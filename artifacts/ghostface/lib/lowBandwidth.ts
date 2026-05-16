/**
 * Pure helpers for the satellite-resilient low-bandwidth mode.
 *
 * Lives in its own module (no React, no React Native, no AsyncStorage) so
 * the classifier, the threshold helpers, the batching debouncer, and the
 * frame-compression codec can be unit-tested with Node's built-in test
 * runner — and so AppContext doesn't grow another inline heuristic block
 * that's only exercised by hand.
 */

import { deflateSync, inflateSync, strToU8, strFromU8 } from "fflate";

export type LinkQuality = "good" | "constrained" | "unknown";

/**
 * User override for low-bandwidth mode.
 *   - `auto`     → derive from current `LinkQuality`
 *   - `forceOn`  → low-bandwidth mode is always on
 *   - `forceOff` → low-bandwidth mode is always off (user accepts the data cost)
 */
export type LowBandwidthMode = "auto" | "forceOn" | "forceOff";

/**
 * Lightweight, monotonically updated metrics fed in by AppContext. These
 * are intentionally observable signals — we can't read modem-level signal
 * strength from JS, but reconnect churn and the gap since the last
 * successful WS auth are reliable proxies for a constrained link.
 */
export interface LinkStats {
  /** Reconnect attempts within the last `RECONNECT_WINDOW_MS`. */
  recentReconnects: number;
  /** Outbox-drain failures within the last `FAILURE_WINDOW_MS`. */
  recentSendFailures: number;
  /** ms since epoch of the last successful WS auth ack. 0 if never. */
  lastAuthAckAt: number;
  /** ms since epoch we first noticed we needed to reconnect. 0 if currently connected. */
  reconnectingSince: number;
}

export const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const FAILURE_WINDOW_MS = 5 * 60 * 1000;
export const STALE_AUTH_MS = 2 * 60 * 1000; // 2 minutes without an ack while trying

/** A "good" link permits this many reconnects in the window before we downgrade. */
export const RECONNECT_CHURN_THRESHOLD = 2;
/** Likewise for outbox-send failures. */
export const SEND_FAILURE_THRESHOLD = 2;

/**
 * Classify the current link based on the observed WS metrics.
 *
 *   - We start in `unknown` until we either succeed an auth ack OR
 *     accumulate enough reconnect churn to call it constrained.
 *   - `constrained` if we've reconnected more than the threshold in the
 *     last 5 min, OR we've been trying to reconnect for more than 2 min
 *     without success, OR the outbox has racked up failures.
 *   - `good` once we've seen a successful auth ack and the churn metrics
 *     are below threshold.
 */
export function classifyLinkQuality(
  stats: LinkStats,
  now: number = Date.now(),
): LinkQuality {
  const hasReconnectChurn = stats.recentReconnects >= RECONNECT_CHURN_THRESHOLD;
  const hasFailureChurn = stats.recentSendFailures >= SEND_FAILURE_THRESHOLD;
  const stuckReconnecting =
    stats.reconnectingSince > 0 && now - stats.reconnectingSince >= STALE_AUTH_MS;

  if (hasReconnectChurn || hasFailureChurn || stuckReconnecting) {
    return "constrained";
  }

  if (stats.lastAuthAckAt > 0) return "good";
  return "unknown";
}

/**
 * Decide whether low-bandwidth mode is active, given the classifier
 * output and the user's override.
 *
 * In `auto`: activate on `constrained` OR `unknown` — Task #111 explicitly
 * calls for automatic activation on "constrained or unknown-quality link"
 * so we don't burn data probing before we know the link is healthy.
 * `forceOn` / `forceOff` always win.
 */
export function isLowBandwidthActive(
  linkQuality: LinkQuality,
  mode: LowBandwidthMode,
): boolean {
  if (mode === "forceOn") return true;
  if (mode === "forceOff") return false;
  return linkQuality === "constrained" || linkQuality === "unknown";
}

/**
 * Client-side WebSocket ping cadence. Stretched when low-bandwidth mode
 * is active so we burn far fewer keepalive bytes on a satellite link.
 *
 * The server's own server→client ping interval is 30 s and we cannot
 * configure that from the client; these constants govern the *client*'s
 * own ping cadence (added by this task).
 */
export const WS_PING_INTERVAL_NORMAL_MS = 25_000;
export const WS_PING_INTERVAL_LBW_MS = 90_000;

export function wsPingIntervalMs(active: boolean): number {
  return active ? WS_PING_INTERVAL_LBW_MS : WS_PING_INTERVAL_NORMAL_MS;
}

/**
 * Reconnect backoff used after a clean WebSocket close. Default is 5 s
 * (matches existing behavior). When low-bandwidth mode is active we
 * stretch it so a returning satellite sliver isn't immediately re-burned
 * by a reconnect storm.
 */
export const WS_RECONNECT_NORMAL_MS = 5_000;
export const WS_RECONNECT_LBW_MS = 60_000;

export function wsReconnectDelayMs(active: boolean): number {
  return active ? WS_RECONNECT_LBW_MS : WS_RECONNECT_NORMAL_MS;
}

/**
 * Reason returned by `sendMessage` when low-bandwidth mode refuses an
 * attachment. The chat screen uses this string as the toast body.
 */
export const LBW_ATTACHMENT_REFUSAL_REASON =
  "Low-bandwidth mode is on — attachments are blocked to save your satellite data.";

/**
 * Outbox batching: when low-bandwidth mode is active, outgoing ciphertexts
 * are pushed to the outbox and drained as a batch after a short debounce
 * window. This is the "batch outgoing ciphertexts" line item from the
 * task — small bursts of typing arrive in one TCP/satellite round trip
 * instead of one per keystroke-message.
 *
 * The actual debounce is implemented in AppContext (closures over WS
 * state); this constant defines the window so it can be unit-tested
 * and centrally adjusted.
 */
export const LBW_BATCH_DEBOUNCE_MS = 1_500;

export function outboxDrainDebounceMs(active: boolean): number {
  // Non-LBW mode: drain immediately (0 ms). LBW: hold for the batch window.
  return active ? LBW_BATCH_DEBOUNCE_MS : 0;
}

// ── Frame compression ──────────────────────────────────────────────────────
// Task #111 calls for "compress the JSON payload before WS send" when in
// low-bandwidth mode. We pack the original wire frame into a `msg-z`
// envelope: `{ type: "msg-z", data: "<base64 of deflate-compressed JSON>" }`.
// The server learns one new branch (decompress, then handle as `msg`); the
// receiver-side path is unchanged because the server delivers the inflated
// `msg` back out to the recipient unmodified.
//
// We DO NOT compress unconditionally — short frames (< MIN_COMPRESS_BYTES)
// gain nothing from deflate and may even grow, and we measure the result
// to avoid sending a *larger* payload. If compression doesn't help, the
// helper returns the frame unchanged.
//
// Honest note: the ciphertext field inside the frame is base64 of high-
// entropy bytes and won't compress. The wins here are JSON envelope keys
// (`type`, `to`, `payload`, `x3dhHeader`) and any structural repetition.
// On real wire samples this is ~10–25%, which is meaningful on a metered
// satellite link.

export const MIN_COMPRESS_BYTES = 256;

/**
 * Base64-encode a Uint8Array using a portable string-builder loop. We
 * avoid `Buffer` (not available in React Native by default) and avoid
 * `String.fromCharCode(...big)` (stack-blows on large arrays).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  // `btoa` is available in modern RN (Hermes ≥ 0.71) and in Node ≥ 16.
  // Fall back to a manual encoder if it isn't.
  if (typeof globalThis.btoa === "function") return globalThis.btoa(bin);
  const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bin.length; i += 3) {
    const a = bin.charCodeAt(i);
    const b = i + 1 < bin.length ? bin.charCodeAt(i + 1) : 0;
    const c = i + 2 < bin.length ? bin.charCodeAt(i + 2) : 0;
    out += B[a >> 2] + B[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bin.length ? B[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bin.length ? B[c & 63] : "=";
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin =
    typeof globalThis.atob === "function"
      ? globalThis.atob(b64)
      : (() => {
          const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          const lookup: Record<string, number> = {};
          for (let i = 0; i < B.length; i++) lookup[B[i]] = i;
          const clean = b64.replace(/=+$/, "");
          let out = "";
          let buffer = 0;
          let bits = 0;
          for (const ch of clean) {
            buffer = (buffer << 6) | lookup[ch];
            bits += 6;
            if (bits >= 8) {
              bits -= 8;
              out += String.fromCharCode((buffer >> bits) & 0xff);
            }
          }
          return out;
        })();
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * If compression actually helps, return a `msg-z` envelope wrapping the
 * deflated JSON of `frame`. Otherwise return the frame unchanged so the
 * caller can serialize it normally.
 *
 * Returns a *string* either way — callers do `ws.send(result)` directly.
 */
export function compressFrameIfBeneficial(frame: unknown): string {
  const json = JSON.stringify(frame);
  if (json.length < MIN_COMPRESS_BYTES) return json;
  try {
    const deflated = deflateSync(strToU8(json), { level: 6 });
    const b64 = bytesToBase64(deflated);
    // ~4/3 base64 overhead. Only ship the compressed form if the on-wire
    // bytes (envelope + base64) are actually smaller than the original.
    const envelope = JSON.stringify({ type: "msg-z", data: b64 });
    if (envelope.length < json.length) return envelope;
    return json;
  } catch (e) {
    // Defensive: deflate should never throw on valid UTF-8 input, but if
    // it ever does we fall back to the uncompressed frame rather than
    // dropping the user's message.
    console.warn("[LBW] compressFrame failed, sending uncompressed:", e);
    return json;
  }
}

/**
 * Inverse of `compressFrameIfBeneficial`. Given an incoming `msg-z`
 * envelope's `data` field, return the inflated JSON string. Throws on
 * malformed input so the caller can respond with a wire error.
 */
export function decompressFrameData(b64: string): string {
  const bytes = base64ToBytes(b64);
  return strFromU8(inflateSync(bytes));
}

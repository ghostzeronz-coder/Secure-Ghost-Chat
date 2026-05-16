/**
 * Pure helpers for the satellite-resilient low-bandwidth mode.
 *
 * Lives in its own module (no React, no React Native, no AsyncStorage) so
 * the classifier and the threshold helpers can be unit-tested with Node's
 * built-in test runner — and so AppContext doesn't grow another inline
 * heuristic block that's only exercised by hand.
 *
 * # Scope (Task #111)
 * The "compression" line item in the task plan is deliberately a no-op in
 * code: the wire payload at this layer is a JSON envelope around already-
 * encrypted (high-entropy) Double Ratchet ciphertext. Generic compression
 * over that yields ~0% savings, and shortening envelope keys would require
 * a coordinated server-side change which is out of scope here. The real
 * wire-size wins delivered by this task come from refusing attachment
 * sends and deferring incoming media downloads. We document this here
 * instead of pretending to compress.
 */

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
 * Note: `unknown` does NOT activate low-bandwidth mode by itself — we'd
 * rather give the user the full-fat experience on first launch and only
 * downgrade once we have evidence the link is hurting.
 */
export function isLowBandwidthActive(
  linkQuality: LinkQuality,
  mode: LowBandwidthMode,
): boolean {
  if (mode === "forceOn") return true;
  if (mode === "forceOff") return false;
  return linkQuality === "constrained";
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

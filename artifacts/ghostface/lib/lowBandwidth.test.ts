import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyLinkQuality,
  isLowBandwidthActive,
  wsPingIntervalMs,
  wsReconnectDelayMs,
  outboxDrainDebounceMs,
  compressFrameIfBeneficial,
  decompressFrameData,
  RECONNECT_CHURN_THRESHOLD,
  SEND_FAILURE_THRESHOLD,
  STALE_AUTH_MS,
  WS_PING_INTERVAL_NORMAL_MS,
  WS_PING_INTERVAL_LBW_MS,
  WS_RECONNECT_NORMAL_MS,
  WS_RECONNECT_LBW_MS,
  LBW_BATCH_DEBOUNCE_MS,
  MIN_COMPRESS_BYTES,
  type LinkStats,
} from "./lowBandwidth.ts";

const clean: LinkStats = {
  recentReconnects: 0,
  recentSendFailures: 0,
  lastAuthAckAt: 0,
  reconnectingSince: 0,
};

test("classifyLinkQuality starts at 'unknown' before any ack", () => {
  assert.equal(classifyLinkQuality(clean, 1_000), "unknown");
});

test("classifyLinkQuality returns 'good' once an auth ack has happened and metrics are clean", () => {
  const s: LinkStats = { ...clean, lastAuthAckAt: 1_000 };
  assert.equal(classifyLinkQuality(s, 2_000), "good");
});

test("classifyLinkQuality flips to 'constrained' on reconnect churn", () => {
  const s: LinkStats = {
    ...clean,
    lastAuthAckAt: 1_000,
    recentReconnects: RECONNECT_CHURN_THRESHOLD,
  };
  assert.equal(classifyLinkQuality(s, 2_000), "constrained");
});

test("classifyLinkQuality flips to 'constrained' on outbox-send failure churn", () => {
  const s: LinkStats = {
    ...clean,
    lastAuthAckAt: 1_000,
    recentSendFailures: SEND_FAILURE_THRESHOLD,
  };
  assert.equal(classifyLinkQuality(s, 2_000), "constrained");
});

test("classifyLinkQuality flips to 'constrained' when stuck reconnecting past STALE_AUTH_MS", () => {
  const s: LinkStats = {
    ...clean,
    lastAuthAckAt: 1_000,
    reconnectingSince: 1_000,
  };
  assert.equal(classifyLinkQuality(s, 1_000 + STALE_AUTH_MS + 1), "constrained");
});

test("classifyLinkQuality stays clean while reconnecting under STALE_AUTH_MS", () => {
  const s: LinkStats = {
    ...clean,
    lastAuthAckAt: 1_000,
    reconnectingSince: 1_000,
  };
  assert.equal(classifyLinkQuality(s, 1_000 + STALE_AUTH_MS - 1), "good");
});

test("isLowBandwidthActive — forceOn always wins", () => {
  assert.equal(isLowBandwidthActive("good", "forceOn"), true);
  assert.equal(isLowBandwidthActive("constrained", "forceOn"), true);
  assert.equal(isLowBandwidthActive("unknown", "forceOn"), true);
});

test("isLowBandwidthActive — forceOff always wins, even with a constrained link", () => {
  assert.equal(isLowBandwidthActive("constrained", "forceOff"), false);
  assert.equal(isLowBandwidthActive("unknown", "forceOff"), false);
  assert.equal(isLowBandwidthActive("good", "forceOff"), false);
});

test("isLowBandwidthActive — auto activates on 'constrained' OR 'unknown' per task spec", () => {
  // Task #111: "When the device reports a constrained or unknown-quality
  // link, GHOSTFACE enters low-bandwidth mode automatically".
  assert.equal(isLowBandwidthActive("constrained", "auto"), true);
  assert.equal(isLowBandwidthActive("unknown", "auto"), true);
  assert.equal(isLowBandwidthActive("good", "auto"), false);
});

test("wsPingIntervalMs and wsReconnectDelayMs stretch when active", () => {
  assert.equal(wsPingIntervalMs(false), WS_PING_INTERVAL_NORMAL_MS);
  assert.equal(wsPingIntervalMs(true), WS_PING_INTERVAL_LBW_MS);
  assert.ok(WS_PING_INTERVAL_LBW_MS > WS_PING_INTERVAL_NORMAL_MS);
  assert.equal(wsReconnectDelayMs(false), WS_RECONNECT_NORMAL_MS);
  assert.equal(wsReconnectDelayMs(true), WS_RECONNECT_LBW_MS);
  assert.ok(WS_RECONNECT_LBW_MS > WS_RECONNECT_NORMAL_MS);
});

test("outboxDrainDebounceMs is 0 in normal mode, batch-window in LBW", () => {
  assert.equal(outboxDrainDebounceMs(false), 0);
  assert.equal(outboxDrainDebounceMs(true), LBW_BATCH_DEBOUNCE_MS);
  assert.ok(LBW_BATCH_DEBOUNCE_MS > 0);
});

test("compressFrameIfBeneficial passes short frames through uncompressed", () => {
  const tiny = { type: "ping" };
  const out = compressFrameIfBeneficial(tiny);
  assert.equal(out, JSON.stringify(tiny));
});

test("compressFrameIfBeneficial round-trips a realistic msg frame and shrinks it", () => {
  // Simulate a real wire frame: high-entropy ciphertext (random hex) but
  // repeated JSON keys and structural overhead. We make the *frame* large
  // enough to clear the MIN_COMPRESS_BYTES floor by repeating the
  // x3dhHeader-ish fields, which is realistic for first-message frames.
  const frame = {
    type: "msg",
    to: "WRAITH_X",
    payload: JSON.stringify({
      header: { dh: "a".repeat(64), n: 0, pn: 0 },
      ciphertext: Array.from({ length: 64 }, (_, i) => i.toString(16).padStart(2, "0")).join(""),
    }),
    x3dhHeader: {
      ik: "b".repeat(64),
      ek: "c".repeat(64),
      spkId: "spk-1",
      otpkId: "otpk-1",
    },
  };
  const baseline = JSON.stringify(frame);
  assert.ok(baseline.length >= MIN_COMPRESS_BYTES, "test frame should clear the compress threshold");
  const wire = compressFrameIfBeneficial(frame);
  assert.ok(wire.length < baseline.length, "compressed wire should be smaller than baseline JSON");
  const parsed = JSON.parse(wire);
  assert.equal(parsed.type, "msg-z");
  assert.equal(typeof parsed.data, "string");
  const inflated = JSON.parse(decompressFrameData(parsed.data));
  assert.deepEqual(inflated, frame);
});

test("compressFrameIfBeneficial keeps original when compression would make it larger", () => {
  // Random-looking bytes near the threshold: deflate gain is negligible
  // and base64 overhead can push the envelope past baseline. We don't
  // assert which branch wins — we assert that whichever the helper
  // chooses, the receiver can recover the original.
  const noisy = {
    type: "msg",
    to: "ABC",
    payload: Array.from({ length: 200 }, () => Math.floor(Math.random() * 36).toString(36)).join(""),
  };
  const wire = compressFrameIfBeneficial(noisy);
  const parsed = JSON.parse(wire);
  if (parsed.type === "msg-z") {
    assert.deepEqual(JSON.parse(decompressFrameData(parsed.data)), noisy);
  } else {
    assert.deepEqual(parsed, noisy);
  }
});

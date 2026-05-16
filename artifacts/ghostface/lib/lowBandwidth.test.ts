/**
 * Unit tests for the low-bandwidth helpers. Runs via:
 *   node --experimental-strip-types --test lib/lowBandwidth.test.ts
 * (Node 24+).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error - Node 24 --experimental-strip-types resolves .ts directly
import {
  classifyLinkQuality,
  isLowBandwidthActive,
  wsPingIntervalMs,
  wsReconnectDelayMs,
  WS_PING_INTERVAL_NORMAL_MS,
  WS_PING_INTERVAL_LBW_MS,
  WS_RECONNECT_NORMAL_MS,
  WS_RECONNECT_LBW_MS,
  RECONNECT_CHURN_THRESHOLD,
  SEND_FAILURE_THRESHOLD,
  STALE_AUTH_MS,
  type LinkStats,
} from "./lowBandwidth.ts";

const NOW = 1_700_000_000_000;
const baseStats: LinkStats = {
  recentReconnects: 0,
  recentSendFailures: 0,
  lastAuthAckAt: 0,
  reconnectingSince: 0,
};

test("classifyLinkQuality starts at 'unknown' before any ack", () => {
  assert.equal(classifyLinkQuality(baseStats, NOW), "unknown");
});

test("classifyLinkQuality returns 'good' once an auth ack has happened and metrics are clean", () => {
  const s: LinkStats = { ...baseStats, lastAuthAckAt: NOW - 5_000 };
  assert.equal(classifyLinkQuality(s, NOW), "good");
});

test("classifyLinkQuality flips to 'constrained' on reconnect churn", () => {
  const s: LinkStats = {
    ...baseStats,
    lastAuthAckAt: NOW - 5_000,
    recentReconnects: RECONNECT_CHURN_THRESHOLD,
  };
  assert.equal(classifyLinkQuality(s, NOW), "constrained");
});

test("classifyLinkQuality flips to 'constrained' on outbox-send failure churn", () => {
  const s: LinkStats = {
    ...baseStats,
    lastAuthAckAt: NOW - 5_000,
    recentSendFailures: SEND_FAILURE_THRESHOLD,
  };
  assert.equal(classifyLinkQuality(s, NOW), "constrained");
});

test("classifyLinkQuality flips to 'constrained' when stuck reconnecting past STALE_AUTH_MS", () => {
  const s: LinkStats = { ...baseStats, reconnectingSince: NOW - STALE_AUTH_MS - 1 };
  assert.equal(classifyLinkQuality(s, NOW), "constrained");
});

test("classifyLinkQuality stays clean while reconnecting under STALE_AUTH_MS", () => {
  const s: LinkStats = {
    ...baseStats,
    lastAuthAckAt: NOW - 60_000,
    reconnectingSince: NOW - (STALE_AUTH_MS - 1_000),
  };
  assert.equal(classifyLinkQuality(s, NOW), "good");
});

test("isLowBandwidthActive — forceOn always wins", () => {
  assert.equal(isLowBandwidthActive("good", "forceOn"), true);
  assert.equal(isLowBandwidthActive("constrained", "forceOn"), true);
  assert.equal(isLowBandwidthActive("unknown", "forceOn"), true);
});

test("isLowBandwidthActive — forceOff always wins, even with a constrained link", () => {
  assert.equal(isLowBandwidthActive("good", "forceOff"), false);
  assert.equal(isLowBandwidthActive("constrained", "forceOff"), false);
  assert.equal(isLowBandwidthActive("unknown", "forceOff"), false);
});

test("isLowBandwidthActive — auto activates only on 'constrained'", () => {
  assert.equal(isLowBandwidthActive("good", "auto"), false);
  assert.equal(isLowBandwidthActive("unknown", "auto"), false);
  assert.equal(isLowBandwidthActive("constrained", "auto"), true);
});

test("wsPingIntervalMs and wsReconnectDelayMs stretch when active", () => {
  assert.equal(wsPingIntervalMs(false), WS_PING_INTERVAL_NORMAL_MS);
  assert.equal(wsPingIntervalMs(true), WS_PING_INTERVAL_LBW_MS);
  assert.ok(WS_PING_INTERVAL_LBW_MS > WS_PING_INTERVAL_NORMAL_MS);
  assert.equal(wsReconnectDelayMs(false), WS_RECONNECT_NORMAL_MS);
  assert.equal(wsReconnectDelayMs(true), WS_RECONNECT_LBW_MS);
  assert.ok(WS_RECONNECT_LBW_MS > WS_RECONNECT_NORMAL_MS);
});

/**
 * Unit tests for evaluateExpiredHandshake.
 *
 * Runs via: node --experimental-strip-types --test lib/expiry.test.ts
 * (Node 24+; the workflow `panic-wipe-silence` does not invoke this — it is
 * a developer-runnable suite that ships alongside the helper.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error - Node 24 --experimental-strip-types resolves .ts directly
import { evaluateExpiredHandshake, type ExpiryConversation } from "./expiry.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function conv(overrides: Partial<ExpiryConversation> = {}): ExpiryConversation {
  return {
    timestamp: NOW - 2 * DAY,
    isRealContact: true,
    pendingX3DHHeader: "header-bytes",
    messages: [{ id: "msg-1", fromMe: true, timestamp: NOW - 2 * DAY }],
    ...overrides,
  };
}

test("seals a real contact whose handshake is older than 24h with no peer reply", () => {
  const r = evaluateExpiredHandshake(conv(), NOW);
  assert.ok(r, "expected expiry result");
  assert.equal(r!.lastMessage, "SELF-DESTRUCTED");
  assert.equal(r!.systemMsg.sealed, true);
  assert.equal(r!.systemMsg.system, true);
  assert.equal(r!.destroyedAt, NOW);
});

test("returns null for fresh handshake (under 24h)", () => {
  const r = evaluateExpiredHandshake(
    conv({
      timestamp: NOW - 1000,
      messages: [{ id: "msg-1", fromMe: true, timestamp: NOW - 1000 }],
    }),
    NOW,
  );
  assert.equal(r, null);
});

test("returns null when peer has ever replied (non-system inbound)", () => {
  const r = evaluateExpiredHandshake(
    conv({
      messages: [
        { id: "msg-1", fromMe: true, timestamp: NOW - 2 * DAY },
        { id: "msg-2", fromMe: false, timestamp: NOW - DAY },
      ],
    }),
    NOW,
  );
  assert.equal(r, null);
});

test("does NOT count a system message as a peer reply", () => {
  const r = evaluateExpiredHandshake(
    conv({
      messages: [
        { id: "msg-1", fromMe: true, timestamp: NOW - 2 * DAY },
        { id: "sys-info-1", fromMe: false, timestamp: NOW - DAY, system: true },
      ],
    }),
    NOW,
  );
  assert.ok(r, "system messages should not block the seal");
});

test("returns null when already destroyed", () => {
  const r = evaluateExpiredHandshake(conv({ destroyedAt: NOW - 1000 }), NOW);
  assert.equal(r, null);
});

test("returns null for mock/sketch contact (isRealContact=false)", () => {
  const r = evaluateExpiredHandshake(conv({ isRealContact: false }), NOW);
  assert.equal(r, null);
});

test("returns null when bootstrap X3DH header is not queued", () => {
  const r = evaluateExpiredHandshake(conv({ pendingX3DHHeader: undefined }), NOW);
  assert.equal(r, null);
});

test("is idempotent — does not re-seal when sys-expired-* already present", () => {
  const r = evaluateExpiredHandshake(
    conv({
      messages: [
        { id: "msg-1", fromMe: true, timestamp: NOW - 2 * DAY },
        { id: "sys-expired-123", fromMe: false, timestamp: NOW - 1000, system: true },
      ],
    }),
    NOW,
  );
  assert.equal(r, null);
});

test("age is anchored to the EARLIEST message — not mutable c.timestamp", () => {
  // c.timestamp keeps getting bumped by retries, but the first message
  // was sent >24h ago. The helper MUST still seal.
  const r = evaluateExpiredHandshake(
    conv({
      timestamp: NOW - 1000,
      messages: [
        { id: "msg-1", fromMe: true, timestamp: NOW - 2 * DAY },
        { id: "msg-2", fromMe: true, timestamp: NOW - 1000 },
      ],
    }),
    NOW,
  );
  assert.ok(r, "earliest message timestamp must drive the age check");
});

test("anchors to c.timestamp only when there are no messages", () => {
  const fresh = evaluateExpiredHandshake(
    conv({ timestamp: NOW - 1000, messages: [] }),
    NOW,
  );
  assert.equal(fresh, null);
  const stale = evaluateExpiredHandshake(
    conv({ timestamp: NOW - 2 * DAY, messages: [] }),
    NOW,
  );
  assert.ok(stale);
});

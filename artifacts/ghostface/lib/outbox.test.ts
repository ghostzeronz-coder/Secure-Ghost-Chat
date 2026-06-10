import { test } from "node:test";
import assert from "node:assert/strict";

import {
  backoffDelayMs,
  backoffMinDelayMs,
  sortByCompose,
  earliestDeferredAt,
  DEFAULT_OUTBOX_BACKOFF,
} from "./outbox.ts";

const cfg = DEFAULT_OUTBOX_BACKOFF;

test("backoffDelayMs grows exponentially up to the cap", () => {
  // Fix rng at the midpoint (0.5 → jitter = 0) so we read the pure
  // exponential value.
  const mid = () => 0.5;
  assert.equal(backoffDelayMs(1, cfg, mid), cfg.baseMs);
  assert.equal(backoffDelayMs(2, cfg, mid), cfg.baseMs * 2);
  assert.equal(backoffDelayMs(3, cfg, mid), cfg.baseMs * 4);
  assert.equal(backoffDelayMs(4, cfg, mid), cfg.baseMs * 8);
  // At attempts=10 the raw exponential would be 2^9 * 2s = ~17 min, so
  // we must be sitting at the cap.
  assert.equal(backoffDelayMs(10, cfg, mid), cfg.capMs);
  // And way past the cap we stay at the cap (no overflow to Infinity).
  assert.equal(backoffDelayMs(200, cfg, mid), cfg.capMs);
});

test("backoffDelayMs respects symmetric jitter bounds", () => {
  // Min jitter (rng→0): exp * (1 - jitterRatio)
  assert.equal(backoffDelayMs(1, cfg, () => 0), Math.floor(cfg.baseMs * (1 - cfg.jitterRatio)));
  // Near-max jitter (rng→1, exclusive): exp * (1 + jitterRatio)
  const top = backoffDelayMs(1, cfg, () => 0.999999);
  assert.ok(top <= Math.floor(cfg.baseMs * (1 + cfg.jitterRatio)));
  assert.ok(top >= Math.floor(cfg.baseMs * (1 + cfg.jitterRatio)) - 1);
});

test("backoffDelayMs final delay never exceeds capMs even with max positive jitter", () => {
  // At the cap, a +25% jitter would otherwise push past 15 min. The
  // final clamp must keep us at or below capMs for any attempt count
  // and any rng draw.
  const rngMax = () => 0.999999;
  for (let a = 1; a < 50; a++) {
    const d = backoffDelayMs(a, cfg, rngMax);
    assert.ok(d <= cfg.capMs, `attempts=${a} produced ${d} > cap ${cfg.capMs}`);
  }
});

test("backoffDelayMs never returns negative", () => {
  // Even with the smallest possible jitter and tiny attempts the value
  // is clamped at 0.
  for (let a = 1; a < 50; a++) {
    assert.ok(backoffDelayMs(a, cfg, () => 0) >= 0);
  }
});

test("backoffMinDelayMs matches the floor of the jittered delay", () => {
  // backoffDelayMs with rng→0 should equal backoffMinDelayMs.
  for (let a = 1; a < 12; a++) {
    assert.equal(backoffDelayMs(a, cfg, () => 0), backoffMinDelayMs(a, cfg));
  }
});

test("sortByCompose orders by createdAt; ties break by id deterministically", () => {
  const input = [
    { id: "c", createdAt: 200 },
    { id: "a", createdAt: 100 },
    { id: "b", createdAt: 100 },
    { id: "d", createdAt: 50 },
  ];
  const out = sortByCompose(input);
  assert.deepEqual(
    out.map((i) => i.id),
    ["d", "a", "b", "c"],
  );
  // Pure function — input untouched.
  assert.equal(input[0].id, "c");
});

test("sortByCompose: order survives a JSON.stringify→parse round trip (persistence audit)", () => {
  // Simulates the AsyncStorage round-trip: items are stringified on
  // write, parsed back on cold start. The on-disk order is irrelevant
  // because the loader sorts on read.
  const items = [
    { id: "z", createdAt: 3 },
    { id: "y", createdAt: 1 },
    { id: "x", createdAt: 2 },
  ];
  const rehydrated = JSON.parse(JSON.stringify(items));
  const sorted = sortByCompose(rehydrated);
  assert.deepEqual(
    sorted.map((i) => i.id),
    ["y", "x", "z"],
  );
});

test("earliestDeferredAt returns the soonest future nextAttemptAt or null", () => {
  const now = 1_000_000;
  assert.equal(earliestDeferredAt([], now), null);
  assert.equal(earliestDeferredAt([{ nextAttemptAt: now - 1 }], now), null);
  assert.equal(
    earliestDeferredAt(
      [
        { nextAttemptAt: now + 5_000 },
        { nextAttemptAt: now + 1_000 },
        { nextAttemptAt: now - 1_000 },
        {},
        { nextAttemptAt: now + 3_000 },
      ],
      now,
    ),
    now + 1_000,
  );
});

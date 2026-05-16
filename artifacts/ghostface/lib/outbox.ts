/**
 * Pure helpers for the resilient outbox (Task #112).
 *
 * The outbox holds outgoing ciphertexts that couldn't be delivered
 * immediately — either the WS was down, the satellite link blipped, or
 * low-bandwidth batching is holding them for a debounce window. This
 * module owns the *policy* pieces that don't need React / RN / storage:
 *
 *   - exponential backoff with jitter (capped at 15 min)
 *   - deterministic ordering by original-compose timestamp
 *
 * Living in its own module keeps these unit-testable with Node's built-in
 * test runner, so we can exercise the backoff curve and the ordering
 * invariant without spinning up the React tree.
 */

export interface BackoffConfig {
  /** First-failure delay (ms). */
  baseMs: number;
  /** Hard ceiling on the delay (ms). The task spec calls for ~15 min. */
  capMs: number;
  /** Symmetric jitter as a fraction of the exponential value (0..1). */
  jitterRatio: number;
}

/**
 * Defaults: 2 s base, 15 min cap, ±25 % jitter.
 *
 * - 2 s base keeps the very first reconnect attempt quick (a transient
 *   WS blip recovers without user-visible delay).
 * - 15 min ceiling is the spec's "don't hammer the link the instant it
 *   returns" guidance — once we've been failing for ~30 min we sit at
 *   the cap until either a foreground transition or a manual retry
 *   kicks a drain.
 * - 25 % jitter is enough to de-correlate retries across a cohort of
 *   devices regaining signal simultaneously without being so noisy that
 *   the next-attempt time loses its meaning to the UI.
 */
export const DEFAULT_OUTBOX_BACKOFF: BackoffConfig = {
  baseMs: 2_000,
  capMs: 15 * 60 * 1000,
  jitterRatio: 0.25,
};

/**
 * Compute the delay (relative to "now") after the Nth consecutive
 * failure. `attempts` is 1-based: 1 means "this is the first retry".
 *
 * Pure function — accepts an `rng` so tests can pin it to a fake clock.
 */
export function backoffDelayMs(
  attempts: number,
  cfg: BackoffConfig = DEFAULT_OUTBOX_BACKOFF,
  rng: () => number = Math.random,
): number {
  const n = attempts < 1 ? 1 : attempts;
  // Math.pow can overflow to Infinity at very large attempt counts; clamp
  // the exponent before the multiplication so we never produce NaN.
  const safeExp = Math.min(n - 1, 30);
  const exp = Math.min(cfg.capMs, cfg.baseMs * Math.pow(2, safeExp));
  // Symmetric jitter in [-jitterRatio, +jitterRatio]. rng() returns
  // [0, 1) so (rng()*2 - 1) is in [-1, 1).
  const jitter = exp * cfg.jitterRatio * (rng() * 2 - 1);
  // Clamp the FINAL delay to capMs, not just the pre-jitter exponential.
  // Without this, a positive-jitter draw at the cap would produce e.g.
  // 18.75 min — violating the spec's "capped at 15 min" guarantee.
  return Math.max(0, Math.min(cfg.capMs, Math.floor(exp + jitter)));
}

/**
 * Lower-bound on the post-jitter delay for a given attempt count. Used
 * by tests and by the retry-timer scheduler to reason about the
 * earliest plausible next attempt.
 */
export function backoffMinDelayMs(
  attempts: number,
  cfg: BackoffConfig = DEFAULT_OUTBOX_BACKOFF,
): number {
  const n = attempts < 1 ? 1 : attempts;
  const safeExp = Math.min(n - 1, 30);
  const exp = Math.min(cfg.capMs, cfg.baseMs * Math.pow(2, safeExp));
  return Math.max(0, Math.floor(exp * (1 - cfg.jitterRatio)));
}

export interface OrderableOutboxItem {
  id: string;
  createdAt: number;
}

/**
 * Sort outbox items by their original compose timestamp. The task spec
 * is explicit: order must be by ORIGINAL compose time, not by retry
 * time, so a message queued at 09:00 always drains before one queued at
 * 10:00 even if the 10:00 one had fewer failures. Ties break by id for
 * determinism across cold-start reads from AsyncStorage.
 */
export function sortByCompose<T extends OrderableOutboxItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Used by the drain loop's retry-timer scheduler: given the current
 * outbox, return the earliest `nextAttemptAt` strictly greater than
 * `now`, or `null` if nothing is deferred. The scheduler converts that
 * timestamp into a setTimeout so we re-drain right when the soonest
 * item becomes due.
 */
export function earliestDeferredAt(
  items: Array<{ nextAttemptAt?: number }>,
  now: number,
): number | null {
  let earliest: number | null = null;
  for (const item of items) {
    const at = item.nextAttemptAt;
    if (typeof at !== "number" || at <= now) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

import { db, ghostNumbersTable, pool } from "@workspace/db";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { vonageClient } from "./vonage";
import { logger } from "./logger";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TICK_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;
const MAX_PER_TICK = 100;
const ROTATION_LOCK_KEY = 7424211918n;

let timer: NodeJS.Timeout | null = null;
let running = false;

function generateDemoMsisdn(country: string): { phoneNumber: string; msisdn: string } {
  const areaCode =
    country === "NZ" ? "+64" :
    country === "AU" ? "+61" :
    country === "US" ? "+1" :
    country === "GB" ? "+44" :
    country === "CA" ? "+1" :
    country === "DE" ? "+49" : "+1";
  const suffix = Math.floor(Math.random() * 9_000_000) + 1_000_000;
  return { phoneNumber: `${areaCode} ${suffix}`, msisdn: `${suffix}` };
}

/**
 * Core rotation logic — exported for reuse in the on-demand rotate-now endpoint.
 * Obtains a new phone number (Vonage or demo), archives the old MSISDN, and
 * updates the DB row.  Pass `resetCountdown: true` to recalculate nextRotationAt
 * based on the number's existing rotateEveryDays schedule.
 */
export async function performRotation(
  row: Pick<typeof ghostNumbersTable.$inferSelect, "id" | "country" | "msisdn" | "rotateEveryDays">,
  opts: { resetCountdown: boolean } = { resetCountdown: false },
): Promise<void> {
  const { id, country, msisdn: oldMsisdn, rotateEveryDays } = row;

  let nextPhone: string;
  let nextMsisdn: string;

  if (!vonageClient.configured()) {
    const demo = generateDemoMsisdn(country);
    nextPhone = demo.phoneNumber;
    nextMsisdn = demo.msisdn;
  } else {
    const available = await vonageClient.searchNumbers(country);
    if (!available.length) {
      throw new Error(`No Vonage numbers available in ${country}`);
    }
    const chosen = available[0];
    await vonageClient.rentNumber(country, chosen.msisdn);
    nextMsisdn = chosen.msisdn;
    nextPhone = `+${chosen.msisdn}`;

    try {
      await vonageClient.releaseNumber(country, oldMsisdn);
    } catch (err) {
      logger.warn({ err, id, oldMsisdn }, "[rotation] Failed to release old MSISDN — continuing");
    }
  }

  const nextRotationAt =
    opts.resetCountdown && rotateEveryDays
      ? new Date(Date.now() + rotateEveryDays * MS_PER_DAY)
      : undefined;

  await db
    .update(ghostNumbersTable)
    .set({
      msisdn: nextMsisdn,
      phoneNumber: nextPhone,
      archivedMsisdns: sql`COALESCE(${ghostNumbersTable.archivedMsisdns}, '[]'::jsonb) || ${JSON.stringify([oldMsisdn])}::jsonb`,
      ...(nextRotationAt !== undefined ? { nextRotationAt } : {}),
    })
    .where(eq(ghostNumbersTable.id, id));

  logger.info({ id, oldMsisdn, nextMsisdn, country }, "[rotation] Rotated ghost number");
}

async function rotateOne(row: typeof ghostNumbersTable.$inferSelect): Promise<void> {
  const { id, country, rotateEveryDays } = row;
  if (!rotateEveryDays || rotateEveryDays <= 0) return;
  try {
    await performRotation(row, { resetCountdown: true });
  } catch (err) {
    // Scheduler path: no available numbers → warn and skip until next tick,
    // matching original "keep current" behaviour.
    logger.warn({ err, id, country }, "[rotation] Could not obtain replacement number — will retry next tick");
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  const lockRes = await pool.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock($1) AS locked`,
    [ROTATION_LOCK_KEY.toString()],
  );
  if (!lockRes.rows[0]?.locked) {
    running = false;
    return;
  }

  try {
    const due = await db
      .select()
      .from(ghostNumbersTable)
      .where(and(
        eq(ghostNumbersTable.status, "active"),
        isNotNull(ghostNumbersTable.nextRotationAt),
        lte(ghostNumbersTable.nextRotationAt, new Date()),
      ))
      .limit(MAX_PER_TICK);

    if (due.length === 0) return;

    logger.info({ count: due.length }, "[rotation] Processing due rotations");

    for (const row of due) {
      try {
        await rotateOne(row);
      } catch (err) {
        logger.error({ err, id: row.id }, "[rotation] Failed — will retry next tick");
      }
    }
  } catch (err) {
    logger.error({ err }, "[rotation] Tick failed");
  } finally {
    await pool.query(`SELECT pg_advisory_unlock($1)`, [ROTATION_LOCK_KEY.toString()]);
    running = false;
  }
}

export function startRotationScheduler(): void {
  if (timer) return;
  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
  logger.info({ intervalMs: TICK_INTERVAL_MS }, "[rotation] Scheduler started");
}

export const __testing = { tick, rotateOne };

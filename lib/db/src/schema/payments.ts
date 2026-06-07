import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * On-chain USDC/Solana payment requests (Task #133).
 *
 * Each row is a single payment intent created when a user selects a paid
 * plan. The `reference` is a freshly generated Solana public key used as the
 * Solana Pay reference so the exact on-chain transaction can be located and
 * validated. Verification is fully automated: the server locates the transfer
 * by reference, checks recipient / USDC mint / exact amount, then marks the
 * request confirmed and records the entitlement.
 *
 * Replay protection: `signature` is UNIQUE, so a given on-chain transaction
 * can redeem at most one payment request (multiple NULLs are allowed by
 * Postgres while requests are still pending).
 */
export const ghostPaymentsTable = pgTable("ghost_payments", {
  id: serial("id").primaryKey(),
  // Solana Pay reference — a unique base58 public key per payment request.
  reference: text("reference").notNull().unique(),
  userId: text("user_id").notNull(),
  plan: text("plan").notNull(),
  // Expected amount in USDC, stored as a decimal string (e.g. "9.99").
  expectedUsdc: text("expected_usdc").notNull(),
  // pending | confirmed | expired
  status: text("status").notNull().default("pending"),
  // Confirmed on-chain transaction signature. UNIQUE → one tx, one redemption.
  signature: text("signature").unique(),
  // Receiving wallet captured at intent time (audit trail).
  recipient: text("recipient").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedAt: timestamp("confirmed_at"),
}, (table) => [index("idx_ghost_payments_user").on(table.userId)]);

/**
 * Active plan entitlement per user. Crypto cannot auto-renew, so this is a
 * pay-per-term record: `activeUntil` is the moment the plan lapses and the
 * user must re-pay. Upserted whenever a payment is confirmed.
 */
export const ghostEntitlementsTable = pgTable("ghost_entitlements", {
  userId: text("user_id").primaryKey(),
  plan: text("plan").notNull(),
  activeUntil: timestamp("active_until").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GhostPayment = typeof ghostPaymentsTable.$inferSelect;
export type GhostEntitlement = typeof ghostEntitlementsTable.$inferSelect;

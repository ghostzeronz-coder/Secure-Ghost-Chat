import {
  pgTable,
  text,
  jsonb,
  timestamp,
  serial,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const ghostNumbersTable = pgTable(
  "ghost_numbers",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull().default("vonage"),
    phoneNumber: text("phone_number").notNull(),
    country: text("country").notNull(),
    capabilities: jsonb("capabilities").notNull().default(["SMS"]),
    status: text("status").notNull().default("active"),
    plan: text("plan").notNull().default("basic"),
    msisdn: text("msisdn").notNull(),
    rotateEveryDays: integer("rotate_every_days"),
    nextRotationAt: timestamp("next_rotation_at"),
    archivedMsisdns: jsonb("archived_msisdns").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Partial index — the rotation scheduler only ever scans rows that have a
    // scheduled rotation, so the index excludes the NULL (no-rotation) rows.
    index("idx_ghost_numbers_next_rotation")
      .on(table.nextRotationAt)
      .where(sql`${table.nextRotationAt} IS NOT NULL`),
  ],
);

export const ghostSmsTable = pgTable("ghost_sms", {
  id: serial("id").primaryKey(),
  numberId: text("number_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  body: text("body").notNull(),
  direction: text("direction").notNull().default("inbound"),
  providerMetadata: jsonb("provider_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Per-user on-demand rotation rate limit (one rotate-now per user per 24h).
 * The rate-limit claim is enforced with a conditional UPSERT in numbers.ts;
 * this schema just provisions the table via `db push`.
 */
export const userRotationLimitsTable = pgTable("user_rotation_limits", {
  userId: text("user_id").primaryKey(),
  lastRotateAt: timestamp("last_rotate_at").notNull(),
});

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  serial,
  integer,
} from "drizzle-orm/pg-core";

export const ghostNumbersTable = pgTable("ghost_numbers", {
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
});

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

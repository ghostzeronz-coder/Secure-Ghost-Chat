import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Stores Bob's long-term public identity keys (IK) and signed prekeys (SPK).
 * These are uploaded once per device registration and are part of the prekey bundle
 * that Alice fetches when initiating a new X3DH session.
 */
export const identityKeysTable = pgTable("identity_keys", {
  id:           serial("id").primaryKey(),
  userId:       text("user_id").notNull().unique(),
  ikPublicKey:  text("ik_public_key").notNull(),
  spkPublicKey: text("spk_public_key").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

/**
 * One-time prekeys (OPKs) for X3DH 4-DH handshake.
 * Each OPK is consumed exactly once during session initiation.
 * When Alice fetches Bob's prekey bundle, one OPK is atomically marked consumed.
 */
export const prekeysTable = pgTable("prekeys", {
  id:         serial("id").primaryKey(),
  userId:     text("user_id").notNull(),
  publicKey:  text("public_key").notNull(),
  consumed:   boolean("consumed").notNull().default(false),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

/**
 * Simple device tokens for authenticating prekey upload operations.
 * Stored as a hash. Only the device that registered can upload their own OPKs.
 */
export const deviceTokensTable = pgTable("device_tokens", {
  id:        serial("id").primaryKey(),
  userId:    text("user_id").notNull().unique(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IdentityKey = typeof identityKeysTable.$inferSelect;
export type PreKey = typeof prekeysTable.$inferSelect;
export type DeviceToken = typeof deviceTokensTable.$inferSelect;

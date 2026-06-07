import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Stores Bob's long-term public identity keys (IK) and signed prekeys (SPK).
 *
 * Security additions (Signal X3DH spec §2.4):
 *   ikSignPublicKey — Ed25519 public key used to verify the SPK signature.
 *                     Separate from the X25519 IK used for DH operations.
 *   spkSignature    — Ed25519 signature of the SPK X25519 public key bytes,
 *                     produced by the device at registration time using ikSign.
 *                     Alice MUST verify this before accepting a prekey bundle.
 *                     Without this, a malicious server can substitute its own SPK
 *                     and perform an undetected man-in-the-middle attack.
 *
 * Nullable for backward compatibility with pre-signature registrations.
 */
export const identityKeysTable = pgTable("identity_keys", {
  id:              serial("id").primaryKey(),
  userId:          text("user_id").notNull().unique(),
  ikPublicKey:     text("ik_public_key").notNull(),
  spkPublicKey:    text("spk_public_key").notNull(),
  ikSignPublicKey: text("ik_sign_public_key"),
  spkSignature:    text("spk_signature"),
  // Post-quantum hybrid handshake (PQXDH). Bob's signed ML-KEM-768 public
  // prekey and its Ed25519 signature (signed with ikSign). Nullable for
  // backward compatibility with pre-PQ registrations → classical-only fallback.
  pqkemPublicKey:  text("pqkem_public_key"),
  pqkemSignature:  text("pqkem_signature"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
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

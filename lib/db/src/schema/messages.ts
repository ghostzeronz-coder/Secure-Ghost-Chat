import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Stores encrypted messages for delivery between devices.
 *
 * Messages are encrypted end-to-end on the sender's device before being stored here.
 * The server never has access to plaintext — it only routes opaque ciphertext blobs.
 *
 * x3dhHeader: present only on the very first message in a conversation (X3DH init).
 *   Contains the sender's IK public key, ephemeral key, and which OPK was consumed,
 *   so the recipient's device can derive the same shared secret without any private
 *   keys being transmitted to the server.
 *
 * delivered: set to true once the message has been pushed to the recipient over
 *   WebSocket OR fetched via the /api/messages/pending poll endpoint.
 */
export const messagesTable = pgTable("messages", {
  id:          serial("id").primaryKey(),
  fromAlias:   text("from_alias").notNull(),
  toAlias:     text("to_alias").notNull(),
  payload:     text("payload").notNull(),
  x3dhHeader:  text("x3dh_header"),
  delivered:   boolean("delivered").notNull().default(false),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type Message = typeof messagesTable.$inferSelect;

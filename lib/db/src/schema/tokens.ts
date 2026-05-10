import { pgTable, serial, text, integer, bigint, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tokenStatusEnum = pgEnum("token_status", ["pending", "deployed", "failed"]);

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  decimals: integer("decimals").notNull().default(9),
  totalSupply: bigint("total_supply", { mode: "number" }).notNull().default(1_000_000_000),
  logoColor: text("logo_color").notNull().default("#00C8FF"),
  status: tokenStatusEnum("status").notNull().default("pending"),
  mintAddress: text("mint_address"),
  deploySignature: text("deploy_signature"),
  explorerUrl: text("explorer_url"),
  network: text("network").default("mainnet-beta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deployedAt: timestamp("deployed_at"),
  notes: text("notes"),
});

export const insertTokenSchema = createInsertSchema(tokensTable).omit({
  id: true,
  createdAt: true,
  deployedAt: true,
  mintAddress: true,
  deploySignature: true,
  explorerUrl: true,
  status: true,
});

export type InsertToken = (typeof insertTokenSchema)["_output"];
export type Token = typeof tokensTable.$inferSelect;

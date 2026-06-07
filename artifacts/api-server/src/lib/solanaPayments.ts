import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Pure config + helpers for USDC-on-Solana payment verification (Task #133).
 *
 * Kept free of Express/DB so the amount/recipient/mint/expiry/term logic can
 * be unit-tested without a network or database.
 */

// Solana USDC mint address (mainnet).
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Placeholder shipped before a real receiving wallet was configured.
export const PLACEHOLDER_WALLET = "GHosTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

export type PlanId = "specter" | "phantom";

export const PLAN_PRICES: Record<PlanId, { usdc: number; label: string }> = {
  specter: { usdc: 9.99, label: "GHOSTFACE SPECTER" },
  phantom: { usdc: 19.99, label: "GHOSTFACE PHANTOM" },
};

export function isPlan(value: unknown): value is PlanId {
  return value === "specter" || value === "phantom";
}

// How long a created payment request stays valid before it expires (minutes).
export const INTENT_TTL_MS = 30 * 60_000;

// How long a confirmed plan stays active before re-payment is required.
export const TERM_DAYS = (() => {
  const raw = Number(process.env.PLAN_TERM_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
})();

const MS_PER_DAY = 24 * 60 * 60_000;

/** Compute when a plan should lapse, given the confirmation time. */
export function computeActiveUntil(from: Date, termDays: number = TERM_DAYS): Date {
  return new Date(from.getTime() + termDays * MS_PER_DAY);
}

/** Validate a base58 Solana address by attempting to construct a PublicKey. */
export function isValidSolanaAddress(addr: string | undefined | null): boolean {
  if (!addr || typeof addr !== "string") return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim())) return false;
  try {
    new PublicKey(addr.trim());
    return true;
  } catch {
    return false;
  }
}

/** The configured receiving wallet, or null if unset/placeholder/invalid. */
export function getReceivingWallet(): string | null {
  const wallet = process.env.GHOST_WALLET_ADDRESS?.trim();
  if (!wallet) return null;
  if (wallet === PLACEHOLDER_WALLET) return null;
  if (!isValidSolanaAddress(wallet)) return null;
  return wallet;
}

export function isWalletConfigured(): boolean {
  return getReceivingWallet() !== null;
}

export const RPC_URL = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";

let connection: Connection | null = null;

/** Lazily-created shared mainnet RPC connection. */
export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, "confirmed");
  }
  return connection;
}

/**
 * Build a Solana Pay transfer-request URL.
 * The `reference` MUST be a unique per-payment public key (not the wallet) so
 * the exact transaction can be located on-chain for verification.
 * https://docs.solanapay.com/spec
 */
export function buildSolanaPayUrl(params: {
  recipient: string;
  amountUsdc: number;
  reference: string;
  label: string;
  memo: string;
}): string {
  const { recipient, amountUsdc, reference, label, memo } = params;
  return [
    `solana:${recipient}`,
    `?amount=${amountUsdc}`,
    `&spl-token=${USDC_MINT}`,
    `&reference=${reference}`,
    `&label=${encodeURIComponent(label)}`,
    `&memo=${encodeURIComponent(memo)}`,
  ].join("");
}

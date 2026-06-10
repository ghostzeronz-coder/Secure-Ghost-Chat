import { describe, it, expect, afterEach } from "vitest";
import {
  USDC_MINT,
  PLACEHOLDER_WALLET,
  PLAN_PRICES,
  isPlan,
  isValidSolanaAddress,
  getReceivingWallet,
  isWalletConfigured,
  buildSolanaPayUrl,
  computeActiveUntil,
} from "../lib/solanaPayments";

// A real, valid base58 Solana address (the USDC mint) used as a stand-in
// for a configured receiving wallet.
const VALID_ADDRESS = USDC_MINT;

const ORIGINAL_WALLET = process.env.GHOST_WALLET_ADDRESS;

afterEach(() => {
  if (ORIGINAL_WALLET === undefined) {
    delete process.env.GHOST_WALLET_ADDRESS;
  } else {
    process.env.GHOST_WALLET_ADDRESS = ORIGINAL_WALLET;
  }
});

describe("plan validation", () => {
  it("accepts the two paid plans", () => {
    expect(isPlan("specter")).toBe(true);
    expect(isPlan("phantom")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isPlan("ghost")).toBe(false);
    expect(isPlan("")).toBe(false);
    expect(isPlan(undefined)).toBe(false);
    expect(isPlan(123)).toBe(false);
  });
  it("has expected prices", () => {
    expect(PLAN_PRICES.specter.usdc).toBe(9.99);
    expect(PLAN_PRICES.phantom.usdc).toBe(19.99);
  });
});

describe("isValidSolanaAddress", () => {
  it("accepts a valid base58 address", () => {
    expect(isValidSolanaAddress(VALID_ADDRESS)).toBe(true);
  });
  it("rejects empty / null / wrong charset / wrong length", () => {
    expect(isValidSolanaAddress("")).toBe(false);
    expect(isValidSolanaAddress(null)).toBe(false);
    expect(isValidSolanaAddress(undefined)).toBe(false);
    expect(isValidSolanaAddress("0OIl")).toBe(false); // contains 0/O/I/l
    expect(isValidSolanaAddress("abc")).toBe(false); // too short
  });
});

describe("getReceivingWallet / isWalletConfigured", () => {
  it("returns null when unset", () => {
    delete process.env.GHOST_WALLET_ADDRESS;
    expect(getReceivingWallet()).toBeNull();
    expect(isWalletConfigured()).toBe(false);
  });
  it("returns null for the placeholder", () => {
    process.env.GHOST_WALLET_ADDRESS = PLACEHOLDER_WALLET;
    expect(getReceivingWallet()).toBeNull();
    expect(isWalletConfigured()).toBe(false);
  });
  it("returns null for an invalid address", () => {
    process.env.GHOST_WALLET_ADDRESS = "not-a-real-address";
    expect(getReceivingWallet()).toBeNull();
  });
  it("returns a valid configured wallet", () => {
    process.env.GHOST_WALLET_ADDRESS = VALID_ADDRESS;
    expect(getReceivingWallet()).toBe(VALID_ADDRESS);
    expect(isWalletConfigured()).toBe(true);
  });
});

describe("buildSolanaPayUrl", () => {
  const url = buildSolanaPayUrl({
    recipient: VALID_ADDRESS,
    amountUsdc: 9.99,
    reference: "RefPubKey1111111111111111111111111111111111",
    label: "GHOSTFACE SPECTER",
    memo: "SPECTER",
  });
  it("targets the recipient", () => {
    expect(url.startsWith(`solana:${VALID_ADDRESS}`)).toBe(true);
  });
  it("encodes the exact amount", () => {
    expect(url).toContain("amount=9.99");
  });
  it("requests the USDC SPL token", () => {
    expect(url).toContain(`spl-token=${USDC_MINT}`);
  });
  it("includes the unique reference (not the wallet)", () => {
    expect(url).toContain("reference=RefPubKey1111111111111111111111111111111111");
    expect(url).not.toContain(`reference=${VALID_ADDRESS}`);
  });
});

describe("computeActiveUntil", () => {
  it("adds the term length in days", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const until = computeActiveUntil(from, 30);
    expect(until.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
  it("defaults to a positive term", () => {
    const from = new Date();
    expect(computeActiveUntil(from).getTime()).toBeGreaterThan(from.getTime());
  });
});

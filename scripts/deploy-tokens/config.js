// ─────────────────────────────────────────────
//  GHOSTFACE Token Deployment — Configuration
//  Edit this file before running deploy.js
// ─────────────────────────────────────────────

export const config = {
  // "mainnet-beta" | "devnet"
  // Always test on devnet first — get free SOL from https://faucet.solana.com
  NETWORK: process.env.NETWORK || "devnet",

  // Your wallet private key.
  // Accepted formats:
  //   • base-58 string  → "5KtP...xR2"
  //   • JSON byte array → "[12,34,56,...]"  (from `solana-keygen` output)
  // WARNING: Keep this private. Never commit this file with a real key.
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY || "",

  // Public address that will receive the initial minted supply.
  // Usually the same wallet as above.
  RECIPIENT_WALLET: process.env.RECIPIENT_WALLET || "",

  // ── Face Dollar (FD) ──────────────────────
  FD: {
    name: "Face Dollar",
    symbol: "FD",
    uri: "https://ghostface.app/tokens/fd-metadata.json", // optional off-chain metadata URI
    decimals: 6,           // USDC-style — 1 FD = 1_000_000 raw units
    supply: 1_000_000_000, // 1 billion FD
    freezeAuthority: true, // keep freeze authority (set false to renounce)
  },

  // ── Casper (CASPER) ───────────────────────
  CASPER: {
    name: "Casper",
    symbol: "CASPER",
    uri: "https://ghostface.app/tokens/casper-metadata.json",
    decimals: 9,           // SOL-style
    supply: 500_000_000,   // 500 million CASPER
    freezeAuthority: true,
  },
};

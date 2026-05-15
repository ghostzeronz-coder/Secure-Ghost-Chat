import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Solana USDC mint address (mainnet)
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Receiving wallet — set GHOST_WALLET_ADDRESS env var to override
const GHOST_WALLET =
  process.env.GHOST_WALLET_ADDRESS || "GHosTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const PLAN_PRICES: Record<string, { usdc: number; label: string }> = {
  specter: { usdc: 9.99, label: "GHOSTFACE SPECTER" },
  phantom: { usdc: 19.99, label: "GHOSTFACE PHANTOM" },
};

// GET /api/crypto/payment-info?plan=specter
router.get("/crypto/payment-info", (req, res) => {
  const plan = (req.query.plan as string)?.toLowerCase();

  if (!plan || !PLAN_PRICES[plan]) {
    return res.status(400).json({
      error: "Invalid plan. Use ?plan=specter or ?plan=phantom",
    });
  }

  const { usdc, label } = PLAN_PRICES[plan];
  const wallet = GHOST_WALLET;

  // Solana Pay URL — https://docs.solanapay.com/spec
  const solanaPayUrl = [
    `solana:${wallet}`,
    `?amount=${usdc}`,
    `&spl-token=${USDC_MINT}`,
    `&label=${encodeURIComponent(label)}`,
    `&memo=${encodeURIComponent(plan.toUpperCase())}`,
    `&reference=${encodeURIComponent(wallet)}`,
  ].join("");

  return res.json({
    wallet,
    usdc,
    currency: "USDC",
    network: "Solana",
    usdcMint: USDC_MINT,
    label,
    solanaPayUrl,
  });
});

export default router;

import { Router, type IRouter } from "express";
import { stripeService } from "../stripeService";

const router: IRouter = Router();

// GET /api/stripe/plans — list all active products with their prices
router.get("/stripe/plans", async (_req, res) => {
  try {
    const products = await stripeService.listActiveProducts();
    res.json({ data: products });
  } catch (err: any) {
    console.error("[stripe/plans]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/checkout — create a Stripe Checkout Session
router.post("/stripe/checkout", async (req, res) => {
  try {
    const { priceId, email } = req.body as { priceId: string; email?: string };
    if (!priceId) {
      return res.status(400).json({ error: "priceId is required" });
    }

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0]
      || process.env.REPLIT_DEV_DOMAIN
      || "localhost";

    const baseUrl = `https://${domain}`;

    const session = await stripeService.createCheckoutSession(
      priceId,
      `${baseUrl}/api/stripe/checkout/success`,
      `${baseUrl}/api/stripe/checkout/cancel`,
      email
    );

    res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("[stripe/checkout]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stripe/checkout/success — redirect target after successful payment
router.get("/stripe/checkout/success", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Payment Complete</title>
      <style>
        body { background: #000; color: #F0F0F0; font-family: monospace;
               display: flex; flex-direction: column; align-items: center;
               justify-content: center; min-height: 100vh; margin: 0; gap: 16px; }
        h1 { color: #00FF88; letter-spacing: 4px; font-size: 20px; }
        p { color: #888; letter-spacing: 2px; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>✓ PAYMENT COMPLETE</h1>
      <p>YOUR GHOST PLAN IS NOW ACTIVE</p>
      <p>YOU CAN CLOSE THIS TAB</p>
    </body>
    </html>
  `);
});

// GET /api/stripe/checkout/cancel — redirect target after cancelled payment
router.get("/stripe/checkout/cancel", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Payment Cancelled</title>
      <style>
        body { background: #000; color: #F0F0F0; font-family: monospace;
               display: flex; flex-direction: column; align-items: center;
               justify-content: center; min-height: 100vh; margin: 0; gap: 16px; }
        h1 { color: #FF3B30; letter-spacing: 4px; font-size: 20px; }
        p { color: #888; letter-spacing: 2px; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>PAYMENT CANCELLED</h1>
      <p>NO CHARGES WERE MADE</p>
      <p>YOU CAN CLOSE THIS TAB</p>
    </body>
    </html>
  `);
});

export default router;

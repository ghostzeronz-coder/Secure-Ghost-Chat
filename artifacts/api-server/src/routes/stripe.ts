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

// POST /api/stripe/seed — create GHOSTFACE products if they don't exist (dev only)
router.post("/stripe/seed", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }
  try {
    const stripe = await (await import("../stripeClient")).getUncachableStripeClient();

    const PLANS = [
      {
        name: "SPECTER",
        description: "Encrypted messaging, VPN, voice changer, and more.",
        monthly: 999,
        yearly: 9900,
      },
      {
        name: "PHANTOM",
        description: "Full GHOSTFACE suite: crypto wallet, panic button, and elite privacy.",
        monthly: 1999,
        yearly: 19900,
      },
    ];

    const results: any[] = [];

    for (const plan of PLANS) {
      const existing = await stripe.products.search({
        query: `name:"${plan.name}" AND active:"true"`,
      });

      let product;
      if (existing.data.length > 0) {
        product = existing.data[0];
      } else {
        product = await stripe.products.create({
          name: plan.name,
          description: plan.description,
          metadata: { ghostface: "true" },
        });
      }

      const existingPrices = await stripe.prices.list({ product: product.id, active: true });
      const prices: any[] = [];

      const hasMonthly = existingPrices.data.find(
        (p) => p.recurring?.interval === "month" && p.unit_amount === plan.monthly
      );
      const hasYearly = existingPrices.data.find(
        (p) => p.recurring?.interval === "year" && p.unit_amount === plan.yearly
      );

      const monthlyPrice = hasMonthly || await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthly,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { ghostface: "true", tier: plan.name.toLowerCase() },
      });

      const yearlyPrice = hasYearly || await stripe.prices.create({
        product: product.id,
        unit_amount: plan.yearly,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { ghostface: "true", tier: plan.name.toLowerCase() },
      });

      prices.push(
        { id: monthlyPrice.id, interval: "month", amount: plan.monthly },
        { id: yearlyPrice.id, interval: "year", amount: plan.yearly }
      );

      results.push({ product: { id: product.id, name: product.name }, prices });
    }

    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error("[stripe/seed]", err.message);
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

    const domain =
      process.env.REPLIT_DOMAINS?.split(",")[0] ||
      process.env.REPLIT_DEV_DOMAIN ||
      "localhost";

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

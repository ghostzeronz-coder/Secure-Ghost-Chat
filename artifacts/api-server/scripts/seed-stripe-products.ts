#!/usr/bin/env tsx
/**
 * Run once after connecting Stripe to seed GHOSTFACE subscription products.
 * Usage: STRIPE_SECRET_KEY=sk_test_... npx tsx artifacts/api-server/scripts/seed-stripe-products.ts
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2025-04-30.basil" as any });

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

async function seed() {
  console.log("Seeding GHOSTFACE subscription products…\n");

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `name:"${plan.name}" AND active:"true"`,
    });

    let product: Stripe.Product;

    if (existing.data.length > 0) {
      product = existing.data[0];
      console.log(`✓ ${plan.name} already exists (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { ghostface: "true" },
      });
      console.log(`+ Created ${plan.name} (${product.id})`);
    }

    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    const hasMonthly = existingPrices.data.some(
      (p) =>
        p.recurring?.interval === "month" &&
        p.unit_amount === plan.monthly
    );
    const hasYearly = existingPrices.data.some(
      (p) =>
        p.recurring?.interval === "year" &&
        p.unit_amount === plan.yearly
    );

    if (!hasMonthly) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthly,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { ghostface: "true", tier: plan.name.toLowerCase() },
      });
      console.log(`  + Monthly price: ${price.id} ($${plan.monthly / 100}/mo)`);
    } else {
      const p = existingPrices.data.find(
        (p) => p.recurring?.interval === "month" && p.unit_amount === plan.monthly
      )!;
      console.log(`  ✓ Monthly price exists: ${p.id}`);
    }

    if (!hasYearly) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.yearly,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { ghostface: "true", tier: plan.name.toLowerCase() },
      });
      console.log(`  + Yearly price: ${price.id} ($${plan.yearly / 100}/yr)`);
    } else {
      const p = existingPrices.data.find(
        (p) => p.recurring?.interval === "year" && p.unit_amount === plan.yearly
      )!;
      console.log(`  ✓ Yearly price exists: ${p.id}`);
    }

    console.log();
  }

  console.log("Done. Copy price IDs into artifacts/ghostface/app/paywall.tsx PLANS array.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

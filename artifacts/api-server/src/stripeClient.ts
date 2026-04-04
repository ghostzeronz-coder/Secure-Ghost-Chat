import Stripe from "stripe";
import { StripeSync, runMigrations } from "stripe-replit-sync";

let _stripeSync: StripeSync | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Connect the Stripe integration in Replit."
    );
  }
  return new Stripe(secretKey, { apiVersion: "2025-04-30.basil" as any });
}

export async function getStripeSync(): Promise<StripeSync> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Connect the Stripe integration in Replit."
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe sync.");
  }

  if (!_stripeSync) {
    _stripeSync = new StripeSync({
      stripeSecretKey: secretKey,
      poolConfig: { connectionString: databaseUrl },
    });
  }

  return _stripeSync;
}

export { runMigrations };

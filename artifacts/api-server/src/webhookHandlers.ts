import { getUncachableStripeClient, getStripeSync } from "./stripeClient";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "Payload must be a Buffer. Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    const sync = await getStripeSync();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      // User-configured webhook: verify signature with their own endpoint secret,
      // then hand the pre-verified event to stripe-replit-sync for DB sync.
      const stripe = await getUncachableStripeClient();
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      await sync.processEvent(event);
    } else {
      // Fallback: stripe-replit-sync manages the webhook endpoint and its secret
      // (created via findOrCreateManagedWebhook on startup).
      await sync.processWebhook(payload, signature);
    }
  }
}

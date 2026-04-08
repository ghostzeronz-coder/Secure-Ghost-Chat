import { getUncachableStripeClient } from "./stripeClient";

export class StripeService {
  async createCheckoutSession(
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    customerEmail?: string,
    trialDays: number = 7
  ) {
    const stripe = await getUncachableStripeClient();
    return stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: trialDays,
      },
      payment_method_collection: "always",
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });
  }

  async listActiveProducts() {
    const stripe = await getUncachableStripeClient();
    const [products, prices] = await Promise.all([
      stripe.products.list({ active: true, limit: 20 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    return products.data.map((product) => ({
      ...product,
      prices: prices.data.filter((p) => p.product === product.id),
    }));
  }
}

export const stripeService = new StripeService();

import { getUncachableStripeClient } from "./stripeClient";

export class StripeService {
  async createCheckoutSession(
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    customerEmail?: string
  ) {
    const stripe = await getUncachableStripeClient();
    return stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });
  }

  async listActiveProducts() {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, limit: 20 });
    const prices = await stripe.prices.list({ active: true, limit: 100 });

    return products.data.map((product) => ({
      ...product,
      prices: prices.data.filter((p) => p.product === product.id),
    }));
  }
}

export const stripeService = new StripeService();

import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync, runMigrations } from "./stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!databaseUrl || !stripeKey) {
    logger.warn(
      "Stripe not configured — skipping Stripe init. " +
      "Set STRIPE_SECRET_KEY to enable payments."
    );
    return;
  }

  try {
    logger.info("Initializing Stripe schema…");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${
      process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost"
    }`;
    await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    logger.info("Stripe webhook configured");

    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.error({ err }, "Stripe initialization error");
  }
}

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

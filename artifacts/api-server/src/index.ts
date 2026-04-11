import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { createWsServer } from "./ws/manager";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init.");
    return;
  }

  try {
    logger.info("Running Stripe DB migrations…");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const domain =
      process.env.REPLIT_DOMAINS?.split(",")[0] ||
      process.env.REPLIT_DEV_DOMAIN ||
      "localhost";

    const webhookUrl = `https://${domain}/api/stripe/webhook`;

    await stripeSync.findOrCreateManagedWebhook(webhookUrl);
    logger.info({ webhookUrl }, "Stripe webhook configured");

    stripeSync
      .syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err: unknown) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.error({ err }, "Stripe initialization error");
  }
}

await initStripe();

const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });
createWsServer(wss);
logger.info("WebSocket server attached at /api/ws");

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});

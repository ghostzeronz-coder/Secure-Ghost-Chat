import { Router, type IRouter, type Request, type Response } from "express";
import { db, ghostNumbersTable, ghostSmsTable, deviceTokensTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { vonageClient } from "../lib/vonage";
import { pool } from "@workspace/db";
import { RateLimiter, getIpKey } from "../lib/rateLimiter";

const router: IRouter = Router();

// 3 number provisions per hour per IP — prevents abuse of paid Vonage API
const provisionLimiter = new RateLimiter({ windowMs: 60 * 60_000, max: 3 });

// 30 SMS inbox fetches per minute per IP
const smsInboxLimiter = new RateLimiter({ windowMs: 60_000, max: 30 });

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ghost_numbers (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      provider    TEXT NOT NULL DEFAULT 'vonage',
      phone_number TEXT NOT NULL,
      country     TEXT NOT NULL,
      capabilities JSONB NOT NULL DEFAULT '["SMS"]',
      status      TEXT NOT NULL DEFAULT 'active',
      plan        TEXT NOT NULL DEFAULT 'basic',
      msisdn      TEXT NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ghost_sms (
      id               SERIAL PRIMARY KEY,
      number_id        TEXT NOT NULL,
      to_user_id       TEXT NOT NULL,
      from_number      TEXT NOT NULL,
      to_number        TEXT NOT NULL,
      body             TEXT NOT NULL,
      direction        TEXT NOT NULL DEFAULT 'inbound',
      provider_metadata JSONB,
      created_at       TIMESTAMP DEFAULT NOW()
    );
  `);
}

runMigrations().catch(console.error);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function getAuthedAlias(req: Request): Promise<string | null> {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const alias = req.query.alias as string | undefined;
  if (!alias) return null;
  const hash = hashToken(token);
  const [row] = await db
    .select()
    .from(deviceTokensTable)
    .where(and(eq(deviceTokensTable.userId, alias.toUpperCase()), eq(deviceTokensTable.tokenHash, hash)));
  return row ? alias.toUpperCase() : null;
}

const COUNTRY_NAMES: Record<string, string> = {
  NZ: "New Zealand",
  AU: "Australia",
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  DE: "Germany",
};

const PLAN_PRICES: Record<string, number> = {
  basic: 4.99,
  private: 9.99,
  phantom: 19.99,
};

// GET /api/numbers — list user's ghost numbers
router.get("/numbers", async (req: Request, res: Response) => {
  try {
    const alias = await getAuthedAlias(req);
    if (!alias) return res.status(401).json({ error: "Unauthorized" });

    const numbers = await db
      .select()
      .from(ghostNumbersTable)
      .where(and(eq(ghostNumbersTable.userId, alias), eq(ghostNumbersTable.status, "active")))
      .orderBy(desc(ghostNumbersTable.createdAt));

    res.json({ data: numbers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/numbers/:id/sms — inbox for a ghost number
router.get("/numbers/:id/sms", async (req: Request, res: Response) => {
  if (!smsInboxLimiter.check(getIpKey(req))) {
    return res.status(429).json({ error: "Too many requests" });
  }
  try {
    const alias = await getAuthedAlias(req);
    if (!alias) return res.status(401).json({ error: "Unauthorized" });

    const numberId = req.params.id;
    const [number] = await db
      .select()
      .from(ghostNumbersTable)
      .where(and(eq(ghostNumbersTable.id, Number(numberId)), eq(ghostNumbersTable.userId, alias)));
    if (!number) return res.status(404).json({ error: "Number not found" });

    const sms = await db
      .select()
      .from(ghostSmsTable)
      .where(eq(ghostSmsTable.numberId, numberId))
      .orderBy(desc(ghostSmsTable.createdAt));

    res.json({ data: sms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/numbers/provision — rent a ghost number
router.post("/numbers/provision", async (req: Request, res: Response) => {
  if (!provisionLimiter.check(getIpKey(req))) {
    return res.status(429).json({ error: "Too many requests. Ghost number provisioning is limited to 3 per hour." });
  }
  try {
    const alias = await getAuthedAlias(req);
    if (!alias) return res.status(401).json({ error: "Unauthorized" });

    const { country = "NZ", plan = "basic" } = req.body;

    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ error: "Invalid plan. Choose: basic, private, phantom" });
    }

    const existing = await db
      .select()
      .from(ghostNumbersTable)
      .where(and(eq(ghostNumbersTable.userId, alias), eq(ghostNumbersTable.status, "active")));

    const maxNumbers = plan === "phantom" ? 2 : 1;
    if (existing.length >= maxNumbers) {
      return res.status(400).json({ error: `Your ${plan} plan allows ${maxNumbers} ghost number(s). Release one first.` });
    }

    let phoneNumber: string;
    let msisdn: string;

    if (!vonageClient.configured()) {
      // Demo mode — generate a realistic-looking ghost number
      const areaCode = country === "NZ" ? "+64" : country === "AU" ? "+61" : country === "US" ? "+1" : country === "GB" ? "+44" : "+1";
      const suffix = Math.floor(Math.random() * 9000000) + 1000000;
      phoneNumber = `${areaCode} ${suffix}`;
      msisdn = `${suffix}`;
    } else {
      const available = await vonageClient.searchNumbers(country);
      if (!available.length) {
        return res.status(404).json({ error: `No numbers available in ${COUNTRY_NAMES[country] ?? country}` });
      }
      const chosen = available[0];
      await vonageClient.rentNumber(country, chosen.msisdn);
      phoneNumber = `+${chosen.msisdn}`;
      msisdn = chosen.msisdn;
    }

    const capabilities = plan === "basic" ? ["SMS"] : ["SMS", "VOICE"];

    const [number] = await db
      .insert(ghostNumbersTable)
      .values({
        userId: alias,
        provider: vonageClient.configured() ? "vonage" : "demo",
        phoneNumber,
        country,
        capabilities,
        status: "active",
        plan,
        msisdn,
      })
      .returning();

    res.status(201).json({ data: number });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/numbers/:id — release a ghost number
router.delete("/numbers/:id", async (req: Request, res: Response) => {
  try {
    const alias = await getAuthedAlias(req);
    if (!alias) return res.status(401).json({ error: "Unauthorized" });

    const numberId = Number(req.params.id);
    const [number] = await db
      .select()
      .from(ghostNumbersTable)
      .where(and(eq(ghostNumbersTable.id, numberId), eq(ghostNumbersTable.userId, alias)));

    if (!number) return res.status(404).json({ error: "Number not found" });

    if (vonageClient.configured()) {
      try {
        await vonageClient.releaseNumber(number.country, number.msisdn);
      } catch {
        // Continue even if Vonage release fails — still mark inactive locally
      }
    }

    await db
      .update(ghostNumbersTable)
      .set({ status: "released" })
      .where(eq(ghostNumbersTable.id, numberId));

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks/sms/inbound — Vonage inbound SMS webhook
router.post("/webhooks/sms/inbound", async (req: Request, res: Response) => {
  try {
    const { msisdn: from, to, text } = req.body;
    if (!to || !from) return res.json({ ok: true });

    const [number] = await db
      .select()
      .from(ghostNumbersTable)
      .where(and(eq(ghostNumbersTable.msisdn, to), eq(ghostNumbersTable.status, "active")));

    if (number) {
      await db.insert(ghostSmsTable).values({
        numberId: String(number.id),
        toUserId: number.userId,
        fromNumber: from,
        toNumber: to,
        body: text ?? "",
        direction: "inbound",
        providerMetadata: req.body,
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/numbers/plans — pricing info
router.get("/numbers/plans", (_req: Request, res: Response) => {
  res.json({
    data: [
      {
        id: "basic",
        name: "BASIC",
        priceNzd: 4.99,
        numbers: 1,
        capabilities: ["SMS"],
        countries: ["NZ", "AU", "US", "GB", "CA"],
        description: "One ghost number, SMS only",
      },
      {
        id: "private",
        name: "PRIVATE",
        priceNzd: 9.99,
        numbers: 1,
        capabilities: ["SMS", "VOICE"],
        countries: ["NZ", "AU", "US", "GB", "CA", "DE"],
        description: "One ghost number, SMS + voice calls",
      },
      {
        id: "phantom",
        name: "PHANTOM",
        priceNzd: 19.99,
        numbers: 2,
        capabilities: ["SMS", "VOICE"],
        countries: ["NZ", "AU", "US", "GB", "CA", "DE"],
        description: "Two ghost numbers, SMS + voice, priority routing",
      },
    ],
  });
});

export default router;

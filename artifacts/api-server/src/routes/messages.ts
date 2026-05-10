import { Router, type IRouter, type Request, type Response } from "express";
import { db, messagesTable, identityKeysTable, deviceTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { RateLimiter, getIpKey } from "../lib/rateLimiter";
import { normalizeAlias } from "../utils/alias";

const router: IRouter = Router();

// 120 message-pending polls per minute per IP (2/sec — ample for normal use)
const pendingPollLimiter = new RateLimiter({ windowMs: 60_000, max: 120 });

// 60 user-exists lookups per minute per IP (prevents alias enumeration)
const userExistsLimiter = new RateLimiter({ windowMs: 60_000, max: 60 });

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
    .where(and(eq(deviceTokensTable.userId, normalizeAlias(alias)), eq(deviceTokensTable.tokenHash, hash)));
  return row ? normalizeAlias(alias) : null;
}

router.get("/users/exists/:alias", async (req: Request, res: Response) => {
  if (!userExistsLimiter.check(getIpKey(req))) {
    return res.status(429).json({ error: "Too many requests" });
  }
  try {
    const alias = normalizeAlias(req.params.alias as string);
    const [row] = await db
      .select({ userId: identityKeysTable.userId })
      .from(identityKeysTable)
      .where(eq(identityKeysTable.userId, alias));

    if (row) {
      return res.json({ exists: true, alias: row.userId });
    }
    return res.status(404).json({ exists: false });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/messages/pending", async (req: Request, res: Response) => {
  if (!pendingPollLimiter.check(getIpKey(req))) {
    return res.status(429).json({ error: "Too many requests" });
  }
  try {
    const alias = await getAuthedAlias(req);
    if (!alias) {
      return res.status(401).json({ error: "Authorization required. Pass alias as query param." });
    }

    const pending = await db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.toAlias, alias), eq(messagesTable.delivered, false)));

    if (pending.length > 0) {
      await Promise.all(
        pending.map((m) =>
          db.update(messagesTable).set({ delivered: true }).where(eq(messagesTable.id, m.id)),
        ),
      );
    }

    return res.json({ messages: pending });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { db, messagesTable, identityKeysTable, deviceTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

const router: IRouter = Router();

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

router.get("/users/exists/:alias", async (req: Request, res: Response) => {
  try {
    const { alias } = req.params;
    const [row] = await db
      .select({ userId: identityKeysTable.userId })
      .from(identityKeysTable)
      .where(eq(identityKeysTable.userId, alias.toUpperCase()));

    if (row) {
      return res.json({ exists: true, alias: row.userId });
    }
    return res.status(404).json({ exists: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/messages/pending", async (req: Request, res: Response) => {
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
    res.status(500).json({ error: err.message });
  }
});

export default router;

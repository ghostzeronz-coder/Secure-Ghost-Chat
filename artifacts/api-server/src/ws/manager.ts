import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { db, messagesTable, deviceTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { logger } from "../lib/logger";

export interface WireMessage {
  type: "auth" | "msg" | "ack" | "ping" | "pong" | "pending";
  token?: string;
  alias?: string;
  to?: string;
  from?: string;
  msgId?: number;
  payload?: string;
  x3dhHeader?: string;
}

interface AuthedSocket {
  ws: WebSocket;
  alias: string;
}

const connectedClients = new Map<string, AuthedSocket>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function validateToken(alias: string, token: string): Promise<boolean> {
  try {
    const hash = hashToken(token);
    const [row] = await db
      .select()
      .from(deviceTokensTable)
      .where(
        and(
          eq(deviceTokensTable.userId, alias),
          eq(deviceTokensTable.tokenHash, hash),
        ),
      );
    return !!row;
  } catch {
    return false;
  }
}

async function deliverPending(alias: string, ws: WebSocket): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.toAlias, alias),
          eq(messagesTable.delivered, false),
        ),
      );

    for (const msg of pending) {
      const wire: WireMessage = {
        type:       "msg",
        msgId:      msg.id,
        from:       msg.fromAlias,
        payload:    msg.payload,
        x3dhHeader: msg.x3dhHeader ?? undefined,
      };
      ws.send(JSON.stringify(wire));
    }

    if (pending.length > 0) {
      const ids = pending.map((m) => m.id);
      await Promise.all(
        ids.map((id) =>
          db
            .update(messagesTable)
            .set({ delivered: true })
            .where(eq(messagesTable.id, id)),
        ),
      );
      logger.info({ alias, count: pending.length }, "Delivered pending messages");
    }
  } catch (err) {
    logger.error({ err, alias }, "Failed to deliver pending messages");
  }
}

export function createWsServer(wss: WebSocketServer): void {
  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let authedAlias: string | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (authedAlias) connectedClients.delete(authedAlias);
      if (pingTimer) clearInterval(pingTimer);
    };

    ws.on("close", cleanup);
    ws.on("error", (err) => {
      logger.warn({ err }, "WebSocket error");
      cleanup();
    });

    ws.on("message", async (raw: Buffer | string) => {
      let msg: WireMessage;
      try {
        msg = JSON.parse(raw.toString()) as WireMessage;
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (msg.type === "auth") {
        if (!msg.alias || !msg.token) {
          ws.send(JSON.stringify({ type: "error", message: "auth requires alias + token" }));
          return;
        }
        const valid = await validateToken(msg.alias, msg.token);
        if (!valid) {
          ws.send(JSON.stringify({ type: "error", message: "auth failed" }));
          ws.close(4001, "Unauthorized");
          return;
        }

        authedAlias = msg.alias.toUpperCase();
        connectedClients.set(authedAlias, { ws, alias: authedAlias });
        ws.send(JSON.stringify({ type: "ack", alias: authedAlias }));
        logger.info({ alias: authedAlias }, "WS client authenticated");

        await deliverPending(authedAlias, ws);

        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
        return;
      }

      if (!authedAlias) {
        ws.send(JSON.stringify({ type: "error", message: "not authenticated" }));
        return;
      }

      if (msg.type === "msg") {
        if (!msg.to || !msg.payload) {
          ws.send(JSON.stringify({ type: "error", message: "msg requires to + payload" }));
          return;
        }

        const toAlias = msg.to.toUpperCase();

        const [stored] = await db
          .insert(messagesTable)
          .values({
            fromAlias:  authedAlias,
            toAlias,
            payload:    msg.payload,
            x3dhHeader: msg.x3dhHeader ?? null,
            delivered:  false,
          })
          .returning();

        const recipient = connectedClients.get(toAlias);
        if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
          const wire: WireMessage = {
            type:       "msg",
            msgId:      stored.id,
            from:       authedAlias,
            payload:    msg.payload,
            x3dhHeader: msg.x3dhHeader ?? undefined,
          };
          recipient.ws.send(JSON.stringify(wire));
          await db
            .update(messagesTable)
            .set({ delivered: true })
            .where(eq(messagesTable.id, stored.id));
          logger.debug({ from: authedAlias, to: toAlias }, "Message delivered live");
        } else {
          logger.debug({ from: authedAlias, to: toAlias }, "Message queued for offline delivery");
        }

        ws.send(JSON.stringify({ type: "ack", msgId: stored.id }));
        return;
      }

      if (msg.type === "ack") {
        if (msg.msgId) {
          await db
            .update(messagesTable)
            .set({ delivered: true })
            .where(eq(messagesTable.id, msg.msgId));
        }
        return;
      }
    });

    ws.send(JSON.stringify({ type: "connected" }));
  });
}

export { connectedClients };

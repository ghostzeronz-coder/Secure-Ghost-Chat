import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { db, messagesTable, deviceTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { logger } from "../lib/logger";
import { normalizeAlias } from "../utils/alias";

export interface WireMessage {
  type:
    | "auth" | "msg" | "ack" | "ping" | "pong" | "pending"
    | "call-ring" | "call-accept" | "call-hangup"
    | "call-offer" | "call-answer" | "call-ice"
    | "sms_inbound";
  token?: string;
  alias?: string;
  to?: string;
  from?: string;
  msgId?: number;
  payload?: string;
  x3dhHeader?: string;
  callId?: string;
  callMode?: string;
  text?: string;
}

// Extend WebSocket with an aliveness flag used by the protocol-level heartbeat.
type LiveSocket = WebSocket & { isAlive: boolean };

interface AuthedSocket {
  ws: LiveSocket;
  alias: string;
}

const connectedClients = new Map<string, AuthedSocket>();

const CALL_SIGNAL_TYPES = new Set([
  "call-ring", "call-accept", "call-hangup",
  "call-offer", "call-answer", "call-ice",
]);

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
  // ── Protocol-level heartbeat ─────────────────────────────────────────────
  // Every 30 s the server sends a native WebSocket ping frame to every client.
  // Clients that fail to respond with a pong within the next interval are
  // terminated.  This catches silently dropped TCP connections that the OS
  // hasn't noticed yet (mobile sleep, NAT timeout, etc.).
  function heartbeat(this: LiveSocket) {
    this.isAlive = true;
  }

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((rawWs) => {
      const ws = rawWs as LiveSocket;
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeatInterval));

  wss.on("connection", (rawWs: WebSocket, _req: IncomingMessage) => {
    const ws = rawWs as LiveSocket;
    ws.isAlive = true;
    ws.on("pong", heartbeat);

    let authedAlias: string | null = null;

    const cleanup = () => {
      if (authedAlias) connectedClients.delete(authedAlias);
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

        authedAlias = normalizeAlias(msg.alias);
        connectedClients.set(authedAlias, { ws, alias: authedAlias });
        ws.send(JSON.stringify({ type: "ack", alias: authedAlias }));
        logger.info({ alias: authedAlias }, "WS client authenticated");

        await deliverPending(authedAlias, ws);
        return;
      }

      if (!authedAlias) {
        ws.send(JSON.stringify({ type: "error", message: "not authenticated" }));
        return;
      }

      // ── Call signalling — ephemeral relay, never persisted ────────────────
      if (CALL_SIGNAL_TYPES.has(msg.type)) {
        if (!msg.to) return;
        const toAlias = normalizeAlias(msg.to);
        const recipient = connectedClients.get(toAlias);
        if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
          recipient.ws.send(JSON.stringify({ ...msg, from: authedAlias }));
          logger.debug({ type: msg.type, from: authedAlias, to: toAlias }, "Call signal relayed");
        } else if (msg.type === "call-ring") {
          // Callee is offline — bounce hangup back to caller immediately
          ws.send(JSON.stringify({ type: "call-hangup", from: toAlias, callId: msg.callId, payload: "offline" }));
          logger.debug({ from: authedAlias, to: toAlias }, "Call ring bounced: callee offline");
        }
        return;
      }

      // ── Text messages ─────────────────────────────────────────────────────
      if (msg.type === "msg") {
        if (!msg.to || !msg.payload) {
          ws.send(JSON.stringify({ type: "error", message: "msg requires to + payload" }));
          return;
        }

        const toAlias = normalizeAlias(msg.to);

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

/**
 * Push a message to a single connected alias over WebSocket.
 * Used for real-time server-initiated events (e.g. inbound SMS).
 * No-ops silently if the alias is offline.
 */
export function broadcastToAlias(alias: string, message: Omit<WireMessage, "token">): void {
  const normalized = normalizeAlias(alias);
  const client = connectedClients.get(normalized);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

export { connectedClients };

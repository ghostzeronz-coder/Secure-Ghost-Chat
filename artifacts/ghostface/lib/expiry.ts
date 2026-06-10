/**
 * Pure expiry predicate for stalled X3DH handshakes. Extracted out of
 * AppContext.tsx so it can be unit-tested without React Native or
 * AsyncStorage in scope. Imported and re-exported from AppContext to
 * preserve the public surface.
 */

export interface ExpiryMessage {
  id: string;
  fromMe: boolean;
  timestamp: number;
  system?: boolean;
}

export interface ExpiryConversation {
  timestamp: number;
  destroyedAt?: number;
  isRealContact?: boolean;
  pendingX3DHHeader?: string;
  messages: ExpiryMessage[];
}

export interface ExpiryResult {
  destroyedAt: number;
  lastMessage: string;
  timestamp: number;
  systemMsg: {
    id: string;
    text: string;
    fromMe: false;
    timestamp: number;
    encrypted: false;
    sealed: true;
    system: true;
  };
}

/**
 * Detect a conversation whose X3DH handshake has expired before completing:
 * the redeemer queued the bootstrap header, the peer never came online,
 * and enough time has passed that we should seal the conversation rather
 * than let it dangle forever.
 *
 * All conditions must hold:
 *   - not already destroyed
 *   - no prior sys-expired-* system message (idempotence)
 *   - real contact (sketch contacts are mocked, never expire)
 *   - bootstrap X3DH header is still queued
 *   - the peer has never sent us a non-system message
 *   - the EARLIEST message (or conversation creation) is older than 24h
 *
 * The age check is anchored to the earliest message timestamp, NOT the
 * mutable c.timestamp — otherwise a flaky session could indefinitely
 * defer sealing by retrying sends.
 */
export function evaluateExpiredHandshake(
  c: ExpiryConversation,
  now: number = Date.now(),
): ExpiryResult | null {
  if (c.destroyedAt) return null;
  if (c.messages.some((m) => m.id.startsWith("sys-expired-"))) return null;
  if (!c.isRealContact) return null;
  if (!c.pendingX3DHHeader) return null;
  const peerEverReplied = c.messages.some((m) => !m.fromMe && !m.system);
  if (peerEverReplied) return null;
  const handshakeStart =
    c.messages.length > 0
      ? Math.min(...c.messages.map((m) => m.timestamp))
      : c.timestamp;
  if (now - handshakeStart <= 24 * 60 * 60 * 1000) return null;
  return {
    destroyedAt: now,
    lastMessage: "SELF-DESTRUCTED",
    timestamp: now,
    systemMsg: {
      id: `sys-expired-${now}`,
      text: "This contact's invite or keys have expired before a secure session could be established. The conversation is sealed.",
      fromMe: false,
      timestamp: now,
      encrypted: false,
      sealed: true,
      system: true,
    },
  };
}

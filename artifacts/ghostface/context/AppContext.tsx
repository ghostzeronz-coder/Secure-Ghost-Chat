import { evaluateExpiredHandshake } from "@/lib/expiry";
import {
  classifyLinkQuality,
  isLowBandwidthActive,
  wsPingIntervalMs,
  wsReconnectDelayMs,
  outboxDrainDebounceMs,
  compressFrameIfBeneficial,
  LBW_ATTACHMENT_REFUSAL_REASON,
  type LinkQuality,
  type LinkStats,
  type LowBandwidthMode,
} from "@/lib/lowBandwidth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  demoKeyForConversation,
  sealedEncryptMessage,
  generateSafetyNumber,
  messageFingerprint,
  type SealedMessage,
} from "@/lib/crypto";
import {
  initSession,
  initSessionFromBundle,
  initSessionAliceWithHeader,
  initSessionBobFromHeader,
  generateOneTimePreKeys,
  ratchetEncrypt,
  ratchetDecrypt,
  isValidDRSession,
  type DRSession,
  type OneTimePreKey,
  type PreKeyBundle,
  type X3DHHeader,
  type RatchetMessage,
} from "@/lib/doubleRatchet";
import { x25519, ed25519 } from "@noble/curves/ed25519.js";
import { randomBytes } from "@noble/hashes/utils.js";

const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");

function generateHexKeypair(): { pub: string; priv: string } {
  const priv = randomBytes(32);
  const pub  = x25519.getPublicKey(priv);
  return { pub: toHex(pub), priv: toHex(priv) };
}

function generateEd25519Keypair(): { pub: string; priv: string } {
  const priv = randomBytes(32);
  const pub  = ed25519.getPublicKey(priv);
  return { pub: toHex(pub), priv: toHex(priv) };
}

function signSPKLocal(spkPubHex: string, ikSignPrivHex: string): string {
  const fromHex = (h: string) => Uint8Array.from(h.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const sig = ed25519.sign(fromHex(spkPubHex), fromHex(ikSignPrivHex));
  return toHex(sig);
}

export type Attachment =
  | {
      kind: "image";
      uri: string;
      width?: number;
      height?: number;
      mimeType?: string;
    }
  | {
      // Photo stored as an encrypted blob on the server. The wire envelope
      // carries only `blobId` + per-blob symmetric `key`; the receiver
      // fetches and decrypts the bytes locally before rendering. `uri` is
      // local-only (sender's preview before send, or receiver's decrypted
      // cache) and is stripped by `wrapPayload`.
      kind: "image-ref";
      blobId: string;
      key: string;
      mimeType?: string;
      width?: number;
      height?: number;
      uri?: string;
    }
  | {
      kind: "file";
      uri: string;
      name: string;
      size?: number;
      mimeType?: string;
    }
  | {
      kind: "audio";
      uri: string;
      durationMs?: number;
      mimeType?: string;
    };

export interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
  encrypted: boolean;
  sealed: boolean;
  ciphertext?: string;
  fingerprint?: string;
  expiresAt?: number;
  pending?: boolean;
  failed?: boolean;
  attachment?: Attachment;
  /**
   * Non-user system event injected into the timeline (e.g. peer self-
   * destructed, invite/key material expired). Rendered as a centered,
   * muted notice — never long-pressable, never editable, never re-sent.
   */
  system?: boolean;
}

export interface OutboxItem {
  id: string;
  conversationId: string;
  text: string;
  attempts?: number;
  attachment?: Attachment;
}

const MAX_OUTBOX_ATTEMPTS = 3;

const ATTACHMENT_ENVELOPE_VERSION = 1;
const ATTACHMENT_ENVELOPE_PREFIX = `{"_gfa":${ATTACHMENT_ENVELOPE_VERSION}`;

function wrapPayload(text: string, attachment?: Attachment): string {
  if (!attachment) return text;
  // image-ref carries a local-only `uri` for the sender's own preview that
  // must NOT be sent over the wire — strip it so the recipient only ever
  // sees the blob reference + key.
  let wireAttachment: Attachment = attachment;
  if (attachment.kind === "image-ref") {
    const { kind, blobId, key, mimeType, width, height } = attachment;
    wireAttachment = { kind, blobId, key, mimeType, width, height };
  }
  return JSON.stringify({ _gfa: ATTACHMENT_ENVELOPE_VERSION, t: text, a: wireAttachment });
}

// Only allow inline base64 data URIs as attachment payloads. This is the
// only transport we control end-to-end through E2EE — any other URI scheme
// (http(s), file, content) would either leak the recipient's IP via a silent
// network fetch when rendered or reference attacker-controlled local
// content. Reject anything else as plain text rather than render it.
const DATA_IMAGE_URI_RE = /^data:image\/(png|jpe?g|gif|webp|heic|heif);base64,[A-Za-z0-9+/=]+$/i;
const DATA_AUDIO_URI_RE = /^data:audio\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i;
const DATA_FILE_URI_RE  = /^data:[a-zA-Z0-9.+/-]+;base64,[A-Za-z0-9+/=]+$/i;
const MAX_ATTACHMENT_NAME_LEN = 200;
// Hard cap on the base64-encoded payload of any attachment. 5 MiB decoded is
// ~6.99 MiB encoded; we round up to 7.5 MiB of base64 chars to leave a small
// margin and still bound memory/decode work. Anything larger is rejected at
// validation time (both on send and on receive) so a malicious peer cannot
// force the client to decode an arbitrarily large blob.
export const MAX_ATTACHMENT_B64_CHARS = 7 * 1024 * 1024 + 512 * 1024;

// Validates a blob reference for the image-ref attachment kind.
const BLOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BLOB_KEY_RE = /^[0-9a-f]{64}$/i;
const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp|heic|heif)$/i;

function isValidAttachment(a: unknown): a is Attachment {
  if (!a || typeof a !== "object") return false;
  const att = a as Record<string, unknown>;

  // image-ref carries blob references instead of an inline data URI.
  if (att.kind === "image-ref") {
    if (typeof att.blobId !== "string" || !BLOB_ID_RE.test(att.blobId)) return false;
    if (typeof att.key !== "string" || !BLOB_KEY_RE.test(att.key)) return false;
    if (att.mimeType !== undefined) {
      if (typeof att.mimeType !== "string" || !IMAGE_MIME_RE.test(att.mimeType)) return false;
    }
    if (att.width !== undefined && typeof att.width !== "number") return false;
    if (att.height !== undefined && typeof att.height !== "number") return false;
    // `uri` is local-only for the sender's preview. A wire payload that
    // contains it is malformed — and if we silently accepted it, a peer
    // could inject any URL (e.g. https://attacker.example/track.png) and
    // force <Image> to fetch it on the receiver, leaking IP/metadata. So
    // any incoming `uri` field is a hard reject; the sender's own copy
    // already passed through `wrapPayload`, which strips it on its way
    // out and never re-runs validation.
    if (att.uri !== undefined) return false;
    return true;
  }

  if (typeof att.uri !== "string") return false;
  if (att.uri.length > MAX_ATTACHMENT_B64_CHARS) return false;
  if (att.mimeType !== undefined && typeof att.mimeType !== "string") return false;

  if (att.kind === "image") {
    if (!DATA_IMAGE_URI_RE.test(att.uri)) return false;
    if (att.width !== undefined && typeof att.width !== "number") return false;
    if (att.height !== undefined && typeof att.height !== "number") return false;
    return true;
  }
  if (att.kind === "audio") {
    if (!DATA_AUDIO_URI_RE.test(att.uri)) return false;
    if (att.durationMs !== undefined && typeof att.durationMs !== "number") return false;
    return true;
  }
  if (att.kind === "file") {
    if (!DATA_FILE_URI_RE.test(att.uri)) return false;
    if (typeof att.name !== "string" || att.name.length === 0 || att.name.length > MAX_ATTACHMENT_NAME_LEN) return false;
    if (att.size !== undefined && typeof att.size !== "number") return false;
    return true;
  }
  return false;
}

function unwrapPayload(plaintext: string): { text: string; attachment?: Attachment } {
  if (!plaintext.startsWith(ATTACHMENT_ENVELOPE_PREFIX)) return { text: plaintext };
  try {
    const parsed = JSON.parse(plaintext) as { _gfa?: unknown; t?: unknown; a?: unknown };
    // Strict schema: any deviation falls back to plain text so legitimate
    // user-typed JSON cannot be reinterpreted as an attachment envelope.
    if (
      parsed._gfa === ATTACHMENT_ENVELOPE_VERSION &&
      typeof parsed.t === "string" &&
      isValidAttachment(parsed.a)
    ) {
      return { text: parsed.t, attachment: parsed.a };
    }
  } catch {
    // fall through — treat as plain text
  }
  return { text: plaintext };
}

function previewForMessage(text: string, attachment?: Attachment): string {
  if (text && text.trim()) return text;
  if (!attachment) return text;
  if (attachment.kind === "image" || attachment.kind === "image-ref") return "📷 Photo";
  if (attachment.kind === "audio") return "🎙 Voice note";
  if (attachment.kind === "file") return `📎 ${attachment.name}`;
  return text;
}

export interface Conversation {
  id: string;
  alias: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  messages: Message[];
  disappearAfterSec?: number;
  safetyNumber?: string;
  drSession?: DRSession;
  pendingX3DHHeader?: string;
  isRealContact?: boolean;
  verified?: boolean;
  /**
   * Set when the peer self-destructed (broadcast a "departed" notice via the
   * server before wiping locally) or their invite/key material has expired
   * with no successful exchange. UI shows a "SELF-DESTRUCTED" badge,
   * disables the composer, and renders a system message in chat.
   */
  destroyedAt?: number;
}

// Pure expiry predicate lives in lib/expiry.ts so it can be unit-tested
// without React Native or AsyncStorage in scope. Re-exported here to keep
// AppContext as the canonical import surface for consumers.
export { evaluateExpiredHandshake };

export interface Transaction {
  id: string;
  type: "send" | "receive";
  token: "FD" | "CASPER";
  amount: number;
  address: string;
  timestamp: number;
}

export interface VPNServer {
  id: string;
  name: string;
  country: string;
  region: string;
  shortRegion: string;
  latency: number;
  flag: string;
}

export interface CallSignal {
  type: string;
  from: string;
  payload?: string;
  callId?: string;
  callMode?: string;
}

export interface IncomingCall {
  callId: string;
  from: string;
  mode: "voice" | "video";
}

interface AppState {
  alias: string | null;
  deviceToken: string | null;
  biometricEnabled: boolean;
  isLocked: boolean;
  isOnboarded: boolean;
  vpnConnected: boolean;
  vpnServer: VPNServer | null;
  conversations: Conversation[];
  fdBalance: number;
  casperBalance: number;
  walletAddress: string;
  transactions: Transaction[];
  dataUsed: number;
  dataLimit: number;
  stripeEmail: string | null;
  stripePublishableKey: string | null;
  subscriptionStatus: { active: boolean; plan: string | null; status: string | null } | null;
  connectedWalletAddress: string | null;
  solBalance: number;
  autoLockTimeout: number | null;
  duressGracePeriod: number;
  language: string;
  incomingCall: IncomingCall | null;
  // Satellite low-bandwidth mode (Task #111). `linkQuality` is the
  // heuristically classified link state, `lowBandwidthMode` is the user
  // override (auto/forceOn/forceOff), and `lowBandwidthActive` is the
  // derived boolean that the rest of the app reads.
  linkQuality: LinkQuality;
  lowBandwidthMode: LowBandwidthMode;
  lowBandwidthActive: boolean;
}

interface AppContextType extends AppState {
  hasPin: boolean;
  hasDuressPin: boolean;
  loadError: string | null;
  setAlias: (alias: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  checkPin: (input: string) => Promise<boolean>;
  checkDuressPin: (input: string) => Promise<boolean>;
  checkPinWithDuress: (input: string) => Promise<{ correct: boolean; isDuress: boolean }>;
  captureCurrentPinForTransition: () => Promise<void>;
  checkPreviousMainPin: (candidate: string) => Promise<boolean>;
  setDuressPin: (pin: string) => Promise<void>;
  clearDuressPin: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setLocked: (locked: boolean) => void;
  connectVPN: (server: VPNServer) => void;
  disconnectVPN: () => void;
  sendMessage: (conversationId: string, text: string, attachment?: Attachment) => { queued: boolean };
  retryMessage: (conversationId: string, messageId: string) => void;
  addConversation: (alias: string) => Promise<{ isReal: boolean }>;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  setDisappearTimer: (conversationId: string, seconds: number | undefined) => void;
  verifyConversation: (conversationId: string) => void;
  panicWipe: () => Promise<void>;
  setStripeEmail: (email: string | null) => Promise<void>;
  checkSubscription: (email: string) => Promise<void>;
  connectWallet: (address: string) => Promise<{ error?: string }>;
  disconnectWallet: () => Promise<void>;
  setAutoLockTimeout: (ms: number | null) => Promise<void>;
  setDuressGracePeriod: (seconds: number) => Promise<void>;
  setLanguage: (code: string) => Promise<void>;
  setLowBandwidthMode: (mode: LowBandwidthMode) => Promise<void>;
  sendCallSignal: (msg: object) => void;
  registerCallListener: (fn: ((s: CallSignal) => void) | null) => void;
  dismissIncomingCall: () => void;
  wsConnected: boolean;
  loaded: boolean;
  vpnAutoReconnecting: boolean;
}

/**
 * Build a Message using Sealed Sender encryption.
 *
 * The sender's alias is embedded INSIDE the ciphertext payload.
 * What would be stored on a server: { to: recipientId, ciphertext: "..." }
 * The from field is completely absent — only the recipient can recover it.
 */
function buildMessage(
  text: string,
  fromMe: boolean,
  convId: string,
  senderAlias: string,
  disappearAfterSec?: number,
  attachment?: Attachment,
): Message {
  const key = demoKeyForConversation(convId);
  let ciphertext: string | undefined;
  let fingerprint: string | undefined;
  let sealed = false;

  try {
    // Sealed sender: senderAlias is encrypted inside the payload, not exposed.
    // When an attachment is present, the JSON envelope (text + attachment) is
    // what gets encrypted, so the recipient recovers both atomically.
    const enc: SealedMessage = sealedEncryptMessage(wrapPayload(text, attachment), senderAlias, key);
    ciphertext = enc.ciphertext;
    fingerprint = messageFingerprint(enc);
    sealed = true;
  } catch {
    // Graceful fallback if noble unavailable (unlikely but safe)
  }

  const expiresAt = disappearAfterSec
    ? Date.now() + disappearAfterSec * 1000
    : undefined;

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    text,
    fromMe,
    timestamp: Date.now(),
    encrypted: true,
    sealed,
    ciphertext,
    fingerprint,
    expiresAt,
    attachment,
  };
}

/**
 * Build the default conversations with fresh DR sessions each call.
 * Called on first launch and after panic wipe — ensures all default
 * conversations are always DR-enabled from the first render.
 */
function createDefaultConversations(): Conversation[] {
  return [];
}

const CALL_SIGNAL_TYPES = new Set([
  "call-ring", "call-accept", "call-hangup",
  "call-offer", "call-answer", "call-ice",
]);

const DEFAULT_TRANSACTIONS: Transaction[] = [];

const VPN_SERVERS: VPNServer[] = [
  { id: "1", name: "US East", country: "United States", region: "New York", shortRegion: "NYC", latency: 12, flag: "🇺🇸" },
  { id: "2", name: "EU West", country: "Germany", region: "Frankfurt", shortRegion: "FRA", latency: 24, flag: "🇩🇪" },
  { id: "3", name: "Asia Pacific", country: "Japan", region: "Tokyo", shortRegion: "TYO", latency: 68, flag: "🇯🇵" },
  { id: "4", name: "Nordic", country: "Sweden", region: "Stockholm", shortRegion: "ARN", latency: 31, flag: "🇸🇪" },
  { id: "5", name: "Offshore", country: "Iceland", region: "Reykjavik", shortRegion: "KEF", latency: 45, flag: "🇮🇸" },
  { id: "6", name: "SE Asia", country: "Singapore", region: "Singapore", shortRegion: "SIN", latency: 92, flag: "🇸🇬" },
];

export { VPN_SERVERS };

const SECURE_PIN_KEY = "ghostface_pin";
const SECURE_DURESS_PIN_KEY = "ghostface_duress_pin";
const CONVERSATIONS_KEY = "ghostface_conversations";
const OUTBOX_KEY = "ghostface_outbox";
const STRIPE_EMAIL_KEY = "stripeEmail";
const CONNECTED_WALLET_KEY = "ghostface_connected_wallet";
const OPK_STORE_KEY = "ghostface_opk_store";
const OPK_BATCH_SIZE = 10;
const DEVICE_TOKEN_KEY = "ghostface_device_token";
const CONTACT_IDENTITY_STORE_KEY = "ghostface_contact_identity_store";
const AUTO_LOCK_TIMEOUT_KEY = "ghostface_auto_lock_timeout";
const DURESS_GRACE_KEY = "ghostface_duress_grace_period";
const LANGUAGE_KEY = "ghostface_language";
const LAST_VPN_SERVER_KEY = "ghostface_last_vpn_server_id";
const LOW_BW_MODE_KEY = "ghostface_low_bandwidth_mode";
const MY_IK_PRIV_KEY = "ghostface_my_ik_priv";
const MY_IK_PUB_KEY = "ghostface_my_ik_pub";
const MY_SPK_PRIV_KEY = "ghostface_my_spk_priv";
const MY_SPK_PUB_KEY = "ghostface_my_spk_pub";
const APP_STORAGE_KEYS = [
  "alias",
  "isOnboarded",
  "biometricEnabled",
  CONVERSATIONS_KEY,
  OUTBOX_KEY,
  STRIPE_EMAIL_KEY,
  CONNECTED_WALLET_KEY,
  OPK_STORE_KEY,
  CONTACT_IDENTITY_STORE_KEY,
  AUTO_LOCK_TIMEOUT_KEY,
  DURESS_GRACE_KEY,
  LANGUAGE_KEY,
  LAST_VPN_SERVER_KEY,
  LOW_BW_MODE_KEY,
] as const;

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return `https://${domain}/api`;
}

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

/**
 * Load the local OPK private-key store from AsyncStorage.
 * The store is a map of { publicKeyHex: privateKeyHex } for unused OPKs.
 */
async function loadOPKStore(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(OPK_STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveOPKStore(store: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(OPK_STORE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn("[OPK] Failed to save OPK store:", err);
  }
}

/**
 * Contact identity store: maps contactAlias → full identity key material.
 * Populated when we simulate registration for a contact in the single-device demo.
 *
 * ikSign* fields: Ed25519 signing key pair (Signal X3DH §2.4).
 * spkSignature:   Ed25519 signature of spkPub bytes signed by ikSignPriv.
 */
interface ContactIdentity {
  ikPub:        string;
  ikPriv:       string;
  spkPub:       string;
  spkPriv:      string;
  ikSignPub?:   string;
  ikSignPriv?:  string;
  spkSignature?: string;
}

async function loadContactIdentityStore(): Promise<Record<string, ContactIdentity>> {
  try {
    const raw = await AsyncStorage.getItem(CONTACT_IDENTITY_STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ContactIdentity>;
  } catch {
    return {};
  }
}

async function saveContactIdentityStore(store: Record<string, ContactIdentity>): Promise<void> {
  try {
    await AsyncStorage.setItem(CONTACT_IDENTITY_STORE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn("[IK] Failed to save contact identity store:", err);
  }
}

/**
 * Register a user's identity with the server.
 * Generates IK (X25519 DH) + SPK (X25519 DH) + ikSign (Ed25519 signing).
 * Signs the SPK with the ikSign private key (Signal X3DH §2.4).
 * Returns the device token and all key material or null on failure.
 */
async function registerWithServer(
  userId: string,
): Promise<{
  token:        string;
  ikPriv:       string;
  ikPub:        string;
  spkPriv:      string;
  spkPub:       string;
  ikSignPriv:   string;
  ikSignPub:    string;
  spkSignature: string;
} | null> {
  const apiBase = getApiBase();
  if (!apiBase) return null;
  try {
    const ik     = generateHexKeypair();
    const spk    = generateHexKeypair();
    const ikSign = generateEd25519Keypair();
    const spkSig = signSPKLocal(spk.pub, ikSign.priv);

    const res = await fetch(`${apiBase}/prekeys/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        ikPublicKey:     ik.pub,
        spkPublicKey:    spk.pub,
        ikSignPublicKey: ikSign.pub,
        spkSignature:    spkSig,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      console.warn("[REGISTER] Server registration failed:", err.error ?? res.status);
      return null;
    }

    const data = await res.json() as { token: string; userId: string };
    console.log(`[REGISTER] Registered ${userId} with server (SPK signed with Ed25519 IK)`);
    return {
      token:        data.token,
      ikPriv:       ik.priv,
      ikPub:        ik.pub,
      spkPriv:      spk.priv,
      spkPub:       spk.pub,
      ikSignPriv:   ikSign.priv,
      ikSignPub:    ikSign.pub,
      spkSignature: spkSig,
    };
  } catch (err) {
    console.warn("[REGISTER] Failed to register with server:", err);
    return null;
  }
}

/**
 * Rotate identity keys for an existing registration.
 * Called when the device token is present but the private keys were lost
 * (e.g. SecureStore cleared on Expo Go reset). Generates fresh IK/SPK,
 * uploads new public keys via PUT /prekeys/:userId/rekey, and returns the
 * new key material for the caller to store.
 */
async function rekeyWithServer(
  userId: string,
  token: string,
): Promise<{
  ikPriv: string; ikPub: string;
  spkPriv: string; spkPub: string;
  ikSignPriv: string; ikSignPub: string;
  spkSignature: string;
} | null> {
  const apiBase = getApiBase();
  if (!apiBase) return null;
  try {
    const ik     = generateHexKeypair();
    const spk    = generateHexKeypair();
    const ikSign = generateEd25519Keypair();
    const spkSig = signSPKLocal(spk.pub, ikSign.priv);

    const res = await fetch(`${apiBase}/prekeys/${encodeURIComponent(userId)}/rekey`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ikPublicKey:     ik.pub,
        spkPublicKey:    spk.pub,
        ikSignPublicKey: ikSign.pub,
        spkSignature:    spkSig,
      }),
    });
    if (!res.ok) {
      console.warn("[REKEY] Server rekey failed:", res.status);
      return null;
    }
    console.log("[REKEY] Identity keys rotated for", userId);
    return { ikPriv: ik.priv, ikPub: ik.pub, spkPriv: spk.priv, spkPub: spk.pub, ikSignPriv: ikSign.priv, ikSignPub: ikSign.pub, spkSignature: spkSig };
  } catch (e) {
    console.warn("[REKEY] Failed:", e);
    return null;
  }
}

/**
 * Simulate registration for a contact (demo only).
 * Generates their IK + SPK + OPKs, uploads them, and stores private keys locally.
 * Returns the contact identity record or null on failure.
 */
async function registerContactForSimulation(
  contactAlias: string,
): Promise<ContactIdentity | null> {
  const apiBase = getApiBase();
  if (!apiBase) return null;
  try {
    const ik     = generateHexKeypair();
    const spk    = generateHexKeypair();
    const ikSign = generateEd25519Keypair();
    const spkSig = signSPKLocal(spk.pub, ikSign.priv);

    const res = await fetch(`${apiBase}/prekeys/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:          contactAlias,
        ikPublicKey:     ik.pub,
        spkPublicKey:    spk.pub,
        ikSignPublicKey: ikSign.pub,
        spkSignature:    spkSig,
      }),
    });

    const identity: ContactIdentity = {
      ikPub:        ik.pub,
      ikPriv:       ik.priv,
      spkPub:       spk.pub,
      spkPriv:      spk.priv,
      ikSignPub:    ikSign.pub,
      ikSignPriv:   ikSign.priv,
      spkSignature: spkSig,
    };

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      // Already registered is OK — reload from local store if possible
      if (res.status === 409) {
        const store = await loadContactIdentityStore();
        return store[contactAlias] ?? null;
      }
      console.warn("[REGISTER] Contact registration failed:", err.error ?? res.status);
      return null;
    }

    const data = await res.json() as { token: string };
    const contactToken = data.token;

    // Upload initial OPKs on behalf of contact (authenticated with their token)
    const opks = generateOneTimePreKeys(OPK_BATCH_SIZE);
    const opkStore = await loadOPKStore();
    for (const opk of opks) {
      opkStore[opk.pub] = opk.priv;
    }
    await saveOPKStore(opkStore);

    await fetch(`${apiBase}/prekeys/${encodeURIComponent(contactAlias)}`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${contactToken}`,
      },
      body: JSON.stringify({ keys: opks.map((k) => k.pub) }),
    });

    // Store contact's identity (both halves — demo only)
    const idStore = await loadContactIdentityStore();
    idStore[contactAlias] = identity;
    await saveContactIdentityStore(idStore);

    console.log(`[REGISTER] Simulated registration for contact ${contactAlias}`);
    return identity;
  } catch (err) {
    console.warn("[REGISTER] Failed to register contact:", contactAlias, err);
    return null;
  }
}

/**
 * Generate a batch of OPKs, save private keys locally, and upload public keys
 * to the server with device-token authentication.
 */
async function generateAndUploadOPKs(userId: string, deviceToken: string): Promise<void> {
  const apiBase = getApiBase();
  if (!apiBase) return;
  try {
    const opks = generateOneTimePreKeys(OPK_BATCH_SIZE);
    const store = await loadOPKStore();
    for (const opk of opks) {
      store[opk.pub] = opk.priv;
    }
    await saveOPKStore(store);

    const res = await fetch(`${apiBase}/prekeys/${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({ keys: opks.map((k) => k.pub) }),
    });
    if (res.ok) {
      console.log(`[OPK] Uploaded ${opks.length} OPKs for ${userId}`);
    } else {
      console.warn(`[OPK] Upload returned ${res.status} for ${userId}`);
    }
  } catch (err) {
    console.warn("[OPK] Failed to upload OPKs:", err);
  }
}

/**
 * Check whether the user's OPK supply is low and replenish if needed.
 */
async function replenishOPKsIfNeeded(userId: string, deviceToken: string): Promise<void> {
  const apiBase = getApiBase();
  if (!apiBase) return;
  try {
    const res = await fetch(`${apiBase}/prekeys/${encodeURIComponent(userId)}/count`, {
      headers: { "Authorization": `Bearer ${deviceToken}` },
    });
    if (!res.ok) return;
    const data = await res.json() as { remaining: number; lowSupply: boolean };
    if (data.lowSupply) {
      await generateAndUploadOPKs(userId, deviceToken);
    }
  } catch {
    // Non-critical — silently ignore
  }
}

/**
 * Fetch the full X3DH prekey bundle for a contact from the server.
 * Atomically consumes one OPK (4-DH) if available, or returns IK+SPK only (3-DH fallback).
 * Also retrieves contact's private identity keys from the local demo store.
 *
 * Demo simulation note:
 *   In a real Signal deployment, the server returns only public keys and Alice
 *   never sees Bob's private keys.  In this single-device demo we generated Bob's
 *   keys locally and stored both halves, so we can compute both sides of the X3DH
 *   handshake to verify correctness.
 */
async function fetchContactBundle(contactAlias: string): Promise<PreKeyBundle | null> {
  const apiBase = getApiBase();
  if (!apiBase) return null;
  try {
    const bundleRes = await fetch(`${apiBase}/prekeys/${encodeURIComponent(contactAlias)}/bundle`);
    if (!bundleRes.ok) {
      console.warn("[BUNDLE] Bundle fetch failed:", bundleRes.status);
      return null;
    }
    const data = await bundleRes.json() as {
      ikPublicKey:     string;
      spkPublicKey:    string;
      opk:             string | null;
      remaining:       number;
      lowSupply:       boolean;
      ikSignPublicKey?: string;
      spkSignature?:   string;
    };

    // Alice uses the OPK public key for her DH4 computation — no private key needed.
    // 3-DH fallback only when server returns opk: null (Bob exhausted his OPK supply).
    const opkPublicKey = data.opk ?? null;

    // Demo simulation: retrieve OPK private key from local store if available.
    // This is only used so Bob's side of the X3DH can be locally verified.
    let opkPrivKey: string | undefined;
    if (opkPublicKey) {
      const opkStore = await loadOPKStore();
      opkPrivKey = opkStore[opkPublicKey];
      if (opkPrivKey) {
        delete opkStore[opkPublicKey];
        await saveOPKStore(opkStore);
      } else {
        console.warn("[BUNDLE] OPK returned but private key not in local demo store (simulation only):", opkPublicKey);
      }
    }

    // Retrieve contact's private identity keys for the demo simulation
    const idStore  = await loadContactIdentityStore();
    const identity = idStore[contactAlias];

    const bundle: PreKeyBundle = {
      ikPublicKey:     data.ikPublicKey,
      spkPublicKey:    data.spkPublicKey,
      opkPublicKey,
      ikSignPublicKey: data.ikSignPublicKey,
      spkSignature:    data.spkSignature,
      ikPrivKey:       identity?.ikPriv,
      spkPrivKey:      identity?.spkPriv,
      opkPrivKey,
    };

    const sigStatus = data.spkSignature ? "✓ SPK signature present" : "⚠ no SPK signature (legacy)";
    console.log(
      opkPublicKey
        ? `[BUNDLE] 4-DH bundle fetched for ${contactAlias} — ${sigStatus}${opkPrivKey ? " (simulation keys available)" : ""}`
        : `[BUNDLE] 3-DH bundle fetched for ${contactAlias} — ${sigStatus} (no OPKs remaining on server)`,
    );

    return bundle;
  } catch (err) {
    console.warn("[BUNDLE] Failed to fetch bundle for contact:", contactAlias, err);
    return null;
  }
}

async function fetchSolBalance(address: string): Promise<number> {
  try {
    const resp = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
    });
    const json = await resp.json();
    return (json?.result?.value ?? 0) / 1e9;
  } catch {
    return 0;
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") { await AsyncStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") { await AsyncStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [hasDuressPin, setHasDuressPin] = useState(false);
  const [vpnAutoReconnecting, setVpnAutoReconnecting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsEverConnectedRef = React.useRef(false);
  const [state, setState] = useState<AppState>({
    alias: null,
    deviceToken: null,
    biometricEnabled: false,
    isLocked: true,
    isOnboarded: false,
    vpnConnected: false,
    vpnServer: null,
    conversations: createDefaultConversations(),
    fdBalance: 0,
    casperBalance: 0,
    walletAddress: "GhFc3...x9mKr4",
    incomingCall: null,
    transactions: DEFAULT_TRANSACTIONS,
    dataUsed: 2.4,
    dataLimit: 10,
    stripeEmail: null,
    stripePublishableKey: null,
    subscriptionStatus: null,
    connectedWalletAddress: null,
    solBalance: 0,
    autoLockTimeout: 5 * 60 * 1000,
    duressGracePeriod: 3,
    language: "en",
    linkQuality: "unknown",
    lowBandwidthMode: "auto",
    lowBandwidthActive: false,
  });

  useEffect(() => {
    async function load() {
      try {
        const [alias, pinValue, duressValue, biometric, onboarded, convData, stripeEmailVal, connectedWallet, autoLockRaw, storedToken, lastVpnServerId, duressGraceRaw, languageRaw, outboxRaw, lowBwRaw] = await Promise.all([
          AsyncStorage.getItem("alias"),
          secureGet(SECURE_PIN_KEY),
          secureGet(SECURE_DURESS_PIN_KEY),
          AsyncStorage.getItem("biometricEnabled"),
          AsyncStorage.getItem("isOnboarded"),
          AsyncStorage.getItem(CONVERSATIONS_KEY),
          AsyncStorage.getItem(STRIPE_EMAIL_KEY),
          AsyncStorage.getItem(CONNECTED_WALLET_KEY),
          AsyncStorage.getItem(AUTO_LOCK_TIMEOUT_KEY),
          secureGet(DEVICE_TOKEN_KEY),
          AsyncStorage.getItem(LAST_VPN_SERVER_KEY),
          AsyncStorage.getItem(DURESS_GRACE_KEY),
          AsyncStorage.getItem(LANGUAGE_KEY),
          AsyncStorage.getItem(OUTBOX_KEY),
          AsyncStorage.getItem(LOW_BW_MODE_KEY),
        ]);

        const hasPinValue = !!pinValue;
        setHasDuressPin(!!duressValue);
        const biometricOn = biometric === "true";
        const isOnboarded = onboarded === "true";

        let conversations: Conversation[] = createDefaultConversations();
        if (convData) {
          try {
            const parsed = JSON.parse(convData);
            if (Array.isArray(parsed)) conversations = parsed;
          } catch (parseErr) {
            console.warn("[AppContext] Failed to parse conversations:", parseErr);
          }
        }

        const DEMO_ALIASES = new Set(["PHANTOM_7", "WRAITH_X", "NULL_PTR"]);
        const beforeCount = conversations.length;
        conversations = conversations.filter(
          (c) => !DEMO_ALIASES.has((c.alias ?? "").toUpperCase())
        );
        if (conversations.length !== beforeCount) {
          AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations)).catch(
            (e) => console.warn("[AppContext] Failed to persist demo cleanup:", e)
          );
        }

        // Ensure every conversation has a valid DR session.
        // Conversations loaded from an older app version (or corrupted storage)
        // may be missing a session or have malformed hex fields — reinitialise
        // those rather than silently operating on bad key material.
        conversations = conversations.map((c) =>
          isValidDRSession(c.drSession) ? c : { ...c, drSession: initSession() }
        );

        let autoLockTimeout: number | null = 5 * 60 * 1000;
        if (autoLockRaw === "null") {
          autoLockTimeout = null;
        } else if (autoLockRaw !== null) {
          const parsed = parseInt(autoLockRaw, 10);
          if (!isNaN(parsed)) autoLockTimeout = parsed;
        }

        const VALID_GRACE = [1, 2, 3, 5];
        let duressGracePeriod = 3;
        if (duressGraceRaw !== null) {
          const parsed = parseInt(duressGraceRaw, 10);
          if (VALID_GRACE.includes(parsed)) duressGracePeriod = parsed;
        }

        const restoredVpnServer = lastVpnServerId
          ? (VPN_SERVERS.find((s) => s.id === lastVpnServerId) ?? null)
          : null;

        const VALID_LANGUAGES = ["en","es","fr","de","ja","zh","ar","pt","ru","ko","hi","it"];
        const language = (languageRaw && VALID_LANGUAGES.includes(languageRaw)) ? languageRaw : "en";

        const VALID_LBW_MODES: LowBandwidthMode[] = ["auto", "forceOn", "forceOff"];
        const lowBandwidthMode: LowBandwidthMode =
          lowBwRaw && (VALID_LBW_MODES as string[]).includes(lowBwRaw)
            ? (lowBwRaw as LowBandwidthMode)
            : "auto";
        // `forceOn` is honoured immediately; otherwise we wait for the
        // classifier to observe link quality before activating.
        const lowBandwidthActive = lowBandwidthMode === "forceOn";

        // Fetch Stripe publishable key in the background (non-blocking)
        const apiBase = getApiBase();
        let stripePublishableKey: string | null = null;
        if (apiBase) {
          fetch(`${apiBase}/stripe/config`)
            .then((r) => r.json())
            .then((d) => {
              if (d?.publishableKey) {
                setState((prev) => ({ ...prev, stripePublishableKey: d.publishableKey }));
              }
            })
            .catch(() => {});
        }

        // Restore the outbox (queued messages pending WS delivery)
        if (outboxRaw) {
          try {
            const parsed = JSON.parse(outboxRaw);
            if (Array.isArray(parsed)) outboxRef.current = parsed;
          } catch { outboxRef.current = []; }
        }

        setHasPin(hasPinValue);
        setState((prev) => ({
          ...prev,
          alias,
          deviceToken: storedToken ?? null,
          biometricEnabled: biometricOn,
          isOnboarded,
          isLocked: true,
          conversations,
          stripeEmail: stripeEmailVal,
          stripePublishableKey,
          connectedWalletAddress: connectedWallet ?? null,
          autoLockTimeout,
          duressGracePeriod,
          language,
          vpnServer: restoredVpnServer,
          // Start disconnected; if a server was saved, show reconnecting for 1.5 s then connect
          vpnConnected: false,
          lowBandwidthMode,
          lowBandwidthActive,
        }));

        if (restoredVpnServer) {
          setVpnAutoReconnecting(true);
          const reconnectTimer = setTimeout(() => {
            setState((prev) => ({ ...prev, vpnConnected: true }));
            setVpnAutoReconnecting(false);
          }, 1500);
          // Store on globalThis so the effect cleanup can clear it if needed
          (globalThis as Record<string, unknown>).__vpnReconnectTimer = reconnectTimer;
        }

        // Fetch SOL balance in background after state is set
        if (connectedWallet) {
          fetchSolBalance(connectedWallet).then((bal) =>
            setState((prev) => ({ ...prev, solBalance: bal }))
          );
        }

        // Self-heal crypto state for returning users.
        // Three cases:
        //   1. No token in SecureStore  → re-register (upserts on the server)
        //   2. Token but no own IK      → rekey
        //   3. Both present             → just top up OPKs if low
        if (alias && onboarded === "true") {
          (async () => {
            try {
              const token = await secureGet(DEVICE_TOKEN_KEY);
              if (!token) {
                console.warn("[AppContext] No device token on mount — re-registering", alias);
                const reg = await registerWithServer(alias);
                if (reg) {
                  await secureSet(DEVICE_TOKEN_KEY, reg.token);
                  await secureSet(MY_IK_PRIV_KEY,  reg.ikPriv);
                  await secureSet(MY_IK_PUB_KEY,   reg.ikPub);
                  await secureSet(MY_SPK_PRIV_KEY, reg.spkPriv);
                  await secureSet(MY_SPK_PUB_KEY,  reg.spkPub);
                  setState((prev) => ({ ...prev, deviceToken: reg.token }));
                  await generateAndUploadOPKs(alias, reg.token);
                  console.log("[AppContext] Re-registration recovered identity for", alias);
                }
                return;
              }
              const ikPriv = await secureGet(MY_IK_PRIV_KEY);
              if (!ikPriv) {
                console.warn("[AppContext] Token present but own IK missing on mount — rekeying", alias);
                const rekey = await rekeyWithServer(alias, token);
                if (rekey) {
                  await secureSet(MY_IK_PRIV_KEY,  rekey.ikPriv);
                  await secureSet(MY_IK_PUB_KEY,   rekey.ikPub);
                  await secureSet(MY_SPK_PRIV_KEY, rekey.spkPriv);
                  await secureSet(MY_SPK_PUB_KEY,  rekey.spkPub);
                  await generateAndUploadOPKs(alias, token);
                  console.log("[AppContext] Rekey recovered identity for", alias);
                }
                return;
              }
              await replenishOPKsIfNeeded(alias, token);
            } catch (e) {
              console.warn("[AppContext] Identity self-heal failed:", e);
            }
          })();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[AppContext] Failed to load persisted state:", msg);
        setLoadError(msg);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  // Purge expired disappearing messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        let changed = false;
        const conversations = prev.conversations.map((c) => {
          const filtered = c.messages.filter((m) => !m.expiresAt || m.expiresAt > now);
          if (filtered.length !== c.messages.length) {
            changed = true;
            return { ...c, messages: filtered };
          }
          return c;
        });
        return changed ? { ...prev, conversations } : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const persistConversations = useCallback(async (convs: Conversation[]) => {
    try {
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convs));
    } catch (err) {
      console.warn("[AppContext] Failed to persist conversations:", err);
    }
  }, []);

  const persistOutbox = useCallback((items: OutboxItem[]) => {
    AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items)).catch(console.error);
  }, []);

  const wsRef = React.useRef<WebSocket | null>(null);
  const callSignalListenerRef = React.useRef<((s: CallSignal) => void) | null>(null);
  const latestStateRef = React.useRef(state);
  const prevMainPinRef = React.useRef<string | null>(null);
  const outboxRef = React.useRef<OutboxItem[]>([]);
  const outboxDrainingRef = React.useRef(false);
  useEffect(() => { latestStateRef.current = state; }, [state]);

  // Seal conversations whose X3DH handshake has expired before completing.
  // Runs once on mount and every 5 minutes thereafter so a stale pending
  // session is detected even when the user never opens the chat or attempts
  // to send a new message. The seal predicate lives in
  // evaluateExpiredHandshake — see its docstring for the conditions.
  // Placed AFTER latestStateRef so the ref is in scope when the closure runs.
  useEffect(() => {
    const sweep = () => {
      // Read current conversations from the latest-state ref so the next
      // array is computed deterministically OUTSIDE setState. We commit
      // with a passthrough setState call and persist in the same tick,
      // avoiding StrictMode replay re-running side effects.
      const current = latestStateRef.current.conversations;
      let changed = false;
      const next = current.map((c) => {
        const expiry = evaluateExpiredHandshake(c);
        if (!expiry) return c;
        changed = true;
        return {
          ...c,
          destroyedAt: expiry.destroyedAt,
          lastMessage: expiry.lastMessage,
          timestamp: expiry.timestamp,
          messages: [...c.messages, expiry.systemMsg],
        };
      });
      if (!changed) return;
      setState((prev) => ({ ...prev, conversations: next }));
      AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(next)).catch((err) =>
        console.warn("[AppContext] Failed to persist expired-handshake seal:", err)
      );
    };
    sweep();
    const interval = setInterval(sweep, 5 * 60_000);
    return () => clearInterval(interval);
  }, []);

  const setAlias = useCallback(async (alias: string) => {
    try {
      await AsyncStorage.setItem("alias", alias);
      await AsyncStorage.setItem("isOnboarded", "true");
      setState((prev) => ({ ...prev, alias, isOnboarded: true, isLocked: false }));
      (async () => {
        try {
          const existing = await secureGet(DEVICE_TOKEN_KEY);
          if (!existing) {
            const reg = await registerWithServer(alias);
            if (reg) {
              await secureSet(DEVICE_TOKEN_KEY, reg.token);
              await secureSet(MY_IK_PRIV_KEY, reg.ikPriv);
              await secureSet(MY_IK_PUB_KEY, reg.ikPub);
              await secureSet(MY_SPK_PRIV_KEY, reg.spkPriv);
              await secureSet(MY_SPK_PUB_KEY, reg.spkPub);
              setState((prev) => ({ ...prev, deviceToken: reg.token }));
              await generateAndUploadOPKs(alias, reg.token);
            }
          } else {
            // Token persisted but in-memory state was never seeded (first
            // run after onboarding). Hydrate it so screens that need the
            // bearer token (e.g. GHOST NUMBER) work without a reload.
            setState((prev) => (prev.deviceToken ? prev : { ...prev, deviceToken: existing }));
            // Token present — check that own private keys are also stored.
            // If they're missing (e.g. SecureStore was cleared after a
            // previous registration), rotate keys on the server so this
            // device can resume real X3DH sessions.
            const ikPriv = await secureGet(MY_IK_PRIV_KEY);
            if (!ikPriv) {
              console.warn("[AppContext] Device token found but own IK missing — rekeying");
              const rekey = await rekeyWithServer(alias, existing);
              if (rekey) {
                await secureSet(MY_IK_PRIV_KEY, rekey.ikPriv);
                await secureSet(MY_IK_PUB_KEY, rekey.ikPub);
                await secureSet(MY_SPK_PRIV_KEY, rekey.spkPriv);
                await secureSet(MY_SPK_PUB_KEY, rekey.spkPub);
                await generateAndUploadOPKs(alias, existing);
              }
            }
            await generateAndUploadOPKs(alias, existing);
          }
        } catch (e) {
          console.warn("[AppContext] Background registration failed:", e);
        }
      })();
    } catch (err) {
      console.error("[AppContext] Failed to save alias:", err);
      throw err;
    }
  }, []);

  const setPin = useCallback(async (pin: string) => {
    try {
      await secureSet(SECURE_PIN_KEY, pin);
      setHasPin(true);
    } catch (err) {
      console.error("[AppContext] Failed to save PIN:", err);
      throw err;
    }
  }, []);

  const checkPin = useCallback(async (input: string): Promise<boolean> => {
    try {
      const stored = await secureGet(SECURE_PIN_KEY);
      return stored === input;
    } catch (err) {
      console.error("[AppContext] Failed to check PIN:", err);
      return false;
    }
  }, []);

  const checkDuressPin = useCallback(async (input: string): Promise<boolean> => {
    try {
      const stored = await secureGet(SECURE_DURESS_PIN_KEY);
      return stored !== null && stored === input;
    } catch (err) {
      console.error("[AppContext] Failed to check duress PIN:", err);
      return false;
    }
  }, []);

  const captureCurrentPinForTransition = useCallback(async (): Promise<void> => {
    try {
      prevMainPinRef.current = await secureGet(SECURE_PIN_KEY);
    } catch (err) {
      console.error("[AppContext] Failed to capture PIN for transition:", err);
      prevMainPinRef.current = null;
    }
  }, []);

  const checkPreviousMainPin = useCallback(async (candidate: string): Promise<boolean> => {
    return prevMainPinRef.current !== null && prevMainPinRef.current === candidate;
  }, []);

  const checkPinWithDuress = useCallback(async (input: string): Promise<{ correct: boolean; isDuress: boolean }> => {
    try {
      const [stored, duress] = await Promise.all([
        secureGet(SECURE_PIN_KEY),
        secureGet(SECURE_DURESS_PIN_KEY),
      ]);
      if (stored === input) return { correct: true, isDuress: false };
      if (duress && duress === input) return { correct: true, isDuress: true };
      return { correct: false, isDuress: false };
    } catch (err) {
      console.error("[AppContext] Failed to check PIN with duress:", err);
      return { correct: false, isDuress: false };
    }
  }, []);

  const setDuressPin = useCallback(async (pin: string) => {
    try {
      await secureSet(SECURE_DURESS_PIN_KEY, pin);
      setHasDuressPin(true);
    } catch (err) {
      console.error("[AppContext] Failed to save duress PIN:", err);
      throw err;
    }
  }, []);

  const clearDuressPin = useCallback(async () => {
    try {
      await secureDelete(SECURE_DURESS_PIN_KEY);
      await AsyncStorage.removeItem(DURESS_GRACE_KEY);
      setHasDuressPin(false);
      setState((prev) => ({ ...prev, duressGracePeriod: 3 }));
    } catch (err) {
      console.error("[AppContext] Failed to clear duress PIN:", err);
      throw err;
    }
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem("biometricEnabled", String(enabled));
      setState((prev) => ({ ...prev, biometricEnabled: enabled }));
    } catch (err) {
      console.error("[AppContext] Failed to save biometric setting:", err);
      throw err;
    }
  }, []);

  // ── Satellite low-bandwidth mode (Task #111) ────────────────────────────
  // We don't have NetInfo wired up (no native module installed). Instead we
  // observe what we already control — WebSocket reconnect churn, outbox
  // failures, and the gap since the last successful auth ack — and feed
  // those into a pure classifier (lib/lowBandwidth.ts).
  const linkStatsRef = React.useRef<LinkStats>({
    recentReconnects: 0,
    recentSendFailures: 0,
    lastAuthAckAt: 0,
    reconnectingSince: 0,
  });
  // Ref mirror of `state.lowBandwidthActive` so the WS effect can pick the
  // right ping cadence / reconnect delay without re-running on every flip.
  const lbwActiveRef = React.useRef(false);

  // Keep `lbwActiveRef` in lockstep with state regardless of which path
  // mutated it (persisted load on cold start, panicWipe reset, classifier
  // recompute). The local setters update the ref themselves, but this
  // belt-and-suspenders effect guarantees the WS ping/reconnect cadence
  // is always reading the authoritative value.
  useEffect(() => {
    lbwActiveRef.current = state.lowBandwidthActive;
  }, [state.lowBandwidthActive]);

  // ── Outbox drain debouncer (LBW batching) ───────────────────────────
  // sendMessage in LBW mode pushes ciphertexts onto the outbox and calls
  // scheduleOutboxDrain() instead of invoking ws.send directly. This lets
  // a burst of rapid sends collapse into one debounced drain so the
  // satellite link sees one batched round trip rather than N separate
  // frames. We route through a ref because `drainOutbox` is declared
  // further down the component body (after sendMessage) — the ref is
  // wired up by a useEffect below once drainOutbox is in scope.
  const drainOutboxRef = React.useRef<(() => Promise<void>) | null>(null);
  const outboxDrainTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleOutboxDrain = useCallback(() => {
    if (outboxDrainTimerRef.current) {
      clearTimeout(outboxDrainTimerRef.current);
      outboxDrainTimerRef.current = null;
    }
    const delay = outboxDrainDebounceMs(lbwActiveRef.current);
    const fire = () => {
      outboxDrainTimerRef.current = null;
      drainOutboxRef.current?.().catch((e) => console.error("[Outbox] scheduled drain failed:", e));
    };
    if (delay === 0) {
      fire();
    } else {
      outboxDrainTimerRef.current = setTimeout(fire, delay);
    }
  }, []);

  const recomputeLinkQuality = useCallback(() => {
    const lq = classifyLinkQuality(linkStatsRef.current);
    setState((prev) => {
      const active = isLowBandwidthActive(lq, prev.lowBandwidthMode);
      if (prev.linkQuality === lq && prev.lowBandwidthActive === active) {
        lbwActiveRef.current = active;
        return prev;
      }
      lbwActiveRef.current = active;
      return { ...prev, linkQuality: lq, lowBandwidthActive: active };
    });
  }, []);

  const setLowBandwidthMode = useCallback(async (mode: LowBandwidthMode) => {
    try {
      await AsyncStorage.setItem(LOW_BW_MODE_KEY, mode);
      setState((prev) => {
        const active = isLowBandwidthActive(prev.linkQuality, mode);
        lbwActiveRef.current = active;
        return { ...prev, lowBandwidthMode: mode, lowBandwidthActive: active };
      });
    } catch (err) {
      console.error("[AppContext] Failed to save low-bandwidth mode:", err);
      throw err;
    }
  }, []);

  // Decay the churn counters once a minute so a brief satellite hiccup
  // doesn't keep low-bandwidth mode latched on forever after the link
  // recovers. Also re-classifies in case nothing else triggered a recompute.
  useEffect(() => {
    const t = setInterval(() => {
      const s = linkStatsRef.current;
      s.recentReconnects = Math.max(0, s.recentReconnects - 1);
      s.recentSendFailures = Math.max(0, s.recentSendFailures - 1);
      recomputeLinkQuality();
    }, 60_000);
    return () => clearInterval(t);
  }, [recomputeLinkQuality]);

  const setLocked = useCallback((locked: boolean) => {
    setState((prev) => ({ ...prev, isLocked: locked }));
  }, []);

  const setAutoLockTimeout = useCallback(async (ms: number | null) => {
    try {
      await AsyncStorage.setItem(AUTO_LOCK_TIMEOUT_KEY, ms === null ? "null" : String(ms));
      setState((prev) => ({ ...prev, autoLockTimeout: ms }));
    } catch (err) {
      console.error("[AppContext] Failed to save autoLockTimeout:", err);
      throw err;
    }
  }, []);

  const setDuressGracePeriod = useCallback(async (seconds: number) => {
    const VALID_GRACE = [1, 2, 3, 5];
    const validated = VALID_GRACE.includes(seconds) ? seconds : 3;
    try {
      await AsyncStorage.setItem(DURESS_GRACE_KEY, String(validated));
      setState((prev) => ({ ...prev, duressGracePeriod: validated }));
    } catch (err) {
      console.error("[AppContext] Failed to save duressGracePeriod:", err);
      throw err;
    }
  }, []);

  const connectVPN = useCallback((server: VPNServer) => {
    setState((prev) => ({ ...prev, vpnConnected: true, vpnServer: server }));
    AsyncStorage.setItem(LAST_VPN_SERVER_KEY, server.id).catch((err) =>
      console.warn("[VPN] Failed to persist last VPN server:", err)
    );
  }, []);

  const disconnectVPN = useCallback(() => {
    setState((prev) => ({ ...prev, vpnConnected: false, vpnServer: null }));
  }, []);

  const deleteMessage = useCallback((conversationId: string, messageId: string) => {
    setState((prev) => {
      const updated = prev.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
          : c
      );
      persistConversations(updated);
      return { ...prev, conversations: updated };
    });
  }, [persistConversations]);

  const clearConversation = useCallback((conversationId: string) => {
    setState((prev) => {
      const updated = prev.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [], lastMessage: "Chat cleared.", unread: 0 }
          : c
      );
      persistConversations(updated);
      return { ...prev, conversations: updated };
    });
  }, [persistConversations]);

  const deleteConversation = useCallback((conversationId: string) => {
    setState((prev) => {
      const updated = prev.conversations.filter((c) => c.id !== conversationId);
      persistConversations(updated);
      return { ...prev, conversations: updated };
    });
  }, [persistConversations]);

  const setDisappearTimer = useCallback((conversationId: string, seconds: number | undefined) => {
    setState((prev) => {
      const updated = prev.conversations.map((c) =>
        c.id === conversationId ? { ...c, disappearAfterSec: seconds } : c
      );
      persistConversations(updated);
      return { ...prev, conversations: updated };
    });
  }, [persistConversations]);

  const verifyConversation = useCallback((conversationId: string) => {
    setState((prev) => {
      const updated = prev.conversations.map((c) =>
        c.id === conversationId ? { ...c, verified: !c.verified } : c
      );
      persistConversations(updated);
      return { ...prev, conversations: updated };
    });
  }, [persistConversations]);

  const sendMessage = useCallback(
    (conversationId: string, text: string, attachment?: Attachment): { queued: boolean } => {
      const conv = latestStateRef.current.conversations.find((c) => c.id === conversationId);
      if (!conv) return { queued: false };
      if (!text.trim() && !attachment) return { queued: false };

      // Low-bandwidth refusal — defensive guard. The chat composer also
      // gates attachment pickers up-front, but if anything slips through
      // (programmatic call, race after toggle, retry of a queued send)
      // we refuse here too rather than burn satellite data on a photo.
      if (attachment && latestStateRef.current.lowBandwidthActive) {
        Alert.alert("Low-bandwidth mode", LBW_ATTACHMENT_REFUSAL_REASON);
        return { queued: false };
      }

      const myAlias = latestStateRef.current.alias ?? "GHOST_USER";
      const isRealContact = conv.isRealContact ?? false;
      const previewText = previewForMessage(text, attachment);

      // For real contacts, verify the WebSocket is open BEFORE advancing the
      // ratchet. Advancing the ratchet state without delivering the message
      // causes an unrecoverable desync — the receiver's chain key will be
      // behind the sender's and every subsequent message will fail to decrypt.
      if (isRealContact) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== 1) {
          // WS is down — queue plaintext for delivery on reconnect.
          // We do NOT advance the ratchet here; drainOutbox will encrypt
          // at the moment of actual delivery, preserving ratchet ordering.
          const pendingId = `pending-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
          const outboxItem: OutboxItem = { id: pendingId, conversationId, text, attempts: 0, attachment };
          const nextOutbox = [...outboxRef.current, outboxItem];
          outboxRef.current = nextOutbox;
          persistOutbox(nextOutbox);
          const pendingMsg: Message = {
            id: pendingId,
            text,
            fromMe: true,
            timestamp: Date.now(),
            encrypted: false,
            sealed: false,
            pending: true,
            attachment,
          };
          setState((prev) => {
            const updated = prev.conversations.map((c) =>
              c.id === conversationId
                ? { ...c, messages: [...c.messages, pendingMsg], lastMessage: previewText, timestamp: Date.now(), unread: 0 }
                : c
            );
            persistConversations(updated);
            return { ...prev, conversations: updated };
          });
          console.warn("[WS] Offline — message queued:", pendingId);
          return { queued: true };
        }
      }

      let aliceMsg: RatchetMessage | undefined;
      let updatedDRSession = conv.drSession;

      if (conv.drSession) {
        let drSession = conv.drSession;
        let attempts = 0;
        const wireText = wrapPayload(text, attachment);
        while (attempts < 2) {
          try {
            const { state: newAlice, message: msg } = ratchetEncrypt(drSession.alice, wireText);
            if (isRealContact) {
              updatedDRSession = { ...drSession, alice: newAlice, lastAliceHeader: msg.header };
            } else {
              const { state: newBob } = ratchetDecrypt(drSession.bob, msg);
              updatedDRSession = { alice: newAlice, bob: newBob, lastAliceHeader: msg.header, usedOPK: drSession.usedOPK ?? false };
            }
            aliceMsg = msg;
            break;
          } catch (e) {
            console.error(`[DR] Encrypt attempt ${attempts + 1} failed:`, e);
            drSession = initSession();
            attempts += 1;
          }
        }
        if (!aliceMsg) {
          console.error("[DR] Aborting send: could not encrypt with DR after reinit");
          const failedMsg: Message = {
            id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            text,
            fromMe: true,
            timestamp: Date.now(),
            encrypted: false,
            sealed: false,
            failed: true,
            attachment,
          };
          setState((prev) => {
            const updated = prev.conversations.map((c) =>
              c.id === conversationId
                ? { ...c, messages: [...c.messages, failedMsg], lastMessage: previewText, timestamp: Date.now(), unread: 0 }
                : c
            );
            persistConversations(updated);
            return { ...prev, conversations: updated };
          });
          Alert.alert("Send failed", "Message could not be encrypted. Please try again.");
          return { queued: false };
        }
      }

      const expiresAt = conv.disappearAfterSec
        ? Date.now() + conv.disappearAfterSec * 1000
        : undefined;

      const newMsg: Message = conv.drSession && aliceMsg
        ? {
            id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            text,
            fromMe: true,
            timestamp: Date.now(),
            encrypted: true,
            sealed: true,
            ciphertext: aliceMsg.ciphertext,
            fingerprint: `DR:${aliceMsg.ciphertext.slice(0, 8).toUpperCase()}`,
            expiresAt,
            attachment,
          }
        : buildMessage(text, true, conversationId, myAlias, conv.disappearAfterSec, attachment);

      const headerToSend = conv.pendingX3DHHeader;

      // For real contacts: send over WebSocket FIRST, then commit the advanced
      // ratchet state to React state. If the send throws for any reason, we
      // bail before persisting — keeping sender and receiver in sync.
      //
      // Low-bandwidth mode short-circuit: when LBW is active, we route the
      // outgoing message through the outbox + a debounced drain instead of
      // an immediate ws.send. Successive rapid sends accumulate in the
      // outbox and then drain together (see scheduleOutboxDrain below),
      // which is the "batch outgoing ciphertexts" line item from the task.
      // We DO NOT advance the ratchet here in that path — drainOutbox
      // encrypts at delivery time so ordering still matches the receiver.
      if (isRealContact && aliceMsg && latestStateRef.current.lowBandwidthActive) {
        const pendingId = `pending-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        const outboxItem: OutboxItem = { id: pendingId, conversationId, text, attempts: 0, attachment };
        const nextOutbox = [...outboxRef.current, outboxItem];
        outboxRef.current = nextOutbox;
        persistOutbox(nextOutbox);
        const pendingMsg: Message = {
          id: pendingId,
          text,
          fromMe: true,
          timestamp: Date.now(),
          encrypted: false,
          sealed: false,
          pending: true,
          attachment,
        };
        setState((prev) => {
          const updated = prev.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, pendingMsg], lastMessage: previewText, timestamp: Date.now(), unread: 0 }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        });
        scheduleOutboxDrain();
        return { queued: true };
      }

      if (isRealContact && aliceMsg) {
        const ws = wsRef.current;
        if (ws && ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({
              type: "msg",
              to: conv.alias,
              payload: JSON.stringify(aliceMsg),
              x3dhHeader: headerToSend,
            }));
          } catch (e) {
            console.error("[WS] send() threw — aborting ratchet commit", e);
            const wsFailedMsg: Message = {
              ...newMsg,
              failed: true,
              pending: false,
            };
            setState((prev) => {
              const updated = prev.conversations.map((c) =>
                c.id === conversationId
                  ? { ...c, messages: [...c.messages, wsFailedMsg], lastMessage: previewText, timestamp: Date.now(), unread: 0 }
                  : c
              );
              persistConversations(updated);
              return { ...prev, conversations: updated };
            });
            Alert.alert("Send failed", "Message could not be sent. Tap RETRY to try again.");
            return { queued: false };
          }
        } else {
          // WS became unavailable between the guard check and here (race).
          // Queue the message so it delivers on reconnect instead of being lost.
          console.warn("[WS] Socket closed before send — queuing message for retry");
          const pendingId = `pending-${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
          const outboxItem: OutboxItem = { id: pendingId, conversationId, text, attempts: 0, attachment };
          const nextOutbox = [...outboxRef.current, outboxItem];
          outboxRef.current = nextOutbox;
          persistOutbox(nextOutbox);
          const pendingMsg: Message = {
            id: pendingId,
            text,
            fromMe: true,
            timestamp: Date.now(),
            encrypted: false,
            sealed: false,
            pending: true,
            attachment,
          };
          setState((prev) => {
            const updated = prev.conversations.map((c) =>
              c.id === conversationId
                ? { ...c, messages: [...c.messages, pendingMsg], lastMessage: previewText, timestamp: Date.now(), unread: 0 }
                : c
            );
            persistConversations(updated);
            return { ...prev, conversations: updated };
          });
          return { queued: true };
        }
      }

      setState((prev) => {
        const updated = prev.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, newMsg],
                lastMessage: previewText,
                timestamp: Date.now(),
                unread: 0,
                drSession: updatedDRSession,
                // Clear the pending X3DH header only for real contacts after a
                // confirmed send. Non-real contacts don't use this field.
                pendingX3DHHeader: isRealContact ? undefined : c.pendingX3DHHeader,
              }
            : c
        );
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });

      if (!isRealContact) {
        const delay = 1500 + Math.random() * 1000;
        // Satisfy return type — non-real contacts deliver synchronously
        // (return at end of callback)
        const REPLY_POOL = [
          "Understood. Signal secure.",
          "Roger. Transmission encrypted.",
          "Copy. Awaiting further instructions.",
          "Confirmed. No trace detected.",
          "Acknowledged. Channel open.",
        ];
        const replyText = REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
        setTimeout(() => {
          setState((prev) => {
            const c2 = prev.conversations.find((c) => c.id === conversationId);
            if (!c2) return prev;

            let replyMsg: Message;
            let updSess = c2.drSession;

            if (c2.drSession) {
              let ds = c2.drSession;
              let bobMsg: RatchetMessage | undefined;
              let att = 0;
              while (att < 2) {
                try {
                  const { state: newBob, message: msg } = ratchetEncrypt(ds.bob, replyText);
                  const { state: newAlice } = ratchetDecrypt(ds.alice, msg);
                  updSess = { alice: newAlice, bob: newBob, lastAliceHeader: null, usedOPK: ds.usedOPK ?? false };
                  bobMsg = msg;
                  break;
                } catch (e) {
                  console.error(`[DR] Reply attempt ${att + 1} failed:`, e);
                  ds = initSession();
                  att += 1;
                }
              }
              if (!bobMsg) {
                console.error("[DR] Aborting reply: could not encrypt with DR after reinit");
                return prev;
              }
              const exp = c2.disappearAfterSec ? Date.now() + c2.disappearAfterSec * 1000 : undefined;
              replyMsg = {
                id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
                text: replyText,
                fromMe: false,
                timestamp: Date.now(),
                encrypted: true,
                sealed: true,
                ciphertext: bobMsg.ciphertext,
                fingerprint: `DR:${bobMsg.ciphertext.slice(0, 8).toUpperCase()}`,
                expiresAt: exp,
              };
            } else {
              replyMsg = buildMessage(replyText, false, conversationId, c2.alias ?? "GHOST", c2.disappearAfterSec);
            }

            const updated = prev.conversations.map((c) =>
              c.id === conversationId
                ? { ...c, messages: [...c.messages, replyMsg!], lastMessage: replyText, timestamp: Date.now(), drSession: updSess }
                : c
            );
            persistConversations(updated);
            return { ...prev, conversations: updated };
          });
        }, delay);
      }
      return { queued: false };
    },
    [persistConversations, persistOutbox]
  );

  const addConversation = useCallback(
    async (alias: string) => {
      const aliasUpper = alias.toUpperCase();
      const apiBase = getApiBase();

      // Step 1: Check if the user actually exists on the server
      let userExistsOnServer = false;
      if (apiBase) {
        try {
          const checkRes = await fetch(`${apiBase}/users/exists/${encodeURIComponent(aliasUpper)}`);
          userExistsOnServer = checkRes.ok;
        } catch {
          // Server unreachable — fall back to simulation mode
        }
      }

      let bundle: PreKeyBundle | null = null;

      if (userExistsOnServer) {
        // Real user: fetch their actual public prekey bundle (no simulation)
        bundle = await fetchContactBundle(aliasUpper);
      } else {
        // Not found on server — simulate their registration for single-device demo
        await registerContactForSimulation(aliasUpper);
        bundle = await fetchContactBundle(aliasUpper);
      }

      // Step 3: Initiate the X3DH session.
      // If real user + own keys available → use real X3DH (initSessionAliceWithHeader).
      // Otherwise → fall back to single-device simulation (initSessionFromBundle / initSession).
      let drSession: DRSession;
      let usedOPK = false;
      let pendingX3DHHeader: string | undefined;

      if (userExistsOnServer && bundle) {
        // Try real X3DH first (requires own stored IK/SPK private keys)
        try {
          const [myIKPriv, myIKPub, mySpkPriv, mySpkPub] = await Promise.all([
            secureGet(MY_IK_PRIV_KEY),
            secureGet(MY_IK_PUB_KEY),
            secureGet(MY_SPK_PRIV_KEY),
            secureGet(MY_SPK_PUB_KEY),
          ]);

          let ikPrivFinal = myIKPriv;
          let ikPubFinal  = myIKPub;
          let spkPrivFinal = mySpkPriv;
          let spkPubFinal  = mySpkPub;

          if (!ikPrivFinal || !ikPubFinal || !spkPrivFinal || !spkPubFinal) {
            // Own keys missing — try to rotate them on the server using the
            // existing device token so we can proceed with real X3DH.
            const token = await secureGet(DEVICE_TOKEN_KEY);
            const selfAlias = state.alias;
            if (token && selfAlias) {
              console.warn("[X3DH] Own keys missing — attempting rekey before session init for self:", selfAlias);
              const rekey = await rekeyWithServer(selfAlias, token);
              if (rekey) {
                await Promise.all([
                  secureSet(MY_IK_PRIV_KEY, rekey.ikPriv),
                  secureSet(MY_IK_PUB_KEY,  rekey.ikPub),
                  secureSet(MY_SPK_PRIV_KEY, rekey.spkPriv),
                  secureSet(MY_SPK_PUB_KEY,  rekey.spkPub),
                ]);
                await generateAndUploadOPKs(selfAlias, token);
                ikPrivFinal  = rekey.ikPriv;
                ikPubFinal   = rekey.ikPub;
                spkPrivFinal = rekey.spkPriv;
                spkPubFinal  = rekey.spkPub;
                // Re-fetch contact bundle so it picks up fresh OPKs if any
                bundle = await fetchContactBundle(aliasUpper);
              }
            }
          }

          if (ikPrivFinal && ikPubFinal && spkPrivFinal && spkPubFinal && bundle) {
            const { session, x3dhHeader } = initSessionAliceWithHeader(bundle, ikPrivFinal, ikPubFinal);
            drSession = session;
            usedOPK = !!(bundle.opkPublicKey);
            pendingX3DHHeader = JSON.stringify(x3dhHeader);
            console.log(`[X3DH] Real ${usedOPK ? "4-DH" : "3-DH"} session initiated with ${aliasUpper}`);
          } else {
            // Own keys still unavailable — fall back to local simulation only
            console.warn("[X3DH] Own private keys not found — falling back to simulation for", aliasUpper);
            if (bundle) {
              drSession = initSessionFromBundle(bundle);
              usedOPK = !!(bundle.opkPublicKey);
            } else {
              drSession = initSession();
            }
          }
        } catch (e) {
          console.error("[X3DH] Real session init failed — falling back:", e);
          if (bundle) {
            drSession = initSessionFromBundle(bundle);
            usedOPK = !!(bundle.opkPublicKey);
          } else {
            drSession = initSession();
          }
        }
      } else if (bundle) {
        drSession = initSessionFromBundle(bundle);
        usedOPK = !!(bundle.opkPublicKey);
        console.log(`[X3DH] ${usedOPK ? "4-DH" : "3-DH"} demo session initiated with ${aliasUpper}`);
      } else {
        drSession = initSession();
        console.log(`[X3DH] Server unavailable — using local 3-DH for ${aliasUpper}`);
      }

      setState((prev) => {
        const id = `${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        const safetyNumber = generateSafetyNumber(prev.alias ?? "GHOST_USER", aliasUpper);
        const newConv: Conversation = {
          id,
          alias: aliasUpper,
          lastMessage: "Double Ratchet session established.",
          timestamp: Date.now(),
          unread: 0,
          safetyNumber,
          drSession,
          isRealContact: userExistsOnServer,
          pendingX3DHHeader,
          messages: [
            buildMessage(
              usedOPK
                ? "Double Ratchet E2EE channel established. X3DH key exchange complete (4-DH with one-time prekey)."
                : "Double Ratchet E2EE channel established. X3DH key exchange complete.",
              false,
              id,
              aliasUpper,
            ),
          ],
        };
        const updated = [newConv, ...prev.conversations];
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });

      // Step 4: Replenish OPKs for ourselves in the background if supply is low
      (async () => {
        try {
          const token = await secureGet(DEVICE_TOKEN_KEY);
          const currentAlias = (await AsyncStorage.getItem("alias")) ?? "";
          if (token && currentAlias) {
            await replenishOPKsIfNeeded(currentAlias, token);
          }
        } catch {
          // Non-critical
        }
      })();

      return { isReal: userExistsOnServer };
    },
    [persistConversations]
  );

  const setStripeEmail = useCallback(async (email: string | null) => {
    try {
      if (email) {
        await AsyncStorage.setItem(STRIPE_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(STRIPE_EMAIL_KEY);
      }
      setState((prev) => ({ ...prev, stripeEmail: email }));
    } catch (err) {
      console.error("[AppContext] Failed to save stripe email:", err);
      throw err;
    }
  }, []);

  const checkSubscription = useCallback(async (email: string) => {
    const apiBase = getApiBase();
    if (!apiBase || !email) return;
    try {
      const res = await fetch(`${apiBase}/stripe/subscription?email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json() as { active: boolean; plan: string | null; status: string | null };
      setState((prev) => ({ ...prev, subscriptionStatus: data }));
    } catch {
      // Non-critical — subscription status remains as last known
    }
  }, []);

  const connectWallet = useCallback(async (address: string): Promise<{ error?: string }> => {
    const trimmed = address.trim();
    if (!isValidSolanaAddress(trimmed)) {
      return { error: "Invalid Solana address. Please check and try again." };
    }
    try {
      await AsyncStorage.setItem(CONNECTED_WALLET_KEY, trimmed);
      setState((prev) => ({ ...prev, connectedWalletAddress: trimmed, solBalance: 0 }));
      fetchSolBalance(trimmed).then((bal) =>
        setState((prev) => ({ ...prev, solBalance: bal }))
      );
      return {};
    } catch (err) {
      console.error("[AppContext] Failed to save connected wallet:", err);
      return { error: "Failed to save wallet address." };
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    await AsyncStorage.removeItem(CONNECTED_WALLET_KEY);
    setState((prev) => ({ ...prev, connectedWalletAddress: null, solBalance: 0 }));
  }, []);

  const setLanguage = useCallback(async (code: string) => {
    const VALID_LANGUAGES = ["en","es","fr","de","ja","zh","ar","pt","ru","ko","hi","it"];
    if (!VALID_LANGUAGES.includes(code)) return;
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
    setState((prev) => ({ ...prev, language: code }));
  }, []);

  // SILENCE CONTRACT: panicWipe must never produce any haptic or audio
  // feedback. A bystander must not be able to detect that a wipe occurred
  // because of an unexpected vibration or sound. Do not add Haptics calls,
  // Audio playback, or any other perceptible feedback here — including in
  // future changes. The duress countdown in lock.tsx relies on this guarantee.
  const panicWipe = useCallback(async () => {
    // Best-effort: notify known real contacts that we are gone, so their
    // app can flag this conversation as self-destructed. Must happen BEFORE
    // we clear local state (which closes the WS) and must NEVER produce
    // perceptible feedback — the silence contract still applies.
    try {
      const ws = wsRef.current;
      const realAliases = latestStateRef.current.conversations
        .filter((c) => c.isRealContact && !c.destroyedAt)
        .map((c) => c.alias)
        .filter((a): a is string => typeof a === "string" && a.length > 0);
      if (ws && ws.readyState === 1 && realAliases.length > 0) {
        ws.send(JSON.stringify({ type: "departed", toAliases: realAliases }));
      }
    } catch (err) {
      console.warn("[AppContext] Failed to broadcast departure:", err);
    }

    try {
      await Promise.all([
        ...APP_STORAGE_KEYS.map((k) => AsyncStorage.removeItem(k)),
        secureDelete(SECURE_PIN_KEY),
        secureDelete(SECURE_DURESS_PIN_KEY),
        secureDelete(DEVICE_TOKEN_KEY),
        secureDelete(MY_IK_PRIV_KEY),
        secureDelete(MY_IK_PUB_KEY),
        secureDelete(MY_SPK_PRIV_KEY),
        secureDelete(MY_SPK_PUB_KEY),
      ]);
    } catch (err) {
      console.error("[AppContext] Panic wipe storage error:", err);
    }
    setHasPin(false);
    setHasDuressPin(false);
    setState({
      alias: null,
      deviceToken: null,
      biometricEnabled: false,
      isLocked: false,
      isOnboarded: false,
      vpnConnected: false,
      vpnServer: null,
      conversations: [],
      fdBalance: 0,
      casperBalance: 0,
      walletAddress: "GhFc3...x9mKr4",
      transactions: DEFAULT_TRANSACTIONS,
      dataUsed: 2.4,
      dataLimit: 10,
      stripeEmail: null,
      stripePublishableKey: null,
      subscriptionStatus: null,
      connectedWalletAddress: null,
      solBalance: 0,
      autoLockTimeout: 5 * 60 * 1000,
      duressGracePeriod: 3,
      language: "en",
      incomingCall: null,
      linkQuality: "unknown",
      lowBandwidthMode: "auto",
      lowBandwidthActive: false,
    });
  }, []);

  const sendCallSignal = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const registerCallListener = useCallback((fn: ((s: CallSignal) => void) | null) => {
    callSignalListenerRef.current = fn;
  }, []);

  const dismissIncomingCall = useCallback(() => {
    setState((prev) => ({ ...prev, incomingCall: null }));
  }, []);

  const markMessageFailed = useCallback((conversationId: string, messageId: string) => {
    setState((prev) => {
      const updated = prev.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const msgs = c.messages.map((m) =>
          m.id === messageId ? { ...m, pending: false, failed: true } : m
        );
        let next = { ...c, messages: msgs };
        // ── Invite/key-expired destruct path ──────────────────────────────
        // Delegated to evaluateExpiredHandshake so the outbox-failure path
        // and the background sweep stay in lockstep. See its docstring for
        // the (deliberately narrow) detection conditions.
        const expiry = evaluateExpiredHandshake(next);
        if (expiry) {
          next = {
            ...next,
            destroyedAt: expiry.destroyedAt,
            lastMessage: expiry.lastMessage,
            timestamp: expiry.timestamp,
            messages: [...next.messages, expiry.systemMsg],
          };
        }
        return next;
      });
      persistConversations(updated);
      return { ...prev, conversations: updated };
    });
    console.warn("[Outbox] Marked failed after", MAX_OUTBOX_ATTEMPTS, "attempts:", messageId);
  }, [persistConversations]);

  const drainOutbox = useCallback(async () => {
    if (outboxDrainingRef.current) return;
    if (outboxRef.current.length === 0) return;
    outboxDrainingRef.current = true;
    try {
      // Per-conversation ratchet cursor for the duration of this drain.
      // Critical: React setState is async, so reading conv.drSession.alice
      // from latestStateRef on each iteration would return the same stale
      // alice for back-to-back messages, producing duplicate header.n values
      // and an unrecoverable receiver desync. We instead thread the freshly
      // advanced alice through the loop locally and let setState merge each
      // commit sequentially via the prev callback.
      const aliceCursor = new Map<string, ReturnType<typeof ratchetEncrypt>["state"]>();
      const headerSent = new Set<string>();

      // Iterate over a snapshot. We bump `attempts` only for items the loop
      // actually reaches (i.e. real delivery attempts) — never for items that
      // sit untouched because the WS died mid-drain. This prevents premature
      // failure when many messages are queued behind a single failing one.
      for (const item of [...outboxRef.current]) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== 1) break;
        const conv = latestStateRef.current.conversations.find((c) => c.id === item.conversationId);
        if (!conv?.drSession) {
          // No session to encrypt with — drop this item silently
          outboxRef.current = outboxRef.current.filter((i) => i.id !== item.id);
          persistOutbox(outboxRef.current);
          continue;
        }
        const nextAttempts = (item.attempts ?? 0) + 1;
        if (nextAttempts > MAX_OUTBOX_ATTEMPTS) {
          // Exhausted — flip Message.failed and remove from outbox.
          outboxRef.current = outboxRef.current.filter((i) => i.id !== item.id);
          persistOutbox(outboxRef.current);
          markMessageFailed(item.conversationId, item.id);
          continue;
        }
        // Persist the attempt before we try to send. If send throws and we
        // break, the next reconnect will see the bumped count.
        outboxRef.current = outboxRef.current.map((i) =>
          i.id === item.id ? { ...i, attempts: nextAttempts } : i
        );
        persistOutbox(outboxRef.current);
        try {
          // Use the local cursor if we've already encrypted at least one
          // message for this conversation in this drain; otherwise fall
          // back to the committed session.
          const aliceForEncrypt = aliceCursor.get(item.conversationId) ?? conv.drSession.alice;
          const wireText = wrapPayload(item.text, item.attachment);
          const { state: newAlice, message: aliceMsg } = ratchetEncrypt(aliceForEncrypt, wireText);
          // pendingX3DHHeader bootstraps the receiver's Bob session and is
          // only required on the very first ciphertext per conversation.
          // After that, header.dh + the ratchet step do the work and a
          // re-sent X3DH header on subsequent messages would force the
          // receiver to discard the live session.
          const x3dhHeader = headerSent.has(item.conversationId) ? undefined : conv.pendingX3DHHeader;
          // In LBW mode we compress the JSON envelope before send. The
          // server unwraps `msg-z` back into `msg` server-side. See
          // lib/lowBandwidth.ts for the wire format and the "only ship
          // compressed if it's actually smaller" guard.
          const frame = {
            type: "msg",
            to: conv.alias,
            payload: JSON.stringify(aliceMsg),
            x3dhHeader,
          };
          ws.send(
            lbwActiveRef.current
              ? compressFrameIfBeneficial(frame)
              : JSON.stringify(frame),
          );
          aliceCursor.set(item.conversationId, newAlice);
          headerSent.add(item.conversationId);
          const expiresAt = conv.disappearAfterSec ? Date.now() + conv.disappearAfterSec * 1000 : undefined;
          setState((prev) => {
            const updated = prev.conversations.map((c) => {
              if (c.id !== item.conversationId) return c;
              if (!c.drSession) return c;
              const updatedSession = { ...c.drSession, alice: newAlice, lastAliceHeader: aliceMsg.header };
              const updatedMsgs = c.messages.map((m) =>
                m.id === item.id
                  ? { ...m, pending: false, encrypted: true, sealed: true, ciphertext: aliceMsg.ciphertext, fingerprint: `DR:${aliceMsg.ciphertext.slice(0, 8).toUpperCase()}`, expiresAt }
                  : m
              );
              return { ...c, messages: updatedMsgs, drSession: updatedSession, pendingX3DHHeader: undefined };
            });
            persistConversations(updated);
            return { ...prev, conversations: updated };
          });
          outboxRef.current = outboxRef.current.filter((i) => i.id !== item.id);
          persistOutbox(outboxRef.current);
          console.log("[Outbox] Drained queued message:", item.id);
        } catch (e) {
          console.error("[Outbox] Failed to drain item:", item.id, e);
          // Feed the low-bandwidth classifier so repeated drain failures
          // can downgrade us into LBW mode.
          linkStatsRef.current.recentSendFailures += 1;
          recomputeLinkQuality();
          break; // Stop on error — ratchet ordering requires sequential delivery
        }
      }
    } finally {
      outboxDrainingRef.current = false;
    }
  }, [persistConversations, persistOutbox, markMessageFailed]);

  // Wire the scheduler's ref to the live drainOutbox each render so the
  // debounced fire() always invokes the freshest closure.
  useEffect(() => {
    drainOutboxRef.current = drainOutbox;
  }, [drainOutbox]);

  const retryMessage = useCallback((conversationId: string, messageId: string) => {
    const conv = latestStateRef.current.conversations.find((c) => c.id === conversationId);
    const msg = conv?.messages.find((m) => m.id === messageId);
    if (!conv || !msg || !msg.failed) return;
    // Re-queue the failed message: clear failed flag, re-add to outbox with
    // attempts reset to 0, and try to drain immediately. Ratchet is not
    // advanced here — drainOutbox encrypts at the moment of WS delivery.
    setState((prev) => {
      const updated = prev.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const msgs = c.messages.map((m) =>
          m.id === messageId ? { ...m, failed: false, pending: true } : m
        );
        return { ...c, messages: msgs };
      });
      persistConversations(updated);
      return { ...prev, conversations: updated };
    });
    if (!outboxRef.current.find((i) => i.id === messageId)) {
      const next: OutboxItem[] = [...outboxRef.current, { id: messageId, conversationId, text: msg.text, attempts: 0, attachment: msg.attachment }];
      outboxRef.current = next;
      persistOutbox(next);
    }
    drainOutbox().catch(console.error);
  }, [persistConversations, persistOutbox, drainOutbox]);

  const handleIncomingWsMessage = useCallback(async (raw: string) => {
    let wsMsg: { type?: string; msgId?: number; from?: string; payload?: string; x3dhHeader?: string; alias?: string; callId?: string; callMode?: string };
    try {
      wsMsg = JSON.parse(raw);
    } catch {
      return;
    }

    // ── Auth ack ─────────────────────────────────────────────────────────────
    if (wsMsg.type === "ack" && !wsMsg.from) {
      wsEverConnectedRef.current = true;
      setWsConnected(true);
      // Link is healthy enough to authenticate — reset the "stuck" timer
      // and let the classifier promote us back to "good".
      linkStatsRef.current.lastAuthAckAt = Date.now();
      linkStatsRef.current.reconnectingSince = 0;
      recomputeLinkQuality();
      drainOutbox().catch(console.error);
      return;
    }

    // ── Self-destruct notice from a peer ───────────────────────────────────
    // Mark the matching conversation as destroyed so the UI can show a
    // "SELF-DESTRUCTED" badge, disable the composer, and render a system
    // message in chat. Notice is one-shot — ignore if already flagged.
    if (wsMsg.type === "departed" && wsMsg.from) {
      const departedAlias = wsMsg.from.toUpperCase();
      setState((prev) => {
        const existing = prev.conversations.find((c) => c.alias === departedAlias);
        if (!existing || existing.destroyedAt) return prev;
        const stamp = Date.now();
        const systemMsg: Message = {
          id: `sys-departed-${stamp}`,
          text: "This contact has self-destructed. The conversation is sealed.",
          fromMe: false,
          timestamp: stamp,
          encrypted: false,
          sealed: true,
          system: true,
        };
        const updated = prev.conversations.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                destroyedAt: stamp,
                lastMessage: "SELF-DESTRUCTED",
                timestamp: stamp,
                messages: [...c.messages, systemMsg],
              }
            : c
        );
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });
      return;
    }

    // ── Call signals ─────────────────────────────────────────────────────────
    if (wsMsg.type && CALL_SIGNAL_TYPES.has(wsMsg.type) && wsMsg.from) {
      if (wsMsg.type === "call-ring") {
        setState((prev) => ({
          ...prev,
          incomingCall: { callId: wsMsg.callId ?? "unknown", from: wsMsg.from!.toUpperCase(), mode: (wsMsg.callMode as "voice" | "video") ?? "voice" },
        }));
      } else {
        callSignalListenerRef.current?.({ type: wsMsg.type, from: wsMsg.from.toUpperCase(), payload: wsMsg.payload, callId: wsMsg.callId, callMode: wsMsg.callMode });
      }
      return;
    }

    if (wsMsg.type !== "msg" || !wsMsg.from || !wsMsg.payload) return;

    let ratchetMsg: RatchetMessage;
    try {
      ratchetMsg = JSON.parse(wsMsg.payload) as RatchetMessage;
    } catch {
      console.warn("[WS] Failed to parse ratchet message payload");
      return;
    }

    const senderAlias = wsMsg.from.toUpperCase();
    const currentConversations = latestStateRef.current.conversations;
    const existing = currentConversations.find((c) => c.alias === senderAlias);

    const myAlias = (latestStateRef.current.alias ?? "").toUpperCase();

    if (existing && existing.drSession) {
      try {
        const { state: newAlice, plaintext } = ratchetDecrypt(existing.drSession.alice, ratchetMsg);
        const unwrapped = unwrapPayload(plaintext);
        const preview = previewForMessage(unwrapped.text, unwrapped.attachment);
        const newMsgObj: Message = {
          id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          text: unwrapped.text,
          fromMe: false,
          timestamp: Date.now(),
          encrypted: true,
          sealed: true,
          fingerprint: `DR:${ratchetMsg.ciphertext.slice(0, 8).toUpperCase()}`,
          ...(unwrapped.attachment ? { attachment: unwrapped.attachment } : {}),
          ...(existing.disappearAfterSec
            ? { expiresAt: Date.now() + existing.disappearAfterSec * 1000 }
            : {}),
        };
        setState((prev) => {
          const updated = prev.conversations.map((c) =>
            c.id === existing.id
              ? {
                  ...c,
                  messages: [...c.messages, newMsgObj],
                  lastMessage: preview,
                  timestamp: Date.now(),
                  unread: c.unread + 1,
                  drSession: { ...c.drSession!, alice: newAlice },
                }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        });
        return;
      } catch (e) {
        // Decryption failed with current session. If the sender included a fresh
        // X3DH header, the two sides have diverged sessions (typical "glare":
        // both initiated X3DH simultaneously after a reset). To converge, both
        // sides apply the same deterministic tiebreaker — the lexicographically
        // smaller alias's session wins. This guarantees both ends pick the same
        // session without further round-trips.
        if (!wsMsg.x3dhHeader) {
          console.error("[DR] Failed to decrypt incoming message from", senderAlias, e);
          const decryptFailMsg: Message = {
            id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            text: "⚠ Message could not be decrypted",
            fromMe: false,
            timestamp: Date.now(),
            encrypted: true,
            sealed: true,
          };
          setState((prev) => {
            const updated = prev.conversations.map((c) =>
              c.id === existing.id
                ? { ...c, messages: [...c.messages, decryptFailMsg], lastMessage: "⚠ Message could not be decrypted", timestamp: Date.now(), unread: c.unread + 1 }
                : c
            );
            persistConversations(updated);
            return { ...prev, conversations: updated };
          });
          return;
        }
        const senderWins = senderAlias < myAlias;
        if (!senderWins) {
          // We "own" the session — drop this message and keep our session intact.
          // Our next outgoing message will reach the sender, who will rebuild
          // their Bob session from our X3DH header.
          console.warn("[DR] Glare detected with", senderAlias, "— our alias wins tiebreaker, keeping local session and dropping incoming message");
          return;
        }
        console.warn("[DR] Glare detected with", senderAlias, "— sender wins tiebreaker, rebuilding Bob session from incoming X3DH header");
      }
    }

    if (existing && !existing.drSession && !wsMsg.x3dhHeader) {
      console.warn("[WS] Existing conversation has no DR session and no X3DH header on incoming message", senderAlias);
      return;
    }

    if (!wsMsg.x3dhHeader) {
      console.warn("[WS] Received message from unknown sender without X3DH header — cannot decrypt", senderAlias);
      return;
    }

    let x3dhHeader: X3DHHeader;
    try {
      x3dhHeader = JSON.parse(wsMsg.x3dhHeader) as X3DHHeader;
    } catch {
      console.warn("[WS] Failed to parse X3DH header from", senderAlias);
      return;
    }

    try {
      const [myIKPriv, myIKPub, mySpkPriv, mySpkPub] = await Promise.all([
        secureGet(MY_IK_PRIV_KEY),
        secureGet(MY_IK_PUB_KEY),
        secureGet(MY_SPK_PRIV_KEY),
        secureGet(MY_SPK_PUB_KEY),
      ]);

      if (!myIKPriv || !myIKPub || !mySpkPriv || !mySpkPub) {
        console.warn("[X3DH] Own private keys not available — cannot init Bob session for", senderAlias);
        return;
      }

      let opkPriv: string | undefined;
      if (x3dhHeader.opkId) {
        const opkStore = await loadOPKStore();
        opkPriv = opkStore[x3dhHeader.opkId];
        if (opkPriv) {
          delete opkStore[x3dhHeader.opkId];
          await saveOPKStore(opkStore);
        }
      }

      const bobSession = initSessionBobFromHeader(
        x3dhHeader,
        myIKPriv,
        myIKPub,
        mySpkPriv,
        mySpkPub,
        opkPriv,
      );

      const { state: newAlice, plaintext } = ratchetDecrypt(bobSession.alice, ratchetMsg);
      const unwrappedFirst = unwrapPayload(plaintext);
      const firstPreview = previewForMessage(unwrappedFirst.text, unwrappedFirst.attachment);
      const safetyNumber = generateSafetyNumber(latestStateRef.current.alias ?? "GHOST_USER", senderAlias);

      const initMsg: Message = {
        id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        text: "Double Ratchet E2EE channel established. Receiving first message.",
        fromMe: false,
        timestamp: Date.now() - 1,
        encrypted: true,
        sealed: false,
      };
      const firstMsg: Message = {
        id: `${Date.now() + 1}${Math.random().toString(36).substr(2, 9)}`,
        text: unwrappedFirst.text,
        fromMe: false,
        timestamp: Date.now(),
        encrypted: true,
        sealed: true,
        fingerprint: `DR:${ratchetMsg.ciphertext.slice(0, 8).toUpperCase()}`,
        ...(unwrappedFirst.attachment ? { attachment: unwrappedFirst.attachment } : {}),
      };

      setState((prev) => {
        const alreadyExists = prev.conversations.find((c) => c.alias === senderAlias);

        if (alreadyExists) {
          // Sender re-initialized their session and we fell through from the
          // decrypt-fail path. Replace the stale DR session and append the
          // decrypted message to the existing conversation rather than creating
          // a duplicate.
          const firstMsgWithExpiry: Message = alreadyExists.disappearAfterSec
            ? { ...firstMsg, expiresAt: Date.now() + alreadyExists.disappearAfterSec * 1000 }
            : firstMsg;
          const updated = prev.conversations.map((c) =>
            c.id === alreadyExists.id
              ? {
                  ...c,
                  drSession: { ...bobSession, alice: newAlice },
                  messages: [...c.messages, firstMsgWithExpiry],
                  lastMessage: firstPreview,
                  timestamp: Date.now(),
                  unread: c.unread + 1,
                  safetyNumber,
                }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        }

        const id = `${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        const newConv: Conversation = {
          id,
          alias: senderAlias,
          lastMessage: firstPreview,
          timestamp: Date.now(),
          unread: 1,
          safetyNumber,
          isRealContact: true,
          drSession: { ...bobSession, alice: newAlice },
          messages: [initMsg, firstMsg],
        };
        const updated = [newConv, ...prev.conversations];
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });

      console.log(`[X3DH] Bob session established with ${senderAlias} — first message decrypted`);
    } catch (e) {
      console.error("[X3DH] Failed to init Bob session or decrypt first message from", senderAlias, e);
      setState((prev) => {
        const placeholder: Message = {
          id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          text: "⚠ Message could not be decrypted",
          fromMe: false,
          timestamp: Date.now(),
          encrypted: true,
          sealed: false,
        };
        const existingConv = prev.conversations.find((c) => c.alias === senderAlias);
        if (existingConv) {
          const updated = prev.conversations.map((c) =>
            c.alias === senderAlias
              ? { ...c, messages: [...c.messages, placeholder], lastMessage: "⚠ Message could not be decrypted", timestamp: Date.now(), unread: c.unread + 1 }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        }
        // Unknown sender — create a minimal conversation so the failure is visible
        const newConv: Conversation = {
          id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          alias: senderAlias,
          lastMessage: "⚠ Message could not be decrypted",
          timestamp: Date.now(),
          unread: 1,
          isRealContact: true,
          messages: [placeholder],
        };
        const updated = [newConv, ...prev.conversations];
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });
    }
  }, [persistConversations, drainOutbox]);

  useEffect(() => {
    const alias = state.alias;
    const isLocked = state.isLocked;
    const isOnboarded = state.isOnboarded;

    if (!alias || isLocked || !isOnboarded) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    async function connect() {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      if (!domain) return;

      const deviceToken = await secureGet(DEVICE_TOKEN_KEY);
      if (!deviceToken || !mounted) return;

      try {
        const wsUrl = `wss://${domain}/api/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // Client-side ping. The server runs its own protocol-level ping
        // every 30 s, but on satellite links we want the *client* to also
        // keep the connection nailed up — and to stretch its cadence when
        // low-bandwidth mode is active. We use a self-rescheduling
        // setTimeout so the interval can adapt to runtime LBW toggles
        // without tearing down and recreating the WS.
        let pingTimer: ReturnType<typeof setTimeout> | null = null;
        const schedulePing = () => {
          pingTimer = setTimeout(() => {
            if (ws.readyState === 1) {
              try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* ignore */ }
              schedulePing();
            }
          }, wsPingIntervalMs(lbwActiveRef.current));
        };

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "auth", alias, token: deviceToken }));
          console.log("[WS] Connection opened, authenticating as", alias);
          schedulePing();
        };

        // Auth-error flag: set by onmessage when server sends { type:"error", message:"auth failed" }.
        // Checked by onclose so we re-register instead of looping blindly.
        // Also catches code 4001 for environments where the proxy passes it through.
        let authRejected = false;

        ws.onmessage = (event) => {
          const raw = event.data as string;
          try {
            const parsed = JSON.parse(raw) as { type?: string; message?: string };
            if (parsed.type === "error" && typeof parsed.message === "string" && parsed.message.toLowerCase().includes("auth")) {
              authRejected = true;
              console.warn("[WS] Auth error received from server — will re-register on close");
              return;
            }
          } catch { /* not JSON or not an error — pass through */ }
          handleIncomingWsMessage(raw).catch(console.error);
        };

        ws.onerror = (e) => {
          console.warn("[WS] Error:", e);
        };

        ws.onclose = (event) => {
          console.log("[WS] Connection closed", event.code);
          setWsConnected(false);
          if (pingTimer) { clearTimeout(pingTimer); pingTimer = null; }
          // Feed the LBW classifier: count this disconnect, and start the
          // "stuck reconnecting" stopwatch if it isn't already running.
          linkStatsRef.current.recentReconnects += 1;
          if (linkStatsRef.current.reconnectingSince === 0) {
            linkStatsRef.current.reconnectingSince = Date.now();
          }
          recomputeLinkQuality();
          if (!mounted) return;

          if (event.code === 4001 || authRejected) {
            authRejected = false;
            // Auth rejected — stale or mismatched device token.
            // Clear local credentials, re-register with the server, then reconnect.
            console.warn("[WS] Auth rejected — clearing stale token and re-registering");
            (async () => {
              try {
                if (!alias) {
                  // Alias was cleared while we were connected (e.g. panic wipe).
                  // Can't re-register without one — just back off and let the
                  // normal WS useEffect guard handle reconnection once alias is set.
                  console.warn("[WS] Auth rejected but alias is null — skipping re-registration");
                  return;
                }
                // Capture alias as a local const so TypeScript can narrow the type
                // from string | null to string across the async boundary.
                const currentAlias: string = alias;
                await Promise.all([
                  secureDelete(DEVICE_TOKEN_KEY),
                  secureDelete(MY_IK_PRIV_KEY),
                  secureDelete(MY_IK_PUB_KEY),
                  secureDelete(MY_SPK_PRIV_KEY),
                  secureDelete(MY_SPK_PUB_KEY),
                ]);
                const reg = await registerWithServer(currentAlias);
                if (reg && mounted) {
                  await secureSet(DEVICE_TOKEN_KEY, reg.token);
                  await secureSet(MY_IK_PRIV_KEY, reg.ikPriv);
                  await secureSet(MY_IK_PUB_KEY, reg.ikPub);
                  await secureSet(MY_SPK_PRIV_KEY, reg.spkPriv);
                  await secureSet(MY_SPK_PUB_KEY, reg.spkPub);
                  await generateAndUploadOPKs(currentAlias, reg.token);
                  reconnectTimer = setTimeout(connect, 1000);
                } else if (mounted) {
                  // Alias taken on server (409) or server unreachable — back off
                  console.warn("[WS] Re-registration failed — retrying in 15 s");
                  reconnectTimer = setTimeout(connect, 15_000);
                }
              } catch {
                if (mounted) reconnectTimer = setTimeout(connect, 10_000);
              }
            })();
            return;
          }

          // Reconnect delay is stretched when LBW is active so a brief
          // satellite sliver isn't immediately re-burned by reconnect churn.
          reconnectTimer = setTimeout(connect, wsReconnectDelayMs(lbwActiveRef.current));
        };
      } catch (e) {
        console.warn("[WS] Failed to connect:", e);
        if (mounted) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      mounted = false;
      setWsConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [state.alias, state.isLocked, state.isOnboarded, handleIncomingWsMessage]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        hasPin,
        hasDuressPin,
        loadError,
        setAlias,
        setPin,
        checkPin,
        checkDuressPin,
        checkPinWithDuress,
        captureCurrentPinForTransition,
        checkPreviousMainPin,
        setDuressPin,
        clearDuressPin,
        setBiometricEnabled,
        setLocked,
        connectVPN,
        disconnectVPN,
        sendMessage,
        retryMessage,
        addConversation,
        deleteMessage,
        clearConversation,
        deleteConversation,
        setDisappearTimer,
        verifyConversation,
        sendCallSignal,
        registerCallListener,
        dismissIncomingCall,
        panicWipe,
        setStripeEmail,
        checkSubscription,
        connectWallet,
        disconnectWallet,
        setAutoLockTimeout,
        setDuressGracePeriod,
        setLanguage,
        setLowBandwidthMode,
        wsConnected,
        loaded,
        vpnAutoReconnecting,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

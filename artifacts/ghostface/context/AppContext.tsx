import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
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
import { x25519, ed25519 } from "@noble/curves/ed25519";
import { randomBytes } from "@noble/hashes/utils";

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
}

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
  connectedWalletAddress: string | null;
  solBalance: number;
  autoLockTimeout: number | null;
}

interface AppContextType extends AppState {
  hasPin: boolean;
  hasDuressPin: boolean;
  loadError: string | null;
  setAlias: (alias: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  checkPin: (input: string) => Promise<boolean>;
  checkPinWithDuress: (input: string) => Promise<{ correct: boolean; isDuress: boolean }>;
  setDuressPin: (pin: string) => Promise<void>;
  clearDuressPin: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setLocked: (locked: boolean) => void;
  connectVPN: (server: VPNServer) => void;
  disconnectVPN: () => void;
  sendMessage: (conversationId: string, text: string) => void;
  addConversation: (alias: string) => Promise<{ isReal: boolean }>;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  setDisappearTimer: (conversationId: string, seconds: number | undefined) => void;
  panicWipe: () => Promise<void>;
  setStripeEmail: (email: string | null) => Promise<void>;
  connectWallet: (address: string) => Promise<{ error?: string }>;
  disconnectWallet: () => Promise<void>;
  setAutoLockTimeout: (ms: number | null) => Promise<void>;
  loaded: boolean;
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
  disappearAfterSec?: number
): Message {
  const key = demoKeyForConversation(convId);
  let ciphertext: string | undefined;
  let fingerprint: string | undefined;
  let sealed = false;

  try {
    // Sealed sender: senderAlias is encrypted inside the payload, not exposed
    const enc: SealedMessage = sealedEncryptMessage(text, senderAlias, key);
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
  };
}

/**
 * Build the default conversations with fresh DR sessions each call.
 * Called on first launch and after panic wipe — ensures all default
 * conversations are always DR-enabled from the first render.
 */
function createDefaultConversations(): Conversation[] {
  return [
    {
      id: "1",
      alias: "PHANTOM_7",
      lastMessage: "All clear. No trace.",
      timestamp: Date.now() - 1000 * 60 * 5,
      unread: 2,
      safetyNumber: generateSafetyNumber("GHOST_USER", "PHANTOM_7"),
      drSession: initSession(),
      messages: [
        buildMessage("Connection established. Key exchange complete.", false, "1", "PHANTOM_7"),
        buildMessage("Copy that. Transfer ready.", true, "1", "GHOST_USER"),
        buildMessage("All clear. No trace.", false, "1", "PHANTOM_7"),
      ],
    },
    {
      id: "2",
      alias: "WRAITH_X",
      lastMessage: "Package delivered. Secure.",
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
      unread: 0,
      safetyNumber: generateSafetyNumber("GHOST_USER", "WRAITH_X"),
      drSession: initSession(),
      messages: [
        buildMessage("Initiating handshake.", true, "2", "GHOST_USER"),
        buildMessage("Package delivered. Secure.", false, "2", "WRAITH_X"),
      ],
    },
    {
      id: "3",
      alias: "NULL_PTR",
      lastMessage: "VPN hopping complete. Stand by.",
      timestamp: Date.now() - 1000 * 60 * 60 * 12,
      unread: 1,
      safetyNumber: generateSafetyNumber("GHOST_USER", "NULL_PTR"),
      drSession: initSession(),
      messages: [
        buildMessage("VPN hopping complete. Stand by.", false, "3", "NULL_PTR"),
      ],
    },
  ];
}

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: "t1", type: "receive", token: "FD", amount: 500, address: "GhF3...x9mK", timestamp: Date.now() - 1000 * 60 * 60 * 2 },
  { id: "t2", type: "send", token: "CASPER", amount: 120, address: "CsP7...v2nQ", timestamp: Date.now() - 1000 * 60 * 60 * 6 },
  { id: "t3", type: "receive", token: "CASPER", amount: 1000, address: "CsP9...r4wX", timestamp: Date.now() - 1000 * 60 * 60 * 24 },
  { id: "t4", type: "send", token: "FD", amount: 200, address: "GhF1...m8pL", timestamp: Date.now() - 1000 * 60 * 60 * 48 },
];

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
const STRIPE_EMAIL_KEY = "stripeEmail";
const CONNECTED_WALLET_KEY = "ghostface_connected_wallet";
const OPK_STORE_KEY = "ghostface_opk_store";
const OPK_BATCH_SIZE = 10;
const DEVICE_TOKEN_KEY = "ghostface_device_token";
const CONTACT_IDENTITY_STORE_KEY = "ghostface_contact_identity_store";
const AUTO_LOCK_TIMEOUT_KEY = "ghostface_auto_lock_timeout";
const LAST_VPN_SERVER_KEY = "ghostface_last_vpn_server_id";
const MY_IK_PRIV_KEY = "ghostface_my_ik_priv";
const MY_IK_PUB_KEY = "ghostface_my_ik_pub";
const MY_SPK_PRIV_KEY = "ghostface_my_spk_priv";
const MY_SPK_PUB_KEY = "ghostface_my_spk_pub";
const APP_STORAGE_KEYS = [
  "alias",
  "isOnboarded",
  "biometricEnabled",
  CONVERSATIONS_KEY,
  STRIPE_EMAIL_KEY,
  CONNECTED_WALLET_KEY,
  OPK_STORE_KEY,
  CONTACT_IDENTITY_STORE_KEY,
  AUTO_LOCK_TIMEOUT_KEY,
  LAST_VPN_SERVER_KEY,
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
  const [state, setState] = useState<AppState>({
    alias: null,
    deviceToken: null,
    biometricEnabled: false,
    isLocked: true,
    isOnboarded: false,
    vpnConnected: false,
    vpnServer: null,
    conversations: createDefaultConversations(),
    fdBalance: 4250.75,
    casperBalance: 8920.5,
    walletAddress: "GhFc3...x9mKr4",
    transactions: DEFAULT_TRANSACTIONS,
    dataUsed: 2.4,
    dataLimit: 10,
    stripeEmail: null,
    connectedWalletAddress: null,
    solBalance: 0,
    autoLockTimeout: 5 * 60 * 1000,
  });

  useEffect(() => {
    async function load() {
      try {
        const [alias, pinValue, duressValue, biometric, onboarded, convData, stripeEmailVal, connectedWallet, autoLockRaw, storedToken, lastVpnServerId] = await Promise.all([
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

        const restoredVpnServer = lastVpnServerId
          ? (VPN_SERVERS.find((s) => s.id === lastVpnServerId) ?? null)
          : null;

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
          connectedWalletAddress: connectedWallet ?? null,
          autoLockTimeout,
          vpnServer: restoredVpnServer,
          vpnConnected: !!restoredVpnServer,
        }));

        // Fetch SOL balance in background after state is set
        if (connectedWallet) {
          fetchSolBalance(connectedWallet).then((bal) =>
            setState((prev) => ({ ...prev, solBalance: bal }))
          );
        }

        // Replenish OPKs in the background if returning user's supply is low
        if (alias && onboarded === "true") {
          (async () => {
            try {
              const token = await secureGet(DEVICE_TOKEN_KEY);
              if (token) {
                await replenishOPKsIfNeeded(alias, token);
              }
            } catch {
              // Non-critical
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

  const wsRef = React.useRef<WebSocket | null>(null);
  const latestStateRef = React.useRef(state);
  useEffect(() => { latestStateRef.current = state; }, [state]);

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
              await generateAndUploadOPKs(alias, reg.token);
            }
          } else {
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
      setHasDuressPin(false);
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

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const conv = latestStateRef.current.conversations.find((c) => c.id === conversationId);
      if (!conv) return;

      const myAlias = latestStateRef.current.alias ?? "GHOST_USER";
      const isRealContact = conv.isRealContact ?? false;

      let aliceMsg: RatchetMessage | undefined;
      let updatedDRSession = conv.drSession;

      if (conv.drSession) {
        let drSession = conv.drSession;
        let attempts = 0;
        while (attempts < 2) {
          try {
            const { state: newAlice, message: msg } = ratchetEncrypt(drSession.alice, text);
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
          return;
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
          }
        : buildMessage(text, true, conversationId, myAlias, conv.disappearAfterSec);

      const headerToSend = conv.pendingX3DHHeader;

      setState((prev) => {
        const updated = prev.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, newMsg],
                lastMessage: text,
                timestamp: Date.now(),
                unread: 0,
                drSession: updatedDRSession,
                pendingX3DHHeader: isRealContact ? undefined : c.pendingX3DHHeader,
              }
            : c
        );
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });

      if (isRealContact && aliceMsg) {
        const ws = wsRef.current;
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "msg",
            to: conv.alias,
            payload: JSON.stringify(aliceMsg),
            x3dhHeader: headerToSend,
          }));
        } else {
          console.warn("[WS] Not connected — message sent to state but not delivered over WS");
        }
      } else if (!isRealContact) {
        const delay = 1500 + Math.random() * 1000;
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
    },
    [persistConversations]
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

          if (myIKPriv && myIKPub && mySpkPriv && mySpkPub) {
            const { session, x3dhHeader } = initSessionAliceWithHeader(bundle, myIKPriv, myIKPub);
            drSession = session;
            usedOPK = !!(bundle.opkPublicKey);
            pendingX3DHHeader = JSON.stringify(x3dhHeader);
            console.log(`[X3DH] Real ${usedOPK ? "4-DH" : "3-DH"} session initiated with ${aliasUpper}`);
          } else {
            // Own keys not yet saved (user registered before this update) — use simulation
            console.warn("[X3DH] Own private keys not found — falling back to simulation for", aliasUpper);
            drSession = initSessionFromBundle(bundle);
            usedOPK = !!(bundle.opkPublicKey);
          }
        } catch (e) {
          console.error("[X3DH] Real session init failed — falling back:", e);
          drSession = initSessionFromBundle(bundle);
          usedOPK = !!(bundle.opkPublicKey);
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

  const panicWipe = useCallback(async () => {
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
      biometricEnabled: false,
      isLocked: false,
      isOnboarded: false,
      vpnConnected: false,
      vpnServer: null,
      conversations: [],
      fdBalance: 4250.75,
      casperBalance: 8920.5,
      walletAddress: "GhFc3...x9mKr4",
      transactions: DEFAULT_TRANSACTIONS,
      dataUsed: 2.4,
      dataLimit: 10,
      stripeEmail: null,
      connectedWalletAddress: null,
      solBalance: 0,
      autoLockTimeout: 5 * 60 * 1000,
    });
  }, []);

  const handleIncomingWsMessage = useCallback(async (raw: string) => {
    let wsMsg: { type?: string; msgId?: number; from?: string; payload?: string; x3dhHeader?: string; alias?: string };
    try {
      wsMsg = JSON.parse(raw);
    } catch {
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

    if (existing) {
      if (!existing.drSession) return;
      try {
        const { state: newAlice, plaintext } = ratchetDecrypt(existing.drSession.alice, ratchetMsg);
        const newMsgObj: Message = {
          id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          text: plaintext,
          fromMe: false,
          timestamp: Date.now(),
          encrypted: true,
          sealed: true,
          fingerprint: `DR:${ratchetMsg.ciphertext.slice(0, 8).toUpperCase()}`,
        };
        setState((prev) => {
          const updated = prev.conversations.map((c) =>
            c.id === existing.id
              ? {
                  ...c,
                  messages: [...c.messages, newMsgObj],
                  lastMessage: plaintext,
                  timestamp: Date.now(),
                  unread: c.unread + 1,
                  drSession: { ...c.drSession!, alice: newAlice },
                }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        });
      } catch (e) {
        console.error("[DR] Failed to decrypt incoming message from", senderAlias, e);
      }
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
        text: plaintext,
        fromMe: false,
        timestamp: Date.now(),
        encrypted: true,
        sealed: true,
        fingerprint: `DR:${ratchetMsg.ciphertext.slice(0, 8).toUpperCase()}`,
      };

      setState((prev) => {
        const alreadyExists = prev.conversations.find((c) => c.alias === senderAlias);
        if (alreadyExists) return prev;

        const id = `${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        const newConv: Conversation = {
          id,
          alias: senderAlias,
          lastMessage: plaintext,
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
    }
  }, [persistConversations]);

  useEffect(() => {
    const alias = state.alias;
    const isLocked = state.isLocked;
    const isOnboarded = state.isOnboarded;

    if (!alias || isLocked || !isOnboarded) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
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

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "auth", alias, token: deviceToken }));
          console.log("[WS] Connection opened, authenticating as", alias);
        };

        ws.onmessage = (event) => {
          handleIncomingWsMessage(event.data as string).catch(console.error);
        };

        ws.onerror = (e) => {
          console.warn("[WS] Error:", e);
        };

        ws.onclose = () => {
          console.log("[WS] Connection closed");
          if (mounted) {
            reconnectTimer = setTimeout(connect, 5000);
          }
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
        checkPinWithDuress,
        setDuressPin,
        clearDuressPin,
        setBiometricEnabled,
        setLocked,
        connectVPN,
        disconnectVPN,
        sendMessage,
        addConversation,
        deleteMessage,
        clearConversation,
        deleteConversation,
        setDisappearTimer,
        panicWipe,
        setStripeEmail,
        connectWallet,
        disconnectWallet,
        setAutoLockTimeout,
        loaded,
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

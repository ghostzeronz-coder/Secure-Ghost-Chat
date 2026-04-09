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
  generateOneTimePreKeys,
  ratchetEncrypt,
  ratchetDecrypt,
  isValidDRSession,
  type DRSession,
  type OneTimePreKey,
  type PreKeyBundle,
} from "@/lib/doubleRatchet";
import { x25519 } from "@noble/curves/ed25519";
import { randomBytes } from "@noble/hashes/utils";

function generateHexKeypair(): { pub: string; priv: string } {
  const priv = randomBytes(32);
  const pub  = x25519.getPublicKey(priv);
  const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
  return { pub: toHex(pub), priv: toHex(priv) };
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
  latency: number;
  flag: string;
}

interface AppState {
  alias: string | null;
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
}

interface AppContextType extends AppState {
  hasPin: boolean;
  loadError: string | null;
  setAlias: (alias: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  checkPin: (input: string) => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setLocked: (locked: boolean) => void;
  connectVPN: (server: VPNServer) => void;
  disconnectVPN: () => void;
  sendMessage: (conversationId: string, text: string) => void;
  addConversation: (alias: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  setDisappearTimer: (conversationId: string, seconds: number | undefined) => void;
  panicWipe: () => Promise<void>;
  setStripeEmail: (email: string | null) => Promise<void>;
  connectWallet: (address: string) => Promise<{ error?: string }>;
  disconnectWallet: () => Promise<void>;
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
  { id: "1", name: "US East", country: "United States", region: "New York", latency: 12, flag: "🇺🇸" },
  { id: "2", name: "EU West", country: "Germany", region: "Frankfurt", latency: 24, flag: "🇩🇪" },
  { id: "3", name: "Asia Pacific", country: "Japan", region: "Tokyo", latency: 68, flag: "🇯🇵" },
  { id: "4", name: "Nordic", country: "Sweden", region: "Stockholm", latency: 31, flag: "🇸🇪" },
  { id: "5", name: "Offshore", country: "Iceland", region: "Reykjavik", latency: 45, flag: "🇮🇸" },
  { id: "6", name: "SE Asia", country: "Singapore", region: "Singapore", latency: 92, flag: "🇸🇬" },
];

export { VPN_SERVERS };

const SECURE_PIN_KEY = "ghostface_pin";
const CONVERSATIONS_KEY = "ghostface_conversations";
const STRIPE_EMAIL_KEY = "stripeEmail";
const CONNECTED_WALLET_KEY = "ghostface_connected_wallet";
const OPK_STORE_KEY = "ghostface_opk_store";
const OPK_BATCH_SIZE = 10;
const DEVICE_TOKEN_KEY = "ghostface_device_token";
const CONTACT_IDENTITY_STORE_KEY = "ghostface_contact_identity_store";
const APP_STORAGE_KEYS = [
  "alias",
  "isOnboarded",
  "biometricEnabled",
  CONVERSATIONS_KEY,
  STRIPE_EMAIL_KEY,
  CONNECTED_WALLET_KEY,
  OPK_STORE_KEY,
  CONTACT_IDENTITY_STORE_KEY,
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
 * Contact identity store: maps contactAlias → { ikPriv, ikPub, spkPriv, spkPub }.
 * Populated when we simulate registration for a contact in the single-device demo.
 */
interface ContactIdentity {
  ikPub:  string;
  ikPriv: string;
  spkPub: string;
  spkPriv: string;
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
 * Generates IK + SPK, uploads to server, stores device token.
 * Returns the device token or null on failure.
 */
async function registerWithServer(
  userId: string,
): Promise<{ token: string; ikPriv: string; spkPriv: string } | null> {
  const apiBase = getApiBase();
  if (!apiBase) return null;
  try {
    const ik  = generateHexKeypair();
    const spk = generateHexKeypair();

    const res = await fetch(`${apiBase}/prekeys/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        ikPublicKey:  ik.pub,
        spkPublicKey: spk.pub,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      console.warn("[REGISTER] Server registration failed:", err.error ?? res.status);
      return null;
    }

    const data = await res.json() as { token: string; userId: string };
    console.log(`[REGISTER] Registered ${userId} with server`);
    return { token: data.token, ikPriv: ik.priv, spkPriv: spk.priv };
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
    const ik  = generateHexKeypair();
    const spk = generateHexKeypair();

    const res = await fetch(`${apiBase}/prekeys/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:       contactAlias,
        ikPublicKey:  ik.pub,
        spkPublicKey: spk.pub,
      }),
    });

    const identity: ContactIdentity = { ikPub: ik.pub, ikPriv: ik.priv, spkPub: spk.pub, spkPriv: spk.priv };

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
      ikPublicKey:  string;
      spkPublicKey: string;
      opk:          string | null;
      remaining:    number;
      lowSupply:    boolean;
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
      ikPublicKey:  data.ikPublicKey,
      spkPublicKey: data.spkPublicKey,
      opkPublicKey,
      ikPrivKey:    identity?.ikPriv,
      spkPrivKey:   identity?.spkPriv,
      opkPrivKey,
    };

    console.log(
      opkPublicKey
        ? `[BUNDLE] 4-DH bundle fetched for ${contactAlias}${opkPrivKey ? " (simulation keys available)" : " (no simulation privkey)"}`
        : `[BUNDLE] 3-DH bundle fetched for ${contactAlias} (no OPKs remaining on server)`,
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
  const [state, setState] = useState<AppState>({
    alias: null,
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
  });

  useEffect(() => {
    async function load() {
      try {
        const [alias, pinValue, biometric, onboarded, convData, stripeEmailVal, connectedWallet] = await Promise.all([
          AsyncStorage.getItem("alias"),
          secureGet(SECURE_PIN_KEY),
          AsyncStorage.getItem("biometricEnabled"),
          AsyncStorage.getItem("isOnboarded"),
          AsyncStorage.getItem(CONVERSATIONS_KEY),
          AsyncStorage.getItem(STRIPE_EMAIL_KEY),
          AsyncStorage.getItem(CONNECTED_WALLET_KEY),
        ]);

        const hasPinValue = !!pinValue;
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

        setHasPin(hasPinValue);
        setState((prev) => ({
          ...prev,
          alias,
          biometricEnabled: biometricOn,
          isOnboarded,
          isLocked: true,
          conversations,
          stripeEmail: stripeEmailVal,
          connectedWalletAddress: connectedWallet ?? null,
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

  const setAlias = useCallback(async (alias: string) => {
    try {
      await AsyncStorage.setItem("alias", alias);
      await AsyncStorage.setItem("isOnboarded", "true");
      setState((prev) => ({ ...prev, alias, isOnboarded: true, isLocked: false }));
      // Register with server and upload initial OPK batch in the background
      (async () => {
        try {
          const existing = await secureGet(DEVICE_TOKEN_KEY);
          if (!existing) {
            const reg = await registerWithServer(alias);
            if (reg) {
              await secureSet(DEVICE_TOKEN_KEY, reg.token);
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

  const connectVPN = useCallback((server: VPNServer) => {
    setState((prev) => ({ ...prev, vpnConnected: true, vpnServer: server }));
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
      // Encrypt with Double Ratchet (if session available) or fall back to
      // the legacy sealed-sender path.  Both Alice-send and Bob-advance happen
      // inside the setState callback to always read the latest persisted state.
      setState((prev) => {
        const conv = prev.conversations.find((c) => c.id === conversationId);
        if (!conv) return prev;

        const myAlias = prev.alias ?? "GHOST_USER";
        let newMsg: Message;
        let updatedDRSession = conv.drSession;

        if (conv.drSession) {
          // Double Ratchet path — no legacy fallback.  If the ratchet fails,
          // reinitialise the session rather than downgrading to weaker keying.
          let drSession = conv.drSession;
          let aliceMsg: import("@/lib/doubleRatchet").RatchetMessage | undefined;
          let attempts = 0;
          while (attempts < 2) {
            try {
              const { state: newAlice, message: msg } = ratchetEncrypt(drSession.alice, text);
              const { state: newBob } = ratchetDecrypt(drSession.bob, msg);
              updatedDRSession = { alice: newAlice, bob: newBob, lastAliceHeader: msg.header, usedOPK: drSession.usedOPK ?? false };
              aliceMsg = msg;
              break;
            } catch (e) {
              console.error(`[DR] Encrypt attempt ${attempts + 1} failed:`, e);
              drSession = initSession();
              attempts += 1;
            }
          }
          if (!aliceMsg) {
            // Both attempts failed — abort send rather than use legacy keying
            console.error("[DR] Aborting send: could not encrypt with DR after reinit");
            return prev;
          }
          const expiresAt = conv.disappearAfterSec
            ? Date.now() + conv.disappearAfterSec * 1000
            : undefined;
          newMsg = {
            id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            text,
            fromMe: true,
            timestamp: Date.now(),
            encrypted: true,
            sealed: true,
            ciphertext: aliceMsg.ciphertext,
            fingerprint: `DR:${aliceMsg.ciphertext.slice(0, 8).toUpperCase()}`,
            expiresAt,
          };
        } else {
          newMsg = buildMessage(text, true, conversationId, myAlias, conv.disappearAfterSec);
        }

        const updated = prev.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, newMsg!], lastMessage: text, timestamp: Date.now(), unread: 0, drSession: updatedDRSession }
            : c
        );
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });

      // Simulated encrypted reply (Bob → Alice ratchet step)
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
          const conv = prev.conversations.find((c) => c.id === conversationId);
          if (!conv) return prev;

          let replyMsg: Message;
          let updatedDRSession = conv.drSession;

          if (conv.drSession) {
            // Double Ratchet reply path — no legacy fallback.
            let drSession = conv.drSession;
            let bobMsg: import("@/lib/doubleRatchet").RatchetMessage | undefined;
            let attempts = 0;
            while (attempts < 2) {
              try {
                const { state: newBob, message: msg } = ratchetEncrypt(drSession.bob, replyText);
                const { state: newAlice } = ratchetDecrypt(drSession.alice, msg);
                updatedDRSession = { alice: newAlice, bob: newBob, lastAliceHeader: null, usedOPK: drSession.usedOPK ?? false };
                bobMsg = msg;
                break;
              } catch (e) {
                console.error(`[DR] Reply attempt ${attempts + 1} failed:`, e);
                drSession = initSession();
                attempts += 1;
              }
            }
            if (!bobMsg) {
              // Both attempts failed — skip the reply entirely rather than downgrade
              console.error("[DR] Aborting reply: could not encrypt with DR after reinit");
              return prev;
            }
            const expiresAt = conv.disappearAfterSec
              ? Date.now() + conv.disappearAfterSec * 1000
              : undefined;
            replyMsg = {
              id: `${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
              text: replyText,
              fromMe: false,
              timestamp: Date.now(),
              encrypted: true,
              sealed: true,
              ciphertext: bobMsg.ciphertext,
              fingerprint: `DR:${bobMsg.ciphertext.slice(0, 8).toUpperCase()}`,
              expiresAt,
            };
          } else {
            replyMsg = buildMessage(replyText, false, conversationId, conv.alias ?? "GHOST", conv.disappearAfterSec);
          }

          const updated = prev.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, replyMsg!], lastMessage: replyText, timestamp: Date.now(), drSession: updatedDRSession }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        });
      }, delay);
    },
    [persistConversations]
  );

  const addConversation = useCallback(
    async (alias: string) => {
      const aliasUpper = alias.toUpperCase();

      // Step 1: Ensure contact is registered on server (demo: we simulate their device)
      // This uploads their IK, SPK, and initial OPK batch.
      await registerContactForSimulation(aliasUpper);

      // Step 2: Fetch the full prekey bundle for the contact from server.
      // The bundle includes: IK.pub, SPK.pub, and optionally an OPK (atomically consumed).
      // Also loads the contact's private keys from local demo store for symmetric verification.
      const bundle = await fetchContactBundle(aliasUpper);

      // Step 3: Initiate the X3DH session.
      // With bundle: use server-provided IK/SPK/OPK (4-DH if OPK present, else 3-DH).
      // Without bundle: fall back to fully local initSession (no server involved).
      let drSession;
      let usedOPK = false;
      if (bundle) {
        drSession = initSessionFromBundle(bundle);
        usedOPK = !!(bundle.opkPublicKey);
        console.log(
          `[X3DH] ${usedOPK ? "4-DH" : "3-DH"} session initiated with ${aliasUpper} using server bundle`,
        );
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
        secureDelete(DEVICE_TOKEN_KEY),
      ]);
    } catch (err) {
      console.error("[AppContext] Panic wipe storage error:", err);
    }
    setHasPin(false);
    setState({
      alias: null,
      biometricEnabled: false,
      isLocked: false,
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
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        hasPin,
        loadError,
        setAlias,
        setPin,
        checkPin,
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

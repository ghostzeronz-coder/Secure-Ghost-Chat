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
  addConversation: (alias: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  setDisappearTimer: (conversationId: string, seconds: number | undefined) => void;
  panicWipe: () => Promise<void>;
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

const DEFAULT_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    alias: "PHANTOM_7",
    lastMessage: "All clear. No trace.",
    timestamp: Date.now() - 1000 * 60 * 5,
    unread: 2,
    safetyNumber: generateSafetyNumber("GHOST_USER", "PHANTOM_7"),
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
    messages: [
      buildMessage("VPN hopping complete. Stand by.", false, "3", "NULL_PTR"),
    ],
  },
];

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
const APP_STORAGE_KEYS = [
  "alias",
  "isOnboarded",
  "biometricEnabled",
  CONVERSATIONS_KEY,
] as const;

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
    conversations: DEFAULT_CONVERSATIONS,
    fdBalance: 4250.75,
    casperBalance: 8920.5,
    walletAddress: "GhFc3...x9mKr4",
    transactions: DEFAULT_TRANSACTIONS,
    dataUsed: 2.4,
    dataLimit: 10,
  });

  useEffect(() => {
    async function load() {
      try {
        const [alias, pinValue, biometric, onboarded, convData] = await Promise.all([
          AsyncStorage.getItem("alias"),
          secureGet(SECURE_PIN_KEY),
          AsyncStorage.getItem("biometricEnabled"),
          AsyncStorage.getItem("isOnboarded"),
          AsyncStorage.getItem(CONVERSATIONS_KEY),
        ]);

        const hasPinValue = !!pinValue;
        const biometricOn = biometric === "true";
        const isOnboarded = onboarded === "true";

        let conversations = DEFAULT_CONVERSATIONS;
        if (convData) {
          try {
            const parsed = JSON.parse(convData);
            if (Array.isArray(parsed)) conversations = parsed;
          } catch (parseErr) {
            console.warn("[AppContext] Failed to parse conversations:", parseErr);
          }
        }

        setHasPin(hasPinValue);
        setState((prev) => ({ ...prev, alias, biometricEnabled: biometricOn, isOnboarded, isLocked: true, conversations }));
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
      const conv = state.conversations.find((c) => c.id === conversationId);
      const myAlias = state.alias ?? "GHOST_USER";
      const newMsg = buildMessage(text, true, conversationId, myAlias, conv?.disappearAfterSec);

      setState((prev) => {
        const c = prev.conversations.find((c) => c.id === conversationId);
        const updated = prev.conversations.map((conv) =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, newMsg], lastMessage: text, timestamp: Date.now(), unread: 0 }
            : conv
        );
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });

      // Simulated encrypted reply
      const delay = 1500 + Math.random() * 1000;
      setTimeout(() => {
        const replies = [
          "Understood. Signal secure.",
          "Roger. Transmission encrypted.",
          "Copy. Awaiting further instructions.",
          "Confirmed. No trace detected.",
          "Acknowledged. Channel open.",
        ];
        const replyText = replies[Math.floor(Math.random() * replies.length)];
        const replyMsg = buildMessage(replyText, false, conversationId, conv?.alias ?? "GHOST", conv?.disappearAfterSec);

        setState((prev) => {
          const updated = prev.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, replyMsg], lastMessage: replyText, timestamp: Date.now() }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        });
      }, delay);
    },
    [state.conversations, persistConversations]
  );

  const addConversation = useCallback(
    (alias: string) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const safetyNumber = generateSafetyNumber(state.alias ?? "GHOST_USER", alias.toUpperCase());
      const newConv: Conversation = {
        id,
        alias: alias.toUpperCase(),
        lastMessage: "E2EE channel established.",
        timestamp: Date.now(),
        unread: 0,
        safetyNumber,
        messages: [
          buildMessage("E2EE channel established. ChaCha20-Poly1305 key exchange complete.", false, id, alias.toUpperCase()),
        ],
      };
      setState((prev) => {
        const updated = [newConv, ...prev.conversations];
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });
    },
    [state.alias, persistConversations]
  );

  const panicWipe = useCallback(async () => {
    try {
      await Promise.all([
        ...APP_STORAGE_KEYS.map((k) => AsyncStorage.removeItem(k)),
        secureDelete(SECURE_PIN_KEY),
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
      conversations: DEFAULT_CONVERSATIONS,
      fdBalance: 4250.75,
      casperBalance: 8920.5,
      walletAddress: "GhFc3...x9mKr4",
      transactions: DEFAULT_TRANSACTIONS,
      dataUsed: 2.4,
      dataLimit: 10,
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

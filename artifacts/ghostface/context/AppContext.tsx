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

export interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
  encrypted: boolean;
}

export interface Conversation {
  id: string;
  alias: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  messages: Message[];
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
  panicWipe: () => Promise<void>;
  loaded: boolean;
}

const DEFAULT_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    alias: "PHANTOM_7",
    lastMessage: "All clear. No trace.",
    timestamp: Date.now() - 1000 * 60 * 5,
    unread: 2,
    messages: [
      {
        id: "m1",
        text: "Connection established. Key exchange complete.",
        fromMe: false,
        timestamp: Date.now() - 1000 * 60 * 30,
        encrypted: true,
      },
      {
        id: "m2",
        text: "Copy that. Transfer ready.",
        fromMe: true,
        timestamp: Date.now() - 1000 * 60 * 20,
        encrypted: true,
      },
      {
        id: "m3",
        text: "All clear. No trace.",
        fromMe: false,
        timestamp: Date.now() - 1000 * 60 * 5,
        encrypted: true,
      },
    ],
  },
  {
    id: "2",
    alias: "WRAITH_X",
    lastMessage: "Package delivered. Secure.",
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    unread: 0,
    messages: [
      {
        id: "m4",
        text: "Initiating handshake.",
        fromMe: true,
        timestamp: Date.now() - 1000 * 60 * 60 * 3,
        encrypted: true,
      },
      {
        id: "m5",
        text: "Package delivered. Secure.",
        fromMe: false,
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        encrypted: true,
      },
    ],
  },
  {
    id: "3",
    alias: "NULL_PTR",
    lastMessage: "VPN hopping complete. Stand by.",
    timestamp: Date.now() - 1000 * 60 * 60 * 12,
    unread: 1,
    messages: [
      {
        id: "m6",
        text: "VPN hopping complete. Stand by.",
        fromMe: false,
        timestamp: Date.now() - 1000 * 60 * 60 * 12,
        encrypted: true,
      },
    ],
  },
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: "t1",
    type: "receive",
    token: "FD",
    amount: 500,
    address: "GhF3...x9mK",
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "t2",
    type: "send",
    token: "CASPER",
    amount: 120,
    address: "CsP7...v2nQ",
    timestamp: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: "t3",
    type: "receive",
    token: "CASPER",
    amount: 1000,
    address: "CsP9...r4wX",
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "t4",
    type: "send",
    token: "FD",
    amount: 200,
    address: "GhF1...m8pL",
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
  },
];

const VPN_SERVERS: VPNServer[] = [
  {
    id: "1",
    name: "US East",
    country: "United States",
    region: "New York",
    latency: 12,
    flag: "🇺🇸",
  },
  {
    id: "2",
    name: "EU West",
    country: "Germany",
    region: "Frankfurt",
    latency: 24,
    flag: "🇩🇪",
  },
  {
    id: "3",
    name: "Asia Pacific",
    country: "Japan",
    region: "Tokyo",
    latency: 68,
    flag: "🇯🇵",
  },
  {
    id: "4",
    name: "Nordic",
    country: "Sweden",
    region: "Stockholm",
    latency: 31,
    flag: "🇸🇪",
  },
  {
    id: "5",
    name: "Offshore",
    country: "Iceland",
    region: "Reykjavik",
    latency: 45,
    flag: "🇮🇸",
  },
  {
    id: "6",
    name: "SE Asia",
    country: "Singapore",
    region: "Singapore",
    latency: 92,
    flag: "🇸🇬",
  },
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
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }
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
        const [alias, pinValue, biometric, onboarded, convData] =
          await Promise.all([
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
            if (Array.isArray(parsed)) {
              conversations = parsed;
            }
          } catch (parseErr) {
            console.warn("[AppContext] Failed to parse conversations:", parseErr);
          }
        }

        setHasPin(hasPinValue);
        setState((prev) => ({
          ...prev,
          alias,
          biometricEnabled: biometricOn,
          isOnboarded,
          isLocked: isOnboarded,
          conversations,
        }));
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

  const persistConversations = useCallback(
    async (convs: Conversation[]) => {
      try {
        await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convs));
      } catch (err) {
        console.warn("[AppContext] Failed to persist conversations:", err);
      }
    },
    []
  );

  const setAlias = useCallback(async (alias: string) => {
    try {
      await AsyncStorage.setItem("alias", alias);
      await AsyncStorage.setItem("isOnboarded", "true");
      setState((prev) => ({
        ...prev,
        alias,
        isOnboarded: true,
        isLocked: false,
      }));
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
    setState((prev) => ({
      ...prev,
      vpnConnected: true,
      vpnServer: server,
    }));
  }, []);

  const disconnectVPN = useCallback(() => {
    setState((prev) => ({
      ...prev,
      vpnConnected: false,
      vpnServer: null,
    }));
  }, []);

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const newMsg: Message = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        text,
        fromMe: true,
        timestamp: Date.now(),
        encrypted: true,
      };
      setState((prev) => {
        const updated = prev.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, newMsg],
                lastMessage: text,
                timestamp: Date.now(),
                unread: 0,
              }
            : c
        );
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });

      setTimeout(() => {
        const replies = [
          "Understood. Signal secure.",
          "Roger. Transmission encrypted.",
          "Copy. Awaiting further instructions.",
          "Confirmed. No trace detected.",
          "Acknowledged. Channel open.",
        ];
        const replyText = replies[Math.floor(Math.random() * replies.length)];
        const replyMsg: Message = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          text: replyText,
          fromMe: false,
          timestamp: Date.now(),
          encrypted: true,
        };
        setState((prev) => {
          const updated = prev.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, replyMsg],
                  lastMessage: replyText,
                  timestamp: Date.now(),
                }
              : c
          );
          persistConversations(updated);
          return { ...prev, conversations: updated };
        });
      }, 1500 + Math.random() * 1000);
    },
    [persistConversations]
  );

  const addConversation = useCallback(
    (alias: string) => {
      const newConv: Conversation = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        alias: alias.toUpperCase(),
        lastMessage: "E2EE channel established.",
        timestamp: Date.now(),
        unread: 0,
        messages: [
          {
            id: Date.now().toString(),
            text: "E2EE channel established. X3DH key exchange complete.",
            fromMe: false,
            timestamp: Date.now(),
            encrypted: true,
          },
        ],
      };
      setState((prev) => {
        const updated = [newConv, ...prev.conversations];
        persistConversations(updated);
        return { ...prev, conversations: updated };
      });
    },
    [persistConversations]
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

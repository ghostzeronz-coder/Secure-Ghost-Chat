import AsyncStorage from "@react-native-async-storage/async-storage";
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
  pin: string | null;
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
  setAlias: (alias: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
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

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<AppState>({
    alias: null,
    pin: null,
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

  useEffect(() => {
    async function load() {
      try {
        const [alias, pin, biometric, onboarded] = await Promise.all([
          AsyncStorage.getItem("alias"),
          AsyncStorage.getItem("pin"),
          AsyncStorage.getItem("biometricEnabled"),
          AsyncStorage.getItem("isOnboarded"),
        ]);
        setState((prev) => ({
          ...prev,
          alias,
          pin,
          biometricEnabled: biometric === "true",
          isOnboarded: onboarded === "true",
          isLocked: !!pin || biometric === "true",
        }));
      } catch (e) {
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  const setAlias = useCallback(async (alias: string) => {
    await AsyncStorage.setItem("alias", alias);
    await AsyncStorage.setItem("isOnboarded", "true");
    setState((prev) => ({ ...prev, alias, isOnboarded: true }));
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await AsyncStorage.setItem("pin", pin);
    setState((prev) => ({ ...prev, pin }));
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem("biometricEnabled", String(enabled));
    setState((prev) => ({ ...prev, biometricEnabled: enabled }));
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
        id:
          Date.now().toString() + Math.random().toString(36).substr(2, 9),
        text,
        fromMe: true,
        timestamp: Date.now(),
        encrypted: true,
      };
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, newMsg],
                lastMessage: text,
                timestamp: Date.now(),
                unread: 0,
              }
            : c
        ),
      }));

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
          id:
            Date.now().toString() + Math.random().toString(36).substr(2, 9),
          text: replyText,
          fromMe: false,
          timestamp: Date.now(),
          encrypted: true,
        };
        setState((prev) => ({
          ...prev,
          conversations: prev.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, replyMsg],
                  lastMessage: replyText,
                  timestamp: Date.now(),
                }
              : c
          ),
        }));
      }, 1500 + Math.random() * 1000);
    },
    []
  );

  const addConversation = useCallback((alias: string) => {
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
    setState((prev) => ({
      ...prev,
      conversations: [newConv, ...prev.conversations],
    }));
  }, []);

  const panicWipe = useCallback(async () => {
    await AsyncStorage.clear();
    setState({
      alias: null,
      pin: null,
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
        setAlias,
        setPin,
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

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

type Sms = {
  id: number;
  fromNumber: string;
  toNumber: string;
  body: string;
  direction: string;
  createdAt: string;
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

export default function SmsInboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, deviceToken } = useApp();
  const { numberId, phoneNumber } = useLocalSearchParams<{
    numberId: string;
    phoneNumber: string;
  }>();

  const [messages, setMessages] = useState<Sms[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMessages = useCallback(async (): Promise<boolean> => {
    if (!alias || !deviceToken || !numberId) return false;
    try {
      const res = await fetch(
        `${API_BASE}/numbers/${numberId}/sms?alias=${alias}`,
        {
          headers: {
            Authorization: `Bearer ${deviceToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMessages(json.data ?? []);
      setFetchError(false);
      return true;
    } catch {
      setFetchError(true);
      return false;
    }
  }, [alias, deviceToken, numberId]);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    await fetchMessages();
    setLoading(false);
  }, [fetchMessages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  }, [fetchMessages]);

  useEffect(() => {
    load();
  }, [load]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 16,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: { flex: 1 },
    headerLabel: {
      color: colors.mutedForeground,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 3,
      marginBottom: 2,
    },
    headerPhone: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1,
    },
    divider: { height: 1, backgroundColor: colors.border },
    scroll: { flex: 1 },
    listContent: { padding: 20, paddingBottom: 40 },
    centerWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      gap: 12,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(0,200,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    centerTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 4,
    },
    centerBody: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 1,
      textAlign: "center",
      lineHeight: 18,
      maxWidth: 240,
    },
    retryBtn: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: colors.radius,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    retryBtnText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 2,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 10,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    fromRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    fromDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,200,255,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },
    fromNumber: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
    },
    timestamp: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: "600",
    },
    body: {
      color: colors.foreground,
      fontSize: 13,
      lineHeight: 20,
      letterSpacing: 0.3,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerLabel}>SMS INBOX</Text>
          <Text style={styles.headerPhone} numberOfLines={1}>
            {phoneNumber ?? `#${numberId}`}
          </Text>
        </View>
        <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : fetchError ? (
        <View style={styles.centerWrap}>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(255,59,48,0.08)" }]}>
            <Ionicons name="warning-outline" size={28} color={colors.destructive} />
          </View>
          <Text style={[styles.centerTitle, { color: colors.destructive }]}>
            LOAD FAILED
          </Text>
          <Text style={styles.centerBody}>
            Could not retrieve messages. Check your connection and try again.
          </Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>RETRY</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.centerWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.centerTitle}>NO MESSAGES YET</Text>
              <Text style={styles.centerBody}>
                Share your ghost number to start receiving anonymous SMS. Messages appear here instantly.
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View key={msg.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.fromRow}>
                    <View style={styles.fromDot}>
                      <Ionicons
                        name="person-outline"
                        size={14}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.fromNumber}>{msg.fromNumber}</Text>
                  </View>
                  <Text style={styles.timestamp}>{formatTime(msg.createdAt)}</Text>
                </View>
                <Text style={styles.body}>{msg.body}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

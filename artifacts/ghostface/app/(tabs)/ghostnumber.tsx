import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type GhostNumber = {
  id: number;
  phoneNumber: string;
  country: string;
  capabilities: string[];
  plan: string;
  status: string;
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

export default function GhostNumberScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, deviceToken } = useApp();

  const [numbers, setNumbers] = useState<GhostNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [releasing, setReleasing] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${deviceToken ?? ""}`,
    }),
    [deviceToken]
  );

  const fetchNumbers = useCallback(async (): Promise<boolean> => {
    if (!alias || !deviceToken) return false;
    try {
      const res = await fetch(`${API_BASE}/numbers?alias=${alias}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setNumbers(json.data ?? []);
      setFetchError(false);
      return true;
    } catch {
      setFetchError(true);
      return false;
    }
  }, [alias, deviceToken, authHeaders]);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    await fetchNumbers();
    setLoading(false);
  }, [fetchNumbers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNumbers();
    setRefreshing(false);
  }, [fetchNumbers]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAcquire = async () => {
    if (!alias || !deviceToken) {
      Alert.alert("NOT READY", "Finish onboarding before acquiring a ghost number.");
      return;
    }
    setProvisioning(true);
    try {
      const res = await fetch(`${API_BASE}/numbers/provision?alias=${alias}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ country: "NZ", capabilities: ["sms"] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Provisioning failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchNumbers();
    } catch (err: any) {
      Alert.alert("ERROR", err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProvisioning(false);
    }
  };

  const handleRelease = (number: GhostNumber) => {
    Alert.alert(
      "RELEASE NUMBER",
      `Release ${number.phoneNumber}?\n\nThis cannot be undone.`,
      [
        { text: "CANCEL", style: "cancel" },
        {
          text: "RELEASE",
          style: "destructive",
          onPress: async () => {
            setReleasing(number.id);
            try {
              const res = await fetch(
                `${API_BASE}/numbers/${number.id}?alias=${alias}`,
                { method: "DELETE", headers: authHeaders() }
              );
              const json = await res.json();
              if (!res.ok) throw new Error(json.error ?? "Release failed");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchNumbers();
            } catch (err: any) {
              Alert.alert("ERROR", err.message);
            } finally {
              setReleasing(null);
            }
          },
        },
      ]
    );
  };

  const handleCopy = async (number: GhostNumber) => {
    await Clipboard.setStringAsync(number.phoneNumber);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(number.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 16,
    },
    headerTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 4,
    },
    divider: { height: 1, backgroundColor: colors.border },
    scroll: { flex: 1 },
    listContent: { padding: 20, paddingBottom: 120 },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
      gap: 12,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(0,200,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 4,
    },
    emptyBody: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 1,
      textAlign: "center",
      lineHeight: 18,
      maxWidth: 240,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: "rgba(0,200,255,0.25)",
      padding: 18,
      marginBottom: 14,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,200,255,0.1)",
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    statusText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
    },
    planBadge: {
      backgroundColor: "rgba(153,69,255,0.12)",
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    planText: {
      color: "#9945FF",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
    },
    phoneRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    phoneNumber: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 2,
      flex: 1,
    },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    copyBtnText: {
      color: colors.foreground,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 1,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    metaChipText: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: "600",
    },
    inboxHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingTop: 2,
      paddingBottom: 14,
    },
    inboxHintText: {
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 2,
    },
    cardDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    releaseBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: "rgba(255,59,48,0.35)",
      borderRadius: colors.radius,
      paddingVertical: 10,
    },
    releaseBtnText: {
      color: colors.destructive,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      paddingBottom: insets.bottom + 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    acquireBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    acquireBtnDisabled: {
      opacity: 0.5,
    },
    acquireBtnText: {
      color: "#000",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 3,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GHOST NUMBER</Text>
        <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : fetchError ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="warning-outline" size={28} color={colors.destructive} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.destructive }]}>LOAD FAILED</Text>
          <Text style={styles.emptyBody}>
            Could not retrieve your ghost numbers. Check your connection and try again.
          </Text>
          <Pressable
            style={{
              marginTop: 16,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: colors.radius,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
            onPress={load}
          >
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>
              RETRY
            </Text>
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
          {numbers.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="phone-portrait-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>NO GHOST NUMBERS</Text>
              <Text style={styles.emptyBody}>
                Acquire a number to receive SMS anonymously. Your identity stays hidden.
              </Text>
            </View>
          ) : (
            numbers.map((n) => (
              <View key={n.id} style={styles.card}>
                {/* Tappable upper area → SMS inbox */}
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/sms-inbox/[numberId]",
                      params: {
                        numberId: String(n.id),
                        phoneNumber: n.phoneNumber,
                      },
                    })
                  }
                >
                  <View style={styles.cardHead}>
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>{n.status.toUpperCase()}</Text>
                    </View>
                    <View style={styles.planBadge}>
                      <Text style={styles.planText}>{n.plan.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.phoneRow}>
                    <Text style={styles.phoneNumber}>{n.phoneNumber}</Text>
                    <Pressable style={styles.copyBtn} onPress={() => handleCopy(n)}>
                      <Ionicons
                        name={copied === n.id ? "checkmark" : "copy-outline"}
                        size={12}
                        color={copied === n.id ? colors.success : colors.foreground}
                      />
                      <Text style={[styles.copyBtnText, copied === n.id && { color: colors.success }]}>
                        {copied === n.id ? "COPIED" : "COPY"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaChip}>
                      <Ionicons name="globe-outline" size={10} color={colors.mutedForeground} />
                      <Text style={styles.metaChipText}>{n.country}</Text>
                    </View>
                    {(n.capabilities as string[]).map((cap) => (
                      <View key={cap} style={styles.metaChip}>
                        <Ionicons
                          name={cap === "SMS" ? "chatbubble-outline" : "call-outline"}
                          size={10}
                          color={colors.mutedForeground}
                        />
                        <Text style={styles.metaChipText}>{cap}</Text>
                      </View>
                    ))}
                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={10} color={colors.mutedForeground} />
                      <Text style={styles.metaChipText}>{formatTime(n.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Inbox chevron hint */}
                  <View style={styles.inboxHint}>
                    <Ionicons name="mail-outline" size={12} color={colors.mutedForeground} />
                    <Text style={styles.inboxHintText}>VIEW SMS INBOX</Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.mutedForeground} />
                  </View>
                </Pressable>

                <View style={styles.cardDivider} />

                <Pressable
                  style={styles.releaseBtn}
                  onPress={() => handleRelease(n)}
                  disabled={releasing === n.id}
                >
                  {releasing === n.id ? (
                    <ActivityIndicator size="small" color={colors.destructive} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={12} color={colors.destructive} />
                      <Text style={styles.releaseBtnText}>RELEASE NUMBER</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          style={[styles.acquireBtn, provisioning && styles.acquireBtnDisabled]}
          onPress={handleAcquire}
          disabled={provisioning}
        >
          {provisioning ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={16} color="#000" />
              <Text style={styles.acquireBtnText}>ACQUIRE NUMBER</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

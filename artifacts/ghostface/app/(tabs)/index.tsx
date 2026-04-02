import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostLogo } from "@/components/GhostLogo";
import { SecureBadge } from "@/components/SecureBadge";
import { StatusDot } from "@/components/StatusDot";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    alias,
    vpnConnected,
    vpnServer,
    conversations,
    fdBalance,
    casperBalance,
  } = useApp();

  const recentActivity = [
    ...conversations.flatMap((c) =>
      c.messages.slice(-1).map((m) => ({
        id: c.id + m.id,
        type: "message" as const,
        label: c.alias,
        subtitle: m.text.slice(0, 40) + (m.text.length > 40 ? "..." : ""),
        time: m.timestamp,
      }))
    ),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 5);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 16,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    aliasText: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
    statusLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    sectionLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      fontWeight: "700" as const,
      marginBottom: 12,
    },
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statusItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusItemLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 2,
    },
    statusItemValue: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: "700" as const,
      letterSpacing: 1,
    },
    balanceRow: {
      flexDirection: "row",
      gap: 12,
    },
    balanceCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    balanceToken: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      fontWeight: "700" as const,
      marginBottom: 4,
    },
    balanceAmount: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "800" as const,
      letterSpacing: 1,
    },
    balanceLabel: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 1,
      marginTop: 2,
    },
    activityItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      gap: 12,
    },
    activityIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    activityContent: {
      flex: 1,
    },
    activityLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "600" as const,
      letterSpacing: 1,
    },
    activitySub: {
      color: colors.mutedForeground,
      fontSize: 11,
      marginTop: 2,
    },
    activityTime: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 1,
    },
    activityDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 48,
    },
    quickActions: {
      flexDirection: "row",
      gap: 12,
    },
    quickAction: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      alignItems: "center",
      gap: 8,
    },
    quickActionText: {
      color: colors.foreground,
      fontSize: 10,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
    scrollPad: {
      height: 120,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <GhostLogo size={28} color={colors.foreground} />
          <View>
            <Text style={styles.aliasText}>{alias ?? "GHOST_00"}</Text>
            <Text style={styles.statusLabel}>SECURE IDENTITY</Text>
          </View>
        </View>
        <SecureBadge type="no-trace" />
      </View>
      <View style={styles.divider} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SECURITY STATUS</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusItemLeft}>
                <StatusDot active={vpnConnected} size={6} />
                <Text style={styles.statusItemLabel}>VPN</Text>
              </View>
              <Text style={[styles.statusItemValue, { color: vpnConnected ? colors.success : colors.destructive }]}>
                {vpnConnected ? (vpnServer?.name ?? "CONNECTED") : "DISCONNECTED"}
              </Text>
            </View>
            <View style={[styles.statusRow]}>
              <View style={styles.statusItemLeft}>
                <StatusDot active pulse={false} size={6} />
                <Text style={styles.statusItemLabel}>E2EE</Text>
              </View>
              <Text style={[styles.statusItemValue, { color: colors.success }]}>ACTIVE</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={styles.statusItemLeft}>
                <StatusDot active pulse={false} size={6} />
                <Text style={styles.statusItemLabel}>IDENTITY</Text>
              </View>
              <Text style={[styles.statusItemValue, { color: colors.success }]}>MASKED</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WALLET</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceToken}>FD</Text>
              <Text style={styles.balanceAmount}>
                {fdBalance.toLocaleString()}
              </Text>
              <Text style={styles.balanceLabel}>FACE DOLLAR</Text>
            </View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceToken}>CSPR</Text>
              <Text style={styles.balanceAmount}>
                {casperBalance.toLocaleString()}
              </Text>
              <Text style={styles.balanceLabel}>CASPER</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.quickActions}>
            <Pressable
              style={({ pressed }) => [
                styles.quickAction,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/messages");
              }}
            >
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
              <Text style={styles.quickActionText}>NEW MSG</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.quickAction,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: "/call",
                  params: { alias: "SECURE_LINE", mode: "voice" },
                });
              }}
            >
              <Ionicons name="call" size={22} color={colors.primary} />
              <Text style={styles.quickActionText}>CALL</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.quickAction,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/vpn");
              }}
            >
              <Ionicons name="shield" size={22} color={vpnConnected ? colors.success : colors.mutedForeground} />
              <Text style={styles.quickActionText}>{vpnConnected ? "VPN ON" : "VPN OFF"}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.quickAction,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/wallet");
              }}
            >
              <Ionicons name="wallet" size={22} color={colors.primary} />
              <Text style={styles.quickActionText}>WALLET</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          {recentActivity.map((item, idx) => (
            <View key={item.id}>
              <View style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityLabel}>{item.label}</Text>
                  <Text style={styles.activitySub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                <Text style={styles.activityTime}>
                  {formatRelative(item.time)}
                </Text>
              </View>
              {idx < recentActivity.length - 1 && (
                <View style={styles.activityDivider} />
              )}
            </View>
          ))}
        </View>

        <View style={styles.scrollPad} />
      </ScrollView>
    </View>
  );
}

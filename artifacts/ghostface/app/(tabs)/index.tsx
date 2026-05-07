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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostLogo } from "@/components/GhostLogo";
import { SecureBadge } from "@/components/SecureBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, vpnConnected, fdBalance, casperBalance } = useApp();
  const { height: screenHeight } = useWindowDimensions();

  const logoSize = Math.round(screenHeight * 0.48);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
    },
    heroBlock: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 16,
      paddingBottom: 8,
    },
    aliasText: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: "800" as const,
      letterSpacing: 4,
      marginTop: 12,
    },
    tagline: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      marginTop: 4,
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
        <SecureBadge type="no-trace" />
      </View>
      <View style={styles.divider} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <GhostLogo size={logoSize} color={colors.foreground} />
          <Text style={styles.aliasText}>{alias ?? "GHOST_00"}</Text>
          <Text style={styles.tagline}>SECURE IDENTITY</Text>
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

        <View style={styles.scrollPad} />
      </ScrollView>
    </View>
  );
}

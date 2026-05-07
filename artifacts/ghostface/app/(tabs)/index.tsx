import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
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
import { StatusDot } from "@/components/StatusDot";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, vpnConnected, vpnServer, fdBalance, casperBalance, panicWipe } = useApp();
  const { height: screenHeight } = useWindowDimensions();
  const [panicModalVisible, setPanicModalVisible] = useState(false);
  const [wiping, setWiping] = useState(false);

  const stripAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    Animated.stagger(
      100,
      stripAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  const logoSize = Math.round(screenHeight * 0.72);

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
    statusStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 14,
      gap: 0,
    },
    statusItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusLabel: {
      fontSize: 9,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
    statusDivider: {
      width: 1,
      height: 10,
      backgroundColor: colors.border,
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
    panicSection: {
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    panicButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: "transparent",
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: "#7f1d1d",
      paddingVertical: 14,
    },
    panicButtonText: {
      color: "#ef4444",
      fontSize: 11,
      letterSpacing: 3,
      fontWeight: "800" as const,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: "#7f1d1d",
      padding: 28,
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
    },
    modalTitle: {
      color: "#ef4444",
      fontSize: 14,
      fontWeight: "800" as const,
      letterSpacing: 4,
      marginBottom: 12,
    },
    modalBody: {
      color: colors.mutedForeground,
      fontSize: 12,
      letterSpacing: 1,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 28,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    modalCancel: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      alignItems: "center",
    },
    modalCancelText: {
      color: colors.foreground,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
    modalConfirm: {
      flex: 1,
      backgroundColor: "#7f1d1d",
      borderRadius: colors.radius,
      paddingVertical: 12,
      alignItems: "center",
    },
    modalConfirmText: {
      color: "#fca5a5",
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: "700" as const,
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

          <View style={styles.statusStrip}>
            <Animated.View style={{ opacity: stripAnims[0] }}>
              <Pressable
                style={({ pressed }) => [
                  styles.statusItem,
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityLabel={vpnConnected ? `VPN connected via ${vpnServer?.name ?? "server"}, tap to manage` : "VPN disconnected, tap to connect"}
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(tabs)/vpn");
                }}
              >
                <StatusDot active={vpnConnected} size={5} pulse={vpnConnected} />
                <Text
                  style={[
                    styles.statusLabel,
                    { color: vpnConnected ? colors.success : colors.mutedForeground },
                  ]}
                >
                  {vpnConnected ? `VPN · ${vpnServer?.flag ?? vpnServer?.name ?? "ACTIVE"}` : "VPN OFF"}
                </Text>
              </Pressable>
            </Animated.View>

            <View style={styles.statusDivider} />

            <Animated.View style={{ opacity: stripAnims[1] }}>
              <Pressable
                style={({ pressed }) => [
                  styles.statusItem,
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityLabel="End-to-end encryption active, tap for settings"
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(tabs)/settings");
                }}
              >
                <StatusDot active size={5} pulse={false} />
                <Text style={[styles.statusLabel, { color: colors.success }]}>
                  E2EE
                </Text>
              </Pressable>
            </Animated.View>

            <View style={styles.statusDivider} />

            <Animated.View style={{ opacity: stripAnims[2] }}>
              <Pressable
                style={({ pressed }) => [
                  styles.statusItem,
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityLabel="Identity masked, tap for settings"
                accessibilityRole="button"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(tabs)/settings");
                }}
              >
                <StatusDot active size={5} pulse={false} />
                <Text style={[styles.statusLabel, { color: colors.success }]}>
                  ID MASKED
                </Text>
              </Pressable>
            </Animated.View>
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

        <View style={styles.panicSection}>
          <Pressable
            style={({ pressed }) => [
              styles.panicButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setPanicModalVisible(true);
            }}
          >
            <Ionicons name="warning" size={16} color="#ef4444" />
            <Text style={styles.panicButtonText}>PANIC WIPE</Text>
          </Pressable>
        </View>

        <View style={styles.scrollPad} />
      </ScrollView>

      <Modal
        visible={panicModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!wiping) setPanicModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>PANIC WIPE</Text>
            <Text style={styles.modalBody}>
              This will permanently erase all messages, contacts, keys, and session data. The app will reset to onboarding.{"\n\n"}This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancel,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  if (!wiping) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPanicModalVisible(false);
                  }
                }}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirm,
                  pressed && { opacity: 0.7 },
                  wiping && { opacity: 0.5 },
                ]}
                onPress={async () => {
                  if (wiping) return;
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  setWiping(true);
                  await panicWipe();
                  setWiping(false);
                  setPanicModalVisible(false);
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {wiping ? "WIPING..." : "WIPE ALL"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

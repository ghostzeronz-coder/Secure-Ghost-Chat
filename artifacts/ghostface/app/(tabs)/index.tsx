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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostLogo } from "@/components/GhostLogo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, vpnConnected, vpnServer, fdBalance, casperBalance, panicWipe } = useApp();
  const [panicModalVisible, setPanicModalVisible] = useState(false);
  const [wiping, setWiping] = useState(false);

  const chipAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const pulseAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    Animated.stagger(
      80,
      chipAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        })
      )
    ).start();

    pulseAnims.forEach((anim) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const vpnLabel = vpnConnected
    ? ["VPN ·", vpnServer?.flag, vpnServer?.shortRegion ?? vpnServer?.name ?? "ACTIVE"]
        .filter(Boolean)
        .join(" ")
    : "VPN OFF";

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Top Command Bar ──────────────────────────────────────────
    commandBar: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8),
      paddingBottom: 10,
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    chip: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 6,
      borderLeftWidth: 2,
      paddingVertical: 8,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    chipPulseDot: {
      position: "absolute",
      top: 5,
      right: 5,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    chipLabel: {
      fontSize: 9,
      fontWeight: "700" as const,
      letterSpacing: 1.5,
      textAlign: "center",
    },

    // ── Identity Section ─────────────────────────────────────────
    identity: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 32,
      paddingBottom: 28,
      paddingHorizontal: 24,
    },
    aliasText: {
      color: colors.foreground,
      fontSize: 28,
      fontWeight: "300" as const,
      letterSpacing: 10,
      marginTop: 20,
      marginBottom: 6,
    },
    tagline: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 4,
      fontWeight: "700" as const,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 0,
    },

    // ── Wallet Stack ─────────────────────────────────────────────
    walletSection: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
      gap: 12,
    },
    walletCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    walletLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    walletCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#1A1A1A",
      alignItems: "center",
      justifyContent: "center",
    },
    walletCircleText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: "800" as const,
      letterSpacing: 1,
    },
    walletAmount: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "700" as const,
      letterSpacing: 1,
      fontVariant: ["tabular-nums"],
    },
    walletCoinLabel: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 3,
      fontWeight: "700" as const,
    },

    // ── Quick Actions ─────────────────────────────────────────────
    actionsSection: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    actionItem: {
      alignItems: "center",
      gap: 10,
    },
    actionCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    actionLabel: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },

    // ── Panic Button ──────────────────────────────────────────────
    panicSection: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    panicButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "#7f1d1d",
      backgroundColor: "rgba(239,68,68,0.08)",
      paddingVertical: 16,
    },
    panicButtonText: {
      color: "#ef4444",
      fontSize: 12,
      letterSpacing: 4,
      fontWeight: "800" as const,
    },

    // ── Panic Modal ───────────────────────────────────────────────
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
    scrollPad: {
      height: 20,
    },
  });

  const chipData = [
    {
      label: vpnLabel,
      color: vpnConnected ? colors.success : colors.mutedForeground,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/(tabs)/vpn");
      },
    },
    {
      label: "E2EE",
      color: colors.success,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/(tabs)/settings");
      },
    },
    {
      label: "ID MASKED",
      color: colors.success,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/(tabs)/settings");
      },
    },
  ];

  return (
    <View style={styles.container}>
      {/* ── Command Bar ── */}
      <View style={styles.commandBar}>
        {chipData.map((chip, i) => (
          <Animated.View key={i} style={{ flex: 1, opacity: chipAnims[i] }}>
            <Pressable
              style={({ pressed }) => [
                styles.chip,
                { borderLeftColor: chip.color },
                pressed && { opacity: 0.6 },
              ]}
              onPress={chip.onPress}
            >
              <Animated.View
                style={[styles.chipPulseDot, { backgroundColor: chip.color, opacity: pulseAnims[i] }]}
              />
              <Text style={[styles.chipLabel, { color: chip.color }]}>
                {chip.label}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Identity ── */}
        <View style={styles.identity}>
          <GhostLogo size={100} color={colors.foreground} />
          <Text style={styles.aliasText}>{alias ?? "GHOST_00"}</Text>
          <Text style={styles.tagline}>SECURE IDENTITY</Text>
        </View>

        <View style={styles.divider} />

        {/* ── Wallet Stack ── */}
        <View style={styles.walletSection}>
          <Pressable
            style={({ pressed }) => [styles.walletCard, pressed && { opacity: 0.75 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/wallet");
            }}
          >
            <View style={styles.walletLeft}>
              <View style={styles.walletCircle}>
                <Text style={styles.walletCircleText}>FD</Text>
              </View>
              <Text style={styles.walletAmount}>{fdBalance.toLocaleString()}</Text>
            </View>
            <Text style={styles.walletCoinLabel}>FACE DOLLAR</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.walletCard, pressed && { opacity: 0.75 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/wallet");
            }}
          >
            <View style={styles.walletLeft}>
              <View style={styles.walletCircle}>
                <Text style={styles.walletCircleText}>CS</Text>
              </View>
              <Text style={styles.walletAmount}>{casperBalance.toLocaleString()}</Text>
            </View>
            <Text style={styles.walletCoinLabel}>CASPER</Text>
          </Pressable>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.actionsSection}>
          <Pressable
            style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/messages");
            }}
          >
            <View style={styles.actionCircle}>
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>NEW MSG</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: "/call", params: { alias: "SECURE_LINE", mode: "voice" } });
            }}
          >
            <View style={styles.actionCircle}>
              <Ionicons name="call" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>CALL</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/vpn");
            }}
          >
            <View style={[
              styles.actionCircle,
              vpnConnected && { borderColor: colors.success, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 8 },
            ]}>
              <Ionicons
                name="shield"
                size={22}
                color={vpnConnected ? colors.success : colors.mutedForeground}
              />
            </View>
            <Text style={[styles.actionLabel, vpnConnected && { color: colors.success }]}>
              {vpnConnected ? "VPN ON" : "VPN OFF"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/wallet");
            }}
          >
            <View style={styles.actionCircle}>
              <Ionicons name="wallet" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>WALLET</Text>
          </Pressable>
        </View>

        {/* ── Panic Button ── */}
        <View style={styles.panicSection}>
          <Pressable
            style={({ pressed }) => [styles.panicButton, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setPanicModalVisible(true);
            }}
          >
            <Ionicons name="warning" size={18} color="#ef4444" />
            <Text style={styles.panicButtonText}>PANIC WIPE</Text>
          </Pressable>
        </View>

        <View style={styles.scrollPad} />
      </ScrollView>

      {/* ── Panic Modal ── */}
      <Modal
        visible={panicModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!wiping) setPanicModalVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>PANIC WIPE</Text>
            <Text style={styles.modalBody}>
              This will permanently erase all messages, contacts, keys, and session data. The app will reset to onboarding.{"\n\n"}This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && { opacity: 0.7 }]}
                onPress={() => { if (!wiping) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPanicModalVisible(false); } }}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalConfirm, pressed && { opacity: 0.7 }, wiping && { opacity: 0.5 }]}
                onPress={async () => {
                  if (wiping) return;
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  setWiping(true);
                  await panicWipe();
                  setWiping(false);
                  setPanicModalVisible(false);
                }}
              >
                <Text style={styles.modalConfirmText}>{wiping ? "WIPING..." : "WIPE ALL"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

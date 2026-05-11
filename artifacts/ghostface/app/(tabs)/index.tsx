import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostLogo } from "@/components/GhostLogo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { TabScreenWrapper } from "@/components/TabScreenWrapper";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, vpnConnected, panicWipe } = useApp();
  const [panicModalVisible, setPanicModalVisible] = useState(false);
  const [wiping, setWiping] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Identity Section ─────────────────────────────────────────
    identity: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: insets.top + (Platform.OS === "web" ? 72 : 40),
      paddingBottom: 32,
      paddingHorizontal: 24,
    },
    aliasText: {
      color: colors.foreground,
      fontSize: 32,
      fontWeight: "800" as const,
      letterSpacing: 10,
      marginTop: 24,
      marginBottom: 6,
    },
    tagline: {
      color: colors.foreground,
      fontSize: 12,
      letterSpacing: 5,
      fontWeight: "800" as const,
      opacity: 0.6,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
    },

    // ── Quick Actions ─────────────────────────────────────────────
    actionsSection: {
      paddingHorizontal: 20,
      paddingTop: 32,
      paddingBottom: 24,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    actionItem: {
      alignItems: "center",
      gap: 10,
    },
    actionCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    actionLabel: {
      color: colors.foreground,
      fontSize: 10,
      letterSpacing: 2,
      fontWeight: "800" as const,
    },

    // ── Panic Button (fixed at bottom above tab bar) ──────────────
    panicSection: {
      paddingHorizontal: 20,
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 90 : 80),
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
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
    // ── Upgrade Banner ────────────────────────────────────────────
    upgradeBanner: {
      marginHorizontal: 20,
      marginBottom: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#9945FF44",
      backgroundColor: "#9945FF12",
      overflow: "hidden",
    },
    upgradeBannerInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    upgradeBannerIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "#9945FF22",
      borderWidth: 1,
      borderColor: "#9945FF55",
      alignItems: "center",
      justifyContent: "center",
    },
    upgradeBannerText: {
      flex: 1,
    },
    upgradeBannerTitle: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
    upgradeBannerSub: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 2,
      marginTop: 2,
    },
    upgradeBannerBadge: {
      backgroundColor: "#9945FF",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    upgradeBannerBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800" as const,
      letterSpacing: 2,
    },

    scrollPad: {
      height: 40,
    },
  });

  return (
    <TabScreenWrapper>
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Identity ── */}
        <View style={styles.identity}>
          <GhostLogo size={300} color="#FFB800" />
          <Text style={styles.aliasText}>{alias ?? "GHOST_00"}</Text>
          <Text style={styles.tagline}>SECURE IDENTITY</Text>
        </View>

        <View style={styles.divider} />

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
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.foreground} />
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
              <Ionicons name="call" size={22} color={colors.foreground} />
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
              vpnConnected && { borderColor: colors.border },
            ]}>
              <Ionicons
                name="shield"
                size={22}
                color={colors.foreground}
              />
            </View>
            <Text style={styles.actionLabel}>
              {vpnConnected ? "VPN ON" : "VPN"}
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
              <Ionicons name="wallet" size={22} color={colors.foreground} />
            </View>
            <Text style={styles.actionLabel}>WALLET</Text>
          </Pressable>
        </View>

        {/* ── Upgrade Banner ── */}
        <Pressable
          style={({ pressed }) => [styles.upgradeBanner, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/paywall");
          }}
        >
          <View style={styles.upgradeBannerInner}>
            <View style={styles.upgradeBannerIconWrap}>
              <Ionicons name="flash" size={18} color="#9945FF" />
            </View>
            <View style={styles.upgradeBannerText}>
              <Text style={styles.upgradeBannerTitle}>7-DAY FREE TRIAL</Text>
              <Text style={styles.upgradeBannerSub}>UNLOCK VPN · WALLET · GHOST NUMBER · MORE</Text>
            </View>
            <View style={styles.upgradeBannerBadge}>
              <Text style={styles.upgradeBannerBadgeText}>START FREE</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.scrollPad} />
      </ScrollView>

      {/* ── Panic Button (fixed bottom) ── */}
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
                <Text style={styles.modalConfirmText}>{wiping ? "WIPING..." : "WIPE ALL"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </TabScreenWrapper>
  );
}

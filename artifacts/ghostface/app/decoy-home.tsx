import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

/**
 * Rendered in place of the real tab navigator when the decoy PIN was used
 * to unlock. Deliberately self-contained: it never imports or mounts the
 * real (tabs) screens, so conversation/wallet/VPN state can't be reached
 * from here even by accident. Looks like a freshly-installed, empty app.
 */
export default function DecoyHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setLocked } = useApp();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 40,
    },
    emptyTxt: {
      color: colors.mutedForeground,
      fontSize: 13,
      letterSpacing: 3,
    },
    emptySub: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 1,
      opacity: 0.6,
      textAlign: "center",
    },
    lockBtn: {
      position: "absolute",
      bottom: insets.bottom + 24,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lockBtnText: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GHOSTFACE</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.empty}>
        <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.mutedForeground} />
        <Text style={styles.emptyTxt}>NO CHANNELS</Text>
        <Text style={styles.emptySub}>Start a new secure conversation</Text>
      </View>

      <Pressable style={styles.lockBtn} onPress={() => setLocked(true)}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.mutedForeground} />
        <Text style={styles.lockBtnText}>LOCK</Text>
      </Pressable>
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusDot } from "@/components/StatusDot";
import { useApp } from "@/context/AppContext";
import { VPN_SERVERS } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function LatencyBar({ latency }: { latency: number }) {
  const colors = useColors();
  const color =
    latency < 30 ? colors.success : latency < 70 ? colors.warning : colors.destructive;
  const bars = latency < 30 ? 3 : latency < 70 ? 2 : 1;
  return (
    <View style={{ flexDirection: "row", gap: 2, alignItems: "flex-end" }}>
      {[1, 2, 3].map((b) => (
        <View
          key={b}
          style={{
            width: 4,
            height: 4 + b * 3,
            borderRadius: 1,
            backgroundColor: b <= bars ? color : "#333",
          }}
        />
      ))}
    </View>
  );
}

export default function VPNScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vpnConnected, vpnServer, connectVPN, disconnectVPN, dataUsed, dataLimit } =
    useApp();
  const [connecting, setConnecting] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (connecting) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [connecting]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (vpnConnected) {
      disconnectVPN();
    } else if (vpnServer) {
      setConnecting(true);
      setTimeout(() => {
        connectVPN(vpnServer);
        setConnecting(false);
      }, 1500);
    } else {
      const first = VPN_SERVERS[0];
      setConnecting(true);
      setTimeout(() => {
        connectVPN(first);
        setConnecting(false);
      }, 1500);
    }
  };

  const handleSelectServer = (server: typeof VPN_SERVERS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (vpnConnected) {
      setConnecting(true);
      disconnectVPN();
      setTimeout(() => {
        connectVPN(server);
        setConnecting(false);
      }, 1200);
    } else {
      connectVPN(server);
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const dataPercent = (dataUsed / dataLimit) * 100;

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
    heroSection: {
      alignItems: "center",
      paddingVertical: 36,
    },
    toggleBtn: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    statusLabel: {
      fontSize: 13,
      fontWeight: "800" as const,
      letterSpacing: 4,
      marginBottom: 4,
    },
    serverLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 3,
    },
    statsRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      gap: 12,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    statLabel: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 3,
      marginBottom: 6,
    },
    statValue: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 1,
    },
    statUnit: {
      color: colors.mutedForeground,
      fontSize: 10,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.muted,
      marginTop: 8,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
    },
    sectionLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      fontWeight: "700" as const,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    serverItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 14,
    },
    flag: {
      fontSize: 24,
      width: 36,
      textAlign: "center",
    },
    serverInfo: {
      flex: 1,
    },
    serverName: {
      fontSize: 13,
      fontWeight: "700" as const,
      letterSpacing: 2,
    },
    serverRegion: {
      color: colors.mutedForeground,
      fontSize: 11,
      marginTop: 2,
    },
    serverMeta: {
      alignItems: "flex-end",
      gap: 4,
    },
    latencyText: {
      fontSize: 11,
      letterSpacing: 1,
    },
    serverDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 70,
    },
    padBottom: { height: 120 },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>VPN</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <StatusDot active={vpnConnected} size={6} />
          <Text style={{ color: vpnConnected ? colors.success : colors.destructive, fontSize: 11, letterSpacing: 2, fontWeight: "700" as const }}>
            {vpnConnected ? "CONNECTED" : "DISCONNECTED"}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />

      <FlatList
        data={VPN_SERVERS}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            <View style={styles.heroSection}>
              <Pressable
                style={({ pressed }) => [
                  styles.toggleBtn,
                  {
                    backgroundColor: vpnConnected
                      ? `${colors.success}15`
                      : colors.card,
                    borderWidth: 2,
                    borderColor: vpnConnected
                      ? colors.success
                      : connecting
                      ? colors.primary
                      : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={handleToggle}
                testID="vpn-toggle"
              >
                <Animated.View style={connecting ? { transform: [{ rotate: spin }] } : {}}>
                  <Ionicons
                    name={vpnConnected ? "shield-checkmark" : connecting ? "reload" : "shield-outline"}
                    size={48}
                    color={
                      vpnConnected
                        ? colors.success
                        : connecting
                        ? colors.primary
                        : colors.mutedForeground
                    }
                  />
                </Animated.View>
              </Pressable>
              <Text
                style={[
                  styles.statusLabel,
                  {
                    color: vpnConnected
                      ? colors.success
                      : connecting
                      ? colors.primary
                      : colors.mutedForeground,
                  },
                ]}
              >
                {vpnConnected
                  ? "PROTECTED"
                  : connecting
                  ? "CONNECTING..."
                  : "UNPROTECTED"}
              </Text>
              <Text style={styles.serverLabel}>
                {vpnConnected && vpnServer
                  ? `${vpnServer.flag} ${vpnServer.name} — ${vpnServer.latency}ms`
                  : "TAP SHIELD TO CONNECT"}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>DATA USED</Text>
                <Text style={styles.statValue}>
                  {dataUsed} <Text style={styles.statUnit}>GB</Text>
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${dataPercent}%`,
                        backgroundColor:
                          dataPercent > 80 ? colors.destructive : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>DATA LIMIT</Text>
                <Text style={styles.statValue}>
                  {dataLimit} <Text style={styles.statUnit}>GB</Text>
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: "100%",
                        backgroundColor: colors.muted,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>LATENCY</Text>
                <Text style={styles.statValue}>
                  {vpnServer ? vpnServer.latency : "--"}{" "}
                  <Text style={styles.statUnit}>ms</Text>
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: vpnServer
                          ? `${Math.min((vpnServer.latency / 150) * 100, 100)}%`
                          : "0%",
                        backgroundColor:
                          vpnServer && vpnServer.latency < 30
                            ? colors.success
                            : vpnServer && vpnServer.latency < 70
                            ? colors.warning
                            : colors.destructive,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>SELECT SERVER</Text>
          </>
        )}
        renderItem={({ item, index }) => {
          const isActive = vpnServer?.id === item.id && vpnConnected;
          return (
            <View>
              <Pressable
                style={({ pressed }) => [
                  styles.serverItem,
                  isActive && { backgroundColor: `${colors.success}10` },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => handleSelectServer(item)}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.serverInfo}>
                  <Text
                    style={[
                      styles.serverName,
                      {
                        color: isActive ? colors.success : colors.foreground,
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text style={styles.serverRegion}>{item.region}</Text>
                </View>
                <View style={styles.serverMeta}>
                  <LatencyBar latency={item.latency} />
                  <Text
                    style={[
                      styles.latencyText,
                      {
                        color:
                          item.latency < 30
                            ? colors.success
                            : item.latency < 70
                            ? colors.warning
                            : colors.destructive,
                      },
                    ]}
                  >
                    {item.latency}ms
                  </Text>
                </View>
                {isActive && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.success}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </Pressable>
              {index < VPN_SERVERS.length - 1 && (
                <View style={styles.serverDivider} />
              )}
            </View>
          );
        }}
        ListFooterComponent={<View style={styles.padBottom} />}
      />
    </View>
  );
}

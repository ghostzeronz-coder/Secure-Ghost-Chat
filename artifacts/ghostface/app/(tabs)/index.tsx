import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabScreenWrapper } from "@/components/TabScreenWrapper";
import { useApp } from "@/context/AppContext";

const BG = "#000";
const GOLD = "#d4af37";
const DIM = "#333";
const DIMMER = "#222";
const FAINT = "#1a1a1a";
const MUTED = "#888";
const RED = "#dc2626";

const FONT_SERIF = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});
const FONT_MONO = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

type IconName = keyof typeof Ionicons.glyphMap;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { alias, vpnConnected, panicWipe } = useApp();
  const [isRevealing, setIsRevealing] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const revealAnim = useRef(new Animated.Value(0)).current;
  const wipeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: isRevealing ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [isRevealing, revealAnim]);

  useEffect(() => {
    Animated.timing(wipeAnim, {
      toValue: wipeArmed || isWiping ? 1 : 0,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [wipeArmed, isWiping, wipeAnim]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (wipeTimer.current) clearTimeout(wipeTimer.current);
      if (wipeFeedbackTimer.current) clearTimeout(wipeFeedbackTimer.current);
    };
  }, []);

  // Hold-to-reveal (300ms) — latches open once revealed.
  const handleScreenPressIn = () => {
    if (isRevealing) return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      if (mountedRef.current) setIsRevealing(true);
    }, 300);
  };

  const handleScreenPressOut = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  const lock = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setIsRevealing(false);
  };

  // Panic-wipe gesture — silent: no haptics, no audio, no toast, no alert.
  // The 3-second hold IS the confirmation.
  const handleWipePressIn = () => {
    if (isWiping) return;
    setWipeArmed(true);
    if (wipeTimer.current) clearTimeout(wipeTimer.current);
    wipeTimer.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setIsWiping(true);
      setWipeArmed(false);
      try {
        await panicWipe();
      } catch {
        // swallow — silent
      }
      if (!mountedRef.current) return;
      if (wipeFeedbackTimer.current) clearTimeout(wipeFeedbackTimer.current);
      wipeFeedbackTimer.current = setTimeout(() => {
        if (mountedRef.current) setIsWiping(false);
      }, 1500);
    }, 3000);
  };

  const handleWipePressOut = () => {
    if (wipeTimer.current) clearTimeout(wipeTimer.current);
    if (!isWiping) setWipeArmed(false);
  };

  const go = (path: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    path();
  };

  const aliasText = (alias ?? "GHOST_00").toUpperCase();

  return (
    <TabScreenWrapper>
      <Pressable
        onPressIn={handleScreenPressIn}
        onPressOut={handleScreenPressOut}
        style={styles.container}
      >
        {/* Panic-wipe seal — top-right, tiny, silent */}
        <View
          pointerEvents="box-none"
          style={[styles.wipeContainer, { top: insets.top + 16 }]}
        >
          <Pressable
            onPressIn={handleWipePressIn}
            onPressOut={handleWipePressOut}
            hitSlop={16}
            style={styles.wipeHit}
          >
            <Animated.View
              style={[
                styles.wipeDot,
                {
                  backgroundColor: wipeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["rgba(127,29,29,0.45)", RED],
                  }),
                  transform: [
                    {
                      scale: wipeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.6],
                      }),
                    },
                  ],
                  shadowOpacity: wipeArmed || isWiping ? 0.8 : 0,
                },
              ]}
            />
            {(wipeArmed || isWiping) && (
              <Text style={styles.wipeLabel}>
                {isWiping ? "WIPED" : "HOLD 3s"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Center seal */}
        <View pointerEvents="none" style={styles.centerWrap}>
          <Animated.View
            style={[
              styles.seal,
              {
                borderColor: revealAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [FAINT, "rgba(212,175,55,0.22)"],
                }),
                backgroundColor: revealAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(0,0,0,0)", "rgba(212,175,55,0.02)"],
                }),
              },
            ]}
          >
            <View style={styles.innerRing} />

            <Animated.Text
              style={[
                styles.aliasText,
                {
                  color: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [DIM, "rgba(212,175,55,0.78)"],
                  }),
                },
              ]}
            >
              {aliasText}
            </Animated.Text>

            <Animated.View
              style={[
                styles.aliasDivider,
                {
                  backgroundColor: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [DIMMER, "rgba(212,175,55,0.3)"],
                  }),
                },
              ]}
            />

            <Text style={styles.aliasTagline}>SECURE IDENTITY</Text>
          </Animated.View>
        </View>

        {/* Bottom: reveal hint + revealed actions (cross-fade) */}
        <View
          pointerEvents="box-none"
          style={[
            styles.bottom,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 96 : 88),
            },
          ]}
        >
          <View style={styles.bottomStack}>
            {/* Reveal hint */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.hintWrap,
                {
                  opacity: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                  transform: [
                    {
                      translateY: revealAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 16],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.hintLine} />
              <Text style={styles.hintText}>HOLD TO REVEAL</Text>
            </Animated.View>

            {/* Revealed action row */}
            <Animated.View
              pointerEvents={isRevealing ? "auto" : "none"}
              style={[
                styles.actionsRow,
                {
                  opacity: revealAnim,
                  transform: [
                    {
                      translateY: revealAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <ActionItem
                icon="chatbubble-ellipses-outline"
                label="MSG"
                onPress={go(() => router.push("/(tabs)/messages"))}
              />
              <View style={styles.actionDivider} />
              <ActionItem
                icon="call-outline"
                label="CALL"
                onPress={go(() =>
                  router.push({
                    pathname: "/call",
                    params: { alias: "SECURE_LINE", mode: "voice" },
                  }),
                )}
              />
              <View style={styles.actionDivider} />
              <ActionItem
                icon="shield-outline"
                label={vpnConnected ? "VPN ON" : "VPN"}
                active={!!vpnConnected}
                onPress={go(() => router.push("/(tabs)/vpn"))}
              />
              <View style={styles.actionDivider} />
              <ActionItem
                icon="wallet-outline"
                label="WALLET"
                onPress={go(() => router.push("/(tabs)/wallet"))}
              />
            </Animated.View>
          </View>

          {/* Lock pill — only when revealed */}
          <Animated.View
            pointerEvents={isRevealing ? "auto" : "none"}
            style={[styles.lockWrap, { opacity: revealAnim }]}
          >
            <Pressable onPress={lock} hitSlop={12}>
              <Text style={styles.lockText}>· TAP TO LOCK ·</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </TabScreenWrapper>
  );
}

function ActionItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.actionCircle, active && styles.actionCircleActive]}>
        <Ionicons name={icon} size={18} color={active ? GOLD : MUTED} />
      </View>
      <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Wipe seal (top-right)
  wipeContainer: {
    position: "absolute",
    right: 24,
    alignItems: "center",
    zIndex: 50,
  },
  wipeHit: { alignItems: "center", justifyContent: "center", padding: 8 },
  wipeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: RED,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  wipeLabel: {
    position: "absolute",
    top: 28,
    fontFamily: FONT_MONO,
    fontSize: 8,
    letterSpacing: 3,
    color: "rgba(220,38,38,0.85)",
  },

  // Center seal
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  seal: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  innerRing: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  aliasText: {
    fontFamily: FONT_SERIF,
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: "400" as const,
  },
  aliasDivider: { width: 32, height: 1, marginVertical: 14 },
  aliasTagline: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: 5,
    color: DIM,
  },

  // Bottom
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: 16,
  },
  bottomStack: {
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  hintWrap: {
    position: "absolute",
    alignItems: "center",
  },
  hintLine: { width: 1, height: 22, backgroundColor: DIM },
  hintText: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    letterSpacing: 3,
    color: "#444",
    marginTop: 10,
  },
  actionsRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
  },
  actionDivider: {
    width: 24,
    height: 1,
    backgroundColor: DIM,
    marginHorizontal: 2,
  },
  actionItem: { alignItems: "center", width: 56, gap: 8 },
  actionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: DIMMER,
  },
  actionCircleActive: {
    backgroundColor: "rgba(212,175,55,0.06)",
    borderColor: "rgba(212,175,55,0.3)",
  },
  actionLabel: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: 2,
    color: "#555",
  },
  actionLabelActive: { color: "rgba(212,175,55,0.85)" },

  lockWrap: { marginTop: 4 },
  lockText: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: 4,
    color: "#444",
  },
});

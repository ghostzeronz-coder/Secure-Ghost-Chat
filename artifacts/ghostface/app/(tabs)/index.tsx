import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
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

// ── Radial menu geometry ──────────────────────────────────────────────────────
const ORBIT_SIZE = 340;
const ORBIT_CENTER = ORBIT_SIZE / 2;
const ORBIT_RADIUS = 134;
const NODE = 60;

type NavNode = {
  icon: IconName;
  label: string;
  onPress: () => void;
  activeKey?: "vpn";
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { alias, vpnConnected, panicWipe } = useApp();
  const [wipeArmed, setWipeArmed] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const wipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const spin = useRef(new Animated.Value(0)).current;
  const globeSpin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const wipeAnim = useRef(new Animated.Value(0)).current;

  // Continuous slow spin + ghostly breathing fade for the centerpiece.
  // Gated by screen focus so the loops don't churn battery while off-screen.
  useFocusEffect(
    useCallback(() => {
      const spinLoop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 26000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      // Sideways "globe" spin for the centerpiece — rotates on its vertical
      // axis (rotateY) rather than flat round-and-round (rotateZ).
      const globeLoop = Animated.loop(
        Animated.timing(globeSpin, {
          toValue: 1,
          duration: 9000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      const fadeLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(fade, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 0,
            duration: 3200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      spinLoop.start();
      globeLoop.start();
      fadeLoop.start();
      return () => {
        spinLoop.stop();
        globeLoop.stop();
        fadeLoop.stop();
      };
    }, [spin, globeSpin, fade]),
  );

  // Reveal/hide the orbiting menu when the central circle is long-pressed.
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: menuOpen ? 1 : 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [menuOpen, reveal]);

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
      if (wipeTimer.current) clearTimeout(wipeTimer.current);
      if (wipeFeedbackTimer.current) clearTimeout(wipeFeedbackTimer.current);
    };
  }, []);

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

  const toggleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuOpen((open) => !open);
  };

  const aliasText = (alias ?? "GHOST_00").toUpperCase();

  const nodes: NavNode[] = [
    {
      icon: "chatbubble-ellipses-outline",
      label: "MSG",
      onPress: go(() => router.push("/(tabs)/messages")),
    },
    {
      icon: "call-outline",
      label: "CALL",
      onPress: go(() =>
        router.push({
          pathname: "/call",
          params: { alias: "SECURE_LINE", mode: "voice" },
        }),
      ),
    },
    {
      icon: "shield-outline",
      label: vpnConnected ? "VPN ON" : "VPN",
      activeKey: "vpn",
      onPress: go(() => router.push("/(tabs)/vpn")),
    },
    {
      icon: "wallet-outline",
      label: "WALLET",
      onPress: go(() => router.push("/(tabs)/wallet")),
    },
    {
      icon: "phone-portrait-outline",
      label: "NUMBER",
      onPress: go(() => router.push("/(tabs)/ghostnumber")),
    },
    {
      icon: "settings-outline",
      label: "SETTINGS",
      onPress: go(() => router.push("/(tabs)/settings")),
    },
  ];

  const spinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const globeDeg = globeSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const circleOpacity = fade.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });
  const nodeScale = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const ringOpacity = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const hintOpacity = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <TabScreenWrapper>
      <View style={styles.container}>
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

        {/* Alias header */}
        <View pointerEvents="none" style={[styles.header, { top: insets.top + 18 }]}>
          <Text style={styles.aliasText}>{aliasText}</Text>
          <View style={styles.aliasDivider} />
          <Text style={styles.aliasTagline}>SECURE IDENTITY</Text>
        </View>

        {/* Radial dial: long-press the transparent circle to reveal the menu */}
        <View style={styles.orbitWrap}>
          <View style={styles.orbit}>
            {/* Decorative tick ring — fades in with the menu */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                { opacity: ringOpacity, transform: [{ rotate: spinDeg }] },
              ]}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tick,
                    {
                      transform: [
                        { rotate: `${i * 30}deg` },
                        { translateY: -(ORBIT_RADIUS - 4) },
                      ],
                    },
                  ]}
                />
              ))}
            </Animated.View>

            {/* Rotating compass emblem — long-press to reveal/hide menu */}
            <View pointerEvents="box-none" style={styles.centerWrap}>
              <View style={styles.centerCol}>
                <Pressable
                  onLongPress={toggleMenu}
                  delayLongPress={350}
                  hitSlop={24}
                  style={styles.centerHit}
                  accessibilityRole="button"
                  accessibilityLabel={
                    menuOpen ? "Hide menu" : "Long press to reveal menu"
                  }
                >
                  <Animated.Image
                    source={require("../../assets/images/login-compass.png")}
                    resizeMode="contain"
                    style={[
                      styles.centerEmblem,
                      {
                        opacity: circleOpacity,
                        transform: [
                          { perspective: 800 },
                          { rotateY: globeDeg },
                        ],
                      },
                    ]}
                  />
                </Pressable>
                <Animated.Text
                  pointerEvents="none"
                  style={[styles.centerHint, { opacity: hintOpacity }]}
                >
                  HOLD TO REVEAL
                </Animated.Text>
              </View>
            </View>

            {/* Orbiting nav nodes — hidden until revealed */}
            {nodes.map((node, i) => {
              const angle = (-90 + i * (360 / nodes.length)) * (Math.PI / 180);
              const x = ORBIT_CENTER + ORBIT_RADIUS * Math.cos(angle) - NODE / 2;
              const y = ORBIT_CENTER + ORBIT_RADIUS * Math.sin(angle) - NODE / 2;
              const active = node.activeKey === "vpn" && !!vpnConnected;
              return (
                <Animated.View
                  key={node.label}
                  pointerEvents={menuOpen ? "auto" : "none"}
                  style={[
                    styles.node,
                    {
                      left: x,
                      top: y,
                      opacity: reveal,
                      transform: [{ scale: nodeScale }],
                    },
                  ]}
                >
                  <Pressable
                    onPress={node.onPress}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.nodeInner,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View
                      style={[
                        styles.nodeCircle,
                        active && styles.nodeCircleActive,
                      ]}
                    >
                      <Ionicons
                        name={node.icon}
                        size={20}
                        color={active ? GOLD : MUTED}
                      />
                    </View>
                    <Text
                      style={[styles.nodeLabel, active && styles.nodeLabelActive]}
                    >
                      {node.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </View>
    </TabScreenWrapper>
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

  // Alias header
  header: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  aliasText: {
    fontFamily: FONT_SERIF,
    fontSize: 20,
    letterSpacing: 8,
    fontWeight: "400" as const,
    color: "rgba(212,175,55,0.78)",
  },
  aliasDivider: {
    width: 32,
    height: 1,
    marginVertical: 12,
    backgroundColor: "rgba(212,175,55,0.3)",
  },
  aliasTagline: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: 5,
    color: DIM,
  },

  // Radial dial
  orbitWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  orbit: {
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: {
    position: "absolute",
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: "rgba(212,175,55,0.18)",
  },

  // Central rotating compass emblem
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerCol: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerHit: {
    width: 184,
    height: 184,
    alignItems: "center",
    justifyContent: "center",
  },
  centerEmblem: {
    width: 184,
    height: 184,
  },
  centerHint: {
    position: "absolute",
    bottom: -26,
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: 4,
    color: "rgba(212,175,55,0.6)",
  },

  // Nav nodes
  node: {
    position: "absolute",
    width: NODE,
    alignItems: "center",
  },
  nodeInner: { alignItems: "center", gap: 6 },
  nodeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0c0c0c",
    borderWidth: 1,
    borderColor: DIMMER,
  },
  nodeCircleActive: {
    backgroundColor: "rgba(212,175,55,0.06)",
    borderColor: "rgba(212,175,55,0.35)",
  },
  nodeLabel: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: 2,
    color: "#555",
  },
  nodeLabelActive: { color: "rgba(212,175,55,0.85)" },
});

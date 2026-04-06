import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const { width: W, height: H } = Dimensions.get("window");

// ─── Single smoke puff ────────────────────────────────────────────────────────

interface PuffProps {
  x: number;
  size: number;
  delay: number;
  color: string;
  duration: number;
}

function SmokePuff({ x, size, delay, color, duration }: PuffProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 80;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -(H * 0.85 + size),
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: drift,
          duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.85, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: duration - 250, useNativeDriver: true }),
        ]),
        Animated.timing(scale, { toValue: 2.4, duration, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 40,
        left: x - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    />
  );
}

// ─── Fire ember fleck ─────────────────────────────────────────────────────────

interface EmberProps {
  x: number;
  delay: number;
}

function Ember({ x, delay }: EmberProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 120;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -(H * 0.4 + Math.random() * H * 0.3),
          duration: 1200 + Math.random() * 800,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: drift,
          duration: 1200 + Math.random() * 800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 20,
        left: x,
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: "#FF6A00",
        opacity,
        transform: [{ translateY }, { translateX }],
      }}
    />
  );
}

// ─── Full-screen smoke overlay ────────────────────────────────────────────────

function SmokeScreen({ onDone }: { onDone: () => void }) {
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const fireGlow = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background fades to black
    Animated.timing(screenOpacity, {
      toValue: 1, duration: 2800, useNativeDriver: true,
    }).start();

    // Fire glow pulses
    Animated.loop(
      Animated.sequence([
        Animated.timing(fireGlow, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(fireGlow, { toValue: 0.6, duration: 300, useNativeDriver: true }),
      ]),
      { iterations: 8 }
    ).start();

    // DATA WIPED text fades in after smoke rises
    setTimeout(() => {
      Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 1800);

    // Call onDone after animation
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, []);

  const SMOKE_PUFFS = [
    { x: W * 0.05, size: 90,  delay: 0,    color: "rgba(20,5,5,0.85)",    duration: 2800 },
    { x: W * 0.18, size: 70,  delay: 120,  color: "rgba(30,10,5,0.8)",    duration: 2600 },
    { x: W * 0.32, size: 110, delay: 60,   color: "rgba(15,5,5,0.9)",     duration: 3000 },
    { x: W * 0.45, size: 80,  delay: 200,  color: "rgba(25,8,5,0.85)",    duration: 2700 },
    { x: W * 0.58, size: 100, delay: 80,   color: "rgba(20,5,5,0.88)",    duration: 2900 },
    { x: W * 0.70, size: 75,  delay: 160,  color: "rgba(30,10,5,0.8)",    duration: 2650 },
    { x: W * 0.82, size: 95,  delay: 40,   color: "rgba(18,6,5,0.87)",    duration: 2750 },
    { x: W * 0.92, size: 65,  delay: 220,  color: "rgba(25,8,5,0.82)",    duration: 2550 },
    // Second wave
    { x: W * 0.10, size: 120, delay: 500,  color: "rgba(15,5,5,0.78)",    duration: 3100 },
    { x: W * 0.28, size: 85,  delay: 600,  color: "rgba(22,7,5,0.80)",    duration: 2900 },
    { x: W * 0.50, size: 130, delay: 450,  color: "rgba(12,4,5,0.82)",    duration: 3200 },
    { x: W * 0.72, size: 90,  delay: 550,  color: "rgba(20,6,5,0.77)",    duration: 2950 },
    { x: W * 0.88, size: 105, delay: 480,  color: "rgba(18,5,5,0.79)",    duration: 3050 },
  ];

  const EMBERS = Array.from({ length: 20 }, (_, i) => ({
    x: Math.random() * W,
    delay: Math.random() * 600,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dark bg fade */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: screenOpacity }]}
      />

      {/* Fire glow band at bottom */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: H * 0.28,
          opacity: fireGlow,
        }}
      >
        <View style={{ flex: 1, backgroundColor: "transparent" }}>
          {/* Deep red base */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(180,20,0,0.4)", bottom: 0, top: "60%" }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,60,0,0.25)", bottom: 0, top: "30%" }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,140,0,0.15)" }]} />
        </View>
      </Animated.View>

      {/* Ember flecks */}
      {EMBERS.map((e, i) => (
        <Ember key={i} x={e.x} delay={e.delay} />
      ))}

      {/* Smoke puffs */}
      {SMOKE_PUFFS.map((p, i) => (
        <SmokePuff key={i} x={p.x} size={p.size} delay={p.delay} color={p.color} duration={p.duration} />
      ))}

      {/* DATA WIPED text */}
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <Ionicons name="nuclear" size={48} color="#FF3B30" />
        <Text style={ss.wipedHeading}>DATA WIPED</Text>
        <Text style={ss.wipedSub}>ALL TRACES ELIMINATED</Text>
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  wipedHeading: {
    color: "#FF3B30",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 8,
    marginTop: 16,
  },
  wipedSub: {
    color: "#FF3B30",
    fontSize: 12,
    letterSpacing: 4,
    opacity: 0.7,
    marginTop: 6,
  },
});

// ─── Main PanicButton ──────────────────────────────────────────────────────────

interface PanicButtonProps {
  onWipe: () => Promise<void>;
}

export function PanicButton({ onWipe }: PanicButtonProps) {
  const colors = useColors();
  const [panicHeld, setPanicHeld] = useState(false);
  const [panicProgress, setPanicProgress] = useState(0);
  const [smokeVisible, setSmokeVisible] = useState(false);
  const panicTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panicInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (panicTimer.current) { clearTimeout(panicTimer.current); panicTimer.current = null; }
    if (panicInterval.current) { clearInterval(panicInterval.current); panicInterval.current = null; }
  };

  useEffect(() => () => clearTimers(), []);

  const startPanic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPanicHeld(true);
    setPanicProgress(0);
    let p = 0;
    panicInterval.current = setInterval(() => {
      p += 2;
      setPanicProgress(p);
      if (p >= 100) {
        clearInterval(panicInterval.current!);
        panicInterval.current = null;
      }
    }, 60);
    panicTimer.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setSmokeVisible(true);
    }, 3000);
  };

  const cancelPanic = () => {
    setPanicHeld(false);
    setPanicProgress(0);
    clearTimers();
  };

  const handleSmokeDone = async () => {
    await onWipe();
  };

  return (
    <>
      <Modal
        visible={smokeVisible}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <SmokeScreen onDone={handleSmokeDone} />
        </View>
      </Modal>

      <View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          HOLD 3 SECONDS TO WIPE ALL DATA
        </Text>
        <Pressable
          style={[
            styles.btn,
            { borderColor: colors.destructive, borderRadius: colors.radius },
            panicHeld && styles.btnPressed,
          ]}
          onPressIn={startPanic}
          onPressOut={cancelPanic}
          testID="panic-btn"
        >
          {panicHeld && (
            <View
              style={[
                styles.progressFill,
                { width: `${panicProgress}%`, backgroundColor: `${colors.destructive}25` },
              ]}
            />
          )}
          <Ionicons name="nuclear-outline" size={28} color={colors.destructive} />
          <Text style={[styles.btnText, { color: colors.destructive }]}>PANIC WIPE</Text>
          <Text style={[styles.subText, { color: colors.destructive }]}>
            {panicHeld ? "WIPING..." : "HOLD TO CLEAR ALL DATA"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 12,
    textAlign: "center",
  },
  btn: {
    borderWidth: 2,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  btnPressed: {
    backgroundColor: "transparent",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "800" as const,
    letterSpacing: 4,
  },
  subText: {
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
    opacity: 0.7,
  },
});

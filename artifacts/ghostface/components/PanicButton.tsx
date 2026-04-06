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

// ─── Explosion flame tongue ────────────────────────────────────────────────────
// Each flame blasts outward from the origin at a given angle.

interface FlameProps {
  angleDeg: number; // clockwise from top, 0 = up
  delay: number;    // ms before animating
  length: number;   // px - how far the flame travels
  width: number;    // flame body width
  height: number;   // flame body height (elongation)
  color: string;
  glowColor: string;
}

function Flame({ angleDeg, delay, length, width, height, color, glowColor }: FlameProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.2)).current;

  const rad = (angleDeg * Math.PI) / 180;
  const tx = Math.sin(rad) * length;
  const ty = -Math.cos(rad) * length; // negative = upward in RN coords

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, tx] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, ty] });

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 640, useNativeDriver: true }),
        ]),
        Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        borderRadius: width / 2,
        backgroundColor: color,
        // Glow ring underneath
        shadowColor: glowColor,
        shadowOpacity: 0.9,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
        transform: [
          { translateX },
          { translateY },
          { rotate: `${angleDeg}deg` },
          { scale },
        ],
        opacity,
      }}
    />
  );
}

// ─── Inner core flash ─────────────────────────────────────────────────────────

function CoreBlast({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scale, { toValue: 4, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 520, useNativeDriver: true }),
        ]),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: 80,
        height: 80,
        marginLeft: -40,
        marginTop: -40,
        borderRadius: 40,
        backgroundColor: "#FFEE44",
        opacity,
        transform: [{ scale }],
        shadowColor: "#FFAA00",
        shadowOpacity: 1,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

// ─── Full explosion screen ────────────────────────────────────────────────────

function ExplosionScreen({ onDone }: { onDone: () => void }) {
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const shockScale = useRef(new Animated.Value(0)).current;
  const shockOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // White flash on detonation
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();

    // Shockwave ring expanding outward
    Animated.parallel([
      Animated.timing(shockScale, { toValue: 8, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(shockOpacity, { toValue: 0.8, duration: 80, useNativeDriver: true }),
        Animated.timing(shockOpacity, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]),
    ]).start();

    // Black bg fills in after explosion settles
    setTimeout(() => {
      Animated.timing(bgOpacity, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    }, 600);

    // DATA WIPED text
    setTimeout(() => {
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 1400);

    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, []);

  // 13 flames distributed around the full 360°
  const FLAMES = [
    // angle, length, width, height,     color,      glowColor,  delay
    [   0,    H*0.55, 22, 100, "#FF8C00", "#FF4500",   0   ],
    [  27,    H*0.50, 26, 120, "#FF4500", "#FF0000",  20   ],
    [  55,    H*0.52, 20, 90,  "#FFB400", "#FF6600",  10   ],
    [  83,    H*0.48, 28, 110, "#FF2200", "#FF0000",  30   ],
    [ 110,    H*0.53, 22, 95,  "#FF5500", "#FF2200",   5   ],
    [ 138,    H*0.50, 24, 105, "#FF8800", "#FF4400",  25   ],
    [ 165,    H*0.55, 20, 115, "#FF3300", "#FF0000",  15   ],
    [ 193,    H*0.48, 26, 100, "#FF6600", "#FF3300",  35   ],
    [ 221,    H*0.52, 22, 90,  "#FF9900", "#FF5500",   8   ],
    [ 248,    H*0.50, 28, 120, "#FF2200", "#CC0000",  28   ],
    [ 276,    H*0.54, 20, 105, "#FF7700", "#FF4400",  12   ],
    [ 304,    H*0.49, 24, 95,  "#FF4400", "#FF1100",  22   ],
    [ 332,    H*0.53, 22, 110, "#FF8800", "#FF5500",   3   ],
  ] as const;

  // Origin: center of screen for full radial explosion
  const ox = W / 2;
  const oy = H * 0.5;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dark bg fade in after explosion */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: bgOpacity }]}
      />

      {/* Bright white detonation flash */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFFFF", opacity: flashOpacity }]}
      />

      {/* Explosion origin */}
      <View style={{ position: "absolute", top: oy, left: ox }}>
        {/* Shockwave ring */}
        <Animated.View
          style={{
            position: "absolute",
            width: 80,
            height: 80,
            marginLeft: -40,
            marginTop: -40,
            borderRadius: 40,
            borderWidth: 3,
            borderColor: "#FF8C00",
            opacity: shockOpacity,
            transform: [{ scale: shockScale }],
          }}
        />

        {/* Inner core blast */}
        <CoreBlast delay={0} />

        {/* 13 flame tongues */}
        {FLAMES.map((f, i) => (
          <Flame
            key={i}
            angleDeg={f[0]}
            length={f[1]}
            width={f[2]}
            height={f[3]}
            color={f[4]}
            glowColor={f[5]}
            delay={f[6]}
          />
        ))}
      </View>

      {/* DATA WIPED */}
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <Ionicons name="nuclear" size={52} color="#FF3B30" />
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
    marginTop: 18,
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
  const [exploding, setExploding] = useState(false);
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
      setExploding(true);
    }, 3000);
  };

  const cancelPanic = () => {
    setPanicHeld(false);
    setPanicProgress(0);
    clearTimers();
  };

  return (
    <>
      <Modal visible={exploding} transparent animationType="none" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <ExplosionScreen onDone={async () => { await onWipe(); }} />
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
  btnPressed: { backgroundColor: "transparent" },
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

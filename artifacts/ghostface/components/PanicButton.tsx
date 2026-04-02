import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PanicButtonProps {
  onWipe: () => Promise<void>;
}

export function PanicButton({ onWipe }: PanicButtonProps) {
  const colors = useColors();
  const [panicHeld, setPanicHeld] = useState(false);
  const [panicProgress, setPanicProgress] = useState(0);
  const [wiped, setWiped] = useState(false);
  const panicTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panicInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const clearTimers = () => {
    if (panicTimer.current) {
      clearTimeout(panicTimer.current);
      panicTimer.current = null;
    }
    if (panicInterval.current) {
      clearInterval(panicInterval.current);
      panicInterval.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

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
    panicTimer.current = setTimeout(async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setWiped(true);
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.7, duration: 300, useNativeDriver: true }),
      ]).start();
      setTimeout(async () => {
        await onWipe();
      }, 1200);
    }, 3000);
  };

  const cancelPanic = () => {
    setPanicHeld(false);
    setPanicProgress(0);
    clearTimers();
  };

  if (wiped) {
    return (
      <Animated.View
        style={[
          styles.wipedContainer,
          {
            borderColor: colors.destructive,
            borderRadius: colors.radius,
            opacity: flashAnim,
          },
        ]}
      >
        <Ionicons name="nuclear" size={32} color={colors.destructive} />
        <Text style={[styles.wipedText, { color: colors.destructive }]}>
          DATA WIPED
        </Text>
        <Text style={[styles.wipedSub, { color: colors.destructive }]}>
          ALL TRACES ELIMINATED
        </Text>
      </Animated.View>
    );
  }

  return (
    <View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        HOLD 3 SECONDS TO WIPE ALL DATA
      </Text>
      <Pressable
        style={[
          styles.btn,
          {
            borderColor: colors.destructive,
            borderRadius: colors.radius,
          },
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
              {
                width: `${panicProgress}%`,
                backgroundColor: `${colors.destructive}25`,
              },
            ]}
          />
        )}
        <Ionicons
          name="nuclear-outline"
          size={28}
          color={colors.destructive}
        />
        <Text style={[styles.btnText, { color: colors.destructive }]}>
          PANIC WIPE
        </Text>
        <Text style={[styles.subText, { color: colors.destructive }]}>
          {panicHeld ? "WIPING..." : "HOLD TO CLEAR ALL DATA"}
        </Text>
      </Pressable>
    </View>
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
  wipedContainer: {
    borderWidth: 2,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  wipedText: {
    fontSize: 20,
    fontWeight: "800" as const,
    letterSpacing: 6,
  },
  wipedSub: {
    fontSize: 11,
    letterSpacing: 3,
    opacity: 0.7,
  },
});

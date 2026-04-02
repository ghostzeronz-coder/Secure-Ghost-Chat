import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
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
import { GhostLogo } from "@/components/GhostLogo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { hasPin, biometricEnabled, checkPin, setLocked } = useApp();
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const [pinLength, setPinLength] = useState(4);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const tryBiometric = async () => {
    if (Platform.OS === "web") return;
    if (!biometricEnabled) return;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to unlock GHOSTFACE",
        cancelLabel: "Use PIN",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
        router.replace("/(tabs)");
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (biometricEnabled) {
      tryBiometric();
    }
  }, []);

  const handleKey = async (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (entered.length >= 8) return;
    const next = entered + key;
    setEntered(next);
    setError(false);

    if (!hasPin) {
      if (next.length >= 4) {
        setLocked(false);
        router.replace("/(tabs)");
      }
      return;
    }

    if (next.length >= 4) {
      const correct = await checkPin(next);
      if (correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLocked(false);
        router.replace("/(tabs)");
      } else if (next.length >= 8) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        shake();
        setTimeout(() => {
          setEntered("");
          setError(false);
        }, 600);
      }
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEntered((e) => e.slice(0, -1));
    setError(false);
  };

  const KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "del"],
  ];

  const dotCount = 4;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
    },
    logo: {
      marginBottom: 12,
    },
    appName: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: "800" as const,
      letterSpacing: 6,
      marginBottom: 4,
    },
    tagline: {
      color: colors.primary,
      fontSize: 10,
      letterSpacing: 4,
      marginBottom: 48,
    },
    dotsRow: {
      flexDirection: "row",
      gap: 16,
      marginBottom: 48,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1.5,
    },
    keypad: {
      gap: 16,
    },
    keyRow: {
      flexDirection: "row",
      gap: 24,
    },
    key: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    keyText: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "400" as const,
    },
    bioBtn: {
      marginTop: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    bioBtnText: {
      color: colors.mutedForeground,
      fontSize: 13,
      letterSpacing: 1,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <GhostLogo size={48} color={colors.foreground} />
      </View>
      <Text style={styles.appName}>GHOSTFACE</Text>
      <Text style={styles.tagline}>NO FACE. NO TRACE.</Text>

      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length: dotCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i < entered.length
                    ? error
                      ? colors.destructive
                      : colors.primary
                    : "transparent",
                borderColor: error ? colors.destructive : colors.border,
              },
            ]}
          />
        ))}
      </Animated.View>

      <View style={styles.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k, ki) => (
              <Pressable
                key={ki}
                style={({ pressed }) => [
                  styles.key,
                  k
                    ? { backgroundColor: pressed ? colors.muted : colors.card }
                    : {},
                ]}
                onPress={() => {
                  if (k === "del") handleDelete();
                  else if (k) handleKey(k);
                }}
                disabled={!k}
              >
                {k === "del" ? (
                  <Ionicons
                    name="backspace-outline"
                    size={22}
                    color={colors.foreground}
                  />
                ) : k ? (
                  <Text style={styles.keyText}>{k}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {biometricEnabled && Platform.OS !== "web" && (
        <Pressable style={styles.bioBtn} onPress={tryBiometric}>
          <Ionicons name="finger-print" size={20} color={colors.mutedForeground} />
          <Text style={styles.bioBtnText}>USE BIOMETRIC</Text>
        </Pressable>
      )}
    </View>
  );
}

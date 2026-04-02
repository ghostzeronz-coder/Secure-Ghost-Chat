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
  const [biometricError, setBiometricError] = useState("");
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

  const unlock = () => {
    setLocked(false);
    router.replace("/(tabs)");
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        unlock();
      } else {
        setBiometricError("Biometric failed — use PIN");
      }
    } catch (err) {
      console.warn("[LockScreen] Biometric error:", err);
      setBiometricError("Biometric unavailable — use PIN");
    }
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
    setBiometricError("");

    if (!hasPin) {
      return;
    }

    const PIN_LENGTH = 4;
    if (next.length >= PIN_LENGTH) {
      try {
        const correct = await checkPin(next);
        if (correct) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          unlock();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(true);
          shake();
          setTimeout(() => {
            setEntered("");
            setError(false);
          }, 600);
        }
      } catch (err) {
        console.error("[LockScreen] PIN check failed:", err);
        setError(true);
        shake();
        setTimeout(() => setEntered(""), 600);
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
    keyBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyText: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "600" as const,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 11,
      letterSpacing: 2,
      marginTop: 16,
    },
    biometricBtn: {
      marginTop: 28,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
    },
    biometricText: {
      color: colors.primary,
      fontSize: 12,
      letterSpacing: 2,
    },
    continueBtn: {
      marginTop: 32,
      backgroundColor: colors.primary,
      paddingHorizontal: 40,
      paddingVertical: 14,
      borderRadius: colors.radius,
      alignItems: "center",
    },
    continueBtnText: {
      color: colors.primaryForeground,
      fontSize: 13,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
    noPinHint: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 2,
      marginTop: 16,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <GhostLogo size={48} color={colors.foreground} />
      </View>
      <Text style={styles.appName}>GHOSTFACE</Text>
      <Text style={styles.tagline}>NO FACE. NO TRACE.</Text>

      {hasPin ? (
        <>
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

          <View style={styles.keypad} testID="keypad">
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((k, ki) => {
                  if (k === "") {
                    return <View key={ki} style={styles.keyBtn} />;
                  }
                  if (k === "del") {
                    return (
                      <Pressable
                        key={ki}
                        style={styles.keyBtn}
                        onPress={handleDelete}
                      >
                        <Ionicons
                          name="backspace-outline"
                          size={22}
                          color={colors.foreground}
                        />
                      </Pressable>
                    );
                  }
                  return (
                    <Pressable
                      key={ki}
                      style={styles.keyBtn}
                      onPress={() => handleKey(k)}
                      testID={`key-${k}`}
                    >
                      <Text style={styles.keyText}>{k}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {error && (
            <Text style={styles.errorText}>INCORRECT PIN</Text>
          )}
          {biometricError ? (
            <Text style={styles.errorText}>{biometricError}</Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.noPinHint}>
            NO PIN CONFIGURED
          </Text>
          <Pressable style={styles.continueBtn} onPress={unlock} testID="no-pin-continue">
            <Text style={styles.continueBtnText}>TAP TO CONTINUE</Text>
          </Pressable>
        </>
      )}

      {biometricEnabled && hasPin && (
        <Pressable style={styles.biometricBtn} onPress={tryBiometric}>
          <Ionicons name="finger-print" size={22} color={colors.primary} />
          <Text style={styles.biometricText}>USE BIOMETRIC</Text>
        </Pressable>
      )}
    </View>
  );
}

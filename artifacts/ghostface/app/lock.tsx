import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostLogo } from "@/components/GhostLogo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 10;
const WARN_FROM = 7;
const FAIL_KEY = "ghostface_pin_fail_count";

// ── Hold-to-decrypt reveal ────────────────────────────────────────────────────
// The lock screen opens in an idle "CIPHER · LOCKED" state. Holding on the seal
// for HOLD_DURATION ms decrypts it and reveals the secure PIN keypad. This is a
// purely visual gate — all PIN / duress / wipe / biometric logic below is
// untouched and only becomes reachable once the keypad is revealed.
const HOLD_DURATION = 750;

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// Decorative cipher glyphs shown inside the locked seal.
const CIPHER_ROW_A = "✛  ✕  ✕  ▢  ▢  ▦";
const CIPHER_ROW_B = "⌗ ▢ ✕ ▮ ▸ ◂ ▮ ⌗ ▢ ◻ ⌗";

// ── Secure storage helpers (web-safe) ─────────────────────────────────────────

async function loadFailCount(): Promise<number> {
  try {
    const raw = Platform.OS === "web"
      ? await AsyncStorage.getItem(FAIL_KEY)
      : await SecureStore.getItemAsync(FAIL_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch (e) {
    if (__DEV__) console.warn("[LockScreen] loadFailCount error:", e);
    return 0;
  }
}

async function saveFailCount(count: number): Promise<void> {
  try {
    const val = String(count);
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(FAIL_KEY, val);
    } else {
      await SecureStore.setItemAsync(FAIL_KEY, val);
    }
  } catch (e) {
    if (__DEV__) console.warn("[LockScreen] saveFailCount error:", e);
  }
}

async function clearFailCount(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(FAIL_KEY);
    } else {
      await SecureStore.deleteItemAsync(FAIL_KEY);
    }
  } catch (e) {
    if (__DEV__) console.warn("[LockScreen] clearFailCount error:", e);
  }
}

// ── Scramble helper ───────────────────────────────────────────────────────────

function shuffleDigits(): string[] {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { hasPin, biometricEnabled, duressGracePeriod, smsFallbackNumbers, checkPinWithDuress, setLocked, panicWipe } = useApp();
  // Count of armed fallback recipients (Task #113). Shown next to the
  // duress countdown bar so the user can confirm at-a-glance whether
  // their out-of-band channel is configured. We deliberately never show
  // the numbers themselves or the message body — a shoulder-surfer
  // glancing at the lock screen must not learn who would be contacted.
  const fallbackCount = smsFallbackNumbers.length;

  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const [biometricError, setBiometricError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const failedAttemptsRef = useRef(0);
  const [failCountLoaded, setFailCountLoaded] = useState(false);

  // Hold-to-decrypt reveal state. The keypad stays hidden behind the idle
  // cipher seal until the user holds long enough to "decrypt" it.
  const [decryptRevealed, setDecryptRevealed] = useState(false);
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  // Subtle ambient shimmer of the cipher glyphs while locked.
  const glyphAnim = useRef(new Animated.Value(0)).current;

  // Duress grace-period state
  const [duressCountdown, setDuressCountdown] = useState<number | null>(null);
  const duressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const duressProgressAnim = useRef(new Animated.Value(1)).current;
  const duressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (duressIntervalRef.current) clearInterval(duressIntervalRef.current);
      if (duressAnimRef.current) {
        duressAnimRef.current.stop();
        duressAnimRef.current = null;
      }
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdAnimRef.current) holdAnimRef.current.stop();
    };
  }, []);

  // Ambient shimmer of the cipher glyphs while the seal is locked.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glyphAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(glyphAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glyphAnim]);

  // Scrambled digit layout — randomised on every mount and app-foreground event
  const [digits, setDigits] = useState<string[]>(() => shuffleDigits());

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scrambleAnim = useRef(new Animated.Value(1)).current;

  // ── Load persisted fail count on mount ────────────────────────────────────
  useEffect(() => {
    loadFailCount().then(async (count) => {
      const clamped = Math.max(0, Math.min(count, MAX_ATTEMPTS));
      if (clamped >= MAX_ATTEMPTS) {
        await clearFailCount();
        await panicWipe();
        return;
      }
      failedAttemptsRef.current = clamped;
      setFailedAttempts(clamped);
      setFailCountLoaded(true);
    });
  }, []);

  // ── Scramble with flash animation ──────────────────────────────────────────
  const rescramble = useCallback(() => {
    Animated.sequence([
      Animated.timing(scrambleAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(scrambleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setDigits(shuffleDigits());
    setEntered("");
    setError(false);
    setBiometricError("");
  }, [scrambleAnim]);

  // Re-seal the keypad behind the cipher screen whenever the app backgrounds.
  // Also tear down any in-flight hold so an interrupted gesture can't complete
  // and reveal the keypad after the app returns.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setDecryptRevealed(false);
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        if (holdAnimRef.current) {
          holdAnimRef.current.stop();
          holdAnimRef.current = null;
        }
        holdAnim.setValue(0);
      }
    });
    return () => sub.remove();
  }, [holdAnim]);

  // Re-scramble when the app returns from background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        rescramble();
      }
    });
    return () => sub.remove();
  }, [rescramble]);

  // ── Shake on wrong PIN ─────────────────────────────────────────────────────
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── Biometric ─────────────────────────────────────────────────────────────
  const tryBiometric = async () => {
    if (Platform.OS === "web") return;
    if (!biometricEnabled) return;
    // Block biometric unlock while a duress wipe countdown is running to prevent
    // an unintended bypass (lock-screen unmount would cancel the interval).
    if (duressIntervalRef.current !== null) return;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to unlock GHOSTFACE",
        cancelLabel: "Use PIN",
        disableDeviceFallback: false,
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await clearFailCount();
        failedAttemptsRef.current = 0;
        setFailedAttempts(0);
        setLocked(false);
      } else {
        setBiometricError("Biometric failed — use PIN");
      }
    } catch {
      setBiometricError("Biometric unavailable — use PIN");
    }
  };

  // Only auto-prompt biometric once the user has decrypted the seal and the
  // keypad is revealed — never on the idle cipher screen, so the hold-to-decrypt
  // gesture stays the single entry point into the unlock flow.
  useEffect(() => {
    if (biometricEnabled && decryptRevealed) tryBiometric();
  }, [decryptRevealed]);

  // ── PIN constants — supports 4–8 digit PINs ───────────────────────────────
  const MIN_PIN_LENGTH = 4;
  const MAX_PIN_LENGTH = 8;

  // ── Shared verify logic (called by keypad submit button) ──────────────────
  const verifyPin = async (pin: string) => {
    if (pin.length < MIN_PIN_LENGTH || !hasPin) return;
    setIsVerifying(true);

    const recordFailure = async () => {
      const newCount = failedAttemptsRef.current + 1;
      failedAttemptsRef.current = newCount;
      await saveFailCount(newCount);
      setFailedAttempts(newCount);
      return newCount;
    };

    try {
      const { correct, isDuress } = await checkPinWithDuress(pin);
      if (correct) {
        // The success haptic fires here — before we know whether this is a
        // duress unlock — so it looks identical to a normal unlock and does
        // not reveal the duress intent to a bystander. This is intentional:
        // the haptic mimics a successful PIN entry, not a wipe trigger.
        // No further haptic or audio must fire from this point onward in the
        // duress path (including inside panicWipe — see AppContext.tsx).
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await clearFailCount();
        failedAttemptsRef.current = 0;
        setFailedAttempts(0);
        if (isDuress) {
          // Start a grace period so the user can cancel an accidental
          // duress trigger. The countdown is subtle — a bystander watching
          // the brief animation won't register it. If not cancelled, the wipe
          // fires exactly as it would have before this change.
          // IMPORTANT: panicWipe() is called with no surrounding haptic or
          // audio — the silence contract in AppContext.tsx must be maintained.
          setDuressCountdown(duressGracePeriod);
          duressProgressAnim.setValue(1);
          duressAnimRef.current = Animated.timing(duressProgressAnim, {
            toValue: 0,
            duration: duressGracePeriod * 1000,
            useNativeDriver: false,
          });
          duressAnimRef.current.start();
          let remaining = duressGracePeriod;
          duressIntervalRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              clearInterval(duressIntervalRef.current!);
              duressIntervalRef.current = null;
              if (duressAnimRef.current) {
                duressAnimRef.current.stop();
                duressAnimRef.current = null;
              }
              setDuressCountdown(null);
              setLocked(false);
              panicWipe(); // silent — see SILENCE CONTRACT in AppContext.tsx
            } else {
              setDuressCountdown(remaining);
            }
          }, 1000);
          // Keep isVerifying true during the countdown so keypad is locked
        } else {
          setLocked(false);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        shake();
        const newCount = await recordFailure();
        if (newCount >= MAX_ATTEMPTS) {
          await clearFailCount();
          await panicWipe();
          return;
        }
        setTimeout(() => {
          setEntered("");
          rescramble();
          setIsVerifying(false);
        }, 650);
      }
    } catch {
      // Intentionally count errors as failed attempts: treating a
      // checkPinWithDuress() exception as "unknown outcome" could be exploited
      // to bypass the wipe threshold by repeatedly triggering errors.
      setError(true);
      shake();
      const newCount = await recordFailure();
      if (newCount >= MAX_ATTEMPTS) {
        await clearFailCount();
        await panicWipe();
        return;
      }
      setTimeout(() => {
        setEntered("");
        rescramble();
        setIsVerifying(false);
      }, 650);
    }
  };

  // ── PIN input ─────────────────────────────────────────────────────────────
  const handleKey = (key: string) => {
    if (isVerifying || !failCountLoaded) return;
    if (entered.length >= MAX_PIN_LENGTH) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEntered((prev) => prev + key);
    setError(false);
    setBiometricError("");
  };

  const handleSubmit = () => {
    if (isVerifying || !failCountLoaded) return;
    if (entered.length < MIN_PIN_LENGTH) return;
    verifyPin(entered);
  };

  const handleDuressCancel = () => {
    if (duressAnimRef.current) {
      duressAnimRef.current.stop();
      duressAnimRef.current = null;
    }
    duressProgressAnim.setValue(1);
    if (duressIntervalRef.current) {
      clearInterval(duressIntervalRef.current);
      duressIntervalRef.current = null;
    }
    setDuressCountdown(null);
    setIsVerifying(false);
    rescramble();
  };

  const handleDelete = () => {
    if (isVerifying || !failCountLoaded) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEntered((e) => e.slice(0, -1));
    setError(false);
  };

  // ── Hold-to-decrypt reveal ─────────────────────────────────────────────────
  // NOTE: the haptics here mark the *reveal* gesture, not a wipe. They are
  // intentionally outside the panicWipe/duress paths, so the silence contract
  // (see scripts/check-panic-wipe-silence.js) is unaffected.
  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdAnimRef.current) {
      holdAnimRef.current.stop();
      holdAnimRef.current = null;
    }
    Animated.timing(holdAnim, { toValue: 0, duration: 220, useNativeDriver: false }).start();
  };

  const startHold = () => {
    if (decryptRevealed || isVerifying || !failCountLoaded) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    holdAnim.setValue(0);
    holdAnimRef.current = Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    });
    holdAnimRef.current.start();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      holdAnimRef.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDecryptRevealed(true);
    }, HOLD_DURATION);
  };

  // Build 4-row grid:
  // Row 0: digits[0..2]
  // Row 1: digits[3..5]
  // Row 2: digits[6..8]
  // Row 3: digits[9], [submit when ≥4 entered], [del]
  const KEYS: string[][] = [
    [digits[0], digits[1], digits[2]],
    [digits[3], digits[4], digits[5]],
    [digits[6], digits[7], digits[8]],
    [digits[9], entered.length >= MIN_PIN_LENGTH ? "ok" : "", "del"],
  ];

  // Show 8 dots — always the same count so PIN length isn't revealed by UI change
  const dotCount = MAX_PIN_LENGTH;
  const remaining = MAX_ATTEMPTS - failedAttempts;
  const showWipeWarning = failedAttempts >= WARN_FROM;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
    },
    logo: { marginBottom: 12 },
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
      marginBottom: 16,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1.5,
    },
    scrambleHint: {
      color: colors.mutedForeground,
      fontSize: 8,
      letterSpacing: 2,
      marginBottom: 32,
      opacity: 0.5,
    },
    keypad: { gap: 16 },
    keyRow: { flexDirection: "row", gap: 24 },
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
    wipeWarning: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: `${colors.destructive}18`,
      alignItems: "center",
    },
    wipeWarningText: {
      color: colors.destructive,
      fontSize: 10,
      fontWeight: "800" as const,
      letterSpacing: 2,
      textAlign: "center",
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

    // ── Idle cipher seal (hold-to-decrypt) ──────────────────────────────────
    sealWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    sealRingOuter: {
      width: 300,
      height: 300,
      borderRadius: 150,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    sealRingInner: {
      width: 230,
      height: 230,
      borderRadius: 115,
      alignItems: "center",
      justifyContent: "center",
    },
    sealLogo: {
      marginBottom: 18,
    },
    glyphRowA: {
      fontFamily: MONO,
      color: colors.mutedForeground,
      fontSize: 15,
      letterSpacing: 2,
      marginBottom: 8,
    },
    glyphRowB: {
      fontFamily: MONO,
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 3,
      opacity: 0.7,
    },
    cipherLabel: {
      fontFamily: MONO,
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 5,
      marginTop: 40,
    },
    holdZone: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: insets.bottom + (Platform.OS === "web" ? 40 : 28),
      alignItems: "center",
    },
    holdProgressTrack: {
      width: 150,
      height: 2,
      borderRadius: 1,
      backgroundColor: `${colors.mutedForeground}30`,
      overflow: "hidden",
      marginBottom: 14,
    },
    holdProgressFill: {
      height: 2,
      backgroundColor: colors.primary,
    },
    holdHintRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    holdHint: {
      fontFamily: MONO,
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 4,
    },
    compactName: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 5,
      marginBottom: 24,
    },
    duressBar: {
      position: "absolute",
      bottom: insets.bottom + (Platform.OS === "web" ? 34 : 16),
      right: 24,
      width: 140,
      borderRadius: 6,
      backgroundColor: `${colors.background}cc`,
      borderWidth: 1,
      borderColor: `${colors.mutedForeground}20`,
      overflow: "hidden",
      opacity: 0.8,
    },
    duressTrack: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: `${colors.destructive}33`,
    },
    duressContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    duressCountText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
    },
    fallbackBadge: {
      position: "absolute",
      bottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) + 38,
      right: 24,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: `${colors.background}cc`,
      borderWidth: 1,
      borderColor: `${colors.mutedForeground}30`,
    },
    fallbackBadgeText: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
    fallbackCarrierNote: {
      color: colors.mutedForeground,
      fontSize: 8,
      letterSpacing: 1.5,
      marginTop: 2,
      opacity: 0.7,
    },
  });

  return (
    <View style={styles.container}>
      {hasPin && !decryptRevealed ? (
        <>
          <Pressable
            onPressIn={startHold}
            onPressOut={cancelHold}
            style={styles.sealWrap}
            testID="decrypt-seal"
          >
            <Animated.View
              style={[
                styles.sealRingOuter,
                {
                  borderColor: holdAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [colors.border, colors.primary],
                  }),
                  transform: [
                    {
                      scale: holdAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.04],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.sealRingInner}>
                <View style={styles.sealLogo}>
                  <GhostLogo size={84} color={colors.primary} />
                </View>
                <Animated.Text
                  style={[
                    styles.glyphRowA,
                    {
                      opacity: glyphAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.7],
                      }),
                    },
                  ]}
                >
                  {CIPHER_ROW_A}
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.glyphRowB,
                    {
                      opacity: glyphAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 0.25],
                      }),
                    },
                  ]}
                >
                  {CIPHER_ROW_B}
                </Animated.Text>
              </View>
            </Animated.View>
            <Text style={styles.cipherLabel}>CIPHER · LOCKED</Text>
          </Pressable>

          <View style={styles.holdZone}>
            <View style={styles.holdProgressTrack}>
              <Animated.View
                style={[
                  styles.holdProgressFill,
                  {
                    width: holdAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <View style={styles.holdHintRow}>
              <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} />
              <Text style={styles.holdHint}>HOLD · TO · DECRYPT</Text>
            </View>
          </View>
        </>
      ) : hasPin ? (
        <>
          <View style={styles.logo}>
            <GhostLogo size={120} color={colors.primary} />
          </View>
          <Text style={styles.compactName}>GHOSTFACE</Text>
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

          <Text style={styles.scrambleHint}>KEYPAD SCRAMBLES ON EACH UNLOCK</Text>

          <Animated.View
            style={[styles.keypad, { opacity: scrambleAnim }]}
            testID="keypad"
          >
            {KEYS.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((k, ki) => {
                  if (k === "") {
                    return <View key={ki} style={styles.keyBtn} />;
                  }
                  if (k === "del") {
                    return (
                      <Pressable key={ki} style={styles.keyBtn} onPress={handleDelete}>
                        <Ionicons name="backspace-outline" size={22} color={colors.foreground} />
                      </Pressable>
                    );
                  }
                  if (k === "ok") {
                    return (
                      <Pressable
                        key={ki}
                        style={[styles.keyBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={handleSubmit}
                        testID="key-submit"
                      >
                        <Ionicons name="checkmark" size={26} color={colors.primaryForeground} />
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
          </Animated.View>

          {error && !showWipeWarning && (
            <Text style={styles.errorText}>INCORRECT PIN</Text>
          )}

          {showWipeWarning && (
            <View style={styles.wipeWarning} testID="wipe-warning">
              <Text style={styles.wipeWarningText}>
                {remaining} {remaining === 1 ? "ATTEMPT" : "ATTEMPTS"} REMAINING BEFORE DATA WIPE
              </Text>
            </View>
          )}

          {biometricError ? <Text style={styles.errorText}>{biometricError}</Text> : null}
        </>
      ) : (
        <>
          <View style={styles.logo}>
            <GhostLogo size={120} color={colors.primary} />
          </View>
          <Text style={styles.compactName}>GHOSTFACE</Text>
          <Text style={styles.noPinHint}>NO PIN CONFIGURED</Text>
          <Pressable style={styles.continueBtn} onPress={() => setLocked(false)} testID="no-pin-continue">
            <Text style={styles.continueBtnText}>TAP TO CONTINUE</Text>
          </Pressable>
        </>
      )}

      {biometricEnabled && hasPin && decryptRevealed && duressCountdown === null && (
        <Pressable style={styles.biometricBtn} onPress={tryBiometric}>
          <Ionicons name="finger-print" size={22} color={colors.primary} />
          <Text style={styles.biometricText}>USE BIOMETRIC</Text>
        </Pressable>
      )}

      {duressCountdown !== null && fallbackCount > 0 && (
        <View style={styles.fallbackBadge} testID="fallback-armed-badge">
          <Text style={styles.fallbackBadgeText}>
            {fallbackCount} SMS FALLBACK ARMED
          </Text>
          {/*
           * Carrier-exposure reminder (Task #113). The duress flow can hand
           * a one-line SMS to the OS composer if the server can't be
           * reached, and SMS — unlike the encrypted in-app channel — is
           * visible to both carriers. Keep this text generic; never expose
           * the recipient numbers or message body on the lock screen.
           */}
          <Text style={styles.fallbackCarrierNote}>
            SMS IS UNENCRYPTED · CARRIERS CAN SEE IT
          </Text>
        </View>
      )}

      {duressCountdown !== null && (
        <TouchableOpacity
          style={styles.duressBar}
          onPress={handleDuressCancel}
          activeOpacity={0.6}
          testID="duress-cancel-bar"
        >
          <Animated.View
            style={[
              styles.duressTrack,
              {
                width: duressProgressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
          <View style={styles.duressContent}>
            <Text style={styles.duressCountText}>{duressCountdown}s / {duressGracePeriod}s</Text>
            <Ionicons name="close" size={12} color={colors.mutedForeground} style={{ opacity: 0.6 }} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

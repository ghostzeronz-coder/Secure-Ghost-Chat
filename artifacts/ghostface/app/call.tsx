import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
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
import { StatusDot } from "@/components/StatusDot";
import { useColors } from "@/hooks/useColors";

export default function CallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, mode } = useLocalSearchParams<{
    alias: string;
    mode: "voice" | "video";
  }>();

  const [callState, setCallState] = useState<"connecting" | "active" | "ended">(
    "connecting"
  );
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    const connectTimer = setTimeout(() => {
      setCallState("active");
      animation.stop();
      pulseAnim.setValue(1);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }, 2000);

    return () => {
      clearTimeout(connectTimer);
      animation.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleEnd = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setCallState("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => router.back(), 1000);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 48),
    },
    topSection: {
      alignItems: "center",
      gap: 16,
    },
    avatarRing: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 2,
      borderColor: callState === "active" ? colors.success : colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: colors.primary,
      fontSize: 32,
      fontWeight: "800" as const,
      letterSpacing: 2,
    },
    aliasText: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "800" as const,
      letterSpacing: 4,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusText: {
      fontSize: 13,
      letterSpacing: 3,
      fontWeight: "600" as const,
    },
    durationText: {
      color: colors.mutedForeground,
      fontSize: 13,
      letterSpacing: 4,
      fontWeight: "600" as const,
    },
    encryptedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    encryptedText: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 2,
    },
    controls: {
      flexDirection: "row",
      gap: 24,
      alignItems: "center",
    },
    ctrlBtn: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    ctrlBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    endBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.destructive,
      alignItems: "center",
      justifyContent: "center",
    },
    modeLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      marginTop: 4,
      textAlign: "center",
    },
  });

  const displayAlias = alias ?? "UNKNOWN";
  const isVideo = mode === "video";

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Animated.View
          style={[
            styles.avatarRing,
            callState === "connecting" && {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayAlias.slice(0, 2)}</Text>
          </View>
        </Animated.View>

        <Text style={styles.aliasText}>{displayAlias}</Text>

        <View style={styles.statusRow}>
          <StatusDot active={callState === "active"} size={6} />
          <Text
            style={[
              styles.statusText,
              {
                color:
                  callState === "active"
                    ? colors.success
                    : callState === "ended"
                    ? colors.destructive
                    : colors.primary,
              },
            ]}
          >
            {callState === "connecting"
              ? "CONNECTING..."
              : callState === "ended"
              ? "CALL ENDED"
              : isVideo
              ? "VIDEO ACTIVE"
              : "CALL ACTIVE"}
          </Text>
        </View>

        {callState === "active" && (
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        )}

        <View style={styles.encryptedRow}>
          <Ionicons name="lock-closed" size={10} color={colors.mutedForeground} />
          <Text style={styles.encryptedText}>
            ZRTP {isVideo ? "VIDEO" : "VOICE"} ENCRYPTED
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "center", gap: 12 }}>
        <View style={styles.controls}>
          <View style={{ alignItems: "center" }}>
            <Pressable
              style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMuted((m) => !m);
              }}
            >
              <Ionicons
                name={muted ? "mic-off" : "mic"}
                size={24}
                color={muted ? colors.primaryForeground : colors.foreground}
              />
            </Pressable>
            <Text style={styles.modeLabel}>{muted ? "UNMUTE" : "MUTE"}</Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <Pressable style={styles.endBtn} onPress={handleEnd} testID="end-call-btn">
              <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
            <Text style={styles.modeLabel}>END</Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <Pressable
              style={[styles.ctrlBtn, speakerOn && styles.ctrlBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSpeakerOn((s) => !s);
              }}
            >
              <Ionicons
                name={speakerOn ? "volume-high" : "volume-medium"}
                size={24}
                color={speakerOn ? colors.primaryForeground : colors.foreground}
              />
            </Pressable>
            <Text style={styles.modeLabel}>SPEAKER</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

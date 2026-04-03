import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusDot } from "@/components/StatusDot";
import { useColors } from "@/hooks/useColors";

type VoicePreset = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  pitch: number;
  description: string;
};

const VOICE_PRESETS: VoicePreset[] = [
  { id: "natural", label: "NATURAL", icon: "person-outline", pitch: 0, description: "Original voice" },
  { id: "robot", label: "ROBOT", icon: "hardware-chip-outline", pitch: -8, description: "Metallic tone" },
  { id: "deep", label: "DEEP", icon: "arrow-down-outline", pitch: -5, description: "Low frequency" },
  { id: "ghost", label: "GHOST", icon: "skull-outline", pitch: -3, description: "Ethereal echo" },
  { id: "alien", label: "ALIEN", icon: "planet-outline", pitch: 7, description: "Warped signal" },
  { id: "chipmunk", label: "HIGH", icon: "arrow-up-outline", pitch: 9, description: "High pitched" },
];

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
  const [showVoiceChanger, setShowVoiceChanger] = useState(false);
  const [activeVoice, setActiveVoice] = useState<string>("natural");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const voiceSlideAnim = useRef(new Animated.Value(0)).current;
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

  const toggleVoiceChanger = () => {
    const opening = !showVoiceChanger;
    setShowVoiceChanger(opening);
    Animated.spring(voiceSlideAnim, {
      toValue: opening ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const selectVoice = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveVoice(id);
  };

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

  const activePreset = VOICE_PRESETS.find((p) => p.id === activeVoice)!;
  const voiceActive = activeVoice !== "natural";

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 48),
    },
    topSection: {
      alignItems: "center",
      gap: 16,
      flex: 1,
      justifyContent: "center",
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
    voiceActiveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: `${colors.primary}20`,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    voiceActiveText: {
      color: colors.primary,
      fontSize: 10,
      letterSpacing: 2,
      fontWeight: "700" as const,
    },
    bottomSection: {
      gap: 16,
    },
    voiceChangerPanel: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: voiceActive ? colors.primary : colors.border,
      overflow: "hidden",
    },
    vcHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: showVoiceChanger ? 1 : 0,
      borderBottomColor: colors.border,
    },
    vcHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    vcHeaderTitle: {
      color: voiceActive ? colors.primary : colors.foreground,
      fontSize: 12,
      fontWeight: "700" as const,
      letterSpacing: 3,
    },
    vcHeaderSub: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 1,
    },
    vcGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: 12,
      gap: 8,
    },
    vcPreset: {
      width: "30%",
      minWidth: 80,
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: colors.radius,
      borderWidth: 1.5,
      gap: 4,
    },
    vcPresetLabel: {
      fontSize: 9,
      fontWeight: "800" as const,
      letterSpacing: 2,
    },
    vcPresetDesc: {
      fontSize: 8,
      letterSpacing: 0.5,
    },
    controls: {
      flexDirection: "row",
      gap: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    ctrlBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
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
    ctrlBtnVoice: {
      backgroundColor: voiceActive ? `${colors.primary}25` : colors.card,
      borderColor: voiceActive ? colors.primary : colors.border,
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
      fontSize: 9,
      letterSpacing: 2,
      marginTop: 4,
      textAlign: "center",
    },
    ctrlItem: {
      alignItems: "center",
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

        {voiceActive && (
          <View style={styles.voiceActiveRow}>
            <Ionicons name="mic" size={10} color={colors.primary} />
            <Text style={styles.voiceActiveText}>
              VOICE: {activePreset.label}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomSection}>
        {/* Voice Changer Panel */}
        <Pressable style={styles.voiceChangerPanel} onPress={toggleVoiceChanger}>
          <View style={styles.vcHeader}>
            <View style={styles.vcHeaderLeft}>
              <Ionicons
                name="mic-outline"
                size={18}
                color={voiceActive ? colors.primary : colors.mutedForeground}
              />
              <View>
                <Text style={styles.vcHeaderTitle}>
                  VOICE CHANGER {voiceActive ? `· ${activePreset.label}` : ""}
                </Text>
                <Text style={styles.vcHeaderSub}>
                  {voiceActive ? activePreset.description.toUpperCase() : "TAP TO CONFIGURE"}
                </Text>
              </View>
            </View>
            <Ionicons
              name={showVoiceChanger ? "chevron-down" : "chevron-up"}
              size={16}
              color={colors.mutedForeground}
            />
          </View>

          {showVoiceChanger && (
            <View style={styles.vcGrid}>
              {VOICE_PRESETS.map((preset) => {
                const isActive = activeVoice === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    style={[
                      styles.vcPreset,
                      {
                        backgroundColor: isActive ? `${colors.primary}20` : "transparent",
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => selectVoice(preset.id)}
                  >
                    <Ionicons
                      name={preset.icon}
                      size={20}
                      color={isActive ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.vcPresetLabel,
                        { color: isActive ? colors.primary : colors.foreground },
                      ]}
                    >
                      {preset.label}
                    </Text>
                    <Text
                      style={[
                        styles.vcPresetDesc,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {preset.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>

        {/* Call Controls */}
        <View style={styles.controls}>
          <View style={styles.ctrlItem}>
            <Pressable
              style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMuted((m) => !m);
              }}
            >
              <Ionicons
                name={muted ? "mic-off" : "mic"}
                size={22}
                color={muted ? colors.primaryForeground : colors.foreground}
              />
            </Pressable>
            <Text style={styles.modeLabel}>{muted ? "UNMUTE" : "MUTE"}</Text>
          </View>

          <View style={styles.ctrlItem}>
            <Pressable
              style={[styles.ctrlBtn, styles.ctrlBtnVoice]}
              onPress={toggleVoiceChanger}
            >
              <Ionicons
                name="mic-circle-outline"
                size={22}
                color={voiceActive ? colors.primary : colors.foreground}
              />
            </Pressable>
            <Text style={[styles.modeLabel, voiceActive && { color: colors.primary }]}>
              VOICE FX
            </Text>
          </View>

          <View style={styles.ctrlItem}>
            <Pressable style={styles.endBtn} onPress={handleEnd} testID="end-call-btn">
              <Ionicons
                name="call"
                size={26}
                color="#FFFFFF"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            </Pressable>
            <Text style={styles.modeLabel}>END</Text>
          </View>

          <View style={styles.ctrlItem}>
            <Pressable
              style={[styles.ctrlBtn, speakerOn && styles.ctrlBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSpeakerOn((s) => !s);
              }}
            >
              <Ionicons
                name={speakerOn ? "volume-high" : "volume-medium"}
                size={22}
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

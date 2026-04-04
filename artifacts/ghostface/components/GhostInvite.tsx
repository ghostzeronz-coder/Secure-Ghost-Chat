import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useColors } from "@/hooks/useColors";

const TIMER_OPTIONS = [
  { label: "10 MIN", ms: 10 * 60 * 1000 },
  { label: "1 HR",   ms: 60 * 60 * 1000 },
  { label: "24 HR",  ms: 24 * 60 * 60 * 1000 },
  { label: "7 DAY",  ms: 7 * 24 * 60 * 60 * 1000 },
];

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "GF-";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  c += "-";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "EXPIRED";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}D ${h % 24}H ${m % 60}M`;
  if (h > 0) return `${h}H ${m % 60}M ${s % 60}S`;
  return `${m}M ${s % 60}S`;
}

export default function GhostInvite() {
  const colors = useColors();
  const [code, setCode] = useState(genCode);
  const [timerIdx, setTimerIdx] = useState(0);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + TIMER_OPTIONS[0].ms);
  const [remaining, setRemaining] = useState(TIMER_OPTIONS[0].ms);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback((idx?: number) => {
    const i = idx ?? timerIdx;
    const newCode = genCode();
    const exp = Date.now() + TIMER_OPTIONS[i].ms;
    setCode(newCode);
    setExpiresAt(exp);
    setRemaining(TIMER_OPTIONS[i].ms);
    setCopied(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [timerIdx]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const r = expiresAt - Date.now();
      setRemaining(r > 0 ? r : 0);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  const expired = remaining <= 0;
  const qrValue = `ghostface://invite/${code}?exp=${expiresAt}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTimer = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimerIdx(idx);
    const exp = Date.now() + TIMER_OPTIONS[idx].ms;
    setExpiresAt(exp);
    setRemaining(TIMER_OPTIONS[idx].ms);
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 20, gap: 20, paddingBottom: 120 },
    sectionLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 3,
      marginBottom: 8,
    },
    qrCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: expired ? colors.destructive : colors.border,
      alignItems: "center",
      padding: 24,
      gap: 16,
    },
    qrWrap: {
      padding: 12,
      backgroundColor: "#FFFFFF",
      borderRadius: 8,
      opacity: expired ? 0.25 : 1,
    },
    expiredOverlay: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    expiredTxt: {
      color: colors.destructive,
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 4,
    },
    codeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    codeText: {
      color: expired ? colors.mutedForeground : colors.primary,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 6,
      fontFamily: "monospace",
    },
    copyBtn: {
      backgroundColor: copied ? colors.success : colors.muted,
      borderRadius: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: copied ? colors.success : colors.border,
    },
    countdownRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    countdownTxt: {
      color: expired ? colors.destructive : remaining < 60000 ? colors.destructive : colors.mutedForeground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 2,
      fontFamily: "monospace",
    },
    selfDestructBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(255,59,48,0.12)",
      borderWidth: 1,
      borderColor: colors.destructive,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    selfDestructTxt: {
      color: colors.destructive,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
    },
    timerRow: {
      flexDirection: "row",
      gap: 8,
    },
    timerBtn: {
      flex: 1,
      paddingVertical: 9,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    timerBtnActive: {
      backgroundColor: "rgba(255,59,48,0.15)",
      borderColor: colors.destructive,
    },
    timerTxt: {
      color: colors.mutedForeground,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 2,
    },
    timerTxtActive: {
      color: colors.destructive,
    },
    regenBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    regenBtnTxt: {
      color: colors.primaryForeground,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 3,
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    infoTxt: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 1,
      flex: 1,
      lineHeight: 18,
    },
  });

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>

        {/* QR card */}
        <View>
          <Text style={styles.sectionLabel}>ENCRYPTED INVITE CODE</Text>
          <View style={styles.qrCard}>

            {/* Self-destruct badge */}
            <View style={styles.selfDestructBadge}>
              <Ionicons name="flame-outline" size={10} color={colors.destructive} />
              <Text style={styles.selfDestructTxt}>SELF-DESTRUCT ENABLED</Text>
            </View>

            {/* QR code */}
            <View>
              <View style={styles.qrWrap}>
                <QRCode
                  value={expired ? "EXPIRED" : qrValue}
                  size={180}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                />
              </View>
              {expired && (
                <View style={[StyleSheet.absoluteFill, styles.expiredOverlay]}>
                  <Ionicons name="ban-outline" size={40} color={colors.destructive} />
                  <Text style={styles.expiredTxt}>EXPIRED</Text>
                </View>
              )}
            </View>

            {/* Code text + copy */}
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{code}</Text>
              {!expired && (
                <Pressable style={styles.copyBtn} onPress={handleCopy}>
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={18}
                    color={copied ? colors.success : colors.mutedForeground}
                  />
                </Pressable>
              )}
            </View>

            {/* Countdown */}
            <View style={styles.countdownRow}>
              <Ionicons
                name="timer-outline"
                size={12}
                color={expired ? colors.destructive : remaining < 60000 ? colors.destructive : colors.mutedForeground}
              />
              <Text style={styles.countdownTxt}>
                {expired ? "CODE DESTROYED" : `DESTROYS IN  ${fmtCountdown(remaining)}`}
              </Text>
            </View>

          </View>
        </View>

        {/* Self-destruct timer selector */}
        <View>
          <Text style={styles.sectionLabel}>SELF-DESTRUCT TIMER</Text>
          <View style={styles.timerRow}>
            {TIMER_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.label}
                style={[styles.timerBtn, timerIdx === i && styles.timerBtnActive]}
                onPress={() => handleTimer(i)}
              >
                <Text style={[styles.timerTxt, timerIdx === i && styles.timerTxtActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Generate new code */}
        <Pressable
          style={({ pressed }) => [styles.regenBtn, pressed && { opacity: 0.8 }]}
          onPress={() => reset()}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.primaryForeground} />
          <Text style={styles.regenBtnTxt}>GENERATE NEW CODE</Text>
        </Pressable>

        {/* Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="qr-code-outline" size={14} color={colors.primary} />
            <Text style={styles.infoTxt}>Share your QR code or the text code with your contact. They scan or enter it to establish an encrypted channel.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="flame-outline" size={14} color={colors.destructive} />
            <Text style={styles.infoTxt}>Codes self-destruct after the selected time. Once expired they cannot be used and leave no trace.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.infoTxt}>Each code is one-time use. After a contact connects, the code is automatically invalidated.</Text>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

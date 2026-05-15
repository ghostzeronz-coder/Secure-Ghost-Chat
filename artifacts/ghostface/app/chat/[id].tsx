import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SecureBadge } from "@/components/SecureBadge";
import { StatusDot } from "@/components/StatusDot";
import type { Attachment } from "@/context/AppContext";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { drKeyFingerprint } from "@/lib/doubleRatchet";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatExpiry(expiresAt: number): string {
  const secsLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  if (secsLeft < 60) return `${secsLeft}s`;
  if (secsLeft < 3600) return `${Math.floor(secsLeft / 60)}m`;
  if (secsLeft < 86400) return `${Math.floor(secsLeft / 3600)}h`;
  return `${Math.floor(secsLeft / 86400)}d`;
}

const DISAPPEAR_OPTIONS = [
  { label: "OFF", value: undefined },
  { label: "30s", value: 30 },
  { label: "5m", value: 300 },
  { label: "1h", value: 3600 },
  { label: "24h", value: 86400 },
  { label: "7d", value: 604800 },
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { conversations, sendMessage, retryMessage, deleteMessage, clearConversation, setDisappearTimer, verifyConversation } = useApp();
  const [text, setText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [showDisappear, setShowDisappear] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [, setTick] = useState(0);
  const listRef = useRef<FlatList>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showQueuedToast = () => {
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const conv = conversations.find((c) => c.id === id);

  // Tick every second when a disappear timer is active — keeps countdown badges live
  useEffect(() => {
    if (!conv?.disappearAfterSec) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.id, conv?.disappearAfterSec]);

  if (!conv) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground, letterSpacing: 2 }}>CHANNEL NOT FOUND</Text>
      </View>
    );
  }

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingAttachment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = sendMessage(conv.id, trimmed, pendingAttachment ?? undefined);
    if (result.queued) showQueuedToast();
    setText("");
    setPendingAttachment(null);
  };

  // Build an inline data URI from a picked image so the attachment travels
  // through the existing E2EE message channel without needing any external
  // storage. Quality and size are capped so the encoded payload stays small.
  const pickFromLibrary = async () => {
    setShowAttachMenu(false);
    if (attachBusy) return;
    setAttachBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "PHOTOS ACCESS DENIED",
          "Enable photo library access in your device settings to attach images.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.4,
        base64: true,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const mime = a.mimeType ?? "image/jpeg";
      const uri = a.base64 ? `data:${mime};base64,${a.base64}` : a.uri;
      setPendingAttachment({
        kind: "image",
        uri,
        width: a.width,
        height: a.height,
        mimeType: mime,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn("[Attach] library pick failed", e);
      Alert.alert("ATTACH FAILED", "Could not load the selected image.");
    } finally {
      setAttachBusy(false);
    }
  };

  const pickFromCamera = async () => {
    setShowAttachMenu(false);
    if (attachBusy) return;
    setAttachBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "CAMERA ACCESS DENIED",
          "Enable camera access in your device settings to capture photos.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.4,
        base64: true,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const mime = a.mimeType ?? "image/jpeg";
      const uri = a.base64 ? `data:${mime};base64,${a.base64}` : a.uri;
      setPendingAttachment({
        kind: "image",
        uri,
        width: a.width,
        height: a.height,
        mimeType: mime,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn("[Attach] camera capture failed", e);
      Alert.alert("CAPTURE FAILED", "Could not capture the photo.");
    } finally {
      setAttachBusy(false);
    }
  };

  const comingSoon = (label: string) => {
    setShowAttachMenu(false);
    Alert.alert(
      `${label.toUpperCase()} COMING SOON`,
      "This message tool is on the roadmap and will arrive in a future build.",
    );
  };

  const handleLongPress = (msgId: string, fromMe: boolean, plaintext: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const deleteTitle = fromMe ? "DELETE MESSAGE" : "DELETE FOR ME";
    const deleteMsg = fromMe
      ? "Permanently delete this message?"
      : "Remove this message from your view?";

    const copy = async () => {
      await Clipboard.setStringAsync(plaintext);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    if (Platform.OS !== "web") {
      Alert.alert(
        "MESSAGE",
        fromMe ? "Copy text or permanently delete this message?" : "Copy text or remove this message from your view?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Copy", onPress: copy },
          { text: "Delete", style: "destructive", onPress: () => deleteMessage(conv.id, msgId) },
        ],
        { cancelable: true }
      );
    } else {
      const choice = window.prompt(`MESSAGE\nType "copy" to copy text, "delete" to ${fromMe ? "delete" : "remove"}:`, "copy");
      if (choice === "copy") copy();
      else if (choice === "delete") {
        if (window.confirm(`${deleteTitle}\n${deleteMsg}`)) deleteMessage(conv.id, msgId);
      }
    }
  };

  const handleClearChat = () => {
    if (Platform.OS !== "web") {
      Alert.alert("CLEAR CHAT", "Delete all messages in this channel? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => { clearConversation(conv.id); setShowInfo(false); } },
      ]);
    } else if (window.confirm("CLEAR CHAT\nDelete all messages in this channel? This cannot be undone.")) {
      clearConversation(conv.id);
      setShowInfo(false);
    }
  };

  const currentDisappear = DISAPPEAR_OPTIONS.find((o) => o.value === conv.disappearAfterSec)
    ?? DISAPPEAR_OPTIONS[0];

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8),
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    headerInfo: { flex: 1 },
    headerAlias: { color: colors.foreground, fontSize: 14, fontWeight: "800", letterSpacing: 3 },
    headerSub: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    headerSubText: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 2 },
    headerTimerBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 2,
      backgroundColor: `${colors.destructive}20`,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    headerTimerTxt: {
      fontSize: 8,
      fontWeight: "800" as const,
      letterSpacing: 1,
      color: colors.destructive,
    },
    headerActions: { flexDirection: "row", gap: 12, alignItems: "center" },
    encBanner: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: `${colors.primary}08`,
    },
    encBannerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    encBannerTxt: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 2 },
    disappearBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: conv.disappearAfterSec ? `${colors.destructive}22` : "transparent",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    disappearTxt: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
      color: conv.disappearAfterSec ? colors.destructive : colors.mutedForeground,
    },
    listContent: { paddingHorizontal: 16, paddingVertical: 12 },
    msgRow: { marginVertical: 4, maxWidth: "80%" },
    msgBubble: { borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8 },
    msgText: { fontSize: 14, lineHeight: 20, letterSpacing: 0.3 },
    msgMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    msgTime: { fontSize: 9, letterSpacing: 0.5 },
    fingerprint: { fontSize: 8, letterSpacing: 1, opacity: 0.5, fontFamily: "monospace" },
    expiryBadge: {
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1,
      color: colors.destructive,
    },
    sealedBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 2,
      backgroundColor: `${colors.primary}1A`,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    sealedTxt: {
      fontSize: 7,
      fontWeight: "800" as const,
      letterSpacing: 1,
      color: colors.primary,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 10),
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      color: colors.foreground,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxHeight: 120,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { backgroundColor: colors.muted },
    callBtn: { padding: 6 },
    attachBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },

    // Image attachment in bubble
    msgBubbleWithImage: { padding: 4, gap: 6 },
    msgImage: {
      width: 220, height: 220, borderRadius: 10,
      backgroundColor: colors.muted,
    },
    msgTextWithImage: { paddingHorizontal: 8, paddingBottom: 4, paddingTop: 2 },

    // Pending attachment chip
    attachPreviewBar: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: 12, paddingVertical: 8,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    attachPreviewImg: {
      width: 40, height: 40, borderRadius: 6,
      backgroundColor: colors.muted,
    },
    attachPreviewLabel: {
      color: colors.foreground, fontSize: 10, fontWeight: "800", letterSpacing: 2,
    },
    attachPreviewSub: {
      color: colors.mutedForeground, fontSize: 10, marginTop: 2,
    },
    attachPreviewClose: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },

    // Attach sheet options
    attachHint: {
      color: colors.mutedForeground, fontSize: 11, lineHeight: 16,
    },
    attachOption: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 12, paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.background,
    },
    attachIconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: `${colors.primary}15`,
      alignItems: "center", justifyContent: "center",
    },
    attachOptionTitle: {
      color: colors.foreground, fontSize: 11, fontWeight: "800", letterSpacing: 2,
    },
    attachOptionSub: {
      color: colors.mutedForeground, fontSize: 10, marginTop: 2,
    },

    // Info modal
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
      paddingBottom: insets.bottom + 24,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border, alignSelf: "center", marginTop: 14, marginBottom: 4,
    },
    sheetHead: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    sheetTitle: { color: colors.foreground, fontSize: 13, fontWeight: "800", letterSpacing: 4 },
    sheetBody: { padding: 20, gap: 16 },
    safetyRow: {
      backgroundColor: colors.background,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 8,
    },
    safetyLabel: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 3 },
    safetyNumber: {
      color: colors.success,
      fontSize: 16, fontWeight: "800", letterSpacing: 4,
      fontFamily: "monospace",
    },
    safetyNote: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 1 },
    infoRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    infoLabel: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 2 },
    infoValue: { color: colors.foreground, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
    disappearOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    disappearOpt: {
      borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    disappearOptTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 2 },
    clearBtn: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.destructive,
      borderRadius: colors.radius,
      paddingVertical: 13,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    clearBtnTxt: {
      color: colors.destructive,
      fontSize: 12,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
  });

  const messages = [...conv.messages];

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={{ padding: 4 }} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerAlias}>{conv.alias}</Text>
          <View style={styles.headerSub}>
            <StatusDot active size={5} pulse={false} />
            <Text style={styles.headerSubText}>
              {conv.drSession ? "DOUBLE RATCHET · X3DH · CHACHA20" : "SECURE · CHACHA20-POLY1305"}
            </Text>
            {conv.disappearAfterSec && (
              <View style={styles.headerTimerBadge}>
                <Ionicons name="timer-outline" size={8} color={colors.destructive} />
                <Text style={styles.headerTimerTxt}>
                  {currentDisappear.label}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.callBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/call", params: { alias: conv.alias, mode: "voice", role: "caller", callId: Date.now().toString() } });
          }} testID="voice-call-btn">
            <Ionicons name="call-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable style={styles.callBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/call", params: { alias: conv.alias, mode: "video", role: "caller", callId: Date.now().toString() } });
          }} testID="video-call-btn">
            <Ionicons name="videocam-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable style={styles.callBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowInfo(true);
          }}>
            <Ionicons
              name={conv.verified ? "shield-checkmark" : "shield-checkmark-outline"}
              size={20}
              color={conv.verified ? colors.primary : colors.success}
            />
          </Pressable>
        </View>
      </View>

      {/* Encryption banner */}
      <View style={styles.encBanner}>
        <View style={styles.encBannerLeft}>
          <SecureBadge type={conv.drSession ? "double-ratchet" : "e2ee"} size="sm" />
          <Text style={styles.encBannerTxt}>
            {conv.drSession ? "DOUBLE RATCHET · SEALED SENDER" : "E2EE · SEALED SENDER"}
          </Text>
        </View>
        <Pressable style={styles.disappearBadge} onPress={() => setShowDisappear(true)}>
          <Ionicons
            name={conv.disappearAfterSec ? "timer-outline" : "timer-outline"}
            size={10}
            color={conv.disappearAfterSec ? colors.destructive : colors.mutedForeground}
          />
          <Text style={styles.disappearTxt}>
            {currentDisappear.label === "OFF" ? "DISAPPEAR: OFF" : `DISAPPEAR: ${currentDisappear.label}`}
          </Text>
        </Pressable>
      </View>

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.msgRow, item.fromMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}
            onLongPress={() => handleLongPress(item.id, item.fromMe, item.text)}
            delayLongPress={400}
          >
            <View style={[
              styles.msgBubble,
              {
                backgroundColor: item.fromMe ? colors.primary : colors.card,
                borderWidth: item.fromMe ? 0 : 1,
                borderColor: colors.border,
              },
              item.attachment?.kind === "image" && styles.msgBubbleWithImage,
            ]}>
              {item.attachment?.kind === "image" && (
                <Image
                  source={{ uri: item.attachment.uri }}
                  style={styles.msgImage}
                  contentFit="cover"
                  transition={120}
                  accessibilityLabel="Encrypted photo attachment"
                />
              )}
              {!!item.text && (
                <Text
                  style={[
                    styles.msgText,
                    { color: item.fromMe ? colors.primaryForeground : colors.foreground },
                    item.attachment?.kind === "image" && styles.msgTextWithImage,
                  ]}
                >
                  {item.text}
                </Text>
              )}
            </View>
            <View style={[styles.msgMeta, item.fromMe ? { justifyContent: "flex-end" } : {}]}>
              <Text style={[styles.msgTime, { color: colors.mutedForeground }]}>
                {formatTime(item.timestamp)}
              </Text>
              {item.failed ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    retryMessage(conv.id, item.id);
                  }}
                  style={[styles.sealedBadge, { backgroundColor: `${colors.destructive}22`, flexDirection: "row", alignItems: "center", gap: 3 }]}
                  testID={`retry-msg-${item.id}`}
                >
                  <Ionicons name="alert-circle-outline" size={8} color={colors.destructive} />
                  <Text style={[styles.sealedTxt, { color: colors.destructive }]}>FAILED</Text>
                  <Ionicons name="refresh" size={8} color={colors.destructive} />
                  <Text style={[styles.sealedTxt, { color: colors.destructive }]}>RETRY</Text>
                </Pressable>
              ) : item.pending ? (
                <View style={[styles.sealedBadge, { backgroundColor: `${colors.mutedForeground}22` }]}>
                  <Ionicons name="time-outline" size={7} color={colors.mutedForeground} />
                  <Text style={[styles.sealedTxt, { color: colors.mutedForeground }]}>QUEUED</Text>
                </View>
              ) : (
                <>
                  {item.encrypted && (
                    <Ionicons name="lock-closed" size={8} color={colors.mutedForeground} />
                  )}
                  {item.sealed && (
                    <View style={styles.sealedBadge}>
                      <Ionicons name="mail-unread-outline" size={7} color={colors.primary} />
                      <Text style={styles.sealedTxt}>SEALED</Text>
                    </View>
                  )}
                </>
              )}
              {item.fingerprint && (
                <Text style={styles.fingerprint}>{item.fingerprint}</Text>
              )}
              {item.expiresAt && (
                <Text style={styles.expiryBadge}>⏱ {formatExpiry(item.expiresAt)}</Text>
              )}
            </View>
          </Pressable>
        )}
      />

      {/* Pending attachment preview chip */}
      {pendingAttachment?.kind === "image" && (
        <View style={styles.attachPreviewBar}>
          <Image
            source={{ uri: pendingAttachment.uri }}
            style={styles.attachPreviewImg}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.attachPreviewLabel}>ENCRYPTED PHOTO</Text>
            <Text style={styles.attachPreviewSub}>Sent end-to-end through the Double Ratchet</Text>
          </View>
          <Pressable
            onPress={() => setPendingAttachment(null)}
            style={styles.attachPreviewClose}
            testID="attach-clear"
            accessibilityLabel="Remove attachment"
          >
            <Ionicons name="close" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <Pressable
          style={styles.attachBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAttachMenu(true);
          }}
          testID="attach-btn"
          accessibilityLabel="Attach to message"
        >
          <Ionicons name="add" size={20} color={colors.mutedForeground} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Encrypted message..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          testID="message-input"
        />
        <Pressable
          style={[styles.sendBtn, !text.trim() && !pendingAttachment && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() && !pendingAttachment}
          testID="send-btn"
        >
          <Ionicons
            name="send"
            size={16}
            color={text.trim() || pendingAttachment ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>

      {/* Attachment menu sheet */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowAttachMenu(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>ATTACH TO MESSAGE</Text>
                <Pressable onPress={() => setShowAttachMenu(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.sheetBody}>
                <Text style={styles.attachHint}>
                  All attachments are encrypted with the same Double Ratchet keys as your messages.
                </Text>

                <Pressable
                  style={styles.attachOption}
                  onPress={pickFromLibrary}
                  testID="attach-photo-library"
                >
                  <View style={styles.attachIconWrap}>
                    <Ionicons name="images" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachOptionTitle}>PHOTO LIBRARY</Text>
                    <Text style={styles.attachOptionSub}>Pick a photo from your device</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>

                <Pressable
                  style={styles.attachOption}
                  onPress={pickFromCamera}
                  testID="attach-camera"
                >
                  <View style={styles.attachIconWrap}>
                    <Ionicons name="camera" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachOptionTitle}>CAMERA</Text>
                    <Text style={styles.attachOptionSub}>Capture a photo with the camera</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>

                <Pressable
                  style={styles.attachOption}
                  onPress={() => comingSoon("File")}
                  testID="attach-file"
                >
                  <View style={styles.attachIconWrap}>
                    <Ionicons name="document" size={18} color={colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.attachOptionTitle, { color: colors.mutedForeground }]}>FILE</Text>
                    <Text style={styles.attachOptionSub}>Coming soon</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>

                <Pressable
                  style={styles.attachOption}
                  onPress={() => comingSoon("Voice note")}
                  testID="attach-voice"
                >
                  <View style={styles.attachIconWrap}>
                    <Ionicons name="mic" size={18} color={colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.attachOptionTitle, { color: colors.mutedForeground }]}>VOICE NOTE</Text>
                    <Text style={styles.attachOptionSub}>Coming soon</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>

                <Pressable
                  style={styles.attachOption}
                  onPress={() => {
                    setShowAttachMenu(false);
                    setShowDisappear(true);
                  }}
                  testID="attach-disappear"
                >
                  <View style={styles.attachIconWrap}>
                    <Ionicons name="timer-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachOptionTitle}>SELF-DESTRUCT TIMER</Text>
                    <Text style={styles.attachOptionSub}>
                      Set how long messages last in this chat
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Security info sheet */}
      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowInfo(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>SECURITY INFO</Text>
                <Pressable onPress={() => setShowInfo(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.sheetBody}>
                {/* Safety number */}
                {conv.safetyNumber && (
                  <View style={[
                    styles.safetyRow,
                    conv.verified && { borderColor: `${colors.primary}60`, backgroundColor: `${colors.primary}08` },
                  ]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={styles.safetyLabel}>SAFETY NUMBER</Text>
                      {conv.verified && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${colors.primary}22`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Ionicons name="shield-checkmark" size={10} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 2 }}>VERIFIED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.safetyNumber}>{conv.safetyNumber}</Text>
                    <Text style={styles.safetyNote}>
                      {conv.verified
                        ? `Identity confirmed. Safety number matches ${conv.alias}.`
                        : `Compare with ${conv.alias} out-of-band to verify identity`}
                    </Text>
                  </View>
                )}
                {/* Ratchet state panel — only visible for DR sessions */}
                {conv.drSession && (() => {
                  const drStep = conv.drSession.alice.step;
                  const stepColor = drStep === 0 ? colors.primary : colors.success;
                  return (
                    <View style={[styles.safetyRow, { backgroundColor: `${stepColor}10`, borderColor: `${stepColor}40` }]}>
                      <Text style={[styles.safetyLabel, { color: stepColor }]}>RATCHET STATE</Text>
                      <View style={{ flexDirection: "row", gap: 20, flexWrap: "wrap", marginTop: 4 }}>
                        <View>
                          <Text style={[styles.safetyLabel, { fontSize: 8 }]}>DH STEPS</Text>
                          <Text style={[styles.safetyNumber, { fontSize: 22, color: stepColor }]}>
                            {drStep}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.safetyLabel, { fontSize: 8 }]}>SENT</Text>
                          <Text style={[styles.safetyNumber, { fontSize: 22 }]}>
                            {conv.drSession!.alice.Ns}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.safetyLabel, { fontSize: 8 }]}>RECV</Text>
                          <Text style={[styles.safetyNumber, { fontSize: 22 }]}>
                            {conv.drSession!.alice.Nr}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.safetyNote, { fontFamily: "monospace", marginTop: 6 }]}>
                        DH KEY: {drKeyFingerprint(conv.drSession!.alice)}...
                      </Text>
                      <Text style={[styles.safetyNote, { marginTop: 2 }]}>
                        {drStep === 0 ? "Awaiting first ratchet step" : "Each reply triggers a new DH ratchet step"}
                      </Text>
                    </View>
                  );
                })()}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>PROTOCOL</Text>
                  <Text style={[styles.infoValue, { color: colors.success }]}>
                    {conv.drSession ? "DOUBLE RATCHET" : "SEALED SENDER"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>KEY AGREEMENT</Text>
                  <Text style={[styles.infoValue, { color: colors.success }]}>
                    {conv.drSession ? "X3DH · X25519" : "ECDH"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>CIPHER</Text>
                  <Text style={[styles.infoValue, { color: colors.success }]}>CHACHA20-POLY1305</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>KDF</Text>
                  <Text style={[styles.infoValue, { color: colors.success }]}>
                    {conv.drSession ? "HKDF-SHA256 · HMAC-SHA256" : "SHA-256"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>FORWARD SECRECY</Text>
                  <Text style={[styles.infoValue, { color: colors.success }]}>ENABLED</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>BREAK-IN RECOVERY</Text>
                  <Text style={[styles.infoValue, { color: conv.drSession ? colors.success : colors.mutedForeground }]}>
                    {conv.drSession ? "ENABLED" : "N/A"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NONCE</Text>
                  <Text style={[styles.infoValue, { color: colors.success }]}>RANDOM 96-BIT PER MSG</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>SEALED SENDER</Text>
                  <Text style={[styles.infoValue, { color: colors.success }]}>ACTIVE</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>LIBRARY</Text>
                  <Text style={styles.infoValue}>@NOBLE/{conv.drSession ? "CURVES + HASHES" : "CIPHERS"}</Text>
                </View>
                {/* Verify / Unverify */}
                <Pressable
                  style={({ pressed }) => [
                    styles.clearBtn,
                    {
                      borderColor: conv.verified ? colors.mutedForeground : colors.primary,
                      backgroundColor: conv.verified ? "transparent" : `${colors.primary}12`,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    verifyConversation(conv.id);
                  }}
                >
                  <Ionicons
                    name={conv.verified ? "shield-outline" : "shield-checkmark"}
                    size={14}
                    color={conv.verified ? colors.mutedForeground : colors.primary}
                  />
                  <Text style={[styles.clearBtnTxt, { color: conv.verified ? colors.mutedForeground : colors.primary }]}>
                    {conv.verified ? "REMOVE VERIFICATION" : "MARK AS VERIFIED"}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
                  onPress={handleClearChat}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.destructive} />
                  <Text style={styles.clearBtnTxt}>CLEAR CHAT</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Disappearing messages sheet */}
      <Modal visible={showDisappear} transparent animationType="slide" onRequestClose={() => setShowDisappear(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowDisappear(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>DISAPPEARING MESSAGES</Text>
                <Pressable onPress={() => setShowDisappear(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.sheetBody}>
                <Text style={styles.safetyNote}>
                  Messages auto-delete after the set time. Both sides can still screenshot.
                </Text>
                <View style={styles.disappearOptions}>
                  {DISAPPEAR_OPTIONS.map((opt) => {
                    const active = opt.value === conv.disappearAfterSec;
                    return (
                      <Pressable
                        key={opt.label}
                        style={[
                          styles.disappearOpt,
                          active && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setDisappearTimer(conv.id, opt.value);
                          setShowDisappear(false);
                        }}
                      >
                        <Text style={[
                          styles.disappearOptTxt,
                          { color: active ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Queued message toast — shown briefly when a message is held for delivery */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: insets.bottom + 80,
          left: 20,
          right: 20,
          opacity: toastOpacity,
          backgroundColor: `${colors.card}F2`,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, letterSpacing: 1, fontWeight: "600" }}>
          MESSAGE QUEUED — will send when connected
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

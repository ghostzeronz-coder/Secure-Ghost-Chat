import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  FlatList,
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
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { conversations, sendMessage } = useApp();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const conv = conversations.find((c) => c.id === id);

  if (!conv) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.mutedForeground, letterSpacing: 2 }}>
          CHANNEL NOT FOUND
        </Text>
      </View>
    );
  }

  const handleSend = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(conv.id, text.trim());
    setText("");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
    backBtn: {
      padding: 4,
    },
    headerInfo: {
      flex: 1,
    },
    headerAlias: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
    headerSub: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    headerSubText: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 2,
    },
    headerActions: {
      flexDirection: "row",
      gap: 16,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    msgRow: {
      marginVertical: 4,
      maxWidth: "80%",
    },
    msgBubble: {
      borderRadius: colors.radius,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    msgText: {
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.3,
    },
    msgMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    msgTime: {
      fontSize: 10,
      letterSpacing: 0.5,
    },
    encryptedLabel: {
      fontSize: 9,
      letterSpacing: 0.5,
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
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: {
      backgroundColor: colors.muted,
    },
    callBar: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    callBtn: {
      padding: 8,
    },
  });

  const messages = [...conv.messages];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerAlias}>{conv.alias}</Text>
          <View style={styles.headerSub}>
            <StatusDot active size={5} pulse={false} />
            <Text style={styles.headerSubText}>SECURE CHANNEL</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.callBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: "/call",
                params: { alias: conv.alias, mode: "voice" },
              });
            }}
            testID="voice-call-btn"
          >
            <Ionicons name="call-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            style={styles.callBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: "/call",
                params: { alias: conv.alias, mode: "video" },
              });
            }}
            testID="video-call-btn"
          >
            <Ionicons name="videocam-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <SecureBadge type="e2ee" size="sm" />
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 10,
            letterSpacing: 2,
          }}
        >
          X3DH + DOUBLE RATCHET
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        inverted={false}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.msgRow,
              item.fromMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
            ]}
          >
            <View
              style={[
                styles.msgBubble,
                {
                  backgroundColor: item.fromMe
                    ? colors.primary
                    : colors.card,
                  borderWidth: item.fromMe ? 0 : 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.msgText,
                  {
                    color: item.fromMe
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {item.text}
              </Text>
            </View>
            <View
              style={[
                styles.msgMeta,
                item.fromMe
                  ? { justifyContent: "flex-end" }
                  : { justifyContent: "flex-start" },
              ]}
            >
              <Text
                style={[styles.msgTime, { color: colors.mutedForeground }]}
              >
                {formatTime(item.timestamp)}
              </Text>
              {item.encrypted && (
                <>
                  <Ionicons
                    name="lock-closed"
                    size={8}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.encryptedLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    ENCRYPTED
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      />

      <View style={styles.inputBar}>
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
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
          testID="send-btn"
        >
          <Ionicons
            name="send"
            size={16}
            color={text.trim() ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

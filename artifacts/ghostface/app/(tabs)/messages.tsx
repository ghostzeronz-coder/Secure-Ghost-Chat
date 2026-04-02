import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SecureBadge } from "@/components/SecureBadge";
import { StatusDot } from "@/components/StatusDot";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { conversations, addConversation } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [newAlias, setNewAlias] = useState("");

  const handleNewChat = () => {
    if (newAlias.trim().length < 2) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addConversation(newAlias.trim());
    setShowNew(false);
    setNewAlias("");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 16,
    },
    headerTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 14,
    },
    avatarContainer: {
      position: "relative",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "800" as const,
      letterSpacing: 1,
    },
    unreadBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadText: {
      color: colors.primaryForeground,
      fontSize: 10,
      fontWeight: "800" as const,
    },
    itemContent: {
      flex: 1,
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    alias: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "700" as const,
      letterSpacing: 2,
    },
    timeText: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 1,
    },
    preview: {
      color: colors.mutedForeground,
      fontSize: 12,
      letterSpacing: 0.5,
    },
    itemDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 78,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1,
      borderColor: colors.border,
      padding: 24,
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
    },
    modalTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "800" as const,
      letterSpacing: 4,
      marginBottom: 20,
    },
    input: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "700" as const,
      letterSpacing: 3,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
    },
    modalBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 8,
    },
    modalBtnText: {
      color: colors.primaryForeground,
      fontSize: 12,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 12,
    },
    cancelText: {
      color: colors.mutedForeground,
      fontSize: 12,
      letterSpacing: 2,
    },
    padBottom: { height: 100 },
  });

  const sorted = [...conversations].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MESSAGES</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <SecureBadge type="e2ee" />
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowNew(true);
            }}
            testID="new-chat-btn"
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.divider} />

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        scrollEnabled={sorted.length > 0}
        renderItem={({ item, index }) => (
          <View>
            <Pressable
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/chat/${item.id}`);
              }}
              testID={`conversation-${item.id}`}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.alias.slice(0, 2)}
                  </Text>
                </View>
                {item.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.alias}>{item.alias}</Text>
                  <Text style={styles.timeText}>
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <StatusDot active size={5} pulse={false} />
            </Pressable>
            {index < sorted.length - 1 && (
              <View style={styles.itemDivider} />
            )}
          </View>
        )}
        ListFooterComponent={<View style={styles.padBottom} />}
      />

      <Modal
        visible={showNew}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNew(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowNew(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>NEW SECURE CHANNEL</Text>
              <TextInput
                style={styles.input}
                value={newAlias}
                onChangeText={(t) => setNewAlias(t.toUpperCase())}
                placeholder="RECIPIENT ALIAS"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                testID="new-alias-input"
              />
              <Pressable
                style={[
                  styles.modalBtn,
                  newAlias.trim().length < 2 && { opacity: 0.4 },
                ]}
                onPress={handleNewChat}
                disabled={newAlias.trim().length < 2}
              >
                <Text style={styles.modalBtnText}>ESTABLISH CHANNEL</Text>
              </Pressable>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowNew(false)}
              >
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

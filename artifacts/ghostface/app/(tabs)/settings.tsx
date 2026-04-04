import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useRef, useState } from "react";

import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostLogo } from "@/components/GhostLogo";
import { PanicButton } from "@/components/PanicButton";
import { SecureBadge } from "@/components/SecureBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    alias,
    biometricEnabled,
    setBiometricEnabled,
    setPin,
    panicWipe,
  } = useApp();

  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  const handleBioToggle = async (val: boolean) => {
    if (val && Platform.OS !== "web") {
      try {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          Alert.alert(
            "NO BIOMETRIC",
            "Set up Face ID or fingerprint in device settings first.",
            [{ text: "OK" }]
          );
          return;
        }
      } catch (err) {
        console.warn("[Settings] Could not check biometric enrollment:", err);
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setBiometricEnabled(val);
  };

  const handlePanicWipe = async () => {
    await panicWipe();
    // Navigation handled automatically — panicWipe sets isOnboarded: false
    // which causes RootNavigator to render OnboardingScreen
  };

  const handlePinSave = async () => {
    if (newPin.length < 4) {
      setPinError("Minimum 4 digits");
      return;
    }
    if (newPin !== newPinConfirm) {
      setPinError("PINs do not match");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await setPin(newPin);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPinSaved(true);
    setTimeout(() => {
      setPinSaved(false);
      setShowPinChange(false);
      setNewPin("");
      setNewPinConfirm("");
      setPinError("");
    }, 1500);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
    profileSection: {
      alignItems: "center",
      paddingVertical: 28,
    },
    aliasText: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: "800" as const,
      letterSpacing: 6,
      marginTop: 12,
    },
    aliasLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      marginTop: 4,
    },
    sectionLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      fontWeight: "700" as const,
      paddingHorizontal: 20,
      marginTop: 20,
      marginBottom: 8,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 14,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    settingLabel: {
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      letterSpacing: 2,
      fontWeight: "600" as const,
    },
    settingDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 70,
    },
    panicSection: {
      marginHorizontal: 20,
      marginTop: 32,
      marginBottom: 12,
    },
    versionSection: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 4,
    },
    versionText: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
    },
    padBottom: { height: 120 },
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
      letterSpacing: 2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: 12,
    },
    successText: {
      color: colors.success,
      fontSize: 16,
      fontWeight: "800" as const,
      letterSpacing: 3,
      textAlign: "center",
      marginBottom: 8,
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
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <SecureBadge type="e2ee" />
      </View>
      <View style={styles.divider} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <GhostLogo size={140} color={colors.primary} />
          <Text style={styles.aliasText}>{alias ?? "GHOST_00"}</Text>
          <Text style={styles.aliasLabel}>ANONYMOUS IDENTITY</Text>
        </View>

        <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
        <Pressable
          style={[styles.settingRow, { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, marginHorizontal: 16, backgroundColor: `${colors.primary}11` }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/paywall"); }}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>CURRENT PLAN</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>GHOST — FREE</Text>
          </View>
          <View style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: "#000", fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>UPGRADE</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View>
          <Pressable
            style={styles.settingRow}
            onPress={() => setShowPinChange(true)}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="keypad" size={18} color={colors.primary} />
            </View>
            <Text style={styles.settingLabel}>CHANGE PIN</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="finger-print" size={18} color={colors.primary} />
            </View>
            <Text style={styles.settingLabel}>BIOMETRIC LOCK</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBioToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.foreground}
              ios_backgroundColor={colors.border}
              testID="biometric-switch"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View>
          {(
            [
              { icon: "moon-outline", label: "THEME", value: "DARK" },
              { icon: "glasses-outline", label: "GHOST MODE", value: "ENABLED" },
            ] as Array<{ icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }>
          ).map((item, idx, arr) => (
            <View key={item.label}>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name={item.icon} size={18} color={colors.mutedForeground} />
                </View>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: "700" as const,
                  }}
                >
                  {item.value}
                </Text>
              </View>
              {idx < arr.length - 1 && <View style={styles.settingDivider} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>PRIVACY</Text>
        <View>
          {(
            [
              { icon: "eye-off-outline", label: "ANONYMOUS MODE", value: "ON" },
              { icon: "lock-closed-outline", label: "E2EE MESSAGING", value: "ON" },
              { icon: "globe-outline", label: "DNS LEAK PROTECTION", value: "ON" },
              { icon: "analytics-outline", label: "TELEMETRY", value: "OFF" },
            ] as Array<{ icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }>
          ).map((item, idx, arr) => (
            <View key={item.label}>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name={item.icon} size={18} color={colors.mutedForeground} />
                </View>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text
                  style={{
                    color:
                      item.value === "ON" ? colors.success : colors.destructive,
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: "700" as const,
                  }}
                >
                  {item.value}
                </Text>
              </View>
              {idx < arr.length - 1 && <View style={styles.settingDivider} />}
            </View>
          ))}
        </View>

        <View style={styles.panicSection}>
          <PanicButton onWipe={handlePanicWipe} />
        </View>

        <View style={styles.versionSection}>
          <GhostLogo size={50} color={colors.border} />
          <Text style={styles.versionText}>GHOSTFACE v1.0.0</Text>
          <Text style={styles.versionText}>NO FACE. NO TRACE.</Text>
        </View>

        <View style={styles.padBottom} />
      </ScrollView>

      <Modal
        visible={showPinChange}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPinChange(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPinChange(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              {pinSaved ? (
                <Text style={styles.successText}>PIN UPDATED</Text>
              ) : (
                <>
                  <Text style={styles.modalTitle}>CHANGE PIN</Text>
                  <TextInput
                    style={styles.input}
                    value={newPin}
                    onChangeText={setNewPin}
                    placeholder="NEW PIN"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                  />
                  <TextInput
                    style={styles.input}
                    value={newPinConfirm}
                    onChangeText={(t) => {
                      setNewPinConfirm(t);
                      setPinError("");
                    }}
                    placeholder="CONFIRM PIN"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                  />
                  {pinError ? (
                    <Text style={styles.errorText}>{pinError}</Text>
                  ) : null}
                  <Pressable
                    style={[
                      styles.modalBtn,
                      newPin.length < 4 && { opacity: 0.4 },
                    ]}
                    onPress={handlePinSave}
                    disabled={newPin.length < 4}
                  >
                    <Text style={styles.modalBtnText}>SAVE PIN</Text>
                  </Pressable>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => setShowPinChange(false)}
                  >
                    <Text style={styles.cancelText}>CANCEL</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

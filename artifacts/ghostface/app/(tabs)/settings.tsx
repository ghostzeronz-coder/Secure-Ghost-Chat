import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import React, { useRef, useState } from "react";

import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
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
    hasDuressPin,
    stripeEmail,
    autoLockTimeout,
    setBiometricEnabled,
    setPin,
    setDuressPin,
    clearDuressPin,
    setLocked,
    panicWipe,
    setStripeEmail,
    setAutoLockTimeout,
  } = useApp();

  const AUTO_LOCK_OPTIONS: { label: string; value: number | null }[] = [
    { label: "30 SECONDS", value: 30 * 1000 },
    { label: "1 MINUTE", value: 60 * 1000 },
    { label: "5 MINUTES", value: 5 * 60 * 1000 },
    { label: "15 MINUTES", value: 15 * 60 * 1000 },
    { label: "NEVER", value: null },
  ];

  const currentAutoLockLabel =
    AUTO_LOCK_OPTIONS.find((o) => o.value === autoLockTimeout)?.label ?? "5 MINUTES";

  const handleAutoLockPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...AUTO_LOCK_OPTIONS.map((o) => o.label), "CANCEL"],
          cancelButtonIndex: AUTO_LOCK_OPTIONS.length,
          title: "AUTO-LOCK TIMEOUT",
        },
        (idx) => {
          if (idx < AUTO_LOCK_OPTIONS.length) {
            setAutoLockTimeout(AUTO_LOCK_OPTIONS[idx].value);
          }
        }
      );
    } else {
      setShowAutoLock(true);
    }
  };

  const [showAutoLock, setShowAutoLock] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  const [showDuressPin, setShowDuressPin] = useState(false);
  const [duressPin, setDuressPinInput] = useState("");
  const [duressPinConfirm, setDuressPinConfirm] = useState("");
  const [duressPinError, setDuressPinError] = useState("");
  const [duressPinSaved, setDuressPinSaved] = useState(false);

  const [showBilling, setShowBilling] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  const handleBillingPortal = async () => {
    if (!billingEmail.includes("@")) {
      setBillingError("Enter a valid email");
      return;
    }
    try {
      setBillingLoading(true);
      setBillingError("");
      const res = await fetch(`${API_BASE}/stripe/customer-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: billingEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open billing portal");
      await setStripeEmail(billingEmail);
      setShowBilling(false);
      setBillingEmail("");
      await Linking.openURL(data.url);
    } catch (err: any) {
      setBillingError(err.message || "Something went wrong");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleDisconnectStripe = async () => {
    await setStripeEmail(null);
    setShowBilling(false);
    setBillingEmail("");
    setBillingError("");
  };

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

  const handleDuressPinSave = async () => {
    if (duressPin.length < 4) {
      setDuressPinError("Minimum 4 digits");
      return;
    }
    if (duressPin !== duressPinConfirm) {
      setDuressPinError("PINs do not match");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await setDuressPin(duressPin);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDuressPinSaved(true);
    setTimeout(() => {
      setDuressPinSaved(false);
      setShowDuressPin(false);
      setDuressPinInput("");
      setDuressPinConfirm("");
      setDuressPinError("");
    }, 1500);
  };

  const handleClearDuressPin = async () => {
    await clearDuressPin();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowDuressPin(false);
    setDuressPinInput("");
    setDuressPinConfirm("");
    setDuressPinError("");
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
        <View style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: 10, marginHorizontal: 16, backgroundColor: `${colors.primary}11`, overflow: "hidden" }}>
          <Pressable
            style={styles.settingRow}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/paywall"); }}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>CURRENT PLAN</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>GHOST — FREE  ·  ◎ USDC</Text>
            </View>
            <View style={{ backgroundColor: "#9945FF", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 2 }}>UPGRADE</Text>
            </View>
          </Pressable>
          <View style={{ height: 1, backgroundColor: `${colors.primary}30` }} />
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBillingEmail(stripeEmail ?? "");
              setBillingError("");
              setShowBilling(true);
            }}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="card-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>MANAGE BILLING</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 2, marginTop: 2 }}>
                {stripeEmail ? stripeEmail.toUpperCase() : "STRIPE CUSTOMER PORTAL"}
              </Text>
            </View>
            {stripeEmail ? (
              <View style={{ backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#000", fontSize: 9, fontWeight: "800", letterSpacing: 2 }}>LINKED</Text>
              </View>
            ) : (
              <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View>
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setLocked(true);
            }}
          >
            <View style={[styles.settingIcon, { borderColor: colors.primary, backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.primary }]}>LOCK SESSION</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </Pressable>
          <View style={styles.settingDivider} />
          <Pressable
            style={styles.settingRow}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/security-audit"); }}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="shield-checkmark" size={18} color={colors.success} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.success }]}>SECURITY AUDIT</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.settingDivider} />
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
          <View style={styles.settingDivider} />
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDuressPinInput("");
              setDuressPinConfirm("");
              setDuressPinError("");
              setShowDuressPin(true);
            }}
            testID="duress-pin-row"
          >
            <View style={styles.settingIcon}>
              <Ionicons name="skull-outline" size={18} color={colors.destructive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.destructive }]}>DURESS PIN</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9, letterSpacing: 2, marginTop: 2 }}>
                TRIGGERS SILENT WIPE ON ENTRY
              </Text>
            </View>
            {hasDuressPin ? (
              <View style={{ backgroundColor: colors.destructive, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 2 }}>ACTIVE</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            )}
          </Pressable>
          <View style={styles.settingDivider} />
          <Pressable
            style={styles.settingRow}
            onPress={handleAutoLockPress}
            testID="auto-lock-row"
          >
            <View style={styles.settingIcon}>
              <Ionicons name="timer-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.settingLabel}>AUTO-LOCK</Text>
            <Text style={{ color: colors.primary, fontSize: 11, letterSpacing: 2, fontWeight: "700" as const }}>
              {currentAutoLockLabel}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
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
        visible={showAutoLock}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAutoLock(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAutoLock(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>AUTO-LOCK TIMEOUT</Text>
              {AUTO_LOCK_OPTIONS.map((opt) => (
                <Pressable
                  key={String(opt.value)}
                  style={[
                    styles.settingRow,
                    { paddingHorizontal: 0, paddingVertical: 14 },
                  ]}
                  onPress={() => {
                    setAutoLockTimeout(opt.value);
                    setShowAutoLock(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[styles.settingLabel, { flex: 1, fontSize: 12 }]}>{opt.label}</Text>
                  {opt.value === autoLockTimeout && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
              <Pressable style={styles.cancelBtn} onPress={() => setShowAutoLock(false)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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

      {/* Duress PIN modal */}
      <Modal
        visible={showDuressPin}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDuressPin(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDuressPin(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              {duressPinSaved ? (
                <Text style={styles.successText}>DURESS PIN SAVED</Text>
              ) : (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <Ionicons name="skull-outline" size={20} color={colors.destructive} />
                    <Text style={[styles.modalTitle, { color: colors.destructive, marginBottom: 0 }]}>DURESS PIN</Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 9, letterSpacing: 2, marginBottom: 20, lineHeight: 16 }}>
                    ENTERING THIS PIN ON THE LOCK SCREEN WILL SILENTLY WIPE ALL DATA — INDISTINGUISHABLE FROM A NORMAL LOGIN
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={duressPin}
                    onChangeText={(t) => { setDuressPinInput(t); setDuressPinError(""); }}
                    placeholder="DURESS PIN"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                    testID="duress-pin-input"
                  />
                  <TextInput
                    style={styles.input}
                    value={duressPinConfirm}
                    onChangeText={(t) => { setDuressPinConfirm(t); setDuressPinError(""); }}
                    placeholder="CONFIRM DURESS PIN"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                    testID="duress-pin-confirm-input"
                  />
                  {duressPinError ? (
                    <Text style={styles.errorText}>{duressPinError}</Text>
                  ) : null}
                  <Pressable
                    style={[
                      styles.modalBtn,
                      { backgroundColor: colors.destructive },
                      duressPin.length < 4 && { opacity: 0.4 },
                    ]}
                    onPress={handleDuressPinSave}
                    disabled={duressPin.length < 4}
                    testID="duress-pin-save-btn"
                  >
                    <Text style={styles.modalBtnText}>SET DURESS PIN</Text>
                  </Pressable>
                  {hasDuressPin && (
                    <Pressable
                      style={[styles.modalBtn, { backgroundColor: colors.muted, marginBottom: 4 }]}
                      onPress={handleClearDuressPin}
                      testID="duress-pin-clear-btn"
                    >
                      <Text style={[styles.modalBtnText, { color: colors.destructive }]}>REMOVE DURESS PIN</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => setShowDuressPin(false)}
                  >
                    <Text style={styles.cancelText}>CANCEL</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Billing portal modal */}
      <Modal
        visible={showBilling}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBilling(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowBilling(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <Ionicons name="card" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>BILLING PORTAL</Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 2, marginBottom: 16, textAlign: "center" }}>
                ENTER YOUR ACCOUNT EMAIL TO MANAGE SUBSCRIPTIONS, INVOICES & PAYMENT METHODS
              </Text>
              <TextInput
                style={styles.input}
                value={billingEmail}
                onChangeText={(t) => { setBillingEmail(t); setBillingError(""); }}
                placeholder="YOUR EMAIL"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {billingError ? (
                <Text style={styles.errorText}>{billingError.toUpperCase()}</Text>
              ) : null}
              <Pressable
                style={[styles.modalBtn, (billingLoading || !billingEmail) && { opacity: 0.5 }]}
                onPress={handleBillingPortal}
                disabled={billingLoading || !billingEmail}
              >
                {billingLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalBtnText}>OPEN STRIPE PORTAL</Text>
                )}
              </Pressable>
              {stripeEmail && (
                <Pressable
                  style={[styles.cancelBtn, { borderColor: colors.destructive, marginBottom: 2 }]}
                  onPress={handleDisconnectStripe}
                >
                  <Text style={[styles.cancelText, { color: colors.destructive }]}>DISCONNECT ACCOUNT</Text>
                </Pressable>
              )}
              <Pressable style={styles.cancelBtn} onPress={() => { setShowBilling(false); setBillingEmail(""); setBillingError(""); }}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

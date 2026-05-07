import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SecureBadge } from "@/components/SecureBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

type Plan = {
  id: string;
  name: string;
  priceNzd: number;
  numbers: number;
  capabilities: string[];
  countries: string[];
  description: string;
};

type GhostNumber = {
  id: number;
  phoneNumber: string;
  country: string;
  capabilities: string[];
  plan: string;
  status: string;
  createdAt: string;
};

type Sms = {
  id: number;
  fromNumber: string;
  body: string;
  createdAt: string;
};

const COUNTRY_FLAGS: Record<string, string> = {
  NZ: "🇳🇿",
  AU: "🇦🇺",
  US: "🇺🇸",
  GB: "🇬🇧",
  CA: "🇨🇦",
  DE: "🇩🇪",
};

const COUNTRY_NAMES: Record<string, string> = {
  NZ: "New Zealand",
  AU: "Australia",
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  DE: "Germany",
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

export default function GhostNumberScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alias, deviceToken } = useApp();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [numbers, setNumbers] = useState<GhostNumber[]>([]);
  const [sms, setSms] = useState<Record<number, Sms[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [releasing, setReleasing] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const [showProvision, setShowProvision] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("NZ");

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${deviceToken ?? ""}`,
  }), [deviceToken]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/numbers/plans`);
      const json = await res.json();
      if (json.data) setPlans(json.data);
    } catch {}
  }, []);

  const fetchNumbers = useCallback(async () => {
    if (!alias || !deviceToken) return;
    try {
      const res = await fetch(`${API_BASE}/numbers?alias=${alias}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      const nums: GhostNumber[] = json.data ?? [];
      setNumbers(nums);
      for (const n of nums) {
        fetchSms(n.id);
      }
    } catch {}
  }, [alias, deviceToken, authHeaders]);

  const fetchSms = useCallback(async (numberId: number) => {
    if (!alias || !deviceToken) return;
    try {
      const res = await fetch(`${API_BASE}/numbers/${numberId}/sms?alias=${alias}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setSms((prev) => ({ ...prev, [numberId]: json.data ?? [] }));
    } catch {}
  }, [alias, deviceToken, authHeaders]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPlans(), fetchNumbers()]);
    setLoading(false);
  }, [fetchPlans, fetchNumbers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNumbers();
    setRefreshing(false);
  }, [fetchNumbers]);

  useEffect(() => { load(); }, [load]);

  const handleProvision = async () => {
    if (!selectedPlan) return;
    setProvisioning(true);
    try {
      const res = await fetch(`${API_BASE}/numbers/provision?alias=${alias}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ country: selectedCountry, plan: selectedPlan.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Provisioning failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowProvision(false);
      await fetchNumbers();
    } catch (err: any) {
      Alert.alert("Error", err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProvisioning(false);
    }
  };

  const handleRelease = (number: GhostNumber) => {
    Alert.alert(
      "RELEASE NUMBER",
      `Release ${number.phoneNumber}? This cannot be undone.`,
      [
        { text: "CANCEL", style: "cancel" },
        {
          text: "RELEASE",
          style: "destructive",
          onPress: async () => {
            setReleasing(number.id);
            try {
              const res = await fetch(`${API_BASE}/numbers/${number.id}?alias=${alias}`, {
                method: "DELETE",
                headers: authHeaders(),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error ?? "Release failed");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchNumbers();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setReleasing(null);
            }
          },
        },
      ]
    );
  };

  const handleCopy = async (number: GhostNumber) => {
    await Clipboard.setStringAsync(number.phoneNumber);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(number.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 4,
    },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
    sectionLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 3,
      fontWeight: "700",
      marginBottom: 12,
      marginHorizontal: 20,
      marginTop: 24,
    },
    // ── active number card ───────────────────────────────
    numberCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: "rgba(0,200,255,0.3)",
      padding: 18,
      marginBottom: 12,
    },
    numberCardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    numberBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(0,200,255,0.1)",
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    numberBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    numberBadgeText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
    },
    planChip: {
      backgroundColor: "rgba(153,69,255,0.15)",
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    planChipText: {
      color: "#9945FF",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
    },
    phoneRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    phoneNumber: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 2,
      flex: 1,
    },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    copyBtnText: {
      color: colors.foreground,
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 1,
    },
    capRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    capChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    capChipText: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: "600",
    },
    releaseBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: "rgba(255,59,48,0.4)",
      borderRadius: colors.radius,
      paddingVertical: 10,
    },
    releaseBtnText: {
      color: colors.destructive,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,
    },
    // ── SMS inbox ────────────────────────────────────────
    smsCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      overflow: "hidden",
    },
    smsItem: {
      padding: 14,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    smsIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(0,200,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    smsContent: { flex: 1 },
    smsFrom: {
      color: colors.foreground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 2,
    },
    smsBody: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    smsTime: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 1,
      marginTop: 4,
    },
    smsDivider: { height: 1, backgroundColor: colors.border, marginLeft: 58 },
    emptyInbox: {
      padding: 24,
      alignItems: "center",
      gap: 8,
    },
    emptyInboxText: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 2,
    },
    // ── pricing cards ────────────────────────────────────
    planCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: 12,
    },
    planCardFeatured: {
      borderColor: "rgba(0,200,255,0.4)",
    },
    planHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    planName: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 4,
    },
    planPrice: {
      alignItems: "flex-end",
    },
    planPriceAmount: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 1,
    },
    planPricePer: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 1,
    },
    planDesc: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: 12,
    },
    planFeatures: { gap: 6, marginBottom: 16 },
    planFeature: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    planFeatureText: {
      color: colors.foreground,
      fontSize: 11,
      letterSpacing: 1,
    },
    getBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 13,
      alignItems: "center",
    },
    getBtnText: {
      color: "#000",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 3,
    },
    // ── provision modal ──────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      paddingBottom: insets.bottom + 24,
    },
    modalTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 4,
      marginBottom: 4,
    },
    modalSub: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: 20,
    },
    countryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 20,
    },
    countryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.muted,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    countryChipActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(0,200,255,0.1)",
    },
    countryChipText: {
      color: colors.foreground,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1,
    },
    confirmBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      marginBottom: 10,
    },
    confirmBtnText: {
      color: "#000",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 3,
    },
    cancelBtn: {
      paddingVertical: 12,
      alignItems: "center",
    },
    cancelBtnText: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 2,
    },
    pad: { height: 100 },
  });

  const planFeatureMap: Record<string, string[]> = {
    basic: ["1 ghost number", "SMS only", "5 countries"],
    private: ["1 ghost number", "SMS + voice calls", "6 countries"],
    phantom: ["2 ghost numbers", "SMS + voice calls", "6 countries", "Priority routing"],
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GHOST NUMBER</Text>
        <SecureBadge type="encrypted" />
      </View>
      <View style={styles.divider} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {numbers.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>YOUR NUMBERS</Text>
            {numbers.map((number) => (
              <View key={number.id} style={styles.numberCard}>
                <View style={styles.numberCardHead}>
                  <View style={styles.numberBadge}>
                    <View style={styles.numberBadgeDot} />
                    <Text style={styles.numberBadgeText}>ACTIVE</Text>
                  </View>
                  <View style={styles.planChip}>
                    <Text style={styles.planChipText}>{number.plan.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.phoneRow}>
                  <Text style={styles.phoneNumber}>{number.phoneNumber}</Text>
                  <Pressable style={styles.copyBtn} onPress={() => handleCopy(number)}>
                    <Ionicons
                      name={copied === number.id ? "checkmark" : "copy-outline"}
                      size={12}
                      color={copied === number.id ? colors.success : colors.foreground}
                    />
                    <Text style={styles.copyBtnText}>{copied === number.id ? "COPIED" : "COPY"}</Text>
                  </Pressable>
                </View>

                <View style={styles.capRow}>
                  <View style={styles.capChip}>
                    <Text style={styles.capChipText}>
                      {COUNTRY_FLAGS[number.country] ?? "🌐"} {COUNTRY_NAMES[number.country] ?? number.country}
                    </Text>
                  </View>
                  {(number.capabilities as string[]).map((cap) => (
                    <View key={cap} style={styles.capChip}>
                      <Ionicons
                        name={cap === "SMS" ? "chatbubble-outline" : "call-outline"}
                        size={10}
                        color={colors.mutedForeground}
                      />
                      <Text style={styles.capChipText}>{cap}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  style={styles.releaseBtn}
                  onPress={() => handleRelease(number)}
                  disabled={releasing === number.id}
                >
                  {releasing === number.id ? (
                    <ActivityIndicator size="small" color={colors.destructive} />
                  ) : (
                    <Ionicons name="trash-outline" size={12} color={colors.destructive} />
                  )}
                  <Text style={styles.releaseBtnText}>
                    {releasing === number.id ? "RELEASING..." : "RELEASE NUMBER"}
                  </Text>
                </Pressable>
              </View>
            ))}

            {numbers.map((number) => (
              <View key={`sms-${number.id}`}>
                <Text style={styles.sectionLabel}>
                  SMS INBOX — {number.phoneNumber}
                </Text>
                <View style={styles.smsCard}>
                  {(sms[number.id] ?? []).length === 0 ? (
                    <View style={styles.emptyInbox}>
                      <Ionicons name="mail-outline" size={24} color={colors.mutedForeground} />
                      <Text style={styles.emptyInboxText}>NO MESSAGES YET</Text>
                    </View>
                  ) : (
                    (sms[number.id] ?? []).map((msg, idx) => (
                      <View key={msg.id}>
                        <View style={styles.smsItem}>
                          <View style={styles.smsIcon}>
                            <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
                          </View>
                          <View style={styles.smsContent}>
                            <Text style={styles.smsFrom}>{msg.fromNumber}</Text>
                            <Text style={styles.smsBody}>{msg.body}</Text>
                            <Text style={styles.smsTime}>{formatTime(msg.createdAt)}</Text>
                          </View>
                        </View>
                        {idx < (sms[number.id] ?? []).length - 1 && <View style={styles.smsDivider} />}
                      </View>
                    ))
                  )}
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>CHOOSE A PLAN</Text>
            {plans.map((plan) => (
              <View key={plan.id} style={[styles.planCard, plan.id === "private" && styles.planCardFeatured]}>
                <View style={styles.planHead}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.planPrice}>
                    <Text style={styles.planPriceAmount}>${plan.priceNzd.toFixed(2)}</Text>
                    <Text style={styles.planPricePer}>NZD / MONTH</Text>
                  </View>
                </View>
                <Text style={styles.planDesc}>{plan.description}</Text>
                <View style={styles.planFeatures}>
                  {(planFeatureMap[plan.id] ?? []).map((f) => (
                    <View key={f} style={styles.planFeature}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={styles.planFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  style={({ pressed }) => [styles.getBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlan(plan);
                    setSelectedCountry(plan.countries[0]);
                    setShowProvision(true);
                  }}
                >
                  <Text style={styles.getBtnText}>GET {plan.name}</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        <View style={styles.pad} />
      </ScrollView>

      <Modal
        visible={showProvision}
        transparent
        animationType="slide"
        onRequestClose={() => !provisioning && setShowProvision(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !provisioning && setShowProvision(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>GET {selectedPlan?.name}</Text>
              <Text style={styles.modalSub}>
                ${selectedPlan?.priceNzd.toFixed(2)} NZD/month · Choose your country
              </Text>

              <View style={styles.countryRow}>
                {(selectedPlan?.countries ?? []).map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.countryChip, selectedCountry === c && styles.countryChipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedCountry(c);
                    }}
                  >
                    <Text>{COUNTRY_FLAGS[c] ?? "🌐"}</Text>
                    <Text style={styles.countryChipText}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.confirmBtn, provisioning && { opacity: 0.6 }]}
                onPress={handleProvision}
                disabled={provisioning}
              >
                {provisioning ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Ionicons name="phone-portrait-outline" size={14} color="#000" />
                )}
                <Text style={styles.confirmBtnText}>
                  {provisioning ? "PROVISIONING..." : "PROVISION NUMBER"}
                </Text>
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={() => setShowProvision(false)} disabled={provisioning}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

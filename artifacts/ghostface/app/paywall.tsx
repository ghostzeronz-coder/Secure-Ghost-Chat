import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostLogo } from "@/components/GhostLogo";
import { useColors } from "@/hooks/useColors";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

type PayMethod = "crypto" | "card";

interface Plan {
  id: string;
  name: string;
  badge: string;
  priceUsdc: number | null;
  priceNzd: number | null;
  color: string;
  features: string[];
  recommended?: boolean;
}

const TRIAL_DAYS = 7;

const PLANS: Plan[] = [
  {
    id: "ghost",
    name: "GHOST",
    badge: "FREE",
    priceUsdc: null,
    priceNzd: null,
    color: "#555555",
    features: [
      "Anonymous alias identity",
      "Basic encrypted messaging",
      "3 secure channels",
      "Standard encryption",
    ],
  },
  {
    id: "specter",
    name: "SPECTER",
    badge: "POPULAR",
    priceUsdc: 9.99,
    priceNzd: 16.99,
    color: "#bf9b30",
    recommended: true,
    features: [
      "Everything in GHOST",
      "Unlimited secure channels",
      "VPN with 6 servers",
      "Voice changer (6 presets)",
      "Encrypted invite QR codes",
      "E2EE messaging",
    ],
  },
  {
    id: "phantom",
    name: "PHANTOM",
    badge: "ELITE",
    priceUsdc: 19.99,
    priceNzd: 32.99,
    color: "#bf9b30",
    features: [
      "Everything in SPECTER",
      "Crypto wallet (FD + CASPER)",
      "Panic wipe with dead man's switch",
      "Priority ghost routing",
      "Biometric app lock",
      "Cipher & steganography tools",
      "Dedicated ghost node",
    ],
  },
];

interface CryptoInfo {
  wallet: string;
  usdc: number;
  currency: string;
  network: string;
  solanaPayUrl: string;
  label: string;
}

interface ActivePayment {
  plan: Plan;
  info: CryptoInfo;
}

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [payMethod, setPayMethod] = useState<PayMethod>("crypto");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<ActivePayment | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentSent, setPaymentSent] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  const openPayment = useCallback((ap: ActivePayment) => {
    setActivePayment(ap);
    setPaymentSent(false);
    setCopied(false);
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 22,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closePayment = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setActivePayment(null));
  }, [slideAnim]);

  const handleSelect = async (plan: Plan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (plan.id === "ghost") {
      router.back();
      return;
    }

    if (payMethod === "card") {
      try {
        setLoading(plan.id);
        setError(null);
        const res = await fetch(`${API_BASE}/stripe/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: plan.id, currency: "nzd" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create checkout session");
        if (data.url) {
          await Linking.openURL(data.url);
        }
      } catch (err: any) {
        setError(err.message || "Card checkout unavailable. Try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLoading(null);
      }
      return;
    }

    // Crypto flow
    if (!plan.priceUsdc) {
      router.back();
      return;
    }
    try {
      setLoading(plan.id);
      setError(null);
      const res = await fetch(`${API_BASE}/crypto/payment-info?plan=${plan.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load payment info");
      openPayment({ plan, info: data });
    } catch (err: any) {
      setError(err.message || "Payment info unavailable. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(null);
    }
  };

  const copyAddress = useCallback(async (addr: string) => {
    await Clipboard.setStringAsync(addr);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2500);
  }, []);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      alignItems: "center",
      paddingTop: insets.top + (Platform.OS === "web" ? 80 : 24),
      paddingBottom: 20,
      gap: 10,
    },
    backBtn: {
      position: "absolute",
      left: 20,
      top: insets.top + (Platform.OS === "web" ? 84 : 28),
    },
    headline: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 6,
    },
    sub: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 3 },
    toggleRow: {
      flexDirection: "row",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    toggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    toggleBtnActive: {
      backgroundColor: "#bf9b30",
    },
    toggleTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: colors.mutedForeground },
    toggleTxtActive: { color: "#000" },
    networkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: "rgba(138,138,138,0.12)",
      borderWidth: 1,
      borderColor: "rgba(138,138,138,0.35)",
    },
    networkTxt: { color: "#8A8A8A", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
    scroll: { flex: 1 },
    plans: { padding: 16, gap: 14, paddingBottom: 40 },
    card: {
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    cardRec: { borderWidth: 2 },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      paddingBottom: 12,
    },
    planName: { fontSize: 18, fontWeight: "800", letterSpacing: 4 },
    badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    badgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 2 },
    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      paddingHorizontal: 16,
      gap: 6,
      marginBottom: 14,
    },
    price: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
    currency: { fontSize: 13, fontWeight: "700", letterSpacing: 2 },
    interval: { fontSize: 13, color: colors.mutedForeground },
    freeTxt: {
      fontSize: 28, fontWeight: "800", letterSpacing: 2,
      paddingHorizontal: 16, marginBottom: 14, color: colors.mutedForeground,
    },
    featureList: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureTxt: { color: colors.mutedForeground, fontSize: 12, letterSpacing: 1, flex: 1 },
    ctaBtn: {
      margin: 16, marginTop: 8,
      borderRadius: colors.radius,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    ctaTxt: { fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    errorBox: {
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: "rgba(255,59,48,0.1)",
      borderWidth: 1, borderColor: colors.destructive,
      borderRadius: colors.radius, padding: 12,
    },
    errorTxt: { color: colors.destructive, fontSize: 11, letterSpacing: 2, textAlign: "center" },
    trialBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 4,
      backgroundColor: "rgba(125,211,252,0.08)",
      borderWidth: 1,
      borderColor: "rgba(125,211,252,0.25)",
      borderRadius: colors.radius,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    trialBannerText: {
      color: colors.success,
      fontSize: 11,
      fontWeight: "800" as const,
      letterSpacing: 3,
    },
    trialSubText: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 1,
      textAlign: "center" as const,
      marginBottom: 12,
      marginTop: -4,
    },
    trialTag: {
      alignSelf: "flex-start" as const,
      backgroundColor: "rgba(125,211,252,0.12)",
      borderWidth: 1,
      borderColor: "rgba(125,211,252,0.3)",
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    trialTagText: {
      color: colors.success,
      fontSize: 9,
      fontWeight: "800" as const,
      letterSpacing: 2,
    },
    footer: {
      color: colors.mutedForeground, fontSize: 9, letterSpacing: 2,
      textAlign: "center", paddingBottom: insets.bottom + 24, opacity: 0.4,
    },

    // Payment panel
    overlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
    },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
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
    sheetTitle: { color: colors.foreground, fontSize: 14, fontWeight: "800", letterSpacing: 4 },
    sheetBody: { padding: 20, gap: 16, alignItems: "center", paddingBottom: insets.bottom + 20 },
    planInfo: { alignItems: "center", gap: 4 },
    planInfoName: { fontSize: 15, fontWeight: "800", letterSpacing: 4 },
    planInfoPrice: { fontSize: 30, fontWeight: "800" },
    planInfoSub: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 2 },
    qrWrap: { padding: 14, backgroundColor: "#fff", borderRadius: 14 },
    addrBox: {
      flexDirection: "row", alignItems: "center", gap: 10,
      width: "100%", backgroundColor: colors.background,
      borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12,
    },
    addrTxt: {
      flex: 1, color: colors.mutedForeground,
      fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
    },
    copyBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: "#8A8A8A", borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    copyTxt: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
    steps: {
      width: "100%", backgroundColor: "rgba(138,138,138,0.07)",
      borderRadius: 12, padding: 14, gap: 10,
    },
    stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    stepNum: { color: "#8A8A8A", fontSize: 11, fontWeight: "800", width: 18 },
    stepTxt: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 1, flex: 1 },
    sentBtn: {
      width: "100%", borderRadius: colors.radius,
      paddingVertical: 14, alignItems: "center",
      backgroundColor: "#8A8A8A",
    },
    sentBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    confirmedBox: {
      width: "100%", borderRadius: colors.radius, padding: 16,
      backgroundColor: "rgba(125,211,252,0.07)",
      borderWidth: 1, borderColor: colors.success,
      alignItems: "center", gap: 6,
    },
    confirmedTxt: { color: colors.success, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    confirmedSub: { color: colors.mutedForeground, fontSize: 10, letterSpacing: 2, textAlign: "center" },
  });

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.mutedForeground} />
        </Pressable>
        <GhostLogo size={52} />
        <Text style={s.headline}>GHOST PLANS</Text>
        <Text style={s.sub}>CHOOSE YOUR LEVEL OF INVISIBILITY</Text>

        {/* Payment method toggle */}
        <View style={s.toggleRow}>
          <Pressable
            style={[s.toggleBtn, payMethod === "crypto" && s.toggleBtnActive]}
            onPress={() => { setPayMethod("crypto"); setError(null); }}
          >
            <Text style={{ fontSize: 12, color: payMethod === "crypto" ? "#000" : colors.mutedForeground }}>◎</Text>
            <Text style={[s.toggleTxt, payMethod === "crypto" && s.toggleTxtActive]}>
              USDC
            </Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, payMethod === "card" && s.toggleBtnActive]}
            onPress={() => { setPayMethod("card"); setError(null); }}
          >
            <Ionicons
              name="card-outline"
              size={12}
              color={payMethod === "card" ? "#000" : colors.mutedForeground}
            />
            <Text style={[s.toggleTxt, payMethod === "card" && s.toggleTxtActive]}>
              CARD · NZD
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={s.divider} />

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorTxt}>{error.toUpperCase()}</Text>
        </View>
      )}

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.plans}>
          {/* Trial banner — shown for card payments only */}
          {payMethod === "card" && (
            <>
              <View style={s.trialBanner}>
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                <Text style={s.trialBannerText}>{TRIAL_DAYS}-DAY FREE TRIAL INCLUDED</Text>
              </View>
              <Text style={s.trialSubText}>
                Card required to start · cancel anytime · no charge for {TRIAL_DAYS} days
              </Text>
            </>
          )}

          {PLANS.map((plan) => {
            const isPaid = plan.id !== "ghost";
            const isLoading = loading === plan.id;

            return (
              <View
                key={plan.id}
                style={[
                  s.card,
                  plan.recommended && { ...s.cardRec, borderColor: plan.color },
                ]}
              >
                <View style={s.cardHeader}>
                  <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
                  <View style={[s.badge, { backgroundColor: `${plan.color}22` }]}>
                    <Text style={[s.badgeTxt, { color: plan.color }]}>{plan.badge}</Text>
                  </View>
                </View>

                {isPaid ? (
                  <>
                    <View style={s.priceRow}>
                      <Text style={[s.price, { color: plan.color }]}>
                        {payMethod === "card" ? plan.priceNzd : plan.priceUsdc}
                      </Text>
                      <Text style={[s.currency, { color: plan.color }]}>
                        {payMethod === "card" ? "NZD" : "USDC"}
                      </Text>
                      <Text style={s.interval}>/mo</Text>
                    </View>
                    {payMethod === "card" && (
                      <Text style={[s.interval, { fontSize: 11, paddingHorizontal: 16, marginTop: -8, marginBottom: 8, opacity: 0.7 }]}>
                        Free for {TRIAL_DAYS} days, then NZ${plan.priceNzd}/mo
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={s.freeTxt}>FREE</Text>
                )}

                <View style={s.featureList}>
                  {plan.features.map((f) => (
                    <View key={f} style={s.featureRow}>
                      <Ionicons name="checkmark-circle" size={14} color={plan.color} />
                      <Text style={s.featureTxt}>{f}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  style={({ pressed }) => [
                    s.ctaBtn,
                    {
                      backgroundColor: plan.recommended
                        ? plan.color
                        : isPaid
                        ? (payMethod === "card" ? "#bf9b3022" : "#8A8A8A22")
                        : "transparent",
                      borderWidth: isPaid && !plan.recommended ? 1 : plan.id === "ghost" ? 1 : 0,
                      borderColor: plan.id === "ghost"
                        ? plan.color
                        : payMethod === "card" ? "#bf9b30" : "#8A8A8A",
                    },
                    pressed && { opacity: 0.8 },
                    loading !== null && { opacity: 0.6 },
                  ]}
                  onPress={() => handleSelect(plan)}
                  disabled={loading !== null}
                >
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={plan.recommended ? "#000" : plan.id === "ghost" ? plan.color : (payMethod === "card" ? "#bf9b30" : "#8A8A8A")}
                    />
                  ) : (
                    <>
                      {isPaid ? (
                        payMethod === "card" ? (
                          <Ionicons name="card" size={14} color={plan.recommended ? "#000" : "#bf9b30"} />
                        ) : (
                          <Text style={{ fontSize: 16 }}>◎</Text>
                        )
                      ) : (
                        <Ionicons name="arrow-forward" size={15} color={plan.color} />
                      )}
                      <Text
                        style={[
                          s.ctaTxt,
                          {
                            color: plan.recommended
                              ? "#000"
                              : isPaid
                              ? (payMethod === "card" ? "#bf9b30" : "#8A8A8A")
                              : plan.color,
                          },
                        ]}
                      >
                        {plan.id === "ghost"
                          ? "CONTINUE FREE"
                          : payMethod === "card"
                          ? `START ${TRIAL_DAYS}-DAY FREE TRIAL`
                          : `PAY ${plan.priceUsdc} USDC`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={s.footer}>
          {payMethod === "card"
            ? `${TRIAL_DAYS}-DAY FREE TRIAL · NZD VIA STRIPE · CANCEL ANYTIME · NO FACE · NO TRACE`
            : "ALL PAYMENTS RECEIVED IN USDC ON SOLANA · NO FACE · NO TRACE"}
        </Text>
      </ScrollView>

      {/* Payment bottom sheet */}
      {activePayment && (
        <>
          <Pressable style={s.overlay} onPress={closePayment} />
          <Animated.View
            style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <View style={s.handle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>SEND PAYMENT</Text>
              <Pressable onPress={closePayment}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.sheetBody}>
                {/* Plan summary */}
                <View style={s.planInfo}>
                  <Text style={[s.planInfoName, { color: activePayment.plan.color }]}>
                    {activePayment.plan.name}
                  </Text>
                  <Text style={[s.planInfoPrice, { color: colors.foreground }]}>
                    {activePayment.info.usdc} USDC
                  </Text>
                  <Text style={s.planInfoSub}>MONTHLY · SOLANA NETWORK</Text>
                </View>

                {/* QR */}
                <View style={s.qrWrap}>
                  <QRCode
                    value={activePayment.info.solanaPayUrl}
                    size={200}
                    backgroundColor="#ffffff"
                    color="#000000"
                  />
                </View>

                {/* Address copy */}
                <View style={s.addrBox}>
                  <Text style={s.addrTxt} numberOfLines={1} ellipsizeMode="middle">
                    {activePayment.info.wallet}
                  </Text>
                  <Pressable
                    style={s.copyBtn}
                    onPress={() => copyAddress(activePayment.info.wallet)}
                  >
                    <Ionicons
                      name={copied ? "checkmark" : "copy-outline"}
                      size={12}
                      color="#fff"
                    />
                    <Text style={s.copyTxt}>{copied ? "COPIED" : "COPY"}</Text>
                  </Pressable>
                </View>

                {/* Steps */}
                <View style={s.steps}>
                  {[
                    "Open Phantom, Backpack, or any Solana wallet",
                    `Send exactly ${activePayment.info.usdc} USDC to the address above`,
                    "Scan the QR code or paste the address manually",
                    "Your plan activates within 1–3 minutes after confirmation",
                  ].map((step, i) => (
                    <View key={i} style={s.stepRow}>
                      <Text style={s.stepNum}>{i + 1}.</Text>
                      <Text style={s.stepTxt}>{step}</Text>
                    </View>
                  ))}
                </View>

                {/* Confirm */}
                {paymentSent ? (
                  <View style={s.confirmedBox}>
                    <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                    <Text style={s.confirmedTxt}>PAYMENT SENT</Text>
                    <Text style={s.confirmedSub}>
                      ACTIVATING {activePayment.plan.name}…{"\n"}
                      CHECKING SOLANA NETWORK (1–3 MIN)
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [s.sentBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setPaymentSent(true);
                    }}
                  >
                    <Text style={s.sentBtnTxt}>I'VE SENT THE PAYMENT</Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

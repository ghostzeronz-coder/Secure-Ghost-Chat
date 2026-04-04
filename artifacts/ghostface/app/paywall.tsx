import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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

interface Plan {
  id: string;
  name: string;
  badge: string;
  price: string | null;
  interval: string | null;
  color: string;
  features: string[];
  ctaStripe: string;
  recommended?: boolean;
  stripePriceId: string | null;
}

const PLANS: Plan[] = [
  {
    id: "ghost",
    name: "GHOST",
    badge: "FREE",
    price: null,
    interval: null,
    color: "#555555",
    stripePriceId: null,
    ctaStripe: "CONTINUE FREE",
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
    price: "$9.99",
    interval: "/mo",
    color: "#00C8FF",
    stripePriceId: "price_1TIJXg88Vhf4WcZqOGvGNLk5",
    ctaStripe: "PAY WITH CARD",
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
    price: "$19.99",
    interval: "/mo",
    color: "#D4AF37",
    stripePriceId: "price_1TIJXh88Vhf4WcZqgs3zxbxP",
    ctaStripe: "PAY WITH CARD",
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

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [stripeLoading, setStripeLoading] = useState<string | null>(null);
  const [cryptoLoading, setCryptoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cryptoModal, setCryptoModal] = useState<{
    plan: Plan;
    info: CryptoInfo;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentSent, setPaymentSent] = useState(false);

  const handleStripe = async (plan: Plan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!plan.stripePriceId || plan.id === "ghost") {
      router.back();
      return;
    }
    try {
      setStripeLoading(plan.id);
      setError(null);
      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.stripePriceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      if (Platform.OS === "web") {
        window.open(data.url, "_blank");
      } else {
        await WebBrowser.openBrowserAsync(data.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        });
      }
    } catch (err: any) {
      setError(err.message || "Payment unavailable. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStripeLoading(null);
    }
  };

  const handleCrypto = async (plan: Plan) => {
    if (!plan.stripePriceId || plan.id === "ghost") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      setCryptoLoading(plan.id);
      setError(null);
      const res = await fetch(`${API_BASE}/crypto/payment-info?plan=${plan.id}`);
      const data: CryptoInfo = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Could not load crypto info");
      setCryptoModal({ plan, info: data });
      setPaymentSent(false);
      setCopied(false);
    } catch (err: any) {
      setError(err.message || "Crypto payment unavailable.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCryptoLoading(null);
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
      gap: 2,
      marginBottom: 14,
    },
    price: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
    interval: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
    freeTxt: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 2,
      paddingHorizontal: 16,
      marginBottom: 14,
      color: colors.mutedForeground,
    },
    featureList: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    featureTxt: { color: colors.mutedForeground, fontSize: 12, letterSpacing: 1, flex: 1 },
    ctaBtn: {
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: colors.radius,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    ctaTxt: { fontSize: 12, fontWeight: "800", letterSpacing: 3 },
    cryptoBtn: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
      borderRadius: colors.radius,
      paddingVertical: 11,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      borderWidth: 1,
    },
    cryptoTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 3 },
    orRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 10,
      gap: 8,
    },
    orLine: { flex: 1, height: 1 },
    orTxt: { fontSize: 9, letterSpacing: 2 },
    errorBox: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: "rgba(255,59,48,0.1)",
      borderWidth: 1,
      borderColor: colors.destructive,
      borderRadius: colors.radius,
      padding: 12,
    },
    errorTxt: {
      color: colors.destructive,
      fontSize: 11,
      letterSpacing: 2,
      textAlign: "center",
    },
    stripe: {
      color: colors.mutedForeground,
      fontSize: 9,
      letterSpacing: 2,
      textAlign: "center",
      paddingBottom: insets.bottom + 24,
      opacity: 0.5,
    },

    // Modal
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      paddingBottom: insets.bottom + 24,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginTop: 12,
      marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 4,
    },
    sheetBody: { padding: 20, gap: 16, alignItems: "center" },
    networkBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: "rgba(153,69,255,0.15)",
      borderWidth: 1,
      borderColor: "rgba(153,69,255,0.4)",
    },
    networkTxt: {
      color: "#9945FF",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 2,
    },
    planBadge: {
      alignItems: "center",
      gap: 4,
    },
    planBadgeName: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 4,
    },
    planBadgePrice: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -1,
    },
    planBadgeSub: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 2,
    },
    qrWrap: {
      padding: 14,
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
    },
    addrRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      width: "100%",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    addrTxt: {
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 1,
      fontFamily: "monospace",
    },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    copyTxt: { color: "#000", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
    instructions: {
      width: "100%",
      backgroundColor: "rgba(153,69,255,0.08)",
      borderRadius: 10,
      padding: 14,
      gap: 8,
    },
    instrRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    instrNum: {
      color: "#9945FF",
      fontSize: 11,
      fontWeight: "800",
      width: 18,
    },
    instrTxt: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 1, flex: 1 },
    sentBtn: {
      width: "100%",
      borderRadius: colors.radius,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: "#9945FF",
    },
    sentBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 3 },
    confirmedBox: {
      width: "100%",
      borderRadius: colors.radius,
      padding: 16,
      backgroundColor: "rgba(0,255,136,0.08)",
      borderWidth: 1,
      borderColor: colors.success,
      alignItems: "center",
      gap: 6,
    },
    confirmedTxt: {
      color: colors.success,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 3,
    },
    confirmedSub: {
      color: colors.mutedForeground,
      fontSize: 10,
      letterSpacing: 2,
      textAlign: "center",
    },
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
      </View>

      <View style={s.divider} />

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorTxt}>{error.toUpperCase()}</Text>
        </View>
      )}

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.plans}>
          {PLANS.map((plan) => {
            const isStripeLoading = stripeLoading === plan.id;
            const isCryptoLoading = cryptoLoading === plan.id;
            const isPaid = plan.id !== "ghost";
            const isAnyLoading = stripeLoading !== null || cryptoLoading !== null;

            return (
              <View
                key={plan.id}
                style={[
                  s.card,
                  plan.recommended && { ...s.cardRec, borderColor: plan.color },
                ]}
              >
                {/* Plan header */}
                <View style={s.cardHeader}>
                  <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
                  <View style={[s.badge, { backgroundColor: `${plan.color}22` }]}>
                    <Text style={[s.badgeTxt, { color: plan.color }]}>{plan.badge}</Text>
                  </View>
                </View>

                {/* Price */}
                {plan.price ? (
                  <View style={s.priceRow}>
                    <Text style={[s.price, { color: plan.color }]}>{plan.price}</Text>
                    <Text style={s.interval}>{plan.interval}</Text>
                  </View>
                ) : (
                  <Text style={s.freeTxt}>FREE</Text>
                )}

                {/* Features */}
                <View style={s.featureList}>
                  {plan.features.map((f) => (
                    <View key={f} style={s.featureRow}>
                      <Ionicons name="checkmark-circle" size={14} color={plan.color} />
                      <Text style={s.featureTxt}>{f}</Text>
                    </View>
                  ))}
                </View>

                {/* Stripe CTA */}
                <Pressable
                  style={({ pressed }) => [
                    s.ctaBtn,
                    { backgroundColor: plan.recommended ? plan.color : `${plan.color}22` },
                    pressed && { opacity: 0.8 },
                    isAnyLoading && { opacity: 0.6 },
                  ]}
                  onPress={() => handleStripe(plan)}
                  disabled={isAnyLoading}
                >
                  {isStripeLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={plan.recommended ? "#000" : plan.color}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={isPaid ? "card-outline" : "arrow-forward"}
                        size={15}
                        color={plan.recommended ? "#000000" : plan.color}
                      />
                      <Text
                        style={[
                          s.ctaTxt,
                          { color: plan.recommended ? "#000000" : plan.color },
                        ]}
                      >
                        {plan.ctaStripe}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Crypto CTA — only for paid plans */}
                {isPaid && (
                  <>
                    <View style={s.orRow}>
                      <View style={[s.orLine, { backgroundColor: colors.border }]} />
                      <Text style={[s.orTxt, { color: colors.mutedForeground }]}>OR</Text>
                      <View style={[s.orLine, { backgroundColor: colors.border }]} />
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        s.cryptoBtn,
                        { borderColor: "#9945FF" },
                        pressed && { opacity: 0.8 },
                        isAnyLoading && { opacity: 0.6 },
                      ]}
                      onPress={() => handleCrypto(plan)}
                      disabled={isAnyLoading}
                    >
                      {isCryptoLoading ? (
                        <ActivityIndicator size="small" color="#9945FF" />
                      ) : (
                        <>
                          <Text style={{ fontSize: 14 }}>◎</Text>
                          <Text style={[s.cryptoTxt, { color: "#9945FF" }]}>
                            PAY WITH CRYPTO
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </View>

        <Text style={s.stripe}>SECURED BY STRIPE · USDC ON SOLANA · CANCEL ANYTIME</Text>
      </ScrollView>

      {/* Crypto Payment Modal */}
      <Modal
        visible={cryptoModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCryptoModal(null)}
      >
        <Pressable style={s.overlay} onPress={() => setCryptoModal(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />

              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>PAY WITH CRYPTO</Text>
                <Pressable onPress={() => setCryptoModal(null)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {cryptoModal && (
                <View style={s.sheetBody}>
                  {/* Network badge */}
                  <View style={s.networkBadge}>
                    <Text style={{ fontSize: 14 }}>◎</Text>
                    <Text style={s.networkTxt}>SOLANA NETWORK · USDC</Text>
                  </View>

                  {/* Plan + amount */}
                  <View style={s.planBadge}>
                    <Text
                      style={[s.planBadgeName, { color: cryptoModal.plan.color }]}
                    >
                      {cryptoModal.plan.name}
                    </Text>
                    <Text style={[s.planBadgePrice, { color: colors.foreground }]}>
                      {cryptoModal.info.usdc} USDC
                    </Text>
                    <Text style={s.planBadgeSub}>≈ ${cryptoModal.info.usdc} USD · MONTHLY</Text>
                  </View>

                  {/* QR code */}
                  <View style={s.qrWrap}>
                    <QRCode
                      value={cryptoModal.info.solanaPayUrl}
                      size={180}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                    />
                  </View>

                  {/* Wallet address */}
                  <View style={s.addrRow}>
                    <Text style={s.addrTxt} numberOfLines={1} ellipsizeMode="middle">
                      {cryptoModal.info.wallet}
                    </Text>
                    <Pressable
                      style={s.copyBtn}
                      onPress={() => copyAddress(cryptoModal.info.wallet)}
                    >
                      <Ionicons
                        name={copied ? "checkmark" : "copy-outline"}
                        size={12}
                        color="#000"
                      />
                      <Text style={s.copyTxt}>{copied ? "COPIED" : "COPY"}</Text>
                    </Pressable>
                  </View>

                  {/* Instructions */}
                  <View style={s.instructions}>
                    {[
                      "Open your Solana wallet (Phantom, Backpack, etc.)",
                      `Send exactly ${cryptoModal.info.usdc} USDC to the address above`,
                      "Scan the QR code or paste the address manually",
                      "Your plan activates within 1–3 minutes after confirmation",
                    ].map((step, i) => (
                      <View key={i} style={s.instrRow}>
                        <Text style={s.instrNum}>{i + 1}.</Text>
                        <Text style={s.instrTxt}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Confirm / sent button */}
                  {paymentSent ? (
                    <View style={s.confirmedBox}>
                      <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                      <Text style={s.confirmedTxt}>PAYMENT SENT</Text>
                      <Text style={s.confirmedSub}>
                        ACTIVATING YOUR {cryptoModal.plan.name} PLAN…{"\n"}
                        THIS MAY TAKE 1–3 MINUTES
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
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

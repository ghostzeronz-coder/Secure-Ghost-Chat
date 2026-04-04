import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  cta: string;
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
    cta: "CONTINUE FREE",
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
    stripePriceId: "SPECTER_PRICE_ID",
    cta: "GET SPECTER",
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
    stripePriceId: "PHANTOM_PRICE_ID",
    cta: "GET PHANTOM",
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

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (plan: Plan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!plan.stripePriceId || plan.id === "ghost") {
      router.back();
      return;
    }

    try {
      setLoading(plan.id);
      setError(null);

      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.stripePriceId }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to create checkout session");
      }

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
      setLoading(null);
    }
  };

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
    sub: {
      color: colors.mutedForeground,
      fontSize: 11,
      letterSpacing: 3,
    },
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
    cardRecommended: { borderWidth: 2 },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      paddingBottom: 12,
    },
    planName: {
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 4,
    },
    badge: {
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeTxt: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      paddingHorizontal: 16,
      gap: 2,
      marginBottom: 14,
    },
    price: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -1,
    },
    interval: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    freeTxt: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 2,
      paddingHorizontal: 16,
      marginBottom: 14,
      color: colors.mutedForeground,
    },
    featureList: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 8,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    featureTxt: {
      color: colors.mutedForeground,
      fontSize: 12,
      letterSpacing: 1,
      flex: 1,
    },
    ctaBtn: {
      margin: 16,
      marginTop: 8,
      borderRadius: colors.radius,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    ctaTxt: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 3,
    },
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
            const isLoading = loading === plan.id;
            return (
              <View
                key={plan.id}
                style={[
                  s.card,
                  plan.recommended && { ...s.cardRecommended, borderColor: plan.color },
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
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={plan.color}
                      />
                      <Text style={s.featureTxt}>{f}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA */}
                <Pressable
                  style={({ pressed }) => [
                    s.ctaBtn,
                    { backgroundColor: plan.recommended ? plan.color : `${plan.color}22` },
                    pressed && { opacity: 0.8 },
                    isLoading && { opacity: 0.6 },
                  ]}
                  onPress={() => handleSelect(plan)}
                  disabled={isLoading || loading !== null}
                >
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={plan.recommended ? "#000" : plan.color}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={plan.id === "ghost" ? "arrow-forward" : "lock-open-outline"}
                        size={16}
                        color={plan.recommended ? "#000000" : plan.color}
                      />
                      <Text
                        style={[
                          s.ctaTxt,
                          { color: plan.recommended ? "#000000" : plan.color },
                        ]}
                      >
                        {plan.cta}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={s.stripe}>SECURED BY STRIPE · CANCEL ANYTIME</Text>
      </ScrollView>
    </View>
  );
}

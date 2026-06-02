import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleProp, ViewStyle } from "react-native";

// Metallic gold sheen used across the app's gold surfaces (buttons/badges).
// Pale-gold highlight → bright gold → deep gold → dark edge gives a polished,
// beveled-metal look that a single flat fill cannot.
export const GOLD_METALLIC = ["#f4e2a1", "#d9b84a", "#bf9b30", "#9a7a24"] as const;
export const GOLD_METALLIC_LOCATIONS = [0, 0.45, 0.75, 1] as const;

export function GoldGradient({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={GOLD_METALLIC}
      locations={GOLD_METALLIC_LOCATIONS}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      // Solid-gold fallback so the button stays visible if the gradient ever fails to render.
      style={[{ backgroundColor: "#bf9b30" }, style]}
    >
      {children}
    </LinearGradient>
  );
}

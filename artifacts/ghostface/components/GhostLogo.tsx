import React from "react";
import { Image, StyleSheet } from "react-native";

interface GhostLogoProps {
  size?: number;
  color?: string;
}

export function GhostLogo({ size = 64, color }: GhostLogoProps) {
  return (
    <Image
      source={require("../assets/images/ghostlogo.png")}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}

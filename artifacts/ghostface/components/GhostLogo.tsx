import React from "react";
import { Image, StyleSheet } from "react-native";

interface GhostLogoProps {
  size?: number;
}

export function GhostLogo({ size = 64 }: GhostLogoProps) {
  return (
    <Image
      source={require("../assets/images/ghostlogo.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

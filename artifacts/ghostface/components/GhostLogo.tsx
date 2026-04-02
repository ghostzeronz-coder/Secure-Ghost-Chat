import React from "react";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

interface GhostLogoProps {
  size?: number;
  color?: string;
}

export function GhostLogo({ size = 64, color = "#F0F0F0" }: GhostLogoProps) {
  const scale = size / 64;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d="M32 4C18 4 8 16 8 30 L8 56 L16 50 L22 56 L28 50 L34 56 L40 50 L46 56 L56 56 L56 30 C56 16 46 4 32 4Z"
        fill={color}
        opacity={0.95}
      />
      <Circle cx="24" cy="28" r="5" fill="#000000" />
      <Circle cx="40" cy="28" r="5" fill="#000000" />
      <Circle cx="25.5" cy="26.5" r="1.5" fill="#1A1AFF" />
      <Circle cx="41.5" cy="26.5" r="1.5" fill="#1A1AFF" />
    </Svg>
  );
}

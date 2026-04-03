import React from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

interface GhostLogoProps {
  size?: number;
  color?: string;
}

export function GhostLogo({ size = 64, color = "#F0F0F0" }: GhostLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 120">
      <Defs>
        <RadialGradient id="eyeGlowLeft" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#00C8FF" stopOpacity="1" />
          <Stop offset="60%" stopColor="#00C8FF" stopOpacity="0.6" />
          <Stop offset="100%" stopColor="#00C8FF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="eyeGlowRight" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#00C8FF" stopOpacity="1" />
          <Stop offset="60%" stopColor="#00C8FF" stopOpacity="0.6" />
          <Stop offset="100%" stopColor="#00C8FF" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.85" />
        </LinearGradient>
      </Defs>

      {/* Ghost body - rounded top, wavy tentacle bottom */}
      <Path
        d={[
          "M50 5",
          "C25 5 10 22 10 44",
          "L10 90",
          "Q15 82 20 90",
          "Q25 98 30 90",
          "Q35 82 40 90",
          "Q45 98 50 90",
          "Q55 82 60 90",
          "Q65 98 70 90",
          "Q75 82 80 90",
          "Q85 98 90 90",
          "L90 44",
          "C90 22 75 5 50 5Z",
        ].join(" ")}
        fill="url(#bodyGrad)"
      />

      {/* Left eye glow halo */}
      <Circle cx="35" cy="45" r="12" fill="url(#eyeGlowLeft)" opacity={0.35} />
      {/* Right eye glow halo */}
      <Circle cx="65" cy="45" r="12" fill="url(#eyeGlowRight)" opacity={0.35} />

      {/* Left eye socket (hollow oval) */}
      <Ellipse cx="35" cy="45" rx="8" ry="10" fill="#000000" />
      {/* Right eye socket */}
      <Ellipse cx="65" cy="45" rx="8" ry="10" fill="#000000" />

      {/* Left eye inner glow */}
      <Ellipse cx="35" cy="45" rx="5.5" ry="7" fill="#00C8FF" opacity={0.9} />
      {/* Right eye inner glow */}
      <Ellipse cx="65" cy="45" rx="5.5" ry="7" fill="#00C8FF" opacity={0.9} />

      {/* Left pupil shine */}
      <Circle cx="32.5" cy="42.5" r="2" fill="#FFFFFF" opacity={0.6} />
      {/* Right pupil shine */}
      <Circle cx="62.5" cy="42.5" r="2" fill="#FFFFFF" opacity={0.6} />

      {/* Mouth — thin jagged slash */}
      <Path
        d="M38 66 L42 62 L46 66 L50 62 L54 66 L58 62 L62 66"
        stroke="#000000"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

import React from "react";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

interface GhostLogoProps {
  size?: number;
}

export function GhostLogo({ size = 64 }: GhostLogoProps) {
  return (
    <Svg width={size} height={(size * 130) / 100} viewBox="0 0 100 130">
      <Defs>
        <LinearGradient id="faceGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#F0D060" stopOpacity="1" />
          <Stop offset="50%" stopColor="#D4AF37" stopOpacity="1" />
          <Stop offset="100%" stopColor="#A07C10" stopOpacity="1" />
        </LinearGradient>
        <RadialGradient id="eyeHaloL" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#D4AF37" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="eyeHaloR" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#D4AF37" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* ── Scream mask face — elongated drooping shape ── */}
      <Path
        d="M50 3
           C43 3 28 13 20 27
           C12 41 12 55 14 67
           C16 79 22 91 30 101
           C36 109 43 119 48 125
           L50 129 L52 125
           C57 119 64 109 70 101
           C78 91 84 79 86 67
           C88 55 88 41 80 27
           C72 13 57 3 50 3Z"
        fill="url(#faceGrad)"
      />

      {/* Eye glow halos */}
      <Ellipse cx="34" cy="52" rx="17" ry="19" fill="url(#eyeHaloL)" />
      <Ellipse cx="66" cy="52" rx="17" ry="19" fill="url(#eyeHaloR)" />

      {/* Left eye socket — teardrop */}
      <Path
        d="M26 44
           C24 36 30 27 38 29
           C46 31 50 42 48 54
           C46 64 40 70 32 67
           C24 63 24 52 26 44Z"
        fill="#000000"
      />

      {/* Right eye socket — teardrop mirror */}
      <Path
        d="M74 44
           C76 36 70 27 62 29
           C54 31 50 42 52 54
           C54 64 60 70 68 67
           C76 63 76 52 74 44Z"
        fill="#000000"
      />

      {/* Screaming mouth — open oval */}
      <Path
        d="M37 82
           C37 78 43 74 50 74
           C57 74 63 78 63 82
           C63 94 58 108 50 110
           C42 108 37 94 37 82Z"
        fill="#000000"
      />

      {/* Subtle nose hint */}
      <Path
        d="M47 68 C47 72 50 74 53 68"
        stroke="#000000"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.4}
      />
    </Svg>
  );
}

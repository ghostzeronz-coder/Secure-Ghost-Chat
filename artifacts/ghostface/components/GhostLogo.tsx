import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

interface GhostLogoProps {
  size?: number;
}

export function GhostLogo({ size = 64 }: GhostLogoProps) {
  const w = size;
  const h = (size * 130) / 116;

  return (
    <Svg width={w} height={h} viewBox="0 0 116 130">
      <Defs>
        <LinearGradient id="maskGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#F5E070" stopOpacity="1" />
          <Stop offset="45%" stopColor="#D4AF37" stopOpacity="1" />
          <Stop offset="100%" stopColor="#9A7510" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#D4AF37" stopOpacity="1" />
          <Stop offset="100%" stopColor="#F5E070" stopOpacity="0.7" />
        </LinearGradient>
      </Defs>

      {/* ── Hood / cowl — dark shape framing the mask ── */}
      <Path
        d="M50 0
           C41 0 24 11 14 28
           C4  45  3 62  6 77
           C9  92 17 106 27 117
           C34 124 42 130 48 130
           L50 130 L52 130
           C58 130 66 124 73 117
           C83 106 91  92 94  77
           C97  62 96  45 86  28
           C76  11 59   0 50   0Z"
        fill="#111111"
      />

      {/* ── Ghostface mask — gold gradient ── */}
      <Path
        d="M50 7
           C43 7 28 17 20 31
           C12 45 12 59 14 71
           C16 83 22 95 30 105
           C36 113 43 122 48 127
           L50 130 L52 127
           C57 122 64 113 70 105
           C78  95 84  83 86  71
           C88  59 88  45 80  31
           C72  17 57   7 50   7Z"
        fill="url(#maskGrad)"
      />

      {/* ── Left eye socket — teardrop ── */}
      <Path
        d="M27 47
           C25 39 31 30 39 32
           C47 34 51 45 49 57
           C47 67 41 73 33 70
           C25 66 25 55 27 47Z"
        fill="#000000"
      />

      {/* ── Right eye socket — teardrop mirror ── */}
      <Path
        d="M73 47
           C75 39 69 30 61 32
           C53 34 49 45 51 57
           C53 67 59 73 67 70
           C75 66 75 55 73 47Z"
        fill="#000000"
      />

      {/* ── Screaming mouth — open oval ── */}
      <Path
        d="M38 84
           C38 80 44 76 50 76
           C56 76 62 80 62 84
           C62 96 57 110 50 112
           C43 110 38  96 38  84Z"
        fill="#000000"
      />

      {/* ── Subtle nose hint ── */}
      <Path
        d="M47 70 C47 74 50 76 53 70"
        stroke="#000000"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.35}
      />

      {/* ── NFC waves — three gold arcs, right side ── */}
      <Path
        d="M80 57 A 9 9 0 0 1 80 73"
        stroke="url(#waveGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M87 51 A 15 15 0 0 1 87 79"
        stroke="url(#waveGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M95 44 A 22 22 0 0 1 95 86"
        stroke="url(#waveGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

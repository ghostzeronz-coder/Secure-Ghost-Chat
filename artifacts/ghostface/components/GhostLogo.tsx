import React from "react";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from "react-native-svg";

interface GhostLogoProps {
  size?: number;
}

export function GhostLogo({ size = 64 }: GhostLogoProps) {
  const w = size;
  const h = size;

  return (
    <Svg width={w} height={h} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="hoodGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#2A2A2A" stopOpacity="1" />
          <Stop offset="100%" stopColor="#111111" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="faceGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#F5E070" stopOpacity="1" />
          <Stop offset="40%" stopColor="#D4AF37" stopOpacity="1" />
          <Stop offset="100%" stopColor="#9A7510" stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* ── Hood / cloak silhouette ── */}
      <Path
        d="M60 6
           C51 6 33 17 22 35
           C11 53  9 72 11 87
           C13 102 22 114 34 119
           L60 120 L86 119
           C98 114 107 102 109 87
           C111 72 109 53  98 35
           C87 17  69  6 60  6Z"
        fill="url(#hoodGrad)"
      />

      {/* Hood highlight (subtle shine left side) */}
      <Path
        d="M60 6
           C51 6 33 17 22 35
           C11 53  9 72 11 87
           L18 80
           C17 66 20 52 30 38
           C40 24 54 14 60 12Z"
        fill="url(#shineGrad)"
      />

      {/* ── Pixel scatter — upper left ── */}
      <Rect x="7"  y="16" width="5" height="5" fill="#D4AF37" opacity={0.95} />
      <Rect x="14" y="10" width="4" height="4" fill="#D4AF37" opacity={0.80} />
      <Rect x="21" y="18" width="3" height="3" fill="#D4AF37" opacity={0.65} />
      <Rect x="11" y="24" width="3" height="3" fill="#D4AF37" opacity={0.55} />
      <Rect x="18" y="30" width="2" height="2" fill="#D4AF37" opacity={0.45} />
      <Rect x="6"  y="28" width="2" height="2" fill="#D4AF37" opacity={0.35} />
      <Rect x="25" y="12" width="2" height="2" fill="#D4AF37" opacity={0.70} />
      <Rect x="5"  y="12" width="3" height="3" fill="#D4AF37" opacity={0.90} />
      <Rect x="28" y="22" width="2" height="2" fill="#D4AF37" opacity={0.40} />
      <Rect x="16" y="36" width="2" height="2" fill="#D4AF37" opacity={0.30} />

      {/* ── NFC element — upper right ── */}
      {/* N badge circle */}
      <Circle cx="90" cy="20" r="9" fill="#1A1A1A" stroke="#D4AF37" strokeWidth="1.5" />
      {/* Letter N as paths */}
      <Path
        d="M84 26 L84 14 L90 22 L96 14 L96 26"
        stroke="#D4AF37"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* NFC signal arcs */}
      <Path
        d="M101 14 A 8 8 0 0 1 101 26"
        stroke="#D4AF37"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
      <Path
        d="M107 10 A 13 13 0 0 1 107 30"
        stroke="#D4AF37"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity={0.70}
      />
      <Path
        d="M114 6 A 18 18 0 0 1 114 34"
        stroke="#D4AF37"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity={0.50}
      />

      {/* ── Geometric low-poly face mask ── */}

      {/* Face base polygon */}
      <Path
        d="M60 32
           L43 43 L36 63 L40 81
           L60 92
           L80 81 L84 63 L77 43Z"
        fill="url(#faceGrad)"
      />

      {/* Mesh triangulation lines (darker gold) */}
      <Path
        d="M60 32 L52 50
           M60 32 L68 50
           M43 43 L52 50
           M77 43 L68 50
           M52 50 L68 50
           M52 50 L44 63
           M68 50 L76 63
           M44 63 L52 75
           M76 63 L68 75
           M52 75 L60 82
           M68 75 L60 82
           M52 50 L60 62
           M68 50 L60 62
           M60 62 L44 63
           M60 62 L76 63
           M60 62 L52 75
           M60 62 L68 75
           M36 63 L44 63
           M84 63 L76 63
           M40 81 L52 75
           M80 81 L68 75
           M60 82 L60 92"
        stroke="#9A7810"
        strokeWidth="0.7"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />

      {/* Left eye socket */}
      <Path
        d="M44 54 L52 51 L54 59 L47 62Z"
        fill="#111111"
        opacity={0.92}
      />

      {/* Right eye socket */}
      <Path
        d="M76 54 L68 51 L66 59 L73 62Z"
        fill="#111111"
        opacity={0.92}
      />

      {/* Nose hint (subtle) */}
      <Path
        d="M57 72 L60 76 L63 72"
        stroke="#9A7810"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}

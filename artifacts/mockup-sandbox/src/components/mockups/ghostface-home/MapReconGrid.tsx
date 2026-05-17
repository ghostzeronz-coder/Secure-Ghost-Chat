import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  Radio,
  RefreshCw,
  ShieldAlert,
  Signal,
  Trash2,
} from "lucide-react";

type LatLon = { lat: number; lon: number };

type ContactNode = {
  id: string;
  callsign: string;
  city: string;
  loc: LatLon;
  active: boolean;
  unread: number;
};

type ThreatNode = {
  id: string;
  tag: string;
  city: string;
  loc: LatLon;
  vector: string;
  blockedAt: string;
};

type ExitNode = {
  id: string;
  label: string;
  city: string;
  country: string;
  loc: LatLon;
  latencyMs: number;
};

const MAP_W = 450;
const MAP_H = 560;

function project(loc: LatLon): { x: number; y: number } {
  const x = ((loc.lon + 180) / 360) * MAP_W;
  const y = ((90 - loc.lat) / 180) * MAP_H;
  return { x, y };
}

const DEVICE_LOC: LatLon = { lat: 40.71, lon: -74.0 };

const EXIT: ExitNode = {
  id: "ch-zurich-04",
  label: "ch-zurich-04",
  city: "Zurich",
  country: "CH",
  loc: { lat: 47.37, lon: 8.54 },
  latencyMs: 42,
};

const CONTACTS: ContactNode[] = [
  {
    id: "phantom9",
    callsign: "PHANTOM_9",
    city: "Berlin",
    loc: { lat: 52.52, lon: 13.4 },
    active: true,
    unread: 2,
  },
  {
    id: "edox",
    callsign: "EDOX",
    city: "Reykjavik",
    loc: { lat: 64.13, lon: -21.94 },
    active: true,
    unread: 0,
  },
  {
    id: "nightowl",
    callsign: "NIGHTOWL",
    city: "Singapore",
    loc: { lat: 1.35, lon: 103.81 },
    active: false,
    unread: 0,
  },
  {
    id: "raven",
    callsign: "RAVEN",
    city: "Sao Paulo",
    loc: { lat: -23.55, lon: -46.63 },
    active: true,
    unread: 1,
  },
];

const THREATS: ThreatNode[] = [
  {
    id: "t1",
    tag: "RU",
    city: "Moscow",
    loc: { lat: 55.75, lon: 37.61 },
    vector: "port-scan :22",
    blockedAt: "00:41:12",
  },
  {
    id: "t2",
    tag: "CN",
    city: "Shenzhen",
    loc: { lat: 22.54, lon: 114.05 },
    vector: "tls-fingerprint",
    blockedAt: "00:38:04",
  },
  {
    id: "t3",
    tag: "US-DC",
    city: "Ashburn",
    loc: { lat: 39.04, lon: -77.48 },
    vector: "stun-probe",
    blockedAt: "00:32:51",
  },
  {
    id: "t4",
    tag: "IR",
    city: "Tehran",
    loc: { lat: 35.69, lon: 51.39 },
    vector: "dns-leak-probe",
    blockedAt: "00:27:18",
  },
  {
    id: "t5",
    tag: "KP",
    city: "Pyongyang",
    loc: { lat: 39.02, lon: 125.75 },
    vector: "icmp-flood",
    blockedAt: "00:14:09",
  },
  {
    id: "t6",
    tag: "US-CA",
    city: "San Jose",
    loc: { lat: 37.34, lon: -121.89 },
    vector: "webrtc-probe",
    blockedAt: "00:02:55",
  },
];

const CONTINENT_PATHS: string[] = [
  "M 60 130 L 110 110 L 150 115 L 175 140 L 168 170 L 140 200 L 120 230 L 95 245 L 78 220 L 62 195 L 55 160 Z",
  "M 120 230 L 140 245 L 138 260 L 122 252 Z",
  "M 140 270 L 165 275 L 175 305 L 168 345 L 150 380 L 138 395 L 130 370 L 132 330 L 138 295 Z",
  "M 190 95 L 215 92 L 218 115 L 198 122 L 188 110 Z",
  "M 215 135 L 250 128 L 268 140 L 260 160 L 240 168 L 222 162 L 212 150 Z",
  "M 225 185 L 268 180 L 285 215 L 282 260 L 265 295 L 248 320 L 232 295 L 222 255 L 220 215 Z",
  "M 268 130 L 340 118 L 385 130 L 395 165 L 380 195 L 345 205 L 305 195 L 282 175 L 270 155 Z",
  "M 320 195 L 340 200 L 338 230 L 325 240 L 315 220 Z",
  "M 360 215 L 385 225 L 380 250 L 365 240 Z",
  "M 370 290 L 415 285 L 425 315 L 405 330 L 378 322 L 368 305 Z",
  "M 30 430 L 420 430 L 420 455 L 30 455 Z",
];

const LON_LABELS: { v: number; label: string }[] = [
  { v: -180, label: "-180" },
  { v: -120, label: "-120" },
  { v: -60, label: "-60" },
  { v: 0, label: "0" },
  { v: 60, label: "+60" },
  { v: 120, label: "+120" },
  { v: 180, label: "+180" },
];

const LAT_LABELS: { v: number; label: string }[] = [
  { v: 90, label: "+90" },
  { v: 45, label: "+45" },
  { v: 0, label: "0" },
  { v: -45, label: "-45" },
  { v: -90, label: "-90" },
];

function CalloutFrame({
  x,
  y,
  w,
  h,
  line1,
  line2,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  line1: string;
  line2: string;
  color: string;
}) {
  const c = 3;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#000" fillOpacity="0.7" />
      <path
        d={
          "M " + x + " " + (y + c) + " L " + x + " " + y + " L " + (x + c) + " " + y +
          " M " + (x + w - c) + " " + y + " L " + (x + w) + " " + y + " L " + (x + w) + " " + (y + c) +
          " M " + x + " " + (y + h - c) + " L " + x + " " + (y + h) + " L " + (x + c) + " " + (y + h) +
          " M " + (x + w - c) + " " + (y + h) + " L " + (x + w) + " " + (y + h) + " L " + (x + w) + " " + (y + h - c)
        }
        fill="none"
        stroke={color}
        strokeOpacity="0.8"
        strokeWidth="0.7"
      />
      <text x={x + 3} y={y + 5} fill={color} fillOpacity="0.95" fontSize="6.5" className="gf-mono">
        {line1}
      </text>
      <text x={x + 3} y={y + 11.5} fill={color} fillOpacity="0.6" fontSize="6.5" className="gf-mono">
        {line2}
      </text>
    </g>
  );
}

export function MapReconGrid() {
  const [now, setNow] = useState<Date>(new Date());
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState<boolean>(false);
  const [rotating, setRotating] = useState<boolean>(false);
  const [panicHold, setPanicHold] = useState<number>(0);
  const holdRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const t = setTimeout(() => setRotating(false), 1400);
    return () => clearTimeout(t);
  }, [rotating]);

  const beginPanic = () => {
    if (holdRef.current) window.clearInterval(holdRef.current);
    setPanicHold(0);
    holdRef.current = window.setInterval(() => {
      setPanicHold((p) => {
        const n = p + 2;
        if (n >= 100) {
          if (holdRef.current) window.clearInterval(holdRef.current);
          holdRef.current = null;
          return 100;
        }
        return n;
      });
    }, 60);
  };

  const endPanic = () => {
    if (holdRef.current) window.clearInterval(holdRef.current);
    holdRef.current = null;
    if (panicHold < 100) setPanicHold(0);
  };

  const exitXY = project(EXIT.loc);
  const deviceXY = project(DEVICE_LOC);

  const midX = (deviceXY.x + exitXY.x) / 2;
  const midY = Math.min(deviceXY.y, exitXY.y) - 70;
  const arcPath =
    "M " + deviceXY.x + " " + deviceXY.y +
    " Q " + midX + " " + midY + " " + exitXY.x + " " + exitXY.y;

  const activeContact = CONTACTS.find((c) => c.id === selectedContact) || null;
  const activeThreat = THREATS.find((t) => t.id === selectedThreat) || null;

  const hhmmss = now.toTimeString().slice(0, 8);

  const styleBlock =
    "@keyframes gf-pulse { 0% { r: 4; opacity: 1; } 100% { r: 18; opacity: 0; } }" +
    " @keyframes gf-dash { to { stroke-dashoffset: -40; } }" +
    " @keyframes gf-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }" +
    " @keyframes gf-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }" +
    " @keyframes gf-redglow { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.0), inset 0 0 12px rgba(255,59,48,0.55); } 50% { box-shadow: 0 0 14px 2px rgba(255,59,48,0.55), inset 0 0 18px rgba(255,59,48,0.8); } }" +
    " .gf-pulse-ring { transform-origin: center; animation: gf-pulse 2.2s ease-out infinite; }" +
    " .gf-arc { stroke-dasharray: 4 6; animation: gf-dash 1.6s linear infinite; }" +
    " .gf-conv { stroke-dasharray: 2 4; animation: gf-dash 2.4s linear infinite; }" +
    " .gf-scan { animation: gf-scan 6s linear infinite; }" +
    " .gf-blink { animation: gf-blink 1.4s ease-in-out infinite; }" +
    " .gf-redglow { animation: gf-redglow 1.4s ease-in-out infinite; }" +
    " .gf-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }";

  return (
    <div className="h-[100dvh] w-full bg-black text-[#FFB800] gf-mono overflow-hidden relative select-none">
      <style dangerouslySetInnerHTML={{ __html: styleBlock }} />

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.18em] border-b border-[#FFB800]/15 bg-black/85 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFB800] gf-blink" />
          <span className="text-[#FFB800]/90">GHOSTFACE</span>
          <span className="text-[#FFB800]/40">//</span>
          <span className="text-[#FFB800]/70">cs:0xA17F</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#FFB800]/50">{hhmmss}Z</span>
          <span className="flex items-center gap-1 text-[#7CFFB2]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7CFFB2]" />
            ONLINE
          </span>
        </div>
      </div>

      {/* Map area */}
      <div className="absolute inset-0 pt-9 pb-[36%]">
        <div className="relative w-full h-full overflow-hidden">
          {/* graticule scanline */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div
              className="absolute left-0 right-0 h-px bg-[#FFB800]/30 gf-scan"
              style={{ top: 0 }}
            />
          </div>

          {/* lat/lon grid */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={"0 0 " + MAP_W + " " + MAP_H}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern
                id="grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="#FFB800"
                  strokeOpacity="0.05"
                  strokeWidth="0.5"
                />
              </pattern>
              <radialGradient id="exitGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFB800" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FFB800" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width={MAP_W} height={MAP_H} fill="url(#grid)" />

            {/* Equator + prime meridian */}
            <line
              x1="0"
              y1={MAP_H / 2}
              x2={MAP_W}
              y2={MAP_H / 2}
              stroke="#FFB800"
              strokeOpacity="0.1"
              strokeDasharray="2 4"
            />
            <line
              x1={MAP_W / 2}
              y1="0"
              x2={MAP_W / 2}
              y2={MAP_H}
              stroke="#FFB800"
              strokeOpacity="0.1"
              strokeDasharray="2 4"
            />

            {/* Calibrated coordinate rulers — top (lon) */}
            {LON_LABELS.map((t) => {
              const x = ((t.v + 180) / 360) * MAP_W;
              return (
                <g key={"lon-" + t.v}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={5}
                    stroke="#FFB800"
                    strokeOpacity="0.35"
                    strokeWidth="0.5"
                  />
                  <text
                    x={x + 2}
                    y={9}
                    fill="#FFB800"
                    fillOpacity="0.35"
                    fontSize="7"
                    className="gf-mono"
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}
            {/* minor lon ticks every 30 */}
            {[-150, -90, -30, 30, 90, 150].map((v) => {
              const x = ((v + 180) / 360) * MAP_W;
              return (
                <line
                  key={"lon-minor-" + v}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={3}
                  stroke="#FFB800"
                  strokeOpacity="0.25"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Calibrated coordinate rulers — left (lat) */}
            {LAT_LABELS.map((t) => {
              const y = ((90 - t.v) / 180) * MAP_H;
              return (
                <g key={"lat-" + t.v}>
                  <line
                    x1={0}
                    y1={y}
                    x2={5}
                    y2={y}
                    stroke="#FFB800"
                    strokeOpacity="0.35"
                    strokeWidth="0.5"
                  />
                  <text
                    x={7}
                    y={y + 2.5}
                    fill="#FFB800"
                    fillOpacity="0.35"
                    fontSize="7"
                    className="gf-mono"
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}

            {/* Continents */}
            {CONTINENT_PATHS.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="#FFB800"
                fillOpacity="0.06"
                stroke="#FFB800"
                strokeOpacity="0.45"
                strokeWidth="0.7"
              />
            ))}

            {/* Exit glow halo */}
            <circle cx={exitXY.x} cy={exitXY.y} r="34" fill="url(#exitGlow)" />

            {/* Geodesic arc device → exit */}
            <path
              d={arcPath}
              fill="none"
              stroke="#FFB800"
              strokeOpacity="0.55"
              strokeWidth="1"
              className="gf-arc"
            />

            {/* Device marker */}
            <g>
              <circle
                cx={deviceXY.x}
                cy={deviceXY.y}
                r="3"
                fill="#FFB800"
                fillOpacity="0.9"
              />
              <circle
                cx={deviceXY.x}
                cy={deviceXY.y}
                r="3"
                fill="none"
                stroke="#FFB800"
                strokeOpacity="0.9"
                className="gf-pulse-ring"
              />
              <line
                x1={deviceXY.x}
                y1={deviceXY.y}
                x2={deviceXY.x + 14}
                y2={deviceXY.y + 14}
                stroke="#FFB800"
                strokeOpacity="0.5"
                strokeWidth="0.5"
              />
              <CalloutFrame
                x={deviceXY.x + 14}
                y={deviceXY.y + 14}
                w={92}
                h={15}
                line1="DEV-LOCAL"
                line2="40.71°N 074.0°W"
                color="#FFB800"
              />
            </g>

            {/* Exit node marker */}
            <g>
              <circle cx={exitXY.x} cy={exitXY.y} r="4" fill="#FFB800" />
              <circle
                cx={exitXY.x}
                cy={exitXY.y}
                r="4"
                fill="none"
                stroke="#FFB800"
                strokeWidth="1"
                className="gf-pulse-ring"
              />
              <line
                x1={exitXY.x}
                y1={exitXY.y}
                x2={exitXY.x + 14}
                y2={exitXY.y - 18}
                stroke="#FFB800"
                strokeOpacity="0.55"
                strokeWidth="0.5"
              />
              <CalloutFrame
                x={exitXY.x + 14}
                y={exitXY.y - 30}
                w={118}
                h={15}
                line1="ch-zurich-04"
                line2="47.37°N 008.5°E · 42ms"
                color="#FFB800"
              />
            </g>

            {/* Conversation lines (exit -> active contacts) */}
            {CONTACTS.filter((c) => c.active).map((c) => {
              const p = project(c.loc);
              const mx = (exitXY.x + p.x) / 2;
              const my = Math.min(exitXY.y, p.y) - 30;
              const d2 =
                "M " + exitXY.x + " " + exitXY.y +
                " Q " + mx + " " + my + " " + p.x + " " + p.y;
              return (
                <path
                  key={"line-" + c.id}
                  d={d2}
                  fill="none"
                  stroke="#FFB800"
                  strokeOpacity="0.35"
                  strokeWidth="0.8"
                  className="gf-conv"
                />
              );
            })}

            {/* Threat dots + static vector arrows toward device */}
            {THREATS.map((t) => {
              const p = project(t.loc);
              const sel = selectedThreat === t.id;
              const dx = deviceXY.x - p.x;
              const dy = deviceXY.y - p.y;
              const len = Math.max(1, Math.hypot(dx, dy));
              const ux = dx / len;
              const uy = dy / len;
              const sx = p.x + ux * 5;
              const sy = p.y + uy * 5;
              const ex = sx + ux * 12;
              const ey = sy + uy * 12;
              // chevron head
              const ang = Math.atan2(uy, ux);
              const ch = 3;
              const hx1 = ex - Math.cos(ang - 0.5) * ch;
              const hy1 = ey - Math.sin(ang - 0.5) * ch;
              const hx2 = ex - Math.cos(ang + 0.5) * ch;
              const hy2 = ey - Math.sin(ang + 0.5) * ch;
              return (
                <g
                  key={t.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedThreat(t.id);
                    setSelectedContact(null);
                  }}
                >
                  <line
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke="#FF3B30"
                    strokeOpacity="0.55"
                    strokeWidth="0.7"
                  />
                  <polyline
                    points={
                      hx1 + "," + hy1 + " " + ex + "," + ey + " " + hx2 + "," + hy2
                    }
                    fill="none"
                    stroke="#FF3B30"
                    strokeOpacity="0.55"
                    strokeWidth="0.7"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={sel ? 4 : 2.6}
                    fill="#FF3B30"
                    fillOpacity="0.9"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="2.6"
                    fill="none"
                    stroke="#FF3B30"
                    strokeOpacity="0.7"
                    className="gf-pulse-ring"
                  />
                  <text
                    x={p.x + 5}
                    y={p.y + 3}
                    fill="#FF6B61"
                    fontSize="6.5"
                    className="gf-mono"
                  >
                    {t.tag}
                  </text>
                </g>
              );
            })}

            {/* Contact dots */}
            {CONTACTS.map((c) => {
              const p = project(c.loc);
              const sel = selectedContact === c.id;
              return (
                <g
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedContact(c.id);
                    setSelectedThreat(null);
                  }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={sel ? 6 : 4.5}
                    fill="#000"
                    stroke="#FFB800"
                    strokeWidth="1.3"
                  />
                  <circle cx={p.x} cy={p.y} r="2" fill="#FFB800" />
                  {c.unread > 0 && (
                    <circle
                      cx={p.x + 5}
                      cy={p.y - 5}
                      r="2.2"
                      fill="#FF3B30"
                    />
                  )}
                  <text
                    x={p.x + 8}
                    y={p.y - 6}
                    fill="#FFB800"
                    fillOpacity="0.85"
                    fontSize="6.5"
                    className="gf-mono"
                  >
                    {c.callsign}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Crosshair corners with N/E/S/W labels */}
          <div className="absolute top-2 left-2 w-4 h-4 border-l border-t border-[#FFB800]/40" />
          <div className="absolute top-2 left-7 text-[6px] text-[#FFB800]/50 gf-mono leading-none">N</div>
          <div className="absolute top-2 right-2 w-4 h-4 border-r border-t border-[#FFB800]/40" />
          <div className="absolute top-2 right-7 text-[6px] text-[#FFB800]/50 gf-mono leading-none">E</div>
          <div className="absolute bottom-2 left-2 w-4 h-4 border-l border-b border-[#FFB800]/40" />
          <div className="absolute bottom-2 left-7 text-[6px] text-[#FFB800]/50 gf-mono leading-none">W</div>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-r border-b border-[#FFB800]/40" />
          <div className="absolute bottom-2 right-7 text-[6px] text-[#FFB800]/50 gf-mono leading-none">S</div>

          {/* Vector legend (top-right) */}
          <div className="absolute top-2 right-10 z-20 flex flex-col gap-[2px] text-[7px] text-[#FFB800]/70 gf-mono">
            {[
              { s: "▲", l: "EXIT" },
              { s: "●", l: "CONTACT" },
              { s: "●", l: "THREAT" },
              { s: "→", l: "VECTOR" },
            ].map((row, i) => (
              <div
                key={i}
                className="border border-[#FFB800]/25 bg-black/70 px-1.5 py-[1px] flex items-center gap-1.5 leading-none"
              >
                <span
                  className={
                    row.l === "THREAT" ? "text-[#FF6B61]" : "text-[#FFB800]"
                  }
                >
                  {row.s}
                </span>
                <span className="tracking-[0.18em]">{row.l}</span>
              </div>
            ))}
          </div>

          {/* Selection inspector chip */}
          {(activeContact || activeThreat) && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 border border-[#FFB800]/40 bg-black/90 text-[10px] px-3 py-2 max-w-[80%]">
              {activeContact && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#FFB800] tracking-[0.18em]">
                      {activeContact.callsign}
                    </span>
                    <span className="text-[#FFB800]/50">
                      {activeContact.city}
                    </span>
                  </div>
                  <div className="text-[#FFB800]/60">
                    routed via {EXIT.label} → tap to open chat
                  </div>
                </div>
              )}
              {activeThreat && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#FF6B61] tracking-[0.18em]">
                      BLOCKED · {activeThreat.tag}
                    </span>
                    <span className="text-[#FFB800]/50">
                      {activeThreat.blockedAt}
                    </span>
                  </div>
                  <div className="text-[#FFB800]/60">
                    {activeThreat.city} — vector: {activeThreat.vector}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 z-30 border-t border-[#FFB800]/30 bg-[#0a0a0a] transition-[height] duration-300 ease-out"
        style={{ height: sheetExpanded ? "54%" : "34%" }}
      >
        {/* drawer pull */}
        <button
          onClick={() => setSheetExpanded((s) => !s)}
          className="w-full flex flex-col items-center pt-2 pb-1"
          aria-label="toggle sheet"
        >
          <div className="w-10 h-1 rounded-full bg-[#FFB800]/40" />
          <ChevronUp
            size={12}
            className={
              "mt-1 text-[#FFB800]/50 transition-transform " +
              (sheetExpanded ? "rotate-180" : "")
            }
          />
        </button>

        <div className="px-4 pb-3 h-full flex flex-col">
          {/* 3-row instrument cluster */}
          <div className="divide-y divide-[#FFB800]/15 border-y border-[#FFB800]/15">
            {/* Row 1 LINK */}
            <div className="flex items-center gap-3 py-2">
              <span className="text-[9px] tracking-[0.22em] text-[#FFB800]/40 w-14">
                01 LINK
              </span>
              <Radio size={13} className="text-[#FFB800]" />
              <div className="flex flex-col leading-tight flex-1 min-w-0">
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#FFB800]/50">
                  exit node
                </span>
                <span className="text-[12px] text-[#FFB800] truncate">
                  {EXIT.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-[#7CFFB2]">{EXIT.latencyMs}ms</span>
                <div className="flex items-center gap-1 text-[#FFB800]/70">
                  <Signal size={12} />
                  <span>4/4</span>
                </div>
              </div>
            </div>

            {/* Row 2 TRAFFIC */}
            <div className="flex items-center gap-3 py-2 text-[10px]">
              <span className="text-[9px] tracking-[0.22em] text-[#FFB800]/40 w-14">
                02 TRAFFIC
              </span>
              <div className="flex-1 flex items-center gap-3 text-[#FFB800]/75">
                <span>
                  <span className="text-[#FFB800]/50">↑ TX</span> 1.2MB
                </span>
                <span className="text-[#FFB800]/25">·</span>
                <span>
                  <span className="text-[#FFB800]/50">↓ RX</span> 4.7MB
                </span>
                <span className="text-[#FFB800]/25">·</span>
                <span>
                  <span className="text-[#FFB800]/50">UP</span> 06:42:18
                </span>
              </div>
            </div>

            {/* Row 3 THREATS */}
            <div className="flex items-center gap-3 py-2">
              <span className="text-[9px] tracking-[0.22em] text-[#FFB800]/40 w-14">
                03 THREATS
              </span>
              <ShieldAlert size={13} className="text-[#FF6B61]" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#FFB800]/75 flex-1">
                6 BLOCKED · 24H
              </span>
              <div className="flex items-end gap-[2px] h-4">
                {[5, 8, 4, 10, 6, 12].map((h, i) => (
                  <span
                    key={i}
                    className="w-[2px] border-l border-[#FF6B61]/70"
                    style={{ height: h + "px" }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Rotate row */}
          <button
            onClick={() => setRotating(true)}
            className="mt-2 flex items-center justify-between border border-[#FFB800]/40 text-[11px] uppercase tracking-[0.22em] text-[#FFB800] py-2 px-3 hover:bg-[#FFB800]/10 active:bg-[#FFB800]/20 transition"
          >
            <span className="flex items-center gap-2">
              <RefreshCw
                size={12}
                className={rotating ? "animate-spin" : ""}
              />
              {rotating ? "rotating exit…" : "rotate exit"}
            </span>
            <span className="text-[9px] tracking-[0.2em] text-[#FFB800]/50">
              AUTO ROTATE in 04:12
            </span>
          </button>

          {sheetExpanded && (
            <div className="mt-3 flex-1 overflow-auto border-t border-[#FFB800]/15 pt-2 text-[10px]">
              <div className="text-[#FFB800]/40 uppercase tracking-[0.22em] mb-1">
                recent intercepts
              </div>
              <div className="divide-y divide-[#FFB800]/10 border-y border-[#FFB800]/10">
                {THREATS.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-[64px_1fr_72px] gap-2 py-1 items-center"
                  >
                    <span className="text-[#FFB800]/85 tracking-[0.18em]">
                      {t.tag}
                    </span>
                    <span className="text-[#FFB800]/55 truncate">
                      {t.vector}
                    </span>
                    <span className="text-[#FFB800]/40 text-right">
                      {t.blockedAt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Panic wipe bar */}
          <div className="mt-auto pt-3">
            <div className="text-[9px] uppercase tracking-[0.25em] text-[#FF6B61]/70 mb-1 flex items-center gap-1.5">
              <Trash2 size={10} />
              hold to panic_wipe
            </div>

            {/* tick labels above */}
            <div className="relative h-3">
              {[
                { p: 33, l: "1S" },
                { p: 66, l: "2S" },
                { p: 100, l: "3S" },
              ].map((tk) => (
                <span
                  key={tk.l}
                  className="absolute -translate-x-1/2 text-[7px] gf-mono text-[#FF6B61]/45"
                  style={{ left: tk.p + "%", top: 0 }}
                >
                  {tk.l}
                </span>
              ))}
            </div>

            <div
              onMouseDown={beginPanic}
              onMouseUp={endPanic}
              onMouseLeave={endPanic}
              onTouchStart={beginPanic}
              onTouchEnd={endPanic}
              className={
                "relative h-8 border border-[#FF3B30]/60 bg-black overflow-hidden cursor-pointer " +
                (panicHold >= 100 ? "gf-redglow" : "")
              }
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#FF3B30]/30 transition-[width] duration-75"
                style={{ width: panicHold + "%" }}
              />
              {/* tick marks at 33/66/100 */}
              {[33, 66, 100].map((p) => (
                <span
                  key={"tk-" + p}
                  className="absolute top-0 bottom-0 w-px bg-[#FF6B61]/45"
                  style={{ left: "calc(" + p + "% - 0.5px)" }}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-[0.3em] uppercase">
                {panicHold >= 100 ? (
                  <span className="text-[#FF6B61]">wiped</span>
                ) : (
                  <span className="text-[#FF6B61]/90">
                    panic_wipe {panicHold > 0 ? panicHold + "%" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapReconGrid;

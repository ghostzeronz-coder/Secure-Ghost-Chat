import { useEffect, useRef, useState } from "react";
import {
  Activity,
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

// Abstract continent outlines (low-fidelity hand-traced silhouettes in equirectangular space).
const CONTINENT_PATHS: string[] = [
  // North America
  "M 60 130 L 110 110 L 150 115 L 175 140 L 168 170 L 140 200 L 120 230 L 95 245 L 78 220 L 62 195 L 55 160 Z",
  // Central America sliver
  "M 120 230 L 140 245 L 138 260 L 122 252 Z",
  // South America
  "M 140 270 L 165 275 L 175 305 L 168 345 L 150 380 L 138 395 L 130 370 L 132 330 L 138 295 Z",
  // Greenland
  "M 190 95 L 215 92 L 218 115 L 198 122 L 188 110 Z",
  // Europe
  "M 215 135 L 250 128 L 268 140 L 260 160 L 240 168 L 222 162 L 212 150 Z",
  // Africa
  "M 225 185 L 268 180 L 285 215 L 282 260 L 265 295 L 248 320 L 232 295 L 222 255 L 220 215 Z",
  // Asia
  "M 268 130 L 340 118 L 385 130 L 395 165 L 380 195 L 345 205 L 305 195 L 282 175 L 270 155 Z",
  // India
  "M 320 195 L 340 200 L 338 230 L 325 240 L 315 220 Z",
  // SE Asia
  "M 360 215 L 385 225 L 380 250 L 365 240 Z",
  // Australia
  "M 370 290 L 415 285 L 425 315 L 405 330 L 378 322 L 368 305 Z",
  // Antarctica strip
  "M 30 430 L 420 430 L 420 455 L 30 455 Z",
];

export function Map() {
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
        const n = p + 3;
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

  // Arc from device to exit (quadratic with elevated control point)
  const midX = (deviceXY.x + exitXY.x) / 2;
  const midY = Math.min(deviceXY.y, exitXY.y) - 70;
  const arcPath = `M ${deviceXY.x} ${deviceXY.y} Q ${midX} ${midY} ${exitXY.x} ${exitXY.y}`;

  const activeContact = CONTACTS.find((c) => c.id === selectedContact) || null;
  const activeThreat = THREATS.find((t) => t.id === selectedThreat) || null;

  const hhmmss = now.toTimeString().slice(0, 8);

  const styleBlock =
    "@keyframes gf-pulse { 0% { r: 4; opacity: 1; } 100% { r: 18; opacity: 0; } }" +
    " @keyframes gf-dash { to { stroke-dashoffset: -40; } }" +
    " @keyframes gf-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }" +
    " @keyframes gf-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }" +
    " .gf-pulse-ring { transform-origin: center; animation: gf-pulse 2.2s ease-out infinite; }" +
    " .gf-arc { stroke-dasharray: 4 6; animation: gf-dash 1.6s linear infinite; }" +
    " .gf-conv { stroke-dasharray: 2 4; animation: gf-dash 2.4s linear infinite; }" +
    " .gf-scan { animation: gf-scan 6s linear infinite; }" +
    " .gf-blink { animation: gf-blink 1.4s ease-in-out infinite; }" +
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
      <div className="absolute inset-0 pt-9 pb-[34%]">
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
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern
                id="grid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 30 0 L 0 0 0 30"
                  fill="none"
                  stroke="#FFB800"
                  strokeOpacity="0.06"
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

            {/* Continents */}
            {CONTINENT_PATHS.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="#FFB800"
                fillOpacity="0.04"
                stroke="#FFB800"
                strokeOpacity="0.35"
                strokeWidth="0.7"
              />
            ))}

            {/* Exit glow halo */}
            <circle
              cx={exitXY.x}
              cy={exitXY.y}
              r="34"
              fill="url(#exitGlow)"
            />

            {/* Geodesic arc device -> exit */}
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
                fillOpacity="0.85"
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
              <text
                x={deviceXY.x + 6}
                y={deviceXY.y - 6}
                fill="#FFB800"
                fillOpacity="0.6"
                fontSize="7"
                className="gf-mono"
              >
                you
              </text>
            </g>

            {/* Exit node marker */}
            <g>
              <circle
                cx={exitXY.x}
                cy={exitXY.y}
                r="4"
                fill="#FFB800"
              />
              <circle
                cx={exitXY.x}
                cy={exitXY.y}
                r="4"
                fill="none"
                stroke="#FFB800"
                strokeWidth="1"
                className="gf-pulse-ring"
              />
              <rect
                x={exitXY.x + 7}
                y={exitXY.y - 14}
                width="62"
                height="11"
                fill="#000"
                stroke="#FFB800"
                strokeOpacity="0.45"
                strokeWidth="0.5"
              />
              <text
                x={exitXY.x + 10}
                y={exitXY.y - 6}
                fill="#FFB800"
                fontSize="7"
                className="gf-mono"
              >
                {EXIT.label}
              </text>
            </g>

            {/* Conversation lines (exit -> active contacts) */}
            {CONTACTS.filter((c) => c.active).map((c) => {
              const p = project(c.loc);
              const mx = (exitXY.x + p.x) / 2;
              const my = Math.min(exitXY.y, p.y) - 30;
              return (
                <path
                  key={`line-${c.id}`}
                  d={`M ${exitXY.x} ${exitXY.y} Q ${mx} ${my} ${p.x} ${p.y}`}
                  fill="none"
                  stroke="#FFB800"
                  strokeOpacity="0.35"
                  strokeWidth="0.8"
                  className="gf-conv"
                />
              );
            })}

            {/* Threat dots */}
            {THREATS.map((t) => {
              const p = project(t.loc);
              const sel = selectedThreat === t.id;
              return (
                <g
                  key={t.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedThreat(t.id);
                    setSelectedContact(null);
                  }}
                >
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
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="2"
                    fill="#FFB800"
                  />
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

          {/* Crosshair corners */}
          <div className="absolute top-2 left-2 w-4 h-4 border-l border-t border-[#FFB800]/40" />
          <div className="absolute top-2 right-2 w-4 h-4 border-r border-t border-[#FFB800]/40" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-l border-b border-[#FFB800]/40" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-r border-b border-[#FFB800]/40" />

          {/* Selection inspector chip */}
          {(activeContact || activeThreat) && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 border border-[#FFB800]/40 bg-black/90 text-[10px] px-3 py-2 max-w-[88%]">
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
        style={{ height: sheetExpanded ? "52%" : "32%" }}
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

        <div className="px-4 pb-4 h-full flex flex-col">
          {/* Exit node row */}
          <div className="flex items-center justify-between border border-[#FFB800]/25 bg-black/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-[#FFB800]" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#FFB800]/50">
                  exit node
                </span>
                <span className="text-[12px] text-[#FFB800]">
                  {EXIT.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[#FFB800]/50 uppercase tracking-[0.18em]">
                  lat
                </span>
                <span className="text-[#7CFFB2]">{EXIT.latencyMs}ms</span>
              </div>
              <div className="flex items-center gap-1 text-[#FFB800]/70">
                <Signal size={12} />
                <span>4/4</span>
              </div>
            </div>
          </div>

          {/* Rotate button */}
          <button
            onClick={() => setRotating(true)}
            className="mt-2 flex items-center justify-center gap-2 border border-[#FFB800]/40 text-[11px] uppercase tracking-[0.22em] text-[#FFB800] py-2 hover:bg-[#FFB800]/10 active:bg-[#FFB800]/20 transition"
          >
            <RefreshCw
              size={12}
              className={rotating ? "animate-spin" : ""}
            />
            {rotating ? "rotating exit…" : "rotate exit"}
          </button>

          {/* Threat counter strip */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-[#FFB800]/60">
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-[#FF6B61]" />
              <span className="uppercase tracking-[0.18em]">
                {THREATS.length} blocked · 24h
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={12} />
              <span>tx 1.2MB / rx 4.7MB</span>
            </div>
          </div>

          {sheetExpanded && (
            <div className="mt-3 flex-1 overflow-auto border-t border-[#FFB800]/15 pt-2 text-[10px] space-y-1.5">
              <div className="text-[#FFB800]/40 uppercase tracking-[0.22em] mb-1">
                recent intercepts
              </div>
              {THREATS.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-l-2 border-[#FF3B30]/60 pl-2"
                >
                  <span className="text-[#FFB800]/80">{t.tag}</span>
                  <span className="text-[#FFB800]/50">{t.vector}</span>
                  <span className="text-[#FFB800]/40">{t.blockedAt}</span>
                </div>
              ))}
            </div>
          )}

          {/* Panic wipe bar */}
          <div className="mt-auto pt-3">
            <div className="text-[9px] uppercase tracking-[0.25em] text-[#FF6B61]/70 mb-1 flex items-center gap-1.5">
              <Trash2 size={10} />
              hold to panic_wipe
            </div>
            <div
              onMouseDown={beginPanic}
              onMouseUp={endPanic}
              onMouseLeave={endPanic}
              onTouchStart={beginPanic}
              onTouchEnd={endPanic}
              className="relative h-8 border border-[#FF3B30]/60 bg-black overflow-hidden cursor-pointer"
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#FF3B30]/30 transition-[width] duration-75"
                style={{ width: `${panicHold}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-[0.3em] uppercase">
                {panicHold >= 100 ? (
                  <span className="text-[#FF6B61]">wiped</span>
                ) : (
                  <span className="text-[#FF6B61]/90">
                    panic_wipe {panicHold > 0 ? `${panicHold}%` : ""}
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

export default Map;

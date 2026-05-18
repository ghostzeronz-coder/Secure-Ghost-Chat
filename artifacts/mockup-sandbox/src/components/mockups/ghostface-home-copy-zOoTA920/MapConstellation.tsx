import { useEffect, useRef, useState } from "react";
import { ChevronUp, RefreshCw } from "lucide-react";

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

const HOLD_MS = 3000;

export function MapConstellation() {
  const [now, setNow] = useState<Date>(new Date());
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState<boolean>(false);
  const [rotating, setRotating] = useState<boolean>(false);
  const [panicHold, setPanicHold] = useState<number>(0);
  const [panicActive, setPanicActive] = useState<boolean>(false);
  const holdRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

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
    startRef.current = Date.now();
    setPanicActive(true);
    setPanicHold(0);
    holdRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
      setPanicHold(pct);
      if (pct >= 100) {
        if (holdRef.current) window.clearInterval(holdRef.current);
        holdRef.current = null;
      }
    }, 50);
  };

  const endPanic = () => {
    if (holdRef.current) window.clearInterval(holdRef.current);
    holdRef.current = null;
    if (panicHold < 100) {
      setPanicActive(false);
      setPanicHold(0);
    }
  };

  const exitXY = project(EXIT.loc);
  const deviceXY = project(DEVICE_LOC);

  const midX = (deviceXY.x + exitXY.x) / 2;
  const midY = Math.min(deviceXY.y, exitXY.y) - 70;
  const arcPath =
    "M " +
    deviceXY.x +
    " " +
    deviceXY.y +
    " Q " +
    midX +
    " " +
    midY +
    " " +
    exitXY.x +
    " " +
    exitXY.y;

  const activeContact = CONTACTS.find((c) => c.id === selectedContact) || null;
  const activeThreat = THREATS.find((t) => t.id === selectedThreat) || null;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const remaining = Math.max(0, (HOLD_MS - (panicHold / 100) * HOLD_MS) / 1000);

  const styleBlock =
    "@keyframes gfc-sweep { 0% { transform: translateY(-200px); } 100% { transform: translateY(100vh); } }" +
    " @keyframes gfc-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }" +
    " @keyframes gfc-breathe { 0% { r: 3; opacity: 0.6; } 100% { r: 8; opacity: 0; } }" +
    " @keyframes gfc-nova { 0% { r: 2; opacity: 0.6; } 100% { r: 14; opacity: 0; } }" +
    " .gfc-sweep { animation: gfc-sweep 12s linear infinite; }" +
    " .gfc-twinkle { animation: gfc-twinkle 4.2s ease-in-out infinite; transform-origin: center; }" +
    " .gfc-breathe { transform-origin: center; animation: gfc-breathe 2.5s ease-out infinite; }" +
    " .gfc-nova { transform-origin: center; animation: gfc-nova 3.5s ease-out infinite; }" +
    " .gfc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }";

  const twinkleDelays = ["0s", "1.1s", "2.3s", "3.4s"];

  return (
    <div className="h-[100dvh] w-full bg-black text-[#FFB800] gfc-mono overflow-hidden relative select-none">
      <style dangerouslySetInnerHTML={{ __html: styleBlock }} />

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.18em] border-b border-[#FFB800]/10 bg-black/85 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[#FFB800]/70">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFB800]/70" />
          <span>GHOSTFACE</span>
          <span className="text-[#FFB800]/30">//</span>
          <span>cs:0xA17F</span>
        </div>
        <div className="flex items-center gap-3 text-[#FFB800]/70">
          <span className="gfc-mono">
            {hh}
            <span className="text-[#FFB800]/30">·</span>
            {mm}
            <span className="text-[#FFB800]/30">·</span>
            {ss}Z
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-px bg-[#FFB800]/70" />
            <span className="inline-block w-1 h-1 rounded-full bg-[#FFB800]/70" />
            <span>ONLINE</span>
          </span>
        </div>
      </div>

      {/* Map area */}
      <div className="absolute inset-0 pt-9 pb-[34%]">
        <div className="relative w-full h-full overflow-hidden">
          {/* sector caption */}
          <div className="absolute top-2 left-3 z-10 text-[7px] tracking-[0.22em] text-[#FFB800]/40 gfc-mono uppercase">
            SECTOR · NORTH ATLANTIC / 04 ACTIVE / 06 BLOCKED
          </div>

          {/* slow gradient sweep */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute left-0 right-0 gfc-sweep"
              style={{
                top: 0,
                height: "200px",
                background:
                  "linear-gradient(to bottom, rgba(255,184,0,0) 0%, rgba(255,184,0,0.06) 50%, rgba(255,184,0,0) 100%)",
              }}
            />
          </div>

          {/* SVG world */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={"0 0 " + MAP_W + " " + MAP_H}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern
                id="cgrid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 30 0 L 0 0 0 30"
                  fill="none"
                  stroke="#FFB800"
                  strokeOpacity="0.025"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width={MAP_W} height={MAP_H} fill="url(#cgrid)" />

            {/* Continents — dimmed */}
            {CONTINENT_PATHS.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="#FFB800"
                fillOpacity="0.015"
                stroke="#FFB800"
                strokeOpacity="0.12"
                strokeWidth="0.5"
              />
            ))}

            {/* Arc device → exit (kept hairline) */}
            <path
              id="gfc-arc"
              d={arcPath}
              fill="none"
              stroke="#FFB800"
              strokeOpacity="0.22"
              strokeWidth="0.5"
            />

            {/* Filament lines exit → active contacts + photons */}
            {CONTACTS.filter((c) => c.active).map((c, idx) => {
              const p = project(c.loc);
              const mx = (exitXY.x + p.x) / 2;
              const my = Math.min(exitXY.y, p.y) - 30;
              const filamentPath =
                "M " +
                exitXY.x +
                " " +
                exitXY.y +
                " Q " +
                mx +
                " " +
                my +
                " " +
                p.x +
                " " +
                p.y;
              const pathId = "fil-" + c.id;
              const dur = 4 + idx * 0.4 + "s";
              const begin = idx * 1.1 + "s";
              return (
                <g key={"f-" + c.id}>
                  <path
                    id={pathId}
                    d={filamentPath}
                    fill="none"
                    stroke="#FFB800"
                    strokeOpacity="0.25"
                    strokeWidth="0.5"
                  />
                  <circle r="1" fill="#FFB800" fillOpacity="0.9">
                    <animateMotion
                      dur={dur}
                      begin={begin}
                      repeatCount="indefinite"
                      rotate="auto"
                    >
                      <mpath href={"#" + pathId} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}

            {/* Device marker — cross + breathing halo */}
            <g>
              <line
                x1={deviceXY.x - 4}
                y1={deviceXY.y}
                x2={deviceXY.x + 4}
                y2={deviceXY.y}
                stroke="#FFB800"
                strokeWidth="1"
                strokeOpacity="0.9"
              />
              <line
                x1={deviceXY.x}
                y1={deviceXY.y - 4}
                x2={deviceXY.x}
                y2={deviceXY.y + 4}
                stroke="#FFB800"
                strokeWidth="1"
                strokeOpacity="0.9"
              />
              <circle
                cx={deviceXY.x}
                cy={deviceXY.y}
                r="3"
                fill="none"
                stroke="#FFB800"
                strokeWidth="0.5"
                className="gfc-breathe"
              />
              <text
                x={deviceXY.x + 7}
                y={deviceXY.y - 5}
                fill="#FFB800"
                fillOpacity="0.55"
                fontSize="6"
                letterSpacing="1"
                className="gfc-mono"
              >
                DEV
              </text>
            </g>

            {/* Exit node — brighter star */}
            <g>
              <line
                x1={exitXY.x - 5}
                y1={exitXY.y}
                x2={exitXY.x + 5}
                y2={exitXY.y}
                stroke="#FFB800"
                strokeWidth="1"
              />
              <line
                x1={exitXY.x}
                y1={exitXY.y - 5}
                x2={exitXY.x}
                y2={exitXY.y + 5}
                stroke="#FFB800"
                strokeWidth="1"
              />
              <circle cx={exitXY.x} cy={exitXY.y} r="1.3" fill="#FFB800" />
              <circle
                cx={exitXY.x}
                cy={exitXY.y}
                r="5"
                fill="none"
                stroke="#FFB800"
                strokeOpacity="0.4"
                strokeWidth="0.5"
              />
              <text
                x={exitXY.x + 9}
                y={exitXY.y - 4}
                fill="#FFB800"
                fillOpacity="0.75"
                fontSize="7"
                className="gfc-mono"
              >
                {EXIT.label}
              </text>
              <line
                x1={exitXY.x + 9}
                y1={exitXY.y - 2}
                x2={exitXY.x + 9 + EXIT.label.length * 4.1}
                y2={exitXY.y - 2}
                stroke="#FFB800"
                strokeOpacity="0.3"
                strokeWidth="0.5"
              />
            </g>

            {/* Threat supernovae */}
            {THREATS.map((t) => {
              const p = project(t.loc);
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
                    r="1.5"
                    fill="#FF3B30"
                    fillOpacity="0.9"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="2"
                    fill="none"
                    stroke="#FF3B30"
                    strokeWidth="0.6"
                    className="gfc-nova"
                  />
                  <text
                    x={p.x + 5}
                    y={p.y + 3}
                    fill="#FF6B61"
                    fillOpacity="0.6"
                    fontSize="6"
                    className="gfc-mono"
                  >
                    {t.tag}
                  </text>
                </g>
              );
            })}

            {/* Contact stars */}
            {CONTACTS.map((c, i) => {
              const p = project(c.loc);
              const delay = twinkleDelays[i % twinkleDelays.length];
              return (
                <g
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedContact(c.id);
                    setSelectedThreat(null);
                  }}
                >
                  <g
                    className="gfc-twinkle"
                    style={{ animationDelay: delay }}
                  >
                    <line
                      x1={p.x - 5}
                      y1={p.y}
                      x2={p.x + 5}
                      y2={p.y}
                      stroke="#FFB800"
                      strokeWidth="1"
                      strokeOpacity={c.active ? 0.95 : 0.5}
                    />
                    <line
                      x1={p.x}
                      y1={p.y - 5}
                      x2={p.x}
                      y2={p.y + 5}
                      stroke="#FFB800"
                      strokeWidth="1"
                      strokeOpacity={c.active ? 0.95 : 0.5}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="1.2"
                      fill="#FFB800"
                      fillOpacity={c.active ? 1 : 0.45}
                    />
                    {c.active && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="6"
                        fill="none"
                        stroke="#FFB800"
                        strokeOpacity="0.35"
                        strokeWidth="0.5"
                      />
                    )}
                  </g>
                  {c.unread > 0 && (
                    <circle
                      cx={p.x + 6}
                      cy={p.y - 6}
                      r="1.6"
                      fill="#FF3B30"
                    />
                  )}
                  <text
                    x={p.x + 8}
                    y={p.y - 7}
                    fill="#FFB800"
                    fillOpacity="0.7"
                    fontSize="6"
                    letterSpacing="0.5"
                    className="gfc-mono"
                  >
                    {c.callsign}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Crosshair corners — softer, smaller */}
          <div className="absolute top-2 left-2 w-[3px] h-[3px] border-l border-t border-[#FFB800]/20" />
          <div className="absolute top-2 right-2 w-[3px] h-[3px] border-r border-t border-[#FFB800]/20" />
          <div className="absolute bottom-2 left-2 w-[3px] h-[3px] border-l border-b border-[#FFB800]/20" />
          <div className="absolute bottom-2 right-2 w-[3px] h-[3px] border-r border-b border-[#FFB800]/20" />

          {/* Selection inspector chip */}
          {(activeContact || activeThreat) && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 border border-[#FFB800]/18 bg-black/90 text-[10px] px-3 py-2 max-w-[88%]">
              {activeContact && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#FFB800]/80 tracking-[0.18em]">
                      {activeContact.callsign}
                    </span>
                    <span className="text-[#FFB800]/45">
                      {activeContact.city}
                    </span>
                  </div>
                  <div className="text-[#FFB800]/55">
                    routed via {EXIT.label} → tap to open chat
                  </div>
                </div>
              )}
              {activeThreat && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#FF6B61]/80 tracking-[0.18em]">
                      BLOCKED · {activeThreat.tag}
                    </span>
                    <span className="text-[#FFB800]/45">
                      {activeThreat.blockedAt}
                    </span>
                  </div>
                  <div className="text-[#FFB800]/55">
                    {activeThreat.city} — vector: {activeThreat.vector}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet — TELEMETRY */}
      <div
        className="absolute left-0 right-0 bottom-0 z-30 border-t border-[#FFB800]/18 bg-[#070707] transition-[height] duration-300 ease-out"
        style={{ height: sheetExpanded ? "52%" : "34%" }}
      >
        <div className="w-full flex flex-col items-center pt-2">
          <div className="text-[8px] tracking-[0.32em] text-[#FFB800]/55 gfc-mono uppercase">
            TELEMETRY
          </div>
          <button
            onClick={() => setSheetExpanded((s) => !s)}
            className="w-full flex flex-col items-center pt-1 pb-1"
            aria-label="toggle sheet"
          >
            <div className="w-8 h-px bg-[#FFB800]/25" />
            <ChevronUp
              size={11}
              className={
                "mt-1 text-[#FFB800]/40 transition-transform " +
                (sheetExpanded ? "rotate-180" : "")
              }
            />
          </button>
        </div>

        <div className="px-4 pb-4 h-full flex flex-col">
          {/* Exit node row */}
          <div className="flex items-center justify-between border border-[#FFB800]/18 bg-black/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] uppercase tracking-[0.24em] text-[#FFB800]/55">
                  exit node
                </span>
                <span className="text-[12px] text-[#FFB800]/85 gfc-mono">
                  {EXIT.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[#FFB800]/55 uppercase tracking-[0.2em] text-[9px]">
                  lat
                </span>
                <span className="text-[#FFB800]/75 gfc-mono">
                  {EXIT.latencyMs}ms
                </span>
              </div>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[#FFB800]/55 uppercase tracking-[0.2em] text-[9px]">
                  link
                </span>
                <span className="text-[#FFB800]/75 gfc-mono">4/4</span>
              </div>
            </div>
          </div>

          {/* Rotate button */}
          <button
            onClick={() => setRotating(true)}
            className="mt-2 flex items-center justify-center gap-2 border border-[#FFB800]/18 text-[10px] uppercase tracking-[0.28em] text-[#FFB800]/75 py-2 hover:bg-[#FFB800]/5 active:bg-[#FFB800]/10 transition gfc-mono"
          >
            {rotating && <RefreshCw size={10} className="animate-spin" />}
            <span>·&nbsp;&nbsp;ROTATE EXIT&nbsp;&nbsp;·</span>
          </button>

          {/* Threat counter strip */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-[#FFB800]/55 gfc-mono">
            <span className="uppercase tracking-[0.22em]">
              {THREATS.length} blocked · 24h
            </span>
            <span className="uppercase tracking-[0.22em]">
              tx 1.2MB / rx 4.7MB
            </span>
          </div>

          {sheetExpanded && (
            <div className="mt-3 flex-1 overflow-auto border-t border-[#FFB800]/15 pt-2 text-[10px] space-y-1">
              <div className="text-[#FFB800]/40 uppercase tracking-[0.24em] mb-1 text-[9px]">
                recent intercepts
              </div>
              {THREATS.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 gfc-mono text-[10px]"
                >
                  <span className="text-[#FFB800]/75 w-10">{t.tag}</span>
                  <div
                    className="flex-1"
                    style={{
                      borderBottom: "1px dotted rgba(255,184,0,0.25)",
                      transform: "translateY(-3px)",
                    }}
                  />
                  <span className="text-[#FFB800]/55">{t.vector}</span>
                  <div
                    className="flex-1"
                    style={{
                      borderBottom: "1px dotted rgba(255,184,0,0.25)",
                      transform: "translateY(-3px)",
                    }}
                  />
                  <span className="text-[#FFB800]/45">{t.blockedAt}</span>
                </div>
              ))}
            </div>
          )}

          {/* Panic wipe */}
          <div className="mt-auto pt-3">
            <div className="text-[9px] uppercase tracking-[0.3em] text-[#FF6B61]/60 mb-1 text-center gfc-mono">
              ·&nbsp;&nbsp;HOLD TO WIPE&nbsp;&nbsp;·
            </div>
            {/* Tick marks above bar */}
            <div className="relative h-3 mb-0.5">
              <div className="absolute inset-0 flex">
                <div className="flex-1" />
                <div
                  className="text-[#FF6B61]/40 text-[9px] -translate-x-1/2"
                  style={{ position: "absolute", left: "33.33%" }}
                >
                  ✦
                </div>
                <div
                  className="text-[#FF6B61]/40 text-[9px] -translate-x-1/2"
                  style={{ position: "absolute", left: "66.66%" }}
                >
                  ✦
                </div>
                <div
                  className="text-[#FF6B61]/40 text-[9px] -translate-x-1/2"
                  style={{ position: "absolute", left: "100%" }}
                >
                  ✦
                </div>
              </div>
            </div>
            <div
              onMouseDown={beginPanic}
              onMouseUp={endPanic}
              onMouseLeave={endPanic}
              onTouchStart={beginPanic}
              onTouchEnd={endPanic}
              className="relative h-7 border border-[#FF3B30]/40 bg-black overflow-hidden cursor-pointer"
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#FF3B30]/35 transition-[width] duration-75"
                style={{ width: panicHold + "%" }}
              />
              {panicActive && (
                <div className="absolute inset-0 flex items-center justify-center text-[#FFB800]/85 gfc-mono text-[11px]">
                  {remaining.toFixed(1)}
                </div>
              )}
              {panicHold >= 100 && (
                <div className="absolute inset-0 flex items-center justify-center text-[#FF6B61] gfc-mono text-[10px] tracking-[0.3em]">
                  WIPED
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

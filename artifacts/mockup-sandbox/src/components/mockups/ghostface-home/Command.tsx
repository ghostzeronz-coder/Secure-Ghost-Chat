import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ArrowUpRight,
  User,
  Clock,
  RotateCw,
  Flame,
  ShieldCheck,
  Lock,
  Globe,
  Plus,
  Key,
  Trash2,
} from 'lucide-react';

const PLACEHOLDERS = [
  'call EDOX_RAVEN',
  'burn message_4471',
  'rotate exit zurich',
  'wipe device',
  'compose to PHANTOM_9',
];

const CONTACTS = [
  { alias: 'EDOX_RAVEN', seen: '2m ago' },
  { alias: 'PHANTOM_9', seen: '14m ago' },
  { alias: 'NULL_VECTOR', seen: '3h ago' },
];

const RECENT = [
  { icon: RotateCw, text: 'rotated VPN to ch-zurich-04', when: '2m ago' },
  { icon: Flame, text: 'burned 4 messages', when: '18m ago' },
  { icon: ShieldCheck, text: 'verified key for EDOX', when: '1h ago' },
];

const SYSTEM = [
  { icon: Lock, label: 'Lock identity', kbd: '⇧L' },
  { icon: Globe, label: 'Rotate exit node', kbd: '⇧R' },
  { icon: Plus, label: 'Compose burner', kbd: '⇧B' },
];

export function Command() {
  const [phIndex, setPhIndex] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const [fuzzy, setFuzzy] = useState(true);
  const [rotation, setRotation] = useState(3600 * 6 + 1247);
  const [armed, setArmed] = useState(0);
  const armRef = useRef<number | null>(null);

  useEffect(() => {
    const i = setInterval(() => {
      setPhIndex((p) => (p + 1) % PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const i = setInterval(() => setCursorOn((c) => !c), 530);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const i = setInterval(() => setRotation((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(i);
  }, []);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return (
      h.toString().padStart(2, '0') +
      ':' +
      m.toString().padStart(2, '0') +
      ':' +
      ss.toString().padStart(2, '0')
    );
  };

  const startArm = () => {
    if (armRef.current) window.clearInterval(armRef.current);
    armRef.current = window.setInterval(() => {
      setArmed((a) => {
        if (a >= 100) {
          if (armRef.current) window.clearInterval(armRef.current);
          return 100;
        }
        return a + 4;
      });
    }, 40);
  };
  const stopArm = () => {
    if (armRef.current) window.clearInterval(armRef.current);
    armRef.current = null;
    setArmed(0);
  };

  return (
    <div className="h-[100dvh] w-full bg-[#050505] text-[#FFB800] font-mono flex flex-col overflow-hidden select-none relative">
      <div
        dangerouslySetInnerHTML={{
          __html:
            "<style>" +
            ".cmd-scan{background-image:repeating-linear-gradient(0deg,rgba(255,184,0,0.025) 0px,rgba(255,184,0,0.025) 1px,transparent 1px,transparent 3px);}" +
            ".cmd-grain:after{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,184,0,0.04) 1px,transparent 1px);background-size:3px 3px;mix-blend-mode:overlay;}" +
            "</style>",
        }}
      />

      {/* TOP 35% — input region */}
      <section className="cmd-scan relative px-5 pt-6 pb-4 border-b border-[#FFB800]/15" style={{ height: '35%' }}>
        <div className="flex items-center justify-between text-[10px] tracking-widest">
          <div className="flex items-center gap-1.5 text-[#FFB800]/80">
            <span>GHOST_00</span>
            <span className={cursorOn ? 'opacity-100' : 'opacity-0'}>▮</span>
          </div>
          <button
            onClick={() => setFuzzy((f) => !f)}
            className="flex items-center gap-2 text-[#FFB800]/60 hover:text-[#FFB800] transition-colors"
          >
            <span>fuzzy match:</span>
            <span
              className={
                'px-1.5 py-0.5 border ' +
                (fuzzy
                  ? 'border-[#22C55E]/50 text-[#22C55E] bg-[#22C55E]/5'
                  : 'border-[#FFB800]/30 text-[#FFB800]/50')
              }
            >
              {fuzzy ? 'on' : 'off'}
            </span>
          </button>
        </div>

        <div className="mt-6 flex items-start gap-3">
          <Search size={22} className="text-[#FFB800]/50 mt-2 shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[26px] leading-tight tracking-tight text-white/95 truncate">
              <span className="text-[#FFB800]/40">$ </span>
              <span className="text-[#FFB800]/80">{PLACEHOLDERS[phIndex]}</span>
              <span className={cursorOn ? 'inline-block w-[10px] -mb-[2px] ml-1 h-[22px] bg-[#FFB800]' : 'inline-block w-[10px] ml-1 h-[22px] bg-transparent'} />
            </div>
            <div className="mt-3 text-[10px] text-[#FFB800]/40 tracking-widest">
              TYPE_INTENT → PRESS_RETURN_TO_EXECUTE
            </div>
          </div>
        </div>

        <div className="absolute left-5 right-5 bottom-3 flex items-center justify-between text-[9px] text-[#FFB800]/40 tracking-widest">
          <span>NO_HISTORY · NO_TELEMETRY</span>
          <span>v0.4.1-paranoid</span>
        </div>
      </section>

      {/* SUGGESTIONS */}
      <section className="cmd-grain relative flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* CONTACTS */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] tracking-[0.2em] text-[#FFB800]/50">CONTACTS</span>
            <span className="text-[9px] text-[#FFB800]/30">3 matches</span>
          </div>
          <div className="border border-[#FFB800]/10 divide-y divide-[#FFB800]/10 bg-[#FFB800]/[0.02]">
            {CONTACTS.map((c) => (
              <div
                key={c.alias}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#FFB800]/5 transition-colors"
              >
                <div className="w-6 h-6 border border-[#FFB800]/30 flex items-center justify-center">
                  <User size={12} className="text-[#FFB800]/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-white tracking-tight truncate">{c.alias}</div>
                  <div className="text-[9px] text-[#FFB800]/40 tracking-widest mt-0.5">
                    LAST_SEEN · {c.seen}
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-[#FFB800]/40" />
              </div>
            ))}
          </div>
        </div>

        {/* RECENT ACTIONS */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] tracking-[0.2em] text-[#FFB800]/50">RECENT_ACTIONS</span>
            <Clock size={10} className="text-[#FFB800]/30" />
          </div>
          <div className="border border-[#FFB800]/10 divide-y divide-[#FFB800]/10 bg-[#FFB800]/[0.02]">
            {RECENT.map((r, idx) => {
              const Icon = r.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-[#FFB800]/5 transition-colors"
                >
                  <Icon size={12} className="text-[#FFB800]/60 shrink-0" />
                  <div className="flex-1 min-w-0 text-[12px] text-white/85 truncate">
                    {r.text}
                  </div>
                  <span className="text-[9px] text-[#FFB800]/40 tracking-widest shrink-0">
                    {r.when}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SYSTEM */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] tracking-[0.2em] text-[#FFB800]/50">SYSTEM</span>
            <span className="text-[9px] text-[#FFB800]/30">⌘ shortcuts</span>
          </div>
          <div className="border border-[#FFB800]/10 divide-y divide-[#FFB800]/10 bg-[#FFB800]/[0.02]">
            {SYSTEM.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#FFB800]/5 transition-colors"
                >
                  <Icon size={12} className="text-[#FFB800]/70 shrink-0" />
                  <div className="flex-1 text-[12px] text-white/90">{s.label}</div>
                  <span className="text-[10px] text-[#FFB800] border border-[#FFB800]/40 px-1.5 py-0.5 tracking-widest bg-[#FFB800]/5">
                    {s.kbd}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-2" />
      </section>

      {/* STATUS STRIP */}
      <div className="px-4 py-2 border-t border-[#FFB800]/15 flex items-center justify-between text-[9px] tracking-widest bg-black/40">
        <div className="flex items-center gap-1.5 text-[#FFB800]/70">
          <Key size={9} className="text-[#FFB800]/50" />
          <span>CHACHA20-POLY1305</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#FFB800]/70 tabular-nums">
          <span className="text-[#FFB800]/40">ROTATE_IN</span>
          <span className="text-white">{fmt(rotation)}</span>
        </div>
      </div>

      {/* PANIC WIPE BAR — silent, hold to arm */}
      <div className="px-4 pb-3 pt-2 bg-black">
        <button
          onMouseDown={startArm}
          onMouseUp={stopArm}
          onMouseLeave={stopArm}
          onTouchStart={startArm}
          onTouchEnd={stopArm}
          className="relative w-full h-11 border border-[#FF3B30]/60 bg-[#FF3B30]/[0.06] flex items-center justify-center overflow-hidden group"
        >
          <div
            className="absolute inset-y-0 left-0 bg-[#FF3B30]/30 transition-[width] duration-75 ease-linear"
            style={{ width: armed + '%' }}
          />
          <div className="relative flex items-center gap-2 text-[#FF3B30] tracking-[0.25em] text-[11px]">
            <Trash2 size={13} />
            <span>{armed >= 100 ? 'WIPE_READY' : armed > 0 ? 'HOLD_TO_WIPE…' : 'PANIC_WIPE'}</span>
          </div>
          <div className="absolute right-2 top-1 text-[8px] text-[#FF3B30]/60 tracking-widest">
            HOLD
          </div>
        </button>
      </div>
    </div>
  );
}

export default Command;

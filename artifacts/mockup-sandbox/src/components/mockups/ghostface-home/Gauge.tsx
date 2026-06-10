import React, { useEffect, useState } from 'react';
import { AlertTriangle, MessageSquare } from 'lucide-react';

export function Gauge() {
  const trust = 94;
  const threatPct = 3;

  const [breath, setBreath] = useState(1);
  const [syncedAgo, setSyncedAgo] = useState(2);

  useEffect(() => {
    let toggle = false;
    const id = setInterval(() => {
      toggle = !toggle;
      setBreath(toggle ? 0.85 : 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSyncedAgo((s) => (s >= 59 ? 1 : s + 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const outerR = 140;
  const outerC = 2 * Math.PI * outerR;
  const outerDash = (trust / 100) * outerC;

  const innerR = 108;
  const innerC = 2 * Math.PI * innerR;
  const threatDash = (threatPct / 100) * innerC;
  const safeDash = ((100 - threatPct) / 100) * innerC;

  const segments = [
    { label: 'VPN', status: 'ok', mark: '✓' },
    { label: 'KEYS FRESH', status: 'ok', mark: '✓' },
    { label: 'OPK LOW', status: 'warn', mark: '⚠' },
  ];

  const styleBlock = ".gf-breathe-glow{filter:drop-shadow(0 0 12px rgba(255,184,0,0.35))}.gf-hazard{background-image:repeating-linear-gradient(45deg,#1a0a0a 0 8px,#2a0e0e 8px 16px)}";

  return (
    <div className="h-[100dvh] w-full bg-[#050505] text-[#FFB800] font-mono flex flex-col select-none overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: styleBlock }} />

      {/* Header */}
      <header className="flex justify-between items-center px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <span className="text-[10px] tracking-[0.25em] text-white/80">GHOST_00</span>
        </div>
        <div className="text-[9px] tracking-widest text-[#FFB800]/50">
          SYNCED {syncedAgo}s AGO
        </div>
      </header>

      {/* Gauge — center ~60% */}
      <div className="flex-1 flex items-center justify-center relative">
        <div className="relative" style={{ width: 340, height: 340 }}>
          <svg
            width="340"
            height="340"
            viewBox="0 0 340 340"
            className="block"
          >
            <defs>
              <linearGradient id="gfAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFD24A" />
                <stop offset="100%" stopColor="#FFB800" />
              </linearGradient>
            </defs>

            {/* Tick marks */}
            <g opacity="0.18">
              {Array.from({ length: 60 }).map((_, i) => {
                const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
                const x1 = 170 + Math.cos(angle) * 162;
                const y1 = 170 + Math.sin(angle) * 162;
                const x2 = 170 + Math.cos(angle) * 168;
                const y2 = 170 + Math.sin(angle) * 168;
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#FFB800"
                    strokeWidth={i % 5 === 0 ? 1.5 : 0.5}
                  />
                );
              })}
            </g>

            {/* Outer track */}
            <circle
              cx="170"
              cy="170"
              r={outerR}
              fill="none"
              stroke="#1a1408"
              strokeWidth="14"
            />

            {/* Outer trust arc — breathing */}
            <g
              transform="rotate(-90 170 170)"
              className="gf-breathe-glow"
              style={{
                opacity: breath,
                transition: 'opacity 2s ease-in-out',
              }}
            >
              <circle
                cx="170"
                cy="170"
                r={outerR}
                fill="none"
                stroke="url(#gfAmber)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${outerDash} ${outerC - outerDash}`}
              />
            </g>

            {/* Inner track */}
            <circle
              cx="170"
              cy="170"
              r={innerR}
              fill="none"
              stroke="#0f0f0f"
              strokeWidth="6"
            />

            {/* Inner: safe (dim amber) + threat (red wedge) */}
            <g transform="rotate(-90 170 170)">
              <circle
                cx="170"
                cy="170"
                r={innerR}
                fill="none"
                stroke="#FFB800"
                strokeOpacity="0.35"
                strokeWidth="6"
                strokeDasharray={`${safeDash} ${innerC - safeDash}`}
              />
              <circle
                cx="170"
                cy="170"
                r={innerR}
                fill="none"
                stroke="#EF4444"
                strokeWidth="6"
                strokeDasharray={`${threatDash} ${innerC - threatDash}`}
                strokeDashoffset={-safeDash}
              />
            </g>

            {/* Cross-hair micro marks */}
            <g stroke="#FFB800" strokeOpacity="0.25" strokeWidth="1">
              <line x1="170" y1="14" x2="170" y2="22" />
              <line x1="170" y1="318" x2="170" y2="326" />
              <line x1="14" y1="170" x2="22" y2="170" />
              <line x1="318" y1="170" x2="326" y2="170" />
            </g>
          </svg>

          {/* Center readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-start leading-none">
              <span
                className="text-[#FFB800] font-mono font-light tabular-nums"
                style={{ fontSize: 116, letterSpacing: '-0.04em' }}
              >
                {trust}
              </span>
              <span className="text-[#FFB800]/70 text-2xl mt-3 ml-1 font-mono">
                %
              </span>
            </div>
            <div className="mt-2 text-[10px] tracking-[0.3em] text-white/80">
              POSTURE: <span className="text-[#22C55E]">STRONG</span>
            </div>
            <div className="mt-1 text-[8px] tracking-[0.25em] text-[#FFB800]/40">
              TRUST_INDEX · v1
            </div>
          </div>
        </div>
      </div>

      {/* Segment indicators */}
      <div className="flex justify-center gap-3 px-5 pb-2">
        {segments.map((s) => {
          const isWarn = s.status === 'warn';
          return (
            <div
              key={s.label}
              className={
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] tracking-[0.18em] ' +
                (isWarn
                  ? 'border-[#FFB800]/70 text-[#FFB800] bg-[#FFB800]/5'
                  : 'border-white/10 text-white/30')
              }
            >
              <span>{s.label}</span>
              <span className={isWarn ? 'text-[#FFB800]' : 'text-white/30'}>
                {s.mark}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom 20% — single action + panic wipe */}
      <div className="px-6 pt-4 pb-6 flex flex-col gap-3">
        <button
          type="button"
          className="w-full border border-[#FFB800] text-[#FFB800] rounded-full py-3 flex items-center justify-center gap-2 hover:bg-[#FFB800]/10 active:scale-[0.99] transition"
        >
          <MessageSquare size={14} />
          <span className="text-[11px] tracking-[0.3em] font-bold">
            OPEN CHANNELS
          </span>
        </button>

        <button
          type="button"
          className="w-full gf-hazard border border-[#EF4444]/60 rounded-sm py-3 flex items-center justify-center gap-2 active:scale-[0.99] transition"
        >
          <AlertTriangle size={13} className="text-white/90" />
          <span className="text-[10px] tracking-[0.4em] text-white/90 font-bold">
            PANIC_WIPE
          </span>
        </button>
      </div>
    </div>
  );
}

export default Gauge;

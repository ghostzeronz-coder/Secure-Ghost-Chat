import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Phone, Shield, Wallet, Lock, ChevronDown } from 'lucide-react';

const FONT_CSS = "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@100;300;400&display=swap');@property --vault-sweep-angle{syntax:'<angle>';inherits:false;initial-value:0deg;}@keyframes vault-sweep{from{--vault-sweep-angle:0deg;}to{--vault-sweep-angle:360deg;}}.vault-sweep-host{animation:vault-sweep 24s linear infinite;}.vault-ray-rot{transform:rotate(var(--vault-sweep-angle));transform-origin:center center;}@supports not (background: conic-gradient(from 0deg, red, blue)){.vault-sweep-trail{background:transparent !important;}}";

export function VaultCompass() {
  const [isRevealing, setIsRevealing] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [isSealed, setIsSealed] = useState(false);
  const [snapToPanic, setSnapToPanic] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeRaf = useRef<number | null>(null);
  const wipeStart = useRef<number | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRevealing || isSealed) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-reveal]')) return;
    holdTimer.current = setTimeout(() => {
      setIsRevealing(true);
    }, 300);
  };

  const handlePointerUp = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const stopWipe = () => {
    if (wipeRaf.current !== null) cancelAnimationFrame(wipeRaf.current);
    wipeRaf.current = null;
    wipeStart.current = null;
  };

  const wipeFrame = (ts: number) => {
    if (wipeStart.current === null) wipeStart.current = ts;
    const elapsed = ts - wipeStart.current;
    const p = Math.min(1, elapsed / 3000);
    setWipeProgress(p);
    if (p < 1) {
      wipeRaf.current = requestAnimationFrame(wipeFrame);
    } else {
      setIsSealed(true);
      setSnapToPanic(true);
      wipeRaf.current = null;
      wipeStart.current = null;
      snapTimer.current = setTimeout(() => {
        setSnapToPanic(false);
      }, 1200);
    }
  };

  const handleWipeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isSealed) return;
    wipeStart.current = null;
    wipeRaf.current = requestAnimationFrame(wipeFrame);
  };

  const handleWipeUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isSealed) return;
    stopWipe();
    setWipeProgress(0);
  };

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (wipeRaf.current !== null) cancelAnimationFrame(wipeRaf.current);
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, []);

  const GOLD = '#d4af37';
  const wipeCircumference = 2 * Math.PI * 9;
  const wipeDash = wipeCircumference * wipeProgress;

  const ringBorder = isRevealing ? 'rgba(212,175,55,0.22)' : '#1a1a1a';
  const tickColor = isRevealing ? 'rgba(212,175,55,0.55)' : '#2a2a2a';

  const trailGradient = isRevealing
    ? 'conic-gradient(from var(--vault-sweep-angle), rgba(212,175,55,0.06) 0deg, transparent 60deg)'
    : 'conic-gradient(from var(--vault-sweep-angle), rgba(26,26,26,0.5) 0deg, transparent 60deg)';

  return (
    <div
      className="relative w-full h-[100dvh] bg-black text-[#a3a3a3] overflow-hidden select-none font-sans"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(18,18,18,0.55) 0%, rgba(0,0,0,1) 75%)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      {/* PANIC WIPE — silent, top-right */}
      <div
        data-no-reveal
        className="absolute top-12 right-8 flex flex-col items-center cursor-pointer z-50"
        onPointerDown={handleWipeDown}
        onPointerUp={handleWipeUp}
        onPointerLeave={handleWipeUp}
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="rgba(212,175,55,0.06)"
              strokeWidth="1"
            />
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke={GOLD}
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray={wipeDash + ' ' + wipeCircumference}
              style={{ transition: wipeProgress === 0 ? 'stroke-dasharray 400ms ease-out' : 'none' }}
              opacity={isSealed ? 0.75 : 0.6}
            />
          </svg>
          <span
            className="font-serif leading-none"
            style={{
              fontSize: '10px',
              color: isSealed ? GOLD : 'rgba(212,175,55,0.5)',
              transition: 'color 700ms ease-out',
            }}
          >
            ▾
          </span>
        </div>
        <span
          className="font-mono uppercase mt-2 whitespace-nowrap"
          style={{
            fontSize: '7px',
            letterSpacing: '0.4em',
            color: isSealed ? 'rgba(212,175,55,0.7)' : 'transparent',
            transition: 'color 700ms ease-out',
          }}
        >
          SEALED
        </span>
      </div>

      {/* CENTER SEAL — compass/sundial */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: 240, height: 240 }}>
          {/* afterglow trail (conic) — sits inside ring */}
          <div
            className="vault-sweep-host vault-sweep-trail absolute rounded-full"
            style={{
              inset: 1,
              background: trailGradient,
              opacity: isRevealing ? 1 : 0.6,
              transition: 'opacity 900ms ease-out',
              maskImage: 'radial-gradient(circle, black 65%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(circle, black 65%, transparent 100%)',
            }}
          />

          {/* hairline ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid ' + ringBorder,
              transition: 'border-color 900ms ease-out',
            }}
          />

          {/* cardinal ticks (just outside ring) */}
          {/* 12 o'clock — doubled hairlines */}
          <div
            className="absolute"
            style={{
              top: -8,
              left: 'calc(50% - 2px)',
              width: '1px',
              height: '6px',
              background: tickColor,
              transition: 'background 700ms ease-out',
            }}
          />
          <div
            className="absolute"
            style={{
              top: -8,
              left: 'calc(50% + 2px)',
              width: '1px',
              height: '6px',
              background: tickColor,
              transition: 'background 700ms ease-out',
            }}
          />
          {/* 3 o'clock */}
          <div
            className="absolute"
            style={{
              right: -8,
              top: 'calc(50% - 0.5px)',
              width: '6px',
              height: '1px',
              background: tickColor,
              transition: 'background 700ms ease-out',
            }}
          />
          {/* 6 o'clock */}
          <div
            className="absolute"
            style={{
              bottom: -8,
              left: 'calc(50% - 0.5px)',
              width: '1px',
              height: '6px',
              background: tickColor,
              transition: 'background 700ms ease-out',
            }}
          />
          {/* 9 o'clock */}
          <div
            className="absolute"
            style={{
              left: -8,
              top: 'calc(50% - 0.5px)',
              width: '6px',
              height: '1px',
              background: tickColor,
              transition: 'background 700ms ease-out',
            }}
          />

          {/* sweeping ray wrapper */}
          <div
            className={snapToPanic ? 'absolute inset-0' : 'absolute inset-0 vault-sweep-host'}
            style={
              snapToPanic
                ? { transform: 'rotate(45deg)', transition: 'transform 500ms ease-out' }
                : undefined
            }
          >
            <div
              className={snapToPanic ? 'absolute' : 'absolute vault-ray-rot'}
              style={{
                top: '50%',
                left: '50%',
                width: '1px',
                height: '128px',
                marginLeft: '-0.5px',
                marginTop: '-128px',
                background: isRevealing ? 'rgba(212,175,55,0.4)' : 'rgba(160,160,160,0.18)',
                transformOrigin: snapToPanic ? '50% 100%' : undefined,
                transition: 'background 900ms ease-out, opacity 800ms ease-out',
                opacity: snapToPanic ? 0 : 1,
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                top: '50%',
                left: '50%',
                width: '4px',
                height: '4px',
                marginLeft: '-2px',
                marginTop: '-130px',
                background: isRevealing ? GOLD : 'rgba(170,170,170,0.25)',
                opacity: snapToPanic ? 0 : isRevealing ? 0.85 : 0.25,
                boxShadow: isRevealing ? '0 0 6px rgba(212,175,55,0.6)' : 'none',
                transition: 'background 900ms ease-out, opacity 800ms ease-out, box-shadow 900ms ease-out',
              }}
            />
          </div>

          {/* center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '22px',
                letterSpacing: '0.35em',
                color: isRevealing ? 'rgba(212,175,55,0.75)' : '#333',
                textShadow: isRevealing ? '0 0 10px rgba(212,175,55,0.18)' : 'none',
                transition: 'color 900ms ease-out, text-shadow 900ms ease-out',
                paddingLeft: '0.35em',
              }}
            >
              GHOST_00
            </span>
            <div style={{ height: 10 }} />
            <span
              className="font-mono uppercase"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                letterSpacing: '0.45em',
                color: isRevealing ? '#555' : '#2a2a2a',
                transition: 'color 900ms ease-out',
                paddingLeft: '0.45em',
              }}
            >
              {isRevealing ? 'HEADING · 042.7°' : 'HEADING · 000.0°'}
            </span>
          </div>
        </div>

        {/* bearing line below seal */}
        <div
          className="font-mono uppercase mt-8"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.4em',
            color: isRevealing ? '#555' : '#2a2a2a',
            transition: 'color 900ms ease-out',
            paddingLeft: '0.4em',
          }}
        >
          {isRevealing ? 'BEARING · LOCKED' : 'BEARING · TRUE_NORTH'}
        </div>
      </div>

      {/* BOTTOM AREA */}
      <div className="absolute bottom-0 inset-x-0 h-56 flex flex-col items-center justify-end pb-10 pointer-events-none">
        {/* REST hint */}
        <div
          className="absolute bottom-16 flex flex-col items-center gap-2"
          style={{
            opacity: isRevealing ? 0 : 1,
            transform: isRevealing ? 'translateY(8px)' : 'translateY(0)',
            filter: isRevealing ? 'blur(4px)' : 'none',
            transition: 'opacity 500ms ease-out, transform 500ms ease-out, filter 500ms ease-out',
          }}
        >
          <ChevronDown size={10} strokeWidth={1.25} className="text-[#444]" />
          <span
            className="font-mono uppercase"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.3em',
              color: '#444',
              paddingLeft: '0.3em',
            }}
          >
            HOLD TO SIGHT
          </span>
        </div>

        {/* REVEALED actions */}
        <div
          className="absolute bottom-20 flex items-center gap-1"
          style={{
            opacity: isRevealing ? 1 : 0,
            transform: isRevealing ? 'translateY(0)' : 'translateY(16px)',
            filter: isRevealing ? 'none' : 'blur(6px)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out, filter 700ms ease-out',
            pointerEvents: isRevealing ? 'auto' : 'none',
          }}
        >
          <ActionChip icon={<MessageSquare size={15} strokeWidth={1.25} />} label="MSG" />
          <Divider />
          <ActionChip icon={<Phone size={15} strokeWidth={1.25} />} label="CALL" />
          <Divider />
          <ActionChip icon={<Shield size={15} strokeWidth={1.25} />} label="VPN" active />
          <Divider />
          <ActionChip icon={<Wallet size={15} strokeWidth={1.25} />} label="WALLET" />
        </div>

        {/* LOCK pill */}
        <button
          data-no-reveal
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setIsRevealing(false); }}
          className="absolute bottom-6 flex items-center gap-1.5 px-3 py-1 rounded-full border bg-black/40 transition-all duration-500 hover:border-[#d4af37]/40"
          style={{
            borderColor: 'rgba(212,175,55,0.18)',
            opacity: isRevealing ? 1 : 0,
            transform: isRevealing ? 'translateY(0)' : 'translateY(6px)',
            pointerEvents: isRevealing ? 'auto' : 'none',
          }}
        >
          <Lock size={9} strokeWidth={1.5} className="text-[#888]" />
          <span
            className="font-mono uppercase"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              letterSpacing: '0.4em',
              color: 'rgba(212,175,55,0.65)',
              paddingLeft: '0.4em',
            }}
          >
            · LOCK ·
          </span>
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-6 h-[1px]" style={{ background: 'rgba(212,175,55,0.18)' }} />;
}

function ActionChip({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const ringBorder = active
    ? '1.5px solid rgba(212,175,55,0.55)'
    : hover
      ? '1px solid #444'
      : '1px solid #222';

  return (
    <div
      data-no-reveal
      className="flex flex-col items-center gap-3 w-16 cursor-pointer transition-transform duration-300 hover:-translate-y-1"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div className="relative w-10 h-10">
        {/* cardinal tick at top of chip */}
        {active ? (
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: -4,
              width: 0,
              height: 0,
              borderLeft: '3px solid transparent',
              borderRight: '3px solid transparent',
              borderTop: '4px solid #d4af37',
              opacity: 0.85,
            }}
          />
        ) : (
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: -3,
              width: '1px',
              height: '2px',
              background: '#d4af37',
              opacity: 0.55,
            }}
          />
        )}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
          style={{
            border: ringBorder,
            boxShadow: active ? 'inset 0 0 12px rgba(212,175,55,0.1)' : 'none',
            color: active ? '#d4af37' : hover ? '#ddd' : '#888',
            background: 'transparent',
          }}
        >
          {icon}
        </div>
      </div>
      <span
        className="font-mono uppercase"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          letterSpacing: '0.3em',
          color: active ? 'rgba(212,175,55,0.8)' : hover ? '#aaa' : '#555',
          transition: 'color 300ms ease-out',
          paddingLeft: '0.3em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

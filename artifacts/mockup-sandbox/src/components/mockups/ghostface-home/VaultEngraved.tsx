import React, { useState, useRef, useEffect } from 'react';

const FONT_CSS = "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@100;300;400;500&display=swap');@keyframes vault-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes vault-spin-rev{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}.vault-ring-spin{animation:vault-spin 120s linear infinite}.vault-ring-spin-rev{animation:vault-spin-rev 180s linear infinite}";

export function VaultEngraved() {
  const [isRevealing, setIsRevealing] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [isSealed, setIsSealed] = useState(false);
  const [now, setNow] = useState<string>('');
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeRaf = useRef<number | null>(null);
  const wipeStart = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setNow(hh + ':' + mm);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const handlePointerDown = () => {
    if (isRevealing) return;
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

  const handleLock = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsRevealing(false);
  };

  const stopWipe = () => {
    if (wipeRaf.current !== null) cancelAnimationFrame(wipeRaf.current);
    wipeRaf.current = null;
    wipeStart.current = null;
    if (!isSealed) setWipeProgress(0);
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
      wipeRaf.current = null;
      wipeStart.current = null;
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
    };
  }, []);

  const GOLD = '#d4af37';
  const wipeCircumference = 2 * Math.PI * 9;
  const wipeDash = wipeCircumference * wipeProgress;

  return (
    <div
      className="relative w-full h-[100dvh] bg-black overflow-hidden select-none font-sans"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 45%, rgba(28,24,16,0.5) 0%, rgba(0,0,0,1) 70%)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      {/* TOP META — timestamp + cardinal tick */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
        <div
          className="w-[1px] h-3"
          style={{ background: 'linear-gradient(to bottom, transparent, #2a2418)' }}
        />
        <span
          className="font-mono text-[8px] tracking-[0.5em]"
          style={{ color: isRevealing ? 'rgba(212,175,55,0.45)' : '#2c2c2c', transition: 'color 700ms ease-out' }}
        >
          {now || '--:--'}
        </span>
      </div>

      {/* PANIC WIPE — silent */}
      <div
        className="absolute top-10 right-8 flex flex-col items-center cursor-pointer z-50"
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
              stroke="rgba(212,175,55,0.08)"
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
              opacity={isSealed ? 0.7 : 0.55}
            />
          </svg>
          <span
            className="font-serif leading-none"
            style={{
              fontSize: '10px',
              color: isSealed ? GOLD : '#3a2f1a',
              transition: 'color 700ms ease-out',
            }}
          >
            •
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

      {/* MEDALLION — true engraved seal */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: 256, height: 256 }}>
          {/* outer ring (256) — slow spin */}
          <div
            className="absolute inset-0 rounded-full vault-ring-spin"
            style={{
              border: '1px solid ' + (isRevealing ? 'rgba(212,175,55,0.45)' : 'rgba(255,255,255,0.18)'),
              transition: 'border-color 900ms ease-out',
            }}
          >
            {/* top fleuron @ 12 o'clock */}
            <span
              className="absolute left-1/2 -translate-x-1/2 -top-[5px] font-serif leading-none"
              style={{ fontSize: '8px', color: GOLD, opacity: 0.5, background: '#000', padding: '0 4px' }}
            >
              ✦
            </span>
            {/* bottom fleuron @ 6 o'clock */}
            <span
              className="absolute left-1/2 -translate-x-1/2 -bottom-[4px] font-serif leading-none"
              style={{ fontSize: '6px', color: GOLD, opacity: 0.4, background: '#000', padding: '0 4px' }}
            >
              ✦
            </span>
          </div>

          {/* middle ring (240) */}
          <div
            className="absolute rounded-full vault-ring-spin-rev"
            style={{
              top: 8,
              left: 8,
              width: 240,
              height: 240,
              border: '1px solid ' + (isRevealing ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.12)'),
              transition: 'border-color 900ms ease-out',
            }}
          />

          {/* inner ring (220) */}
          <div
            className="absolute rounded-full"
            style={{
              top: 18,
              left: 18,
              width: 220,
              height: 220,
              border: '1px solid ' + (isRevealing ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.08)'),
              transition: 'border-color 900ms ease-out',
              background: isRevealing
                ? 'radial-gradient(circle, rgba(212,175,55,0.025) 0%, transparent 70%)'
                : 'transparent',
            }}
          />

          {/* center plate content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-mono uppercase"
              style={{
                fontSize: '9px',
                letterSpacing: '0.5em',
                color: isRevealing ? 'rgba(212,175,55,0.55)' : '#2a2a2a',
                transition: 'color 900ms ease-out',
                paddingLeft: '0.5em',
              }}
            >
              CIPHERED · PRESENCE
            </span>

            <div style={{ height: 14 }} />

            <span
              className="font-serif"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '24px',
                letterSpacing: '0.3em',
                color: isRevealing ? GOLD : '#2e2e2e',
                textShadow: isRevealing ? '0 0 12px rgba(212,175,55,0.18)' : 'none',
                transition: 'color 900ms ease-out, text-shadow 900ms ease-out',
                paddingLeft: '0.3em',
              }}
            >
              GHOST_00
            </span>

            <div style={{ height: 10 }} />

            {/* gold underline draws on reveal */}
            <div
              style={{
                height: '1px',
                width: isRevealing ? '24px' : '0px',
                background: GOLD,
                opacity: 0.55,
                transition: 'width 700ms ease-out',
              }}
            />

          </div>
        </div>
      </div>

      {/* BOTTOM — hint or engraved actions */}
      <div className="absolute bottom-0 inset-x-0 pb-14 flex flex-col items-center pointer-events-none">
        {/* REST hint */}
        <div
          className="absolute bottom-14 flex flex-col items-center gap-3"
          style={{
            opacity: isRevealing ? 0 : 1,
            transform: isRevealing ? 'translateY(8px)' : 'translateY(0)',
            filter: isRevealing ? 'blur(4px)' : 'none',
            transition: 'opacity 500ms ease-out, transform 500ms ease-out, filter 500ms ease-out',
          }}
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              letterSpacing: '0.4em',
              color: '#2c2c2c',
            }}
          >
            · HOLD TO REVEAL ·
          </span>
        </div>

        {/* REVEALED engraved actions */}
        <div
          className="absolute bottom-10 flex flex-col items-center gap-5"
          style={{
            opacity: isRevealing ? 1 : 0,
            transform: isRevealing ? 'translateY(0)' : 'translateY(16px)',
            filter: isRevealing ? 'none' : 'blur(6px)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out, filter 700ms ease-out',
            pointerEvents: isRevealing ? 'auto' : 'none',
          }}
        >
          <div className="flex items-center gap-3">
            <EngravedAction label="MSG" />
            <Fleuron />
            <EngravedAction label="CALL" />
            <Fleuron />
            <EngravedAction label="VPN" active />
            <Fleuron />
            <EngravedAction label="WALLET" />
          </div>

          <span
            className="font-serif italic"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontSize: '11px',
              color: GOLD,
              opacity: 0.35,
              letterSpacing: '0.05em',
            }}
          >
            in restraint, presence
          </span>

          <button
            onPointerDown={handleLock}
            className="font-mono uppercase cursor-pointer"
            style={{
              fontSize: '9px',
              letterSpacing: '0.45em',
              color: 'rgba(212,175,55,0.55)',
              background: 'transparent',
              border: '1px solid rgba(212,175,55,0.18)',
              borderRadius: '999px',
              padding: '7px 18px 7px 22px',
            }}
          >
            · LOCK ·
          </button>
        </div>
      </div>
    </div>
  );
}

function Fleuron() {
  return (
    <span
      className="font-serif leading-none"
      style={{ fontSize: '8px', color: '#d4af37', opacity: 0.35 }}
    >
      ✦
    </span>
  );
}

function EngravedAction({ label, active = false }: { label: string; active?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="relative inline-flex flex-col items-center cursor-pointer"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{ padding: '4px 2px' }}
    >
      <span
        className="font-mono uppercase"
        style={{
          fontSize: '10px',
          letterSpacing: '0.3em',
          fontWeight: active ? 500 : 300,
          color: active ? '#d4af37' : hover ? 'rgba(212,175,55,0.75)' : 'rgba(180,180,180,0.55)',
          transition: 'color 300ms ease-out',
          paddingLeft: '0.3em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          marginTop: 4,
          height: '1px',
          width: active ? '100%' : hover ? '100%' : '30%',
          background: active ? '#d4af37' : 'rgba(212,175,55,0.4)',
          opacity: active ? 0.7 : hover ? 0.6 : 0.25,
          transition: 'width 400ms ease-out, opacity 400ms ease-out',
        }}
      />
    </span>
  );
}

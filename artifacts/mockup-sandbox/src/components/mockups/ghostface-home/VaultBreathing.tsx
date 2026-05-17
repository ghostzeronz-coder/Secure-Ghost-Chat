import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Phone, Shield, Wallet, Lock } from 'lucide-react';

const FONT_CSS = "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@100;300;400&display=swap');\n\n@keyframes vault-breathe { 0%,100% { opacity: 0.45; } 50% { opacity: 0.85; } }\n@keyframes vault-breathe-amber { 0%,100% { opacity: 0.35; } 50% { opacity: 0.75; } }\n@keyframes vault-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n@keyframes vault-hairline-blink { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }\n@keyframes vault-entry-fade { from { opacity: 0; } to { opacity: 1; } }";

export function VaultBreathing() {
  const [isRevealing, setIsRevealing] = useState(false);
  const [isArming, setIsArming] = useState(false);
  const [isWiped, setIsWiped] = useState(false);
  const [isAftermath, setIsAftermath] = useState(false);
  const [mounted, setMounted] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipedFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRevealing || isAftermath) return;
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

  const handleWipeDown = () => {
    if (isAftermath) return;
    setIsArming(true);
    wipeTimer.current = setTimeout(() => {
      setIsWiped(true);
      setIsArming(false);
      wipedFadeTimer.current = setTimeout(() => {
        setIsAftermath(true);
        setTimeout(() => {
          setIsAftermath(false);
          setIsWiped(false);
          setIsRevealing(false);
        }, 1500);
      }, 700);
    }, 3000);
  };

  const handleWipeUp = () => {
    if (wipeTimer.current) {
      clearTimeout(wipeTimer.current);
      wipeTimer.current = null;
    }
    if (!isWiped) setIsArming(false);
  };

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (wipeTimer.current) clearTimeout(wipeTimer.current);
      if (wipedFadeTimer.current) clearTimeout(wipedFadeTimer.current);
    };
  }, []);

  const ringColor = isRevealing ? 'rgba(212,175,55,0.55)' : 'rgba(80,80,80,0.6)';

  return (
    <div
      className="relative w-full h-[100dvh] bg-black text-[#a3a3a3] overflow-hidden select-none font-sans"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(20,20,20,0.5) 0%, rgba(0,0,0,1) 100%)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      {/* Aftermath fade overlay */}
      <div
        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-[1500ms] z-[60]"
        style={{ opacity: isAftermath ? 0.92 : 0 }}
      />

      {/* PANIC WIPE PIP */}
      <div
        data-no-reveal
        className="absolute top-12 right-8 flex flex-col items-center justify-center cursor-pointer z-50 group"
        onPointerDown={(e) => { e.stopPropagation(); handleWipeDown(); }}
        onPointerUp={(e) => { e.stopPropagation(); handleWipeUp(); }}
        onPointerLeave={handleWipeUp}
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          {/* Progress ring */}
          <div
            className="absolute inset-0 rounded-full border border-red-700/40"
            style={{
              transform: isArming ? 'scale(1.6)' : 'scale(1)',
              opacity: isArming ? 0.7 : 0,
              transition: isArming ? 'transform 3000ms linear, opacity 200ms ease-out' : 'transform 400ms ease-out, opacity 400ms ease-out',
            }}
          />
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all duration-700 ${
              isWiped
                ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] scale-150'
                : isArming
                  ? 'bg-red-700/80'
                  : 'bg-red-900/40 group-hover:bg-red-800'
            }`}
          />
        </div>
        <span
          className={`font-mono text-[8px] tracking-[0.3em] absolute top-7 whitespace-nowrap transition-all duration-500 ${
            isWiped ? 'text-red-600/80 opacity-100 translate-y-0' : 'opacity-0 translate-y-1 text-red-700/0'
          }`}
        >
          WIPED
        </span>
      </div>

      {/* CENTER SEAL */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className="relative flex items-center justify-center w-64 h-64"
          style={{
            opacity: mounted ? 1 : 0,
            transition: 'opacity 800ms ease-out',
          }}
        >
          {/* Outer breathing ring */}
          <div
            className="absolute inset-0 rounded-full border transition-colors duration-1000"
            style={{
              borderColor: ringColor,
              animation: 'vault-breathe 4s ease-in-out infinite',
              boxShadow: isRevealing ? 'inset 0 0 40px rgba(212,175,55,0.04)' : 'none',
              background: isRevealing ? 'rgba(212,175,55,0.015)' : 'transparent',
            }}
          />

          {/* North cardinal tick at 12 o'clock */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[1px] w-[1px] h-[6px]"
            style={{
              background: isRevealing ? 'rgba(212,175,55,0.7)' : 'rgba(212,175,55,0.35)',
              transition: 'background 700ms ease-out',
            }}
          />

          {/* Slow rotating inner concentric ring (reveal only) */}
          <div
            className="absolute inset-6 rounded-full border border-[#d4af37]/15"
            style={{
              animation: 'vault-spin-slow 90s linear infinite',
              opacity: isRevealing ? 1 : 0,
              transition: 'opacity 1000ms ease-out',
            }}
          >
            {/* tiny notch on rotating ring */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-[3px] bg-[#d4af37]/30" />
          </div>

          {/* Inner static ring for depth */}
          <div
            className="absolute inset-3 rounded-full border"
            style={{
              borderColor: isRevealing ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.035)',
              transition: 'border-color 700ms ease-out',
            }}
          />

          <div className="flex flex-col items-center gap-2.5">
            <span
              className="font-['Playfair_Display'] transition-all duration-1000"
              style={{
                fontSize: '22px',
                letterSpacing: '0.35em',
                color: isRevealing ? 'rgba(212,175,55,0.78)' : '#333',
                textShadow: isRevealing ? '0 0 8px rgba(212,175,55,0.2)' : 'none',
              }}
            >
              GHOST_00
            </span>
            {/* underscore tail under "GHOST" only on reveal */}
            <div
              className="h-[1px] transition-all duration-700"
              style={{
                width: isRevealing ? '34px' : '22px',
                background: isRevealing ? 'rgba(212,175,55,0.45)' : '#222',
                marginTop: '-2px',
                marginRight: '40%',
              }}
            />
            <span
              className="font-['JetBrains_Mono'] uppercase transition-colors duration-700"
              style={{
                fontSize: '9px',
                letterSpacing: '0.45em',
                color: isRevealing ? '#555' : '#2c2c2c',
              }}
            >
              Secure Identity
            </span>
          </div>
        </div>

        {/* Local time line below seal */}
        <div
          className="mt-6 font-['JetBrains_Mono'] transition-colors duration-700"
          style={{
            fontSize: '9px',
            letterSpacing: '0.35em',
            color: isRevealing ? '#555' : '#2a2a2a',
            opacity: mounted ? 1 : 0,
            transitionProperty: 'color, opacity',
            transitionDuration: '700ms, 800ms',
          }}
        >
          LOCAL · 02:17 · OFFLINE_OK
        </div>
      </div>

      {/* BOTTOM AREA */}
      <div className="absolute bottom-0 inset-x-0 h-56 flex flex-col items-center justify-end pb-10 pointer-events-none">
        {/* HOLD TO REVEAL hint */}
        <div
          className={`flex flex-col items-center gap-3 absolute bottom-16 transition-all duration-500 ${
            isRevealing ? 'opacity-0 translate-y-4 blur-sm' : 'opacity-100 translate-y-0 blur-0'
          }`}
        >
          <div
            className="w-[1px] h-6 bg-[#555]"
            style={{ animation: 'vault-hairline-blink 2s ease-in-out infinite' }}
          />
          <span
            className="font-['JetBrains_Mono'] text-[10px] tracking-[0.35em] text-[#444]"
          >
            HOLD TO REVEAL
          </span>
        </div>

        {/* Revealed actions */}
        <div
          className={`absolute bottom-20 flex items-center gap-1 transition-all duration-700 ease-out ${
            isRevealing
              ? 'opacity-100 translate-y-0 scale-100 blur-0 pointer-events-auto'
              : 'opacity-0 translate-y-8 scale-95 blur-md pointer-events-none'
          }`}
        >
          <ActionItem icon={<MessageSquare size={15} strokeWidth={1.25} />} label="MSG" revealed={isRevealing} />
          <Divider revealed={isRevealing} />
          <ActionItem icon={<Phone size={15} strokeWidth={1.25} />} label="CALL" revealed={isRevealing} />
          <Divider revealed={isRevealing} />
          <ActionItem icon={<Shield size={15} strokeWidth={1.25} />} label="VPN" active revealed={isRevealing} />
          <Divider revealed={isRevealing} />
          <ActionItem icon={<Wallet size={15} strokeWidth={1.25} />} label="WALLET" revealed={isRevealing} />
        </div>

        {/* LOCK pill */}
        <button
          data-no-reveal
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setIsRevealing(false); }}
          className={`absolute bottom-6 flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#222] bg-black/40 transition-all duration-500 ${
            isRevealing ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
          } hover:border-[#d4af37]/30`}
        >
          <Lock size={9} strokeWidth={1.5} className="text-[#555]" />
          <span className="font-['JetBrains_Mono'] text-[9px] tracking-[0.4em] text-[#666]">
            · LOCK ·
          </span>
        </button>
      </div>
    </div>
  );
}

function Divider({ revealed }: { revealed: boolean }) {
  return (
    <div
      className="w-8 h-[1px] transition-colors duration-700"
      style={{ background: revealed ? 'rgba(212,175,55,0.18)' : '#222' }}
    />
  );
}

function ActionItem({
  icon,
  label,
  active = false,
  revealed,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  revealed: boolean;
}) {
  return (
    <div
      data-no-reveal
      className="flex flex-col items-center gap-3 w-16 cursor-pointer group transition-transform duration-300 hover:-translate-y-1"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          border: active ? '1.5px solid rgba(212,175,55,0.45)' : '1px solid #222',
          boxShadow: active ? 'inset 0 0 12px rgba(212,175,55,0.12)' : 'none',
          color: active ? '#d4af37' : '#888',
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLDivElement).style.border = '1px solid #444';
            (e.currentTarget as HTMLDivElement).style.color = '#ddd';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLDivElement).style.border = '1px solid #222';
            (e.currentTarget as HTMLDivElement).style.color = '#888';
          }
        }}
      >
        {icon}
      </div>
      <span
        className={`font-['JetBrains_Mono'] text-[9px] tracking-[0.3em] transition-colors duration-300 ${
          active ? 'text-[#d4af37]/80' : 'text-[#555] group-hover:text-[#aaa]'
        }`}
      >
        {label}
      </span>
      {/* mark revealed prop usage for hierarchy hint */}
      <span className="hidden">{revealed ? '1' : '0'}</span>
    </div>
  );
}

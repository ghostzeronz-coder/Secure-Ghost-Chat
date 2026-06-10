import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Phone, Shield, Wallet, Lock } from 'lucide-react';

const FONT_CSS = "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@100;300;400;500&display=swap');";

const GLYPHS = ['█','▓','▒','░','╳','⌬','⌗','⎕','✕','◊','✚'];
const ALIAS_TARGET = ['G','H','O','S','T','_','0','0'];
const TAG_TARGET = 'SECURE IDENTITY';
const TAG_REST = '▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓';

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
const randomAlias = () => Array.from({ length: 8 }, randomGlyph);
const randomTag = () =>
  TAG_REST.split('').map((c) => (c === ' ' ? ' ' : randomGlyph())).join('');

export function GhostfaceHomeCopyZOoTA920() {
  const [isRevealing, setIsRevealing] = useState(false);
  const [aliasChars, setAliasChars] = useState<string[]>(() => randomAlias());
  const [tagChars, setTagChars] = useState<string>(() => randomTag());
  const [aliasLocked, setAliasLocked] = useState<boolean[]>(() => Array(8).fill(false));
  const [tagLocked, setTagLocked] = useState<boolean[]>(() => Array(TAG_TARGET.length).fill(false));

  const [isArming, setIsArming] = useState(false);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [wipeGlyph, setWipeGlyph] = useState<string>('•');
  const [isWiped, setIsWiped] = useState(false);
  const [isAftermath, setIsAftermath] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeRaf = useRef<number | null>(null);
  const wipeStart = useRef<number | null>(null);
  const wipeShimmerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cascadeTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const shimmerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCascade = () => {
    cascadeTimers.current.forEach((t) => clearTimeout(t));
    cascadeTimers.current = [];
  };

  // Shimmer at rest
  useEffect(() => {
    if (isRevealing || isAftermath) {
      if (shimmerTimer.current) {
        clearInterval(shimmerTimer.current);
        shimmerTimer.current = null;
      }
      return;
    }
    shimmerTimer.current = setInterval(() => {
      setAliasChars((prev) => prev.map((c, i) => (aliasLocked[i] ? c : randomGlyph())));
      setTagChars((prev) =>
        prev
          .split('')
          .map((c, i) => {
            if (TAG_TARGET[i] === ' ') return ' ';
            if (tagLocked[i]) return c;
            return randomGlyph();
          })
          .join(''),
      );
    }, 220);
    return () => {
      if (shimmerTimer.current) {
        clearInterval(shimmerTimer.current);
        shimmerTimer.current = null;
      }
    };
  }, [isRevealing, isAftermath, aliasLocked, tagLocked]);

  const runDecrypt = useCallback(() => {
    clearCascade();
    // alias cascade: 80ms stagger
    ALIAS_TARGET.forEach((ch, i) => {
      const t = setTimeout(() => {
        setAliasChars((prev) => {
          const next = [...prev];
          next[i] = ch;
          return next;
        });
        setAliasLocked((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * 80);
      cascadeTimers.current.push(t);
    });
    // tag cascade: 40ms stagger
    TAG_TARGET.split('').forEach((ch, i) => {
      const t = setTimeout(() => {
        setTagChars((prev) => {
          const arr = prev.split('');
          arr[i] = ch;
          return arr.join('');
        });
        setTagLocked((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, 200 + i * 40);
      cascadeTimers.current.push(t);
    });
  }, []);

  const runEncrypt = useCallback(() => {
    clearCascade();
    // reverse cascade
    for (let i = ALIAS_TARGET.length - 1; i >= 0; i--) {
      const step = ALIAS_TARGET.length - 1 - i;
      const t = setTimeout(() => {
        setAliasLocked((prev) => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
        setAliasChars((prev) => {
          const next = [...prev];
          next[i] = randomGlyph();
          return next;
        });
      }, step * 50);
      cascadeTimers.current.push(t);
    }
    for (let i = TAG_TARGET.length - 1; i >= 0; i--) {
      const step = TAG_TARGET.length - 1 - i;
      const t = setTimeout(() => {
        setTagLocked((prev) => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
        setTagChars((prev) => {
          const arr = prev.split('');
          arr[i] = TAG_TARGET[i] === ' ' ? ' ' : randomGlyph();
          return arr.join('');
        });
      }, step * 28);
      cascadeTimers.current.push(t);
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRevealing || isAftermath) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-reveal]')) return;
    holdTimer.current = setTimeout(() => {
      setIsRevealing(true);
      runDecrypt();
    }, 300);
  };

  const handlePointerUp = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handleLock = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    setIsRevealing(false);
    runEncrypt();
  };

  // Panic wipe
  const stopWipeShimmer = () => {
    if (wipeShimmerTimer.current) {
      clearInterval(wipeShimmerTimer.current);
      wipeShimmerTimer.current = null;
    }
  };

  const wipeFrame = (ts: number) => {
    if (wipeStart.current === null) wipeStart.current = ts;
    const elapsed = ts - wipeStart.current;
    const p = Math.min(1, elapsed / 3000);
    setWipeProgress(p);
    if (p < 1) {
      wipeRaf.current = requestAnimationFrame(wipeFrame);
    } else {
      // complete
      wipeRaf.current = null;
      wipeStart.current = null;
      setIsArming(false);
      stopWipeShimmer();
      setWipeGlyph('✕');
      setIsWiped(true);
      // aftermath: re-encrypt seal contents
      setIsRevealing(false);
      setAliasLocked(Array(8).fill(false));
      setTagLocked(Array(TAG_TARGET.length).fill(false));
      clearCascade();
      setAliasChars(randomAlias());
      setTagChars(randomTag());
      setIsAftermath(true);
      setTimeout(() => {
        setIsAftermath(false);
        setIsWiped(false);
        setWipeGlyph('•');
        setWipeProgress(0);
      }, 1800);
    }
  };

  const handleWipeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isArming || isWiped || isAftermath) return;
    setIsArming(true);
    wipeStart.current = null;
    wipeRaf.current = requestAnimationFrame(wipeFrame);
    stopWipeShimmer();
    wipeShimmerTimer.current = setInterval(() => {
      setWipeGlyph(randomGlyph());
    }, 140);
  };

  const handleWipeUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (isWiped || isAftermath) return;
    if (wipeRaf.current !== null) {
      cancelAnimationFrame(wipeRaf.current);
      wipeRaf.current = null;
    }
    wipeStart.current = null;
    setIsArming(false);
    setWipeProgress(0);
    stopWipeShimmer();
    setWipeGlyph('•');
  };

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (wipeRaf.current !== null) cancelAnimationFrame(wipeRaf.current);
      stopWipeShimmer();
      clearCascade();
      if (shimmerTimer.current) clearInterval(shimmerTimer.current);
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
          'radial-gradient(circle at 50% 50%, rgba(18,18,18,0.55) 0%, rgba(0,0,0,1) 75%)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      {/* Aftermath redact overlay (subtle darkening) */}
      <div
        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-[1200ms] z-[40]"
        style={{ opacity: isAftermath ? 0.6 : 0 }}
      />

      {/* PANIC WIPE PIP — silent, encrypting */}
      <div
        data-no-reveal
        className="absolute top-12 right-8 flex flex-col items-center cursor-pointer z-50"
        onPointerDown={handleWipeDown}
        onPointerUp={handleWipeUp}
        onPointerLeave={handleWipeUp}
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(80,12,12,0.35)" strokeWidth="1" />
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="rgba(220,38,38,0.75)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray={wipeDash + ' ' + wipeCircumference}
              style={{ transition: wipeProgress === 0 ? 'stroke-dasharray 300ms ease-out' : 'none' }}
            />
          </svg>
          <span
            className="leading-none"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: isWiped ? '11px' : isArming ? '10px' : '14px',
              color: isWiped ? 'rgba(220,38,38,0.85)' : isArming ? 'rgba(180,40,40,0.7)' : 'rgba(120,30,30,0.5)',
              transition: 'color 400ms ease-out, font-size 200ms ease-out',
            }}
          >
            {isArming ? wipeGlyph : isWiped ? '✕' : '•'}
          </span>
        </div>
      </div>

      {/* CENTER SEAL */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center" style={{ width: 256, height: 256 }}>
          {/* outer hairline ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '1px solid ' + (isRevealing ? 'rgba(212,175,55,0.22)' : '#1a1a1a'),
              transition: 'border-color 700ms ease-out',
            }}
          />
          {/* inner barely-visible ring */}
          <div
            className="absolute rounded-full"
            style={{
              top: 14,
              left: 14,
              width: 228,
              height: 228,
              border: '1px solid ' + (isRevealing ? 'rgba(212,175,55,0.07)' : 'rgba(255,255,255,0.025)'),
              transition: 'border-color 700ms ease-out',
            }}
          />

          <div className="flex flex-col items-center">
            {/* alias glyphs */}
            <div
              className="flex"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '22px',
                letterSpacing: '0.35em',
                paddingLeft: '0.35em',
              }}
            >
              {aliasChars.map((c, i) => {
                const settled = aliasLocked[i];
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: '0.85em',
                      textAlign: 'center',
                      color: settled
                        ? 'rgba(212,175,55,0.75)'
                        : isRevealing
                          ? 'rgba(120,100,55,0.45)'
                          : '#2f2f2f',
                      textShadow: settled ? '0 0 8px rgba(212,175,55,0.18)' : 'none',
                      transition: 'color 200ms ease-out, text-shadow 400ms ease-out',
                    }}
                  >
                    {c}
                  </span>
                );
              })}
            </div>

            {/* hairline divider */}
            <div
              style={{
                marginTop: 12,
                height: '1px',
                width: isRevealing ? '24px' : '0px',
                background: 'rgba(212,175,55,0.45)',
                transition: 'width 500ms ease-out 150ms',
              }}
            />

            {/* tagline glyphs */}
            <div
              className="font-mono uppercase"
              style={{
                marginTop: 10,
                fontSize: '9px',
                letterSpacing: '0.4em',
                paddingLeft: '0.4em',
                whiteSpace: 'pre',
                color: isRevealing ? 'rgba(212,175,55,0.55)' : '#2a2a2a',
                transition: 'color 600ms ease-out',
              }}
            >
              {tagChars}
            </div>
          </div>
        </div>

        {/* CIPHER STATUS line below seal */}
        <div
          className="mt-7 font-mono uppercase"
          style={{
            fontSize: '8px',
            letterSpacing: '0.5em',
            color: isRevealing ? '#555' : '#2a2a2a',
            transition: 'color 300ms ease-out',
          }}
        >
          {isRevealing ? 'CIPHER · UNLOCKED' : 'CIPHER · LOCKED'}
        </div>
      </div>

      {/* BOTTOM AREA */}
      <div className="absolute bottom-0 inset-x-0 h-56 flex flex-col items-center justify-end pb-10 pointer-events-none">
        {/* HOLD TO DECRYPT hint */}
        <div
          className={`flex flex-col items-center gap-2 absolute bottom-16 transition-all duration-500 ${
            isRevealing ? 'opacity-0 translate-y-3 blur-sm' : 'opacity-100 translate-y-0 blur-0'
          }`}
        >
          <Lock size={12} strokeWidth={1.25} className="text-[#333]" />
          <span
            className="font-mono uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.3em', color: '#444' }}
          >
            HOLD · TO · DECRYPT
          </span>
        </div>

        {/* Revealed actions */}
        <div
          className={`absolute bottom-20 flex items-center gap-1 transition-all duration-700 ease-out ${
            isRevealing
              ? 'opacity-100 translate-y-0 scale-100 blur-0 pointer-events-auto'
              : 'opacity-0 translate-y-6 scale-95 blur-md pointer-events-none'
          }`}
        >
          <ActionItem revealed={isRevealing} delay={0} render={(s) => s ? <MessageSquare size={15} strokeWidth={1.5} /> : null} label="MSG" />
          <Divider revealed={isRevealing} />
          <ActionItem revealed={isRevealing} delay={120} render={(s) => s ? <Phone size={15} strokeWidth={1.5} /> : null} label="CALL" />
          <Divider revealed={isRevealing} />
          <ActionItem revealed={isRevealing} delay={240} render={(s) => s ? <Shield size={15} strokeWidth={1.5} /> : null} label="VPN" active />
          <Divider revealed={isRevealing} />
          <ActionItem revealed={isRevealing} delay={360} render={(s) => s ? <Wallet size={15} strokeWidth={1.5} /> : null} label="WALLET" />
        </div>

        {/* LOCK pill */}
        <button
          data-no-reveal
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleLock}
          className={`absolute bottom-6 flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-500 ${
            isRevealing ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          style={{
            borderColor: 'rgba(212,175,55,0.22)',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <Lock size={9} strokeWidth={1.5} style={{ color: 'rgba(212,175,55,0.6)' }} />
          <span
            className="font-mono uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.45em', color: 'rgba(212,175,55,0.7)' }}
          >
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
  revealed,
  delay,
  render,
  label,
  active = false,
}: {
  revealed: boolean;
  delay: number;
  render: (settled: boolean) => React.ReactNode;
  label: string;
  active?: boolean;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!revealed) {
      setSettled(false);
      return;
    }
    const t1 = setTimeout(() => {
      // placeholder shown via settled=false
      const t2 = setTimeout(() => setSettled(true), 200);
      return () => clearTimeout(t2);
    }, delay);
    const t2 = setTimeout(() => setSettled(true), delay + 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [revealed, delay]);

  return (
    <div
      data-no-reveal
      className="flex flex-col items-center gap-3 w-16 cursor-pointer group transition-transform duration-300 hover:-translate-y-1"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          border: active ? '1.5px solid rgba(212,175,55,0.5)' : '1px solid #2a2a2a',
          background: active ? 'rgba(212,175,55,0.08)' : '#0e0e0e',
          color: active ? '#d4af37' : '#9a9a9a',
          boxShadow: active ? 'inset 0 0 12px rgba(212,175,55,0.12)' : 'none',
        }}
      >
        {settled ? (
          render(true)
        ) : (
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '14px',
              color: active ? 'rgba(212,175,55,0.7)' : '#555',
              lineHeight: 1,
            }}
          >
            ▓
          </span>
        )}
      </div>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: '9px',
          letterSpacing: '0.3em',
          color: active ? 'rgba(212,175,55,0.8)' : '#666',
        }}
      >
        {label}
      </span>
    </div>
  );
}

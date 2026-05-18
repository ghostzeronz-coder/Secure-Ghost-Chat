import React, { useState, useEffect } from 'react';
import {
  Lock,
  Search,
  Pencil,
  Pin,
  Clock,
  Timer,
  AlertTriangle,
  ShieldAlert,
  Flame,
  ShieldCheck,
} from 'lucide-react';

type Badge = 'burner' | 'verified' | 'expiring' | 'selfdestruct' | 'keychanged';

type Convo = {
  id: string;
  alias: string;
  initials: string;
  avatarColor: string;
  preview: string;
  time: string;
  unread?: number;
  badges?: Badge[];
  pinned?: boolean;
  keyChanged?: boolean;
  typing?: boolean;
};

const CONVOS: Convo[] = [
  {
    id: 'p1',
    alias: 'PHANTOM_9',
    initials: 'P9',
    avatarColor: '#FFB800',
    preview: 'drop confirmed. burn the relay at 0300.',
    time: '00:42',
    unread: 2,
    badges: ['verified'],
    pinned: true,
  },
  {
    id: 'c2',
    alias: 'EDOX_RAVEN',
    initials: 'ER',
    avatarColor: '#8B5CF6',
    preview: 'sending the dossier in fragments — verify hash',
    time: '23:18',
    unread: 5,
    badges: ['verified', 'expiring'],
  },
  {
    id: 'c3',
    alias: 'NIGHTOWL',
    initials: 'NO',
    avatarColor: '#22C55E',
    preview: 'on the move. ping me from a clean handle.',
    time: '22:51',
    badges: ['verified'],
  },
  {
    id: 'c4',
    alias: 'BURNER_44',
    initials: 'B4',
    avatarColor: '#6B7280',
    preview: 'one-time channel. read and forget.',
    time: '22:07',
    unread: 1,
    badges: ['burner', 'selfdestruct'],
  },
  {
    id: 'c5',
    alias: 'HALCYON',
    initials: 'HC',
    avatarColor: '#EF4444',
    preview: 'session re-keyed from new device — verify safety number',
    time: '21:30',
    badges: ['keychanged'],
    keyChanged: true,
  },
  {
    id: 'c6',
    alias: 'SIGMA_DELTA',
    initials: 'SD',
    avatarColor: '#06B6D4',
    preview: 'typing…',
    time: '20:14',
    badges: ['verified'],
    typing: true,
  },
  {
    id: 'c7',
    alias: 'WRAITH_07',
    initials: 'W7',
    avatarColor: '#F472B6',
    preview: 'coords attached. coffee at the usual dead-drop.',
    time: '18:02',
    badges: ['verified'],
  },
  {
    id: 'c8',
    alias: 'COLD_ASH',
    initials: 'CA',
    avatarColor: '#A3A3A3',
    preview: 'burner expires in 11h — save what matters.',
    time: '16:44',
    badges: ['burner', 'expiring'],
  },
  {
    id: 'c9',
    alias: 'IRONVEIL',
    initials: 'IV',
    avatarColor: '#FACC15',
    preview: 'package received. signature checks out.',
    time: 'YDA',
    badges: ['verified'],
  },
  {
    id: 'c10',
    alias: 'NULL_HAND',
    initials: 'NH',
    avatarColor: '#3B82F6',
    preview: 'pgp block incoming — decrypt offline.',
    time: 'YDA',
    badges: ['burner'],
  },
];

function BadgePill({ kind }: { kind: Badge }) {
  if (kind === 'burner') {
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider text-neutral-400 border border-neutral-700 bg-neutral-900 px-1.5 py-[1px] rounded-sm">
        <Flame size={8} />
        burner
      </span>
    );
  }
  if (kind === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider text-[#22C55E] border border-[#22C55E]/30 bg-[#22C55E]/5 px-1.5 py-[1px] rounded-sm">
        <span className="w-1 h-1 rounded-full bg-[#22C55E]" />
        key ok
      </span>
    );
  }
  if (kind === 'expiring') {
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/5 px-1.5 py-[1px] rounded-sm">
        <Clock size={8} />
        12h
      </span>
    );
  }
  if (kind === 'selfdestruct') {
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/5 px-1.5 py-[1px] rounded-sm">
        <Timer size={8} />
        self-destruct
      </span>
    );
  }
  if (kind === 'keychanged') {
    return (
      <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider text-[#EF4444] border border-[#EF4444]/40 bg-[#EF4444]/10 px-1.5 py-[1px] rounded-sm">
        <ShieldAlert size={8} />
        verify
      </span>
    );
  }
  return null;
}

export function Chats() {
  const [now, setNow] = useState<string>('00:42:18');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      const s = d.getSeconds().toString().padStart(2, '0');
      setNow(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const totalUnread = CONVOS.reduce((acc, c) => acc + (c.unread ?? 0), 0);

  return (
    <div className="h-[100dvh] w-full bg-black text-white font-sans flex flex-col relative overflow-hidden select-none">
      <style
        dangerouslySetInnerHTML={{
          __html:
            ".gf-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;}.gf-hazard{background-image:repeating-linear-gradient(135deg,#1a0000 0 10px,#000 10px 20px);}.gf-scroll::-webkit-scrollbar{width:0;}",
        }}
      />

      {/* Top bar */}
      <header className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-sm bg-[#FFB800]/10 border border-[#FFB800]/30 flex items-center justify-center">
            <Lock size={12} className="text-[#FFB800]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[8px] gf-mono uppercase tracking-[0.2em] text-white/40">
              call-sign
            </span>
            <span className="text-sm gf-mono font-bold tracking-widest text-white">
              GHOST_00
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8px] gf-mono uppercase tracking-[0.2em] text-white/40">
              local
            </span>
            <span className="text-[10px] gf-mono tabular-nums text-[#22C55E]">
              {now}
            </span>
          </div>
          <button
            aria-label="search"
            className="w-8 h-8 rounded-sm border border-white/10 bg-white/[0.02] flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            <Search size={14} className="text-white/70" />
          </button>
        </div>
      </header>

      {/* Sub-header status strip */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-white/5 bg-[#0A0A0A]">
        <div className="flex items-center gap-2">
          <ShieldCheck size={11} className="text-[#22C55E]" />
          <span className="text-[9px] gf-mono uppercase tracking-[0.18em] text-white/50">
            end-to-end · 10 channels
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] gf-mono uppercase tracking-[0.18em] text-white/40">
            unread
          </span>
          <span className="text-[9px] gf-mono font-bold text-black bg-[#FFB800] px-1.5 rounded-sm tabular-nums">
            {totalUnread}
          </span>
        </div>
      </div>

      {/* Conversation list */}
      <main className="flex-1 overflow-y-auto gf-scroll">
        {CONVOS.map((c) => (
          <button
            key={c.id}
            className={
              'w-full text-left flex items-stretch gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors relative ' +
              (c.pinned ? 'bg-[#FFB800]/[0.04]' : '')
            }
          >
            {c.pinned && (
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#FFB800]" />
            )}

            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center gf-mono font-bold text-[13px] tracking-wider text-black"
                style={{ backgroundColor: c.avatarColor }}
              >
                {c.initials}
              </div>
              {c.badges?.includes('verified') && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22C55E] border-2 border-black" />
              )}
              {c.keyChanged && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#EF4444] border-2 border-black flex items-center justify-center">
                  <AlertTriangle size={6} className="text-black" />
                </span>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 min-w-0">
                {c.pinned && (
                  <Pin size={9} className="text-[#FFB800] shrink-0" />
                )}
                <span className="gf-mono text-[12px] font-bold tracking-[0.14em] text-white truncate">
                  {c.alias}
                </span>
                <div className="flex items-center gap-1 ml-auto pl-2 shrink-0">
                  <span
                    className={
                      'gf-mono text-[10px] tabular-nums ' +
                      (c.unread ? 'text-[#FFB800]' : 'text-white/40')
                    }
                  >
                    {c.time}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <p
                  className={
                    'text-[12px] truncate flex-1 ' +
                    (c.keyChanged
                      ? 'text-[#EF4444]'
                      : c.typing
                      ? 'text-[#22C55E] italic'
                      : c.unread
                      ? 'text-white/80'
                      : 'text-white/45')
                  }
                >
                  {c.keyChanged
                    ? 'key changed — verify safety number'
                    : c.preview}
                </p>
                {c.unread ? (
                  <span className="shrink-0 gf-mono text-[9px] font-bold text-black bg-[#FFB800] rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center tabular-nums">
                    {c.unread}
                  </span>
                ) : null}
              </div>

              {c.badges && c.badges.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {c.badges.map((b) => (
                    <BadgePill key={b} kind={b} />
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}

        {/* Footer hint inside scroll */}
        <div className="px-4 py-6 flex items-center justify-center gap-2">
          <span className="h-px flex-1 bg-white/5" />
          <span className="gf-mono text-[8px] uppercase tracking-[0.3em] text-white/30">
            end · 10 channels · no archive
          </span>
          <span className="h-px flex-1 bg-white/5" />
        </div>

        {/* spacer for floating button */}
        <div className="h-28" />
      </main>

      {/* Floating compose */}
      <button
        aria-label="compose"
        className="absolute right-4 bottom-[88px] w-14 h-14 rounded-full bg-[#FFB800] text-black flex items-center justify-center shadow-[0_8px_24px_rgba(255,184,0,0.35)] active:scale-95 transition-transform"
      >
        <Pencil size={20} strokeWidth={2.5} />
      </button>

      {/* Panic wipe strip */}
      <div className="absolute left-0 right-0 bottom-0 px-3 pb-3 pt-2 bg-gradient-to-t from-black via-black to-transparent">
        <div className="gf-hazard rounded-sm border border-[#EF4444]/60 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-white drop-shadow" />
            <span className="gf-mono text-[11px] font-bold tracking-[0.25em] text-white drop-shadow">
              PANIC_WIPE
            </span>
          </div>
          <span className="gf-mono text-[9px] tracking-[0.2em] text-white/70">
            hold 3s →
          </span>
        </div>
      </div>
    </div>
  );
}

export default Chats;

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Phone, Shield, Wallet } from 'lucide-react';
import './vault.css';

export function Vault() {
  const [isRevealing, setIsRevealing] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const wipeTimer = useRef<NodeJS.Timeout | null>(null);

  // Handle main reveal hold
  const handlePointerDown = () => {
    holdTimer.current = setTimeout(() => {
      setIsRevealing(true);
    }, 300); // 300ms to reveal
  };

  const handlePointerUp = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setIsRevealing(false);
  };

  // Handle panic wipe hold
  const handleWipeDown = () => {
    wipeTimer.current = setTimeout(() => {
      setIsWiping(true);
      setTimeout(() => setIsWiping(false), 2000);
    }, 1500);
  };

  const handleWipeUp = () => {
    if (wipeTimer.current) clearTimeout(wipeTimer.current);
  };

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (wipeTimer.current) clearTimeout(wipeTimer.current);
    };
  }, []);

  return (
    <div 
      className="relative w-full h-[100dvh] bg-black text-[#a3a3a3] overflow-hidden select-none font-sans"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(20,20,20,0.5) 0%, rgba(0,0,0,1) 100%)'
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@100;300;400&display=swap');
      `}</style>

      {/* PANIC WIPE SEAL */}
      <div 
        className="absolute top-12 right-8 flex flex-col items-center justify-center gap-2 cursor-pointer z-50 group"
        onPointerDown={(e) => { e.stopPropagation(); handleWipeDown(); }}
        onPointerUp={handleWipeUp}
        onPointerLeave={handleWipeUp}
      >
        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-1000 ${isWiping ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] scale-150' : 'bg-red-900/40 group-hover:bg-red-800'}`} />
        <span className={`text-[8px] font-mono tracking-[0.3em] text-red-700/0 transition-all duration-700 absolute top-4 whitespace-nowrap ${isWiping ? 'text-red-600/80 translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
          {isWiping ? "WIPED" : "HOLD 3s"}
        </span>
      </div>

      {/* CENTER SEAL (ALIAS) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className={`relative flex items-center justify-center w-64 h-64 rounded-full border transition-all duration-700 ease-out
          ${isRevealing ? 'border-[#d4af37]/20 bg-[#d4af37]/[0.02] shadow-[inset_0_0_40px_rgba(212,175,55,0.02)]' : 'border-[#1a1a1a] bg-transparent'}`}
        >
          {/* Subtle inner ring */}
          <div className="absolute inset-4 rounded-full border border-white/[0.02]" />
          
          <div className="flex flex-col items-center gap-3">
            <span className={`font-['Playfair_Display'] text-2xl tracking-[0.4em] transition-all duration-1000
              ${isRevealing ? 'text-[#d4af37]/70 drop-shadow-[0_0_8px_rgba(212,175,55,0.2)]' : 'text-[#333]'}`}
            >
              GHOST_00
            </span>
            <div className={`w-8 h-[1px] transition-all duration-700 ${isRevealing ? 'bg-[#d4af37]/30' : 'bg-[#222]'}`} />
            <span className="font-['JetBrains_Mono'] text-[9px] tracking-[0.5em] text-[#333] uppercase">
              Secure Identity
            </span>
          </div>
        </div>
      </div>

      {/* BOTTOM REVEAL AREA */}
      <div className="absolute bottom-0 inset-x-0 h-48 flex flex-col items-center justify-end pb-12 pointer-events-none">
        
        {/* Reveal Hint */}
        <div className={`transition-all duration-500 flex flex-col items-center gap-3 absolute bottom-12
          ${isRevealing ? 'opacity-0 translate-y-4 blur-sm' : 'opacity-100 translate-y-0 blur-0'}`}>
          <div className="w-[1px] h-6 bg-gradient-to-b from-transparent to-[#333]" />
          <span className="font-['JetBrains_Mono'] text-[10px] tracking-[0.2em] text-[#444]">
            HOLD TO REVEAL
          </span>
        </div>

        {/* Revealed Actions */}
        <div className={`transition-all duration-700 ease-out absolute bottom-12 flex items-center gap-1
          ${isRevealing ? 'opacity-100 translate-y-0 scale-100 blur-0 pointer-events-auto' : 'opacity-0 translate-y-8 scale-95 blur-md pointer-events-none'}`}>
          
          <ActionItem icon={<MessageSquare size={16} strokeWidth={1.5} />} label="MSG" />
          <div className="w-8 h-[1px] bg-[#333]" />
          <ActionItem icon={<Phone size={16} strokeWidth={1.5} />} label="CALL" />
          <div className="w-8 h-[1px] bg-[#333]" />
          <ActionItem icon={<Shield size={16} strokeWidth={1.5} />} label="VPN" active={true} />
          <div className="w-8 h-[1px] bg-[#333]" />
          <ActionItem icon={<Wallet size={16} strokeWidth={1.5} />} label="WALLET" />
          
        </div>

      </div>

    </div>
  );
}

function ActionItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 w-16 cursor-pointer group hover:-translate-y-1 transition-transform duration-300">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500
        ${active ? 'text-[#d4af37] border border-[#d4af37]/30 bg-[#d4af37]/5' : 'text-[#888] border border-[#222] bg-[#111] group-hover:text-white group-hover:border-[#444]'}`}>
        {icon}
      </div>
      <span className={`font-['JetBrains_Mono'] text-[9px] tracking-[0.2em] transition-colors duration-300
        ${active ? 'text-[#d4af37]/80' : 'text-[#555] group-hover:text-[#aaa]'}`}>
        {label}
      </span>
    </div>
  );
}

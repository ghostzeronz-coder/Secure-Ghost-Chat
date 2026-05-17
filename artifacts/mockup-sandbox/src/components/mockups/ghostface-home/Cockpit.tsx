import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Activity, 
  MessageSquare, 
  Phone, 
  Wallet, 
  AlertTriangle, 
  Wifi, 
  Globe, 
  Clock, 
  Terminal,
  Key
} from 'lucide-react';
import './_cockpit.css';

export function Cockpit() {
  const [ping, setPing] = useState(42);
  const [keyAge, setKeyAge] = useState(3600 * 24 * 7 - 1205);

  useEffect(() => {
    const interval = setInterval(() => {
      setPing(prev => {
        const newPing = prev + Math.floor(Math.random() * 7) - 3;
        return Math.max(12, Math.min(150, newPing));
      });
      setKeyAge(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="cockpit-container grid-bg min-h-[100dvh] bg-[#050505] text-[#FFB800] p-4 flex flex-col relative overflow-hidden select-none font-mono tracking-tight">
      
      {/* HUD Header */}
      <header className="flex justify-between items-end border-b border-[#FFB800]/20 pb-2 mb-4">
        <div className="flex flex-col">
          <span className="text-[9px] text-[#FFB800]/60 mb-1">CALL-SIGN</span>
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-[#22C55E]" />
            <span className="text-sm font-bold text-white tracking-widest">GHOST_00</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-[#FFB800]/60 mb-1">SYS_STAT</span>
          <span className="text-sm font-bold text-[#22C55E] tracking-widest">ONLINE</span>
        </div>
      </header>

      {/* Main Readouts */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 p-3 rounded-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[9px] text-[#FFB800]/60">CIPHER_SUITE</span>
            <Lock size={12} className="text-[#FFB800]/40" />
          </div>
          <div className="text-xs text-white">CHACHA20-POLY1305</div>
        </div>
        
        <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 p-3 rounded-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[9px] text-[#FFB800]/60">KEY_ROTATION_IN</span>
            <Key size={12} className="text-[#FFB800]/40" />
          </div>
          <div className="text-xs text-white tabular-nums">{formatTime(keyAge)}</div>
        </div>

        <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 p-3 rounded-sm col-span-2 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield size={14} className="text-[#22C55E]" />
            <div className="flex flex-col">
              <span className="text-[9px] text-[#FFB800]/60">THREATS_BLOCKED_24H</span>
              <span className="text-sm text-white">1,402</span>
            </div>
          </div>
          <div className="flex gap-1 h-4">
             {[1,2,3,4,5,6].map(i => (
               <div key={i} className={`w-1 bg-[#22C55E] ${i > 4 ? 'opacity-30' : ''}`} />
             ))}
          </div>
        </div>
      </div>

      {/* Net Module */}
      <div className="border border-[#FFB800]/20 bg-[#0A0A0A] p-3 mb-6 rounded-sm">
        <div className="flex items-center justify-between mb-3 border-b border-[#FFB800]/20 pb-2">
          <div className="flex items-center gap-2">
            <Globe size={12} className="text-[#FFB800]" />
            <span className="text-[10px] font-bold tracking-widest text-[#FFB800]">NET_ROUTING</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse-fast"></span>
            <span className="text-[9px] text-[#22C55E]">SECURED</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-[#FFB800]/60">EXIT_NODE</span>
            <span className="text-white">ch-zurich-04</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[#FFB800]/60">IP_ADDR</span>
            <span className="text-white">194.5.212.18</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[#FFB800]/60">LATENCY</span>
            <span className={`tabular-nums ${ping > 100 ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>{ping} ms</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[#FFB800]/60">CIRCUIT</span>
            <span className="text-white truncate max-w-[150px]">gH8f...2xP → pL9...1qZ → ch4...</span>
          </div>
        </div>
      </div>

      {/* Action Channels */}
      <div className="flex-1">
        <div className="text-[9px] text-[#FFB800]/60 mb-2 flex items-center gap-2">
          <Terminal size={10} />
          <span>SECURE_CHANNELS</span>
        </div>
        
        <div className="space-y-2">
          <button className="w-full flex items-center justify-between bg-[#111] border border-[#FFB800]/30 p-3 rounded-sm hover:bg-[#FFB800]/10 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#FFB800]/10 rounded border border-[#FFB800]/20 group-hover:bg-[#FFB800]/20">
                <MessageSquare size={14} className="text-[#FFB800]" />
              </div>
              <span className="text-xs font-bold text-white tracking-widest">MSG_UPLINK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#FFB800] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">3 UNREAD</span>
            </div>
          </button>

          <button className="w-full flex items-center justify-between bg-[#111] border border-[#FFB800]/30 p-3 rounded-sm hover:bg-[#FFB800]/10 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#FFB800]/10 rounded border border-[#FFB800]/20 group-hover:bg-[#FFB800]/20">
                <Phone size={14} className="text-[#FFB800]" />
              </div>
              <span className="text-xs font-bold text-white tracking-widest">VOICE_COMM</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#FFB800]/60">[STANDBY]</span>
            </div>
          </button>

          <button className="w-full flex items-center justify-between bg-[#111] border border-[#22C55E]/30 p-3 rounded-sm hover:bg-[#22C55E]/10 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#22C55E]/10 rounded border border-[#22C55E]/20">
                <Shield size={14} className="text-[#22C55E]" />
              </div>
              <span className="text-xs font-bold text-white tracking-widest">VPN_TUNNEL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse-fast"></span>
              <span className="text-[9px] text-[#22C55E]">ACTIVE</span>
            </div>
          </button>

          <button className="w-full flex items-center justify-between bg-[#111] border border-[#FFB800]/30 p-3 rounded-sm hover:bg-[#FFB800]/10 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#FFB800]/10 rounded border border-[#FFB800]/20 group-hover:bg-[#FFB800]/20">
                <Wallet size={14} className="text-[#FFB800]" />
              </div>
              <span className="text-xs font-bold text-white tracking-widest">CRYPTO_VAULT</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white">0.0450 BTC</span>
            </div>
          </button>
        </div>
      </div>

      {/* Panic Wipe Lever */}
      <div className="mt-6 pt-4 border-t border-[#EF4444]/30">
        <button className="w-full hazard-bg border-2 border-[#EF4444] rounded-sm py-4 relative overflow-hidden flex items-center justify-center gap-2 hazard-stripe transition-transform active:scale-[0.98]">
          <div className="absolute inset-0 bg-[#EF4444]/10"></div>
          <AlertTriangle size={16} className="text-white relative z-10 drop-shadow-md" />
          <span className="text-white font-bold tracking-[0.2em] relative z-10 drop-shadow-md">PANIC_WIPE</span>
        </button>
      </div>

    </div>
  );
}
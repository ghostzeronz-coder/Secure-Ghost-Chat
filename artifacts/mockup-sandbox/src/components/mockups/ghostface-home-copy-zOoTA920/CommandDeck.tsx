import React from "react";
import { MessageSquare, Phone, Shield, Wallet, AlertTriangle } from "lucide-react";

export function CommandDeck() {
  return (
    <div 
      className="min-h-screen w-full flex flex-col text-[#F0F0F0] font-sans relative pb-8"
      style={{ background: "#000000" }}
    >
      {/* Top Command Bar */}
      <div className="flex w-full px-2 pt-12 pb-4 gap-2 border-b border-[#1E1E1E]">
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0D0D0D] border-l-2 border-[#00FF88] rounded-md py-2 px-1 relative">
          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse"></div>
          <span className="text-[10px] text-[#00FF88] font-mono uppercase tracking-wider text-center leading-tight">VPN · 🇺🇸 NYC</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0D0D0D] border-l-2 border-[#00FF88] rounded-md py-2 px-1 relative">
          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse"></div>
          <span className="text-[10px] text-[#00FF88] font-mono uppercase tracking-wider text-center leading-tight">E2EE</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0D0D0D] border-l-2 border-[#00FF88] rounded-md py-2 px-1 relative">
          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse"></div>
          <span className="text-[10px] text-[#00FF88] font-mono uppercase tracking-wider text-center leading-tight">ID MASKED</span>
        </div>
      </div>

      {/* Identity Section */}
      <div className="flex flex-col items-center justify-center py-10 px-6">
        <img 
          src="/__mockup/images/ghostlogo.png" 
          alt="Ghost Logo" 
          className="w-[100px] h-[100px] object-contain mb-6 opacity-90 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        />
        <h1 className="text-3xl font-light tracking-[0.3em] text-white mb-2">GHOST_7X</h1>
        <p className="text-xs text-[#666666] tracking-[0.2em] font-mono">SECURE IDENTITY</p>
      </div>

      <div className="w-full h-px bg-[#1E1E1E] my-2"></div>

      {/* Wallet Stack */}
      <div className="px-6 py-6 flex flex-col gap-4">
        {/* FD Card */}
        <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#F0F0F0] font-bold text-xl">
              FD
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-mono text-[#00C8FF]">1,250</span>
            </div>
          </div>
          <span className="text-xs text-[#666666] tracking-widest font-mono">FACE DOLLAR</span>
        </div>

        {/* CSPR Card */}
        <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#F0F0F0] font-bold text-xl">
              CS
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-mono text-[#00C8FF]">847</span>
            </div>
          </div>
          <span className="text-xs text-[#666666] tracking-widest font-mono">CASPER</span>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Quick Actions */}
      <div className="px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex flex-col items-center gap-3">
            <button className="w-14 h-14 rounded-full bg-[#0D0D0D] border border-[#1E1E1E] flex items-center justify-center text-[#F0F0F0] active:scale-95 transition-transform">
              <MessageSquare size={24} />
            </button>
            <span className="text-[10px] text-[#666666] tracking-wider font-mono">NEW MSG</span>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <button className="w-14 h-14 rounded-full bg-[#0D0D0D] border border-[#1E1E1E] flex items-center justify-center text-[#F0F0F0] active:scale-95 transition-transform">
              <Phone size={24} />
            </button>
            <span className="text-[10px] text-[#666666] tracking-wider font-mono">CALL</span>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <button className="w-14 h-14 rounded-full bg-[#0D0D0D] border border-[#00C8FF] flex items-center justify-center text-[#00C8FF] active:scale-95 transition-transform shadow-[0_0_15px_rgba(0,200,255,0.15)]">
              <Shield size={24} />
            </button>
            <span className="text-[10px] text-[#00C8FF] tracking-wider font-mono">VPN</span>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <button className="w-14 h-14 rounded-full bg-[#0D0D0D] border border-[#1E1E1E] flex items-center justify-center text-[#F0F0F0] active:scale-95 transition-transform">
              <Wallet size={24} />
            </button>
            <span className="text-[10px] text-[#666666] tracking-wider font-mono">WALLET</span>
          </div>
        </div>

        {/* Panic Button */}
        <button className="w-full py-4 rounded-xl border-2 border-[#7f1d1d] bg-[#ef4444]/10 text-[#FF3B30] flex items-center justify-center gap-2 active:bg-[#ef4444]/20 transition-colors">
          <AlertTriangle size={20} className="animate-pulse" />
          <span className="font-mono tracking-[0.2em] font-bold text-sm">PANIC WIPE</span>
        </button>
      </div>
    </div>
  );
}

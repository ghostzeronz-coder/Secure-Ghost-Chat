import React from 'react';
import { MessageSquare, Phone, Shield, Wallet, AlertTriangle } from 'lucide-react';

export function SplitIdentityTight() {
  return (
    <div style={{ background: '#000000' }} className="min-h-screen text-[#F0F0F0] font-mono flex flex-col p-4 space-y-4 max-w-md mx-auto relative pb-8 pt-12">
      
      {/* Header / Identity Block */}
      <div className="flex bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl overflow-hidden">
        {/* Left Column */}
        <div className="flex-1 py-8 px-5 flex flex-col items-center justify-center">
          <img src="/__mockup/images/ghostlogo.png" alt="Ghost Logo" className="w-[88px] h-[88px] mb-5 object-contain" />
          <div className="text-[#00FF88] text-2xl tracking-[0.25em] font-bold">GHOST_7X</div>
        </div>
        
        {/* Right Column */}
        <div className="flex-1 flex flex-col justify-center p-5 pl-0">
          <div className="border-l border-[#1E1E1E] pl-4 space-y-4 flex flex-col justify-center h-full">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88]"></div>
              <span className="text-sm text-[#F0F0F0]">VPN_ACTIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88]"></div>
              <span className="text-sm text-[#F0F0F0]">TOR_ROUTED</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88]"></div>
              <span className="text-sm text-[#F0F0F0]">P2P_SECURE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions 2x2 Grid */}
      <div className="grid grid-cols-2 gap-4">
        <button className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl py-5 px-4 flex flex-col items-center justify-center active:scale-95 transition-transform">
          <Phone className="w-5 h-5 text-[#00C8FF] mb-2" />
          <span className="text-xs text-[#F0F0F0] tracking-widest">CALL</span>
        </button>
        <button className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl py-5 px-4 flex flex-col items-center justify-center active:scale-95 transition-transform">
          <MessageSquare className="w-5 h-5 text-[#00C8FF] mb-2" />
          <span className="text-xs text-[#F0F0F0] tracking-widest">MESSAGE</span>
        </button>
        <button className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl py-5 px-4 flex flex-col items-center justify-center active:scale-95 transition-transform">
          <Shield className="w-5 h-5 text-[#00C8FF] mb-2" />
          <span className="text-xs text-[#F0F0F0] tracking-widest">NUMBERS</span>
        </button>
        <button className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl py-5 px-4 flex flex-col items-center justify-center active:scale-95 transition-transform">
          <Wallet className="w-5 h-5 text-[#00C8FF] mb-2" />
          <span className="text-xs text-[#F0F0F0] tracking-widest">WALLET</span>
        </button>
      </div>

      {/* Unified Wallet Card */}
      <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl p-5 flex justify-between items-center">
         <div className="flex flex-col">
           <span className="text-xl font-mono text-[#00C8FF]">3.42M</span>
           <span className="text-xs text-[#666666] tracking-widest">FD</span>
         </div>
         <div className="h-10 w-px bg-[#1E1E1E]"></div>
         <div className="flex flex-col text-right">
           <span className="text-xl font-mono text-[#00C8FF]">142.5K</span>
           <span className="text-xs text-[#666666] tracking-widest">CSPR</span>
         </div>
      </div>
      
      <div className="flex-1 min-h-[40px]"></div>

      {/* Panic Button */}
      <div className="flex justify-center mt-8 pb-4">
        <button className="border border-[#7f1d1d] rounded-full px-8 py-3 text-[#ef4444] bg-[#ef4444]/5 flex items-center gap-2 active:scale-95 transition-transform">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm tracking-widest font-bold">PANIC</span>
        </button>
      </div>

    </div>
  );
}

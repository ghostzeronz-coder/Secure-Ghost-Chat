import React from 'react';
import { MessageSquare, Phone, Shield, Wallet, AlertTriangle } from 'lucide-react';

export function SplitIdentityElevated() {
  return (
    <div style={{ background: '#000000' }} className="min-h-screen text-[#F0F0F0] font-mono p-4 flex flex-col gap-6">
      
      {/* Header Block */}
      <div className="flex bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl overflow-hidden">
        {/* Left Column - Identity */}
        <div 
          className="flex-1 p-6 flex flex-col items-center justify-center gap-6 border-r border-[#1E1E1E]"
          style={{ background: 'linear-gradient(to right, #0A0A0A, transparent)' }}
        >
          <div 
            className="rounded-full flex items-center justify-center"
            style={{ 
              boxShadow: '0 0 20px 10px rgba(255,255,255,0.08)',
              width: 80,
              height: 80,
              backgroundColor: '#050505'
            }}
          >
            <img 
              src="/__mockup/images/ghostlogo.png" 
              alt="Ghost" 
              className="w-12 h-12 opacity-90"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}
            />
          </div>
          <div className="text-3xl font-light tracking-[0.3em] text-white">GHOST_7X</div>
        </div>

        {/* Right Column - Status */}
        <div className="flex-1 p-6 flex flex-col justify-center gap-5">
          <div className="flex items-center gap-2 border-l-2 border-[#00FF88] pl-3">
            <div className="w-2 h-2 rounded-full bg-[#00FF88]" style={{ boxShadow: '0 0 8px #00FF88' }} />
            <span className="text-sm text-[#00FF88] uppercase tracking-wider">Network</span>
          </div>
          <div className="flex items-center gap-2 border-l-2 border-[#00FF88] pl-3">
            <div className="w-2 h-2 rounded-full bg-[#00FF88]" style={{ boxShadow: '0 0 8px #00FF88' }} />
            <span className="text-sm text-[#00FF88] uppercase tracking-wider">VPN Active</span>
          </div>
          <div className="flex items-center gap-2 border-l-2 border-[#00FF88] pl-3">
            <div className="w-2 h-2 rounded-full bg-[#00FF88]" style={{ boxShadow: '0 0 8px #00FF88' }} />
            <span className="text-sm text-[#00FF88] uppercase tracking-wider">Stealth</span>
          </div>
        </div>
      </div>

      {/* Unified Wallet Card */}
      <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl p-6 flex items-center justify-between">
        <div className="flex-1 flex flex-col items-center gap-2">
          <span className="text-xs text-[#666666] tracking-widest uppercase">FD Balance</span>
          <span className="text-2xl font-mono text-[#00C8FF]" style={{ textShadow: '0 0 12px rgba(0,200,255,0.3)' }}>
            $2,450.00
          </span>
        </div>
        
        <div className="h-12 w-px" style={{ background: 'linear-gradient(to bottom, transparent, #1E1E1E, transparent)' }} />
        
        <div className="flex-1 flex flex-col items-center gap-2">
          <span className="text-xs text-[#666666] tracking-widest uppercase">CSPR Balance</span>
          <span className="text-2xl font-mono text-[#00C8FF]" style={{ textShadow: '0 0 12px rgba(0,200,255,0.3)' }}>
            1,245.50
          </span>
        </div>
      </div>

      {/* 2x2 Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: MessageSquare, label: "SECURE CHAT" },
          { icon: Phone, label: "VOIP CALL" },
          { icon: Shield, label: "BURN LOGS" },
          { icon: Wallet, label: "TRANSFER" }
        ].map((action, i) => (
          <button
            key={i}
            className="flex flex-col items-center justify-center gap-3 py-5 rounded-xl border border-[#1E1E1E] active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #111111, #0D0D0D)' }}
          >
            <action.icon className="w-6 h-6 text-[#00C8FF]" />
            <span className="text-xs tracking-widest text-[#F0F0F0]">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Panic Button */}
      <button className="mt-8 flex items-center justify-center gap-3 py-4 rounded-full border border-[#7f1d1d] bg-[#ef4444]/5 active:bg-[#ef4444]/20 transition-colors">
        <AlertTriangle className="w-5 h-5 text-[#ef4444] opacity-70" />
        <span className="text-[#ef4444] text-sm tracking-[0.3em] uppercase">Emergency Wipe</span>
      </button>

    </div>
  );
}

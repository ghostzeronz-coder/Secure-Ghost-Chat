import React from 'react';
import { MessageSquare, Phone, Shield, Wallet, AlertTriangle } from 'lucide-react';

export default function SplitIdentity() {
  return (
    <div className="min-h-screen w-full flex flex-col font-mono text-sm safe-area-pt pb-8" style={{ background: '#000000', color: '#F0F0F0' }}>
      {/* Identity Block (Split) */}
      <div className="flex border-b" style={{ borderColor: '#1E1E1E' }}>
        {/* Left Column (40%) */}
        <div className="w-[40%] flex flex-col items-center justify-center p-6 border-r" style={{ borderColor: '#1E1E1E' }}>
          <img src="/__mockup/images/ghostlogo.png" alt="Ghostface Logo" className="w-20 h-20 mb-4 opacity-90" />
          <h1 className="tracking-widest font-bold text-lg mb-1 text-center">GHOST_7X</h1>
          <p className="text-xs tracking-wider text-center" style={{ color: '#666666' }}>SECURE IDENTITY</p>
        </div>

        {/* Right Column (60%) */}
        <div className="w-[60%] flex flex-col justify-center p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#00FF88', boxShadow: '0 0 8px #00FF88' }} />
            <span className="font-bold tracking-wider text-xs" style={{ color: '#00FF88' }}>VPN · 🇺🇸 NYC</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#00FF88', boxShadow: '0 0 8px #00FF88' }} />
            <span className="font-bold tracking-wider text-xs" style={{ color: '#00FF88' }}>E2EE</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#00FF88', boxShadow: '0 0 8px #00FF88' }} />
            <span className="font-bold tracking-wider text-xs" style={{ color: '#00FF88' }}>ID MASKED</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 flex-1 flex flex-col">
        {/* Unified Wallet Card */}
        <div className="flex border rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: '#0D0D0D', borderColor: '#1E1E1E' }}>
          <div className="flex-1 p-5 border-r flex flex-col items-center justify-center" style={{ borderColor: '#1E1E1E' }}>
            <span className="text-xs mb-2 font-semibold tracking-wider" style={{ color: '#666666' }}>FACE DOLLAR</span>
            <span className="text-xl font-bold tracking-tight">1,250 <span className="text-xs opacity-50">FD</span></span>
          </div>
          <div className="flex-1 p-5 flex flex-col items-center justify-center">
            <span className="text-xs mb-2 font-semibold tracking-wider" style={{ color: '#9945FF' }}>CASPER</span>
            <span className="text-xl font-bold tracking-tight">847 <span className="text-xs opacity-50">CSPR</span></span>
          </div>
        </div>

        {/* Quick Actions (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <button className="flex flex-col items-center justify-center p-6 border rounded-xl transition-colors active:opacity-70" style={{ backgroundColor: '#0D0D0D', borderColor: '#1E1E1E' }}>
            <MessageSquare className="w-6 h-6 mb-3" style={{ color: '#00C8FF' }} />
            <span className="text-xs tracking-wider font-bold">NEW MSG</span>
          </button>
          
          <button className="flex flex-col items-center justify-center p-6 border rounded-xl transition-colors active:opacity-70" style={{ backgroundColor: '#0D0D0D', borderColor: '#1E1E1E' }}>
            <Phone className="w-6 h-6 mb-3" style={{ color: '#00C8FF' }} />
            <span className="text-xs tracking-wider font-bold">CALL</span>
          </button>
          
          <button className="flex flex-col items-center justify-center p-6 border rounded-xl transition-colors active:opacity-70" style={{ backgroundColor: '#0D0D0D', borderColor: '#1E1E1E' }}>
            <Shield className="w-6 h-6 mb-3" style={{ color: '#00C8FF' }} />
            <span className="text-xs tracking-wider font-bold">VPN</span>
          </button>
          
          <button className="flex flex-col items-center justify-center p-6 border rounded-xl transition-colors active:opacity-70" style={{ backgroundColor: '#0D0D0D', borderColor: '#1E1E1E' }}>
            <Wallet className="w-6 h-6 mb-3" style={{ color: '#00C8FF' }} />
            <span className="text-xs tracking-wider font-bold">WALLET</span>
          </button>
        </div>
      </div>

      {/* Panic Wipe (minimal) */}
      <div className="px-4 mt-auto mb-8 flex justify-center">
        <button className="flex items-center space-x-2 py-4 px-8 rounded-full active:opacity-70 transition-opacity" style={{ color: '#FF3B30' }}>
          <AlertTriangle className="w-5 h-5" />
          <span className="font-bold tracking-widest text-sm">PANIC WIPE</span>
        </button>
      </div>
    </div>
  );
}

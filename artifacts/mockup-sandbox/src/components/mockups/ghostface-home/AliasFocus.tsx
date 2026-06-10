import React from 'react';
import { MessageSquare, Phone, Shield, Wallet, AlertTriangle } from 'lucide-react';

export default function AliasFocus() {
  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans overflow-y-auto" 
      style={{ background: '#000000', color: '#F0F0F0' }}
    >
      <div className="pt-16 pb-8 px-6 flex-1 flex flex-col">
        
        {/* Header / Hero */}
        <div className="flex flex-col items-center justify-center pt-8 pb-12">
          <img 
            src="/__mockup/images/ghostlogo.png" 
            alt="Ghost Logo" 
            className="w-12 h-12 opacity-80 mb-6 object-contain"
          />
          <h1 
            className="text-[52px] font-black tracking-widest leading-none text-center"
            style={{ textShadow: '0 0 20px rgba(255,255,255,0.05)' }}
          >
            GHOST_7X
          </h1>
          <p className="text-sm font-medium tracking-[0.2em] mt-4" style={{ color: '#666666' }}>
            SECURE IDENTITY
          </p>
        </div>

        {/* Status Rows */}
        <div className="flex flex-col gap-3 mb-10 w-full max-w-sm mx-auto">
          {[
            { label: 'VPN · 🇺🇸 NYC', color: '#00FF88' },
            { label: 'E2EE', color: '#00FF88' },
            { label: 'ID MASKED', color: '#00FF88' },
          ].map((status, i) => (
            <div 
              key={i}
              className="flex items-center justify-between px-5 py-3.5 rounded-full border w-full"
              style={{ background: '#0D0D0D', borderColor: '#1E1E1E' }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-2 h-2 rounded-full animate-pulse" 
                  style={{ backgroundColor: status.color, boxShadow: `0 0 10px ${status.color}` }} 
                />
                <span className="text-xs font-semibold tracking-widest" style={{ color: '#F0F0F0' }}>
                  {status.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Wallet Balances */}
        <div 
          className="flex items-center rounded-2xl border mb-10 w-full max-w-sm mx-auto"
          style={{ background: '#0D0D0D', borderColor: '#1E1E1E' }}
        >
          <div className="flex-1 py-4 px-4 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold tracking-widest mb-1" style={{ color: '#666666' }}>FACE DOLLAR</span>
            <span className="text-sm font-medium tracking-wide">1,250 <span className="text-xs text-muted" style={{color: '#666666'}}>FD</span></span>
          </div>
          <div className="w-[1px] h-10" style={{ background: '#1E1E1E' }}></div>
          <div className="flex-1 py-4 px-4 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold tracking-widest mb-1" style={{ color: '#666666' }}>CASPER</span>
            <span className="text-sm font-medium tracking-wide">847 <span className="text-xs text-muted" style={{color: '#666666'}}>CSPR</span></span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full overflow-x-auto no-scrollbar pb-8 -mx-6 px-6">
          <div className="flex gap-3 min-w-max mx-auto justify-center md:justify-start">
            {[
              { icon: MessageSquare, label: 'NEW MSG' },
              { icon: Phone, label: 'CALL' },
              { icon: Shield, label: 'VPN' },
              { icon: Wallet, label: 'WALLET' },
            ].map((action, i) => (
              <button 
                key={i}
                className="flex items-center gap-2.5 px-5 py-3 rounded-full border whitespace-nowrap active:scale-95 transition-transform"
                style={{ background: '#0D0D0D', borderColor: '#1E1E1E' }}
              >
                <action.icon size={16} style={{ color: '#00C8FF' }} />
                <span className="text-xs font-bold tracking-widest">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-[40px]" />

        {/* Panic Wipe */}
        <div className="pb-4 pt-4 flex justify-center mt-auto">
          <button className="flex items-center gap-2.5 active:opacity-70 transition-opacity">
            <AlertTriangle size={16} style={{ color: '#FF3B30' }} />
            <span className="text-[11px] font-bold tracking-[0.2em]" style={{ color: '#FF3B30' }}>
              PANIC WIPE
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}

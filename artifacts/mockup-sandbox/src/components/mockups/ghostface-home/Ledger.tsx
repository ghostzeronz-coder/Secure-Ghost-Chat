import React, { useState, useEffect } from "react";
import { Shield, MessageSquare, Phone, Wallet, AlertTriangle } from "lucide-react";

export function Ledger() {
  const [time, setTime] = useState("");
  const [wipeProgress, setWipeProgress] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleWipePress = (e: React.MouseEvent | React.TouchEvent) => {
    // visual feedback for wiping
  };

  const logs = [
    {
      day: "TODAY",
      events: [
        { time: "12:04", text: "VPN rotated → Reykjavik (38 ms)" },
        { time: "11:58", text: "Tor circuit refreshed" },
        { time: "11:31", text: "3 messages decrypted" },
        { time: "10:15", text: "Key rotation complete" },
        { time: "09:42", text: "Burner SMS received (ghost #4471)" },
        { time: "08:00", text: "System boot sequence verified" },
      ],
    },
    {
      day: "YESTERDAY",
      events: [
        { time: "23:45", text: "Background sync complete" },
        { time: "18:22", text: "Panic drill executed in 0.4s" },
        { time: "14:10", text: "Outbound call encrypted (14m 20s)" },
        { time: "09:05", text: "Wallet balance verified" },
      ],
    },
    {
      day: "MON",
      events: [
        { time: "16:40", text: "248 trackers blocked" },
        { time: "11:11", text: "Identity payload synchronized" },
        { time: "07:30", text: "VPN connected → Zurich (45 ms)" },
      ],
    },
    {
      day: "SUN",
      events: [
        { time: "20:00", text: "Weekly key digest rotated" },
        { time: "15:21", text: "Secure file wiped" },
      ],
    },
    {
      day: "SAT",
      events: [
        { time: "12:00", text: "Device integrity check passed" },
      ],
    },
    {
      day: "FRI",
      events: [
        { time: "09:00", text: "Network anonymization enabled" },
      ],
    },
    {
      day: "THU",
      events: [
        { time: "18:00", text: "Deep scan complete. 0 threats found." },
      ],
    }
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#111111] text-[#E0E0E0] font-sans selection:bg-[#FFB800] selection:text-black overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap'); .font-mono { font-family: 'JetBrains Mono', monospace; } ::-webkit-scrollbar { width: 0px; background: transparent; }" }} />

      {/* Top Bar */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-[#333333] bg-[#111111]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FFB800] shadow-[0_0_8px_#FFB800]"></div>
          <span className="font-mono text-xs font-bold tracking-widest text-[#FFB800]">GHOST_00</span>
        </div>
        <div className="font-mono text-[10px] text-[#888888]">
          SYNCED {time}
        </div>
      </div>

      {/* Scrolling Ledger Feed */}
      <div className="flex-1 overflow-y-auto pb-48 pt-4 px-4 space-y-8">
        {logs.map((group, i) => (
          <div key={i} className="space-y-3">
            <div className="sticky top-0 bg-[#111111]/90 backdrop-blur pb-2 pt-1 z-10">
              <span className="font-mono text-[10px] font-bold text-[#666666] tracking-widest">{group.day}</span>
            </div>
            <div className="space-y-3 pl-1">
              {group.events.map((ev, j) => (
                <div key={j} className="flex items-start gap-4 group">
                  <span className="font-mono text-xs text-[#555555] shrink-0 mt-[2px] w-12">{ev.time}</span>
                  <span className="text-sm text-[#CCCCCC] leading-tight font-mono tracking-tight group-hover:text-white transition-colors">
                    {ev.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Actions Container */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent pt-12">
        {/* Navigation Pills */}
        <div className="px-4 pb-6">
          <div className="flex justify-between gap-2 p-1.5 bg-[#1A1A1A] rounded-2xl border border-[#333333]">
            <button className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-[#252525] transition-colors group">
              <MessageSquare size={16} className="text-[#888888] group-hover:text-white transition-colors" />
              <span className="font-mono text-[9px] tracking-wider text-[#888888] group-hover:text-white">MSG</span>
            </button>
            <button className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-[#252525] transition-colors group">
              <Phone size={16} className="text-[#888888] group-hover:text-white transition-colors" />
              <span className="font-mono text-[9px] tracking-wider text-[#888888] group-hover:text-white">CALL</span>
            </button>
            <button className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#252525] border border-[#444444] shadow-[0_0_10px_rgba(255,184,0,0.1)] group">
              <Shield size={16} className="text-[#FFB800]" />
              <span className="font-mono text-[9px] tracking-wider text-[#FFB800] font-bold">VPN</span>
            </button>
            <button className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl hover:bg-[#252525] transition-colors group">
              <Wallet size={16} className="text-[#888888] group-hover:text-white transition-colors" />
              <span className="font-mono text-[9px] tracking-wider text-[#888888] group-hover:text-white">WALLET</span>
            </button>
          </div>
        </div>

        {/* Panic Wipe Strip */}
        <button 
          className="w-full h-12 bg-[#2a0808] border-t border-[#4a0f0f] flex items-center justify-center gap-3 relative overflow-hidden active:bg-[#4a0f0f] transition-colors group"
          onMouseDown={() => setWipeProgress(100)}
          onMouseUp={() => setWipeProgress(0)}
          onMouseLeave={() => setWipeProgress(0)}
          onTouchStart={() => setWipeProgress(100)}
          onTouchEnd={() => setWipeProgress(0)}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 bg-[#7f1d1d] transition-all duration-[3000ms] ease-linear"
            style={{ width: `${wipeProgress}%` }}
          />
          <AlertTriangle size={14} className="text-[#ef4444] z-10 group-active:text-[#ff8888]" />
          <span className="font-mono text-[10px] font-bold tracking-widest text-[#ef4444] z-10 group-active:text-[#ff8888]">
            HOLD TO WIPE — 3s
          </span>
        </button>
      </div>
    </div>
  );
}

import React, { memo, useState } from 'react';
import { MapPin, Radio, Palette, Loader2 } from 'lucide-react';
export type NicheCardVariant = 'crafts' | 'sports' | 'gaming';
interface NicheCardProps {
  variant: NicheCardVariant;
  title: string;
  venue: string;
  status?: string;
  date?: string;
  eventId?: string;
  onJoin?: (eventId: string) => Promise<void>;
  isJoining?: boolean;
}
export const NicheCard = memo(function NicheCard({
  variant,
  title,
  venue,
  status,
  date,
  eventId,
  onJoin,
  isJoining = false,
}: NicheCardProps) {
  const [localJoining, setLocalJoining] = useState(false);
  const joining = isJoining || localJoining;

  const handleJoin = async () => {
    if (!eventId || !onJoin || joining) return;
    setLocalJoining(true);
    try {
      await onJoin(eventId);
    } finally {
      setLocalJoining(false);
    }
  };
  // CRAFTS VARIANT (Soft / Museum)
  if (variant === 'crafts') {
    return <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-[#F5F1E8] shadow-lg group cursor-pointer border border-[#E6E0D0]">
        {/* Paper Texture Overlay */}
        <div className="absolute inset-0 bg-paper-texture pointer-events-none mix-blend-multiply"></div>

        {/* Content */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="bg-[#E8E1D0] p-2 rounded-full text-[#8A7E70]">
              <Palette size={18} />
            </div>
            {status && <span className="text-[#8A7E70] text-xs font-serif-display italic tracking-wide">
                {status}
              </span>}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[#8A7E70] text-xs font-medium uppercase tracking-widest">
                Workshop
              </p>
              <h3 className="text-2xl font-serif-display font-bold text-[#4A4036] leading-tight italic">
                {title}
              </h3>
              <p className="text-[#6B5E50] text-sm font-serif-display flex items-center gap-1.5">
                <MapPin size={12} /> {venue}
              </p>
            </div>

            <button 
              onClick={handleJoin}
              disabled={joining || !eventId || !onJoin}
              className="w-full bg-[#D4886F] text-[#F5F1E8] font-serif-display font-semibold py-3 rounded-xl hover:bg-[#C0765E] transition-colors text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {joining ? 'Reserving...' : 'Reserve Easel'}
            </button>
          </div>
        </div>
      </div>;
  }
  // SPORTS VARIANT (Team / Athletic)
  if (variant === 'sports') {
    return <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-[#FFD700] shadow-xl group cursor-pointer border-2 border-black">
        {/* Athletic Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)',
          backgroundSize: '10px 10px'
        }}></div>
        </div>

        <div className="absolute inset-0 p-5 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="bg-black text-[#FFD700] px-2 py-1 text-xs font-athletic font-bold uppercase tracking-wider -skew-x-12">
              MATCH DAY
            </div>
            <div className="text-black font-athletic font-bold text-lg">
              {date || 'JAN 17'}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-3xl font-athletic font-bold text-black leading-[0.9] uppercase mb-1">
                {title}
              </h3>
              <p className="text-black/80 text-xs font-bold uppercase flex items-center gap-1">
                <MapPin size={12} strokeWidth={3} /> {venue}
              </p>
            </div>

            <button 
              onClick={handleJoin}
              disabled={joining || !eventId || !onJoin}
              className="w-full bg-black text-[#FFD700] font-athletic font-bold py-3 rounded-lg hover:bg-black/90 transition-colors text-sm uppercase tracking-wide skew-x-0 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {joining ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {joining ? 'Joining...' : 'Match Day Squad'}
            </button>
          </div>
        </div>
      </div>;
  }
  // GAMING VARIANT (Tech / Dashboard)
  return <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden bg-[#0F1115] shadow-lg border border-zinc-800 group cursor-pointer">
      {/* Tactical Map Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 50 L40 60 L80 40" stroke="#00FF88" strokeWidth="1" fill="none" opacity="0.5" />
          <circle cx="40" cy="60" r="3" fill="#00FF88" />
          <circle cx="80" cy="40" r="3" fill="#00FF88" />
          <circle cx="20" cy="50" r="3" fill="#00FF88" />
        </svg>
      </div>

      {/* Status Indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF88] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF88]"></span>
        </span>
        <span className="text-[#00FF88] text-[10px] font-mono-tech uppercase tracking-widest">
          {status || 'LIVE'}
        </span>
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white mb-2">
            <Radio size={18} className="text-[#00FF88]" />
          </div>
          <h3 className="text-lg font-bold text-white leading-tight font-mono-tech">
            {title}
          </h3>
          <p className="text-zinc-500 text-xs font-mono-tech">{venue}</p>
        </div>

        <button 
          onClick={handleJoin}
          disabled={joining || !eventId || !onJoin}
          className="mt-4 w-full bg-[#00FF88] text-black font-bold py-2.5 rounded-lg hover:bg-[#00cc6a] transition-colors text-xs font-mono-tech uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {joining ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          {joining ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>;
});
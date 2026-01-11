import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
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

  // CRAFTS VARIANT - 2026: Warm gradient, refined elegance
  if (variant === 'crafts') {
    return (
      <motion.div 
        className="relative w-full aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 shadow-apple-md group cursor-pointer border border-orange-100/50"
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Content */}
        <div className="absolute inset-0 p-5 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="bg-white/80 backdrop-blur-sm p-2.5 rounded-2xl text-orange-600 shadow-apple-sm">
              <Palette size={18} />
            </div>
            {status && (
              <span className="text-orange-600/80 text-xs font-serif-display italic tracking-wide bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full">
                {status}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-orange-600/70 text-xs font-medium uppercase tracking-widest">
                Workshop
              </p>
              <h3 className="text-xl font-serif-display font-bold text-zinc-800 leading-tight">
                {title}
              </h3>
              <p className="text-zinc-600 text-sm flex items-center gap-1.5">
                <MapPin size={12} /> {venue}
              </p>
            </div>

            <button 
              onClick={handleJoin}
              disabled={joining || !eventId || !onJoin}
              className="w-full bg-orange-500 text-white font-semibold py-3.5 min-h-[48px] rounded-2xl hover:bg-orange-600 transition-all text-sm shadow-apple-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {joining && <Loader2 size={16} className="animate-spin" />}
              {joining ? 'Reserving...' : 'Reserve Spot'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // SPORTS VARIANT - 2026: Vibrant amber, clean typography
  if (variant === 'sports') {
    return (
      <motion.div 
        className="relative w-full aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 shadow-apple-md group cursor-pointer"
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <div className="absolute inset-0 p-5 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="bg-zinc-900 text-amber-400 px-3 py-1.5 text-xs font-athletic font-bold uppercase tracking-wider rounded-xl">
              Match Day
            </div>
            <div className="text-zinc-900 font-athletic font-bold text-base bg-white/30 backdrop-blur-sm px-3 py-1 rounded-xl">
              {date || 'JAN 17'}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-athletic font-bold text-zinc-900 leading-[0.95] uppercase mb-2">
                {title}
              </h3>
              <p className="text-zinc-900/70 text-xs font-semibold uppercase flex items-center gap-1.5">
                <MapPin size={12} strokeWidth={2.5} /> {venue}
              </p>
            </div>

            <button 
              onClick={handleJoin}
              disabled={joining || !eventId || !onJoin}
              className="w-full bg-zinc-900 text-amber-400 font-athletic font-bold py-3.5 min-h-[48px] rounded-2xl hover:bg-zinc-800 transition-all text-sm uppercase tracking-wide active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {joining && <Loader2 size={16} className="animate-spin" />}
              {joining ? 'Joining...' : 'Join Squad'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // GAMING VARIANT - 2026: Refined dark with indigo/violet accents
  return (
    <motion.div 
      className="relative w-full aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 shadow-apple-lg border border-zinc-700/50 group cursor-pointer"
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/30 rounded-full blur-2xl"></div>
      </div>

      {/* Status Indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400"></span>
        </span>
        <span className="text-violet-400 text-[10px] font-mono-tech uppercase tracking-widest">
          {status || 'LIVE'}
        </span>
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        <div className="space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white mb-2">
            <Radio size={18} className="text-violet-400" />
          </div>
          <h3 className="text-lg font-bold text-white leading-tight font-mono-tech">
            {title}
          </h3>
          <p className="text-zinc-400 text-xs font-mono-tech">{venue}</p>
        </div>

        <button 
          onClick={handleJoin}
          disabled={joining || !eventId || !onJoin}
          className="mt-4 w-full bg-violet-500 text-white font-bold py-3 min-h-[48px] rounded-2xl hover:bg-violet-600 transition-all text-xs font-mono-tech uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
        >
          {joining && <Loader2 size={14} className="animate-spin" />}
          {joining ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </motion.div>
  );
});

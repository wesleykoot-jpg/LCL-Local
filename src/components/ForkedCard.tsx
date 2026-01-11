import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { CornerDownRight, Users, Loader2 } from 'lucide-react';
import { Facepile } from './Facepile';

interface ForkedCardProps {
  title: string;
  parentEvent: string;
  attendees: Array<{
    id: string;
    image: string;
    alt: string;
  }>;
  extraCount: number;
  className?: string;
  eventId?: string;
  onJoin?: (eventId: string) => Promise<void>;
  isJoining?: boolean;
}

export const ForkedCard = memo(function ForkedCard({
  title,
  parentEvent,
  attendees,
  extraCount,
  className = '',
  eventId,
  onJoin,
  isJoining = false,
}: ForkedCardProps) {
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

  return (
    <motion.div 
      className={`relative w-full rounded-3xl glass-light border border-white/60 shadow-apple-md p-5 flex flex-col gap-4 group ${className}`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Header / Connection */}
      <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium">
        <CornerDownRight size={14} className="text-zinc-400" />
        <span className="tracking-wide truncate">
          Reply to{' '}
          <span className="font-semibold text-zinc-700">{parentEvent}</span>
        </span>
      </div>

      {/* Main Content */}
      <div className="flex justify-between items-center gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-zinc-900 leading-snug line-clamp-2">
            {title}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <Facepile users={attendees} extraCount={extraCount} className="origin-left" />
        {/* 2026: Primary action button - solid black, rounded */}
        <button 
          onClick={handleJoin}
          disabled={joining || !eventId || !onJoin}
          className="px-5 py-2.5 min-h-[48px] rounded-2xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-apple-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          {joining ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Users size={16} />
          )}
          <span>{joining ? 'Joining...' : 'Join'}</span>
        </button>
      </div>
    </motion.div>
  );
});

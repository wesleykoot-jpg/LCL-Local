import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, Users, Loader2 } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { Facepile } from './Facepile';
import { cn } from '@/lib/utils';

interface EventCardProps {
  id: string;
  title: string;
  category: string;
  venue: string;
  date: string;
  time?: string;
  imageUrl?: string;
  matchPercentage?: number;
  attendees?: Array<{ id: string; image: string; alt: string }>;
  extraCount?: number;
  onJoin?: (eventId: string) => Promise<void>;
  isJoining?: boolean;
  className?: string;
}

export const EventCard = memo(function EventCard({
  id,
  title,
  category,
  venue,
  date,
  time,
  imageUrl,
  matchPercentage,
  attendees = [],
  extraCount = 0,
  onJoin,
  isJoining = false,
  className,
}: EventCardProps) {
  const [localJoining, setLocalJoining] = useState(false);
  const joining = isJoining || localJoining;

  const handleJoin = async () => {
    if (!onJoin || joining) return;
    setLocalJoining(true);
    try {
      await onJoin(id);
    } finally {
      setLocalJoining(false);
    }
  };

  const hasImage = !!imageUrl;

  return (
    <motion.div
      className={cn(
        'relative w-full rounded-2xl overflow-hidden',
        'bg-white/5 backdrop-blur-xl border border-white/10',
        'p-5 group cursor-pointer',
        className
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Image Header (if present) */}
      {hasImage && (
        <div className="relative w-full h-40 rounded-xl overflow-hidden mb-4 -mt-1 -mx-1" style={{ width: 'calc(100% + 8px)' }}>
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
          {matchPercentage && (
            <div className="absolute bottom-3 right-3 bg-white/10 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20">
              {matchPercentage}% Match
            </div>
          )}
        </div>
      )}

      {/* Category Badge */}
      <div className="mb-3">
        <CategoryBadge category={category} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-white leading-tight mb-2 line-clamp-2">
        {title}
      </h3>

      {/* Meta Info */}
      <div className="flex flex-wrap items-center gap-3 text-zinc-400 text-sm mb-4">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} />
          <span className="truncate max-w-[120px]">{venue}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={14} />
          <span>{date}{time && ` · ${time}`}</span>
        </div>
      </div>

      {/* Footer: Attendees + Action */}
      <div className="flex items-center justify-between">
        {attendees.length > 0 ? (
          <Facepile users={attendees} extraCount={extraCount} />
        ) : (
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <Users size={14} />
            <span>Be the first!</span>
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={joining || !onJoin}
          className={cn(
            'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
            'bg-white text-zinc-900 hover:bg-zinc-100',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'active:scale-95 flex items-center gap-2'
          )}
        >
          {joining && <Loader2 size={14} className="animate-spin" />}
          <span>{joining ? 'Joining...' : 'Join'}</span>
        </button>
      </div>
    </motion.div>
  );
});

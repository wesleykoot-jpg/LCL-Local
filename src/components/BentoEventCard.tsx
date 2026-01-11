import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Check, Loader2 } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { cn } from '@/lib/utils';

type TileSize = 'hero' | 'tower' | 'standard';

interface BentoEventCardProps {
  id: string;
  title: string;
  category: string;
  venue: string;
  date: string;
  imageUrl?: string;
  attendees?: Array<{ id: string; image: string; name?: string; isFriend?: boolean }>;
  totalAttendees?: number;
  relevanceScore?: number;
  size?: TileSize;
  onJoin?: (eventId: string) => Promise<void>;
  isJoining?: boolean;
  className?: string;
}

const getGridClass = (size: TileSize): string => {
  switch (size) {
    case 'hero':
      return 'col-span-2 row-span-2';
    case 'tower':
      return 'col-span-1 row-span-2';
    default:
      return 'col-span-1 row-span-1';
  }
};

export const BentoEventCard = memo(function BentoEventCard({
  id,
  title,
  category,
  venue,
  date,
  imageUrl,
  attendees = [],
  totalAttendees = 0,
  relevanceScore = 0,
  size = 'standard',
  onJoin,
  isJoining = false,
  className,
}: BentoEventCardProps) {
  const [localJoining, setLocalJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const joining = isJoining || localJoining;

  const friendAttendees = attendees.filter(a => a.isFriend);
  const showFriendBubbles = friendAttendees.length > 0;

  const handleJoin = async () => {
    if (!onJoin || joining || joined) return;
    setLocalJoining(true);
    try {
      await onJoin(id);
      setJoined(true);
    } finally {
      setLocalJoining(false);
    }
  };

  const isLarge = size === 'hero' || size === 'tower';

  return (
    <motion.article
      className={cn(
        'bento-card relative overflow-hidden cursor-pointer group',
        getGridClass(size),
        isLarge ? 'p-5' : 'p-4',
        className
      )}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Background Image (for hero/tower) */}
      {imageUrl && isLarge && (
        <div className="absolute inset-0">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>
      )}

      {/* Friend Avatars - Social Proof Priority */}
      {showFriendBubbles && (
        <div className={cn(
          'absolute z-20',
          isLarge ? 'top-4 right-4' : 'top-3 right-3'
        )}>
          <div className="flex -space-x-2">
            {friendAttendees.slice(0, 3).map((friend, idx) => (
              <motion.div
                key={friend.id}
                initial={{ scale: 0, x: 10 }}
                animate={{ scale: 1, x: 0 }}
                transition={{ delay: idx * 0.1, type: 'spring', stiffness: 500 }}
                className={cn(
                  'rounded-full border-2 border-white shadow-md overflow-hidden',
                  isLarge ? 'w-10 h-10' : 'w-8 h-8'
                )}
              >
                <img
                  src={friend.image}
                  alt={friend.name || 'Friend'}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
            {friendAttendees.length > 3 && (
              <div className={cn(
                'rounded-full border-2 border-white bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold',
                isLarge ? 'w-10 h-10' : 'w-8 h-8'
              )}>
                +{friendAttendees.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'relative z-10 flex flex-col h-full',
        isLarge && imageUrl ? 'justify-end text-white' : ''
      )}>
        {/* Category Tag */}
        <div className="mb-auto">
          <CategoryBadge 
            category={category} 
            className={cn(isLarge && imageUrl && 'bg-white/20 text-white border-white/30')}
          />
        </div>

        {/* Event Info */}
        <div className={cn('mt-3', isLarge ? 'mt-auto' : '')}>
          <h3 className={cn(
            'font-headline leading-tight line-clamp-2 mb-2',
            isLarge ? 'text-xl' : 'text-base',
            isLarge && imageUrl ? 'text-white' : 'text-foreground'
          )}>
            {title}
          </h3>

          {/* Meta */}
          <div className={cn(
            'flex items-center gap-2 text-sm mb-3',
            isLarge && imageUrl ? 'text-white/70' : 'text-muted-foreground'
          )}>
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{venue}</span>
            <span className="opacity-50">·</span>
            <span className="whitespace-nowrap">{date}</span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            {/* Attendee count */}
            {totalAttendees > 0 && (
              <span className={cn(
                'text-sm',
                isLarge && imageUrl ? 'text-white/60' : 'text-muted-foreground'
              )}>
                {totalAttendees} going
              </span>
            )}

            {/* Action Button */}
            <motion.button
              onClick={handleJoin}
              disabled={joining || !onJoin}
              className={cn(
                'ml-auto px-4 py-2 rounded-xl text-sm font-semibold min-h-touch flex items-center gap-2 transition-all',
                joined
                  ? 'bg-emerald-500 text-white'
                  : 'btn-action',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait">
                {joining ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 size={16} className="animate-spin" />
                  </motion.span>
                ) : joined ? (
                  <motion.span
                    key="joined"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <Check size={16} />
                    <span>Joined!</span>
                  </motion.span>
                ) : (
                  <motion.span key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Join
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
});
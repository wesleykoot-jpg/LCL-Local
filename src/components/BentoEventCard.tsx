import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Check, Loader2 } from 'lucide-react';
import { getCategoryConfig } from '@/lib/categories';
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

  const categoryConfig = getCategoryConfig(category);
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
  const isHero = size === 'hero';
  const isTower = size === 'tower';

  return (
    <motion.article
      className={cn(
        'relative overflow-hidden cursor-pointer group rounded-2xl bg-white border border-border/50',
        'border-l-[3px]',
        categoryConfig.accentBorder,
        getGridClass(size),
        className
      )}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Image Section */}
      {imageUrl && (
        <div className={cn(
          'relative overflow-hidden',
          isHero && 'h-[55%]',
          isTower && 'h-[40%]',
          !isLarge && 'absolute top-4 right-4 w-12 h-12 rounded-xl'
        )}>
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          {isLarge && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          )}
        </div>
      )}

      {/* Friend Avatars - Social Proof */}
      {showFriendBubbles && (
        <div className={cn(
          'absolute z-20',
          isLarge ? 'top-3 left-3' : 'bottom-14 right-4'
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
                  isLarge ? 'w-8 h-8' : 'w-7 h-7'
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
                isLarge ? 'w-8 h-8' : 'w-7 h-7'
              )}>
                +{friendAttendees.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'flex flex-col h-full',
        isLarge ? 'p-4' : 'p-4 pr-20'
      )}>
        {/* Category Label - Minimal */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className={cn('w-1.5 h-1.5 rounded-full', categoryConfig.dotClass)} />
          <span className={cn('text-xs font-medium', categoryConfig.textClass)}>
            {categoryConfig.label}
          </span>
        </div>

        {/* Event Title */}
        <h3 className={cn(
          'font-semibold leading-tight line-clamp-2 text-foreground',
          isHero ? 'text-xl mb-2' : isTower ? 'text-lg mb-2' : 'text-base mb-1.5'
        )}>
          {title}
        </h3>

        {/* Meta Info */}
        <div className={cn(
          'flex items-center gap-1.5 text-muted-foreground',
          isLarge ? 'text-sm' : 'text-xs'
        )}>
          <MapPin size={isLarge ? 14 : 12} className="shrink-0 opacity-60" />
          <span className="truncate">{venue}</span>
          <span className="opacity-40">·</span>
          <span className="whitespace-nowrap">{date}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-2" />

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-auto">
          {/* Attendee count */}
          {totalAttendees > 0 && (
            <span className="text-xs text-muted-foreground">
              {totalAttendees} going
            </span>
          )}

          {/* Action Button */}
          <motion.button
            onClick={handleJoin}
            disabled={joining || !onJoin}
            className={cn(
              'ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              joined
                ? 'bg-emerald-500 text-white'
                : 'bg-primary text-primary-foreground shadow-sm hover:shadow-md',
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
                >
                  <Loader2 size={14} className="animate-spin" />
                </motion.span>
              ) : joined ? (
                <motion.span
                  key="joined"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1"
                >
                  <Check size={14} />
                  <span>Joined</span>
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
    </motion.article>
  );
});
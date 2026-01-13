import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Loader2, MapPin } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import type { EventStack } from '@/lib/feedGrouping';
import type { EventWithAttendees } from '@/lib/hooks';
import { CATEGORY_MAP } from '@/lib/categories';
import { hapticImpact } from '@/lib/haptics';

// Fallback images by category - Dutch/Netherlands themed
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  active: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=900&q=80',
  gaming: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80',
  family: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
  social: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
  outdoors: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
  music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=900&q=80',
  workshops: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80',
  foodie: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
  community: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
  entertainment: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
};

const GREY_PATTERN_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Cpath fill="%23d1d5db" d="M0 0h50v50H0zM50 50h50v50H50z"/%3E%3C/svg%3E';

interface EventStackCardProps {
  stack: EventStack;
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  joiningEventId?: string;
  currentUserProfileId?: string;
}

const getEventImage = (event: EventWithAttendees): string => {
  if (event.image_url) return event.image_url;
  const category = CATEGORY_MAP[event.category] || event.category;
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default;
};

const getCategoryFallback = (category: string): string => {
  const mappedCategory = CATEGORY_MAP[category] || category;
  return CATEGORY_FALLBACK_IMAGES[mappedCategory] || CATEGORY_FALLBACK_IMAGES.default;
};

const useImageFallback = (primaryUrl: string, category: string) => {
  const [currentSrc, setCurrentSrc] = useState(primaryUrl);
  const [errorCount, setErrorCount] = useState(0);

  const handleError = useCallback(() => {
    setErrorCount(prev => {
      const newCount = prev + 1;
      if (newCount === 1) {
        setCurrentSrc(getCategoryFallback(category));
      } else {
        setCurrentSrc(GREY_PATTERN_FALLBACK);
      }
      return newCount;
    });
  }, [category]);

  return { src: currentSrc, onError: handleError };
};

// Format date as short pill text (e.g., "za 18" or "Morgen") - Dutch locale
const formatDatePill = (dateStr: string) => {
  // Handle full ISO timestamps from Supabase
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const eventDate = new Date(datePart + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  if (eventDate.getTime() === today.getTime()) {
    return 'Vandaag';
  } else if (eventDate.getTime() === tomorrow.getTime()) {
    return 'Morgen';
  }
  
  // Dutch locale: "za 18" instead of "Sat 18"
  return eventDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' });
};

// Dutch 24-hour time format - handles both HH:MM and descriptive times
const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  
  // If it's a proper HH:MM time format
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  // Handle descriptive Dutch time values
  const descriptiveMap: Record<string, string> = {
    'TBD': '',
    'Hele dag': 'Hele dag',
    'Avond': 'Avond',
    'Middag': 'Middag',
    'Ochtend': 'Ochtend',
  };
  
  return descriptiveMap[timeStr] ?? timeStr;
};

// Anchor Card - Compact Airbnb-inspired design
const AnchorEventCard = memo(function AnchorEventCard({
  event,
  onClick,
  onJoin,
  isJoining,
  hasForks,
  currentUserProfileId,
}: {
  event: EventWithAttendees;
  onClick?: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  hasForks: boolean;
  currentUserProfileId?: string;
}) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const primaryImageUrl = getEventImage(event);
  const { src: imageUrl, onError: handleImageError } = useImageFallback(primaryImageUrl, event.category);
  
  const hasJoined = Boolean(
    currentUserProfileId && event.attendees?.some(
      attendee => attendee.profile?.id === currentUserProfileId
    )
  );

  return (
    <motion.div
      className="relative w-full rounded-2xl overflow-hidden bg-card shadow-card-warm cursor-pointer group"
      whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(180,120,60,0.1), 0 16px 40px rgba(180,120,60,0.12)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      layout
    >
      {/* Image Section - Compact */}
      <div className="relative h-44 overflow-hidden bg-muted">
        <img 
          src={imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={handleImageError}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/70 via-zinc-900/20 to-transparent" />
        
        {/* Category Badge - Top Left */}
        <div className="absolute top-3 left-3">
          <CategoryBadge category={categoryLabel} variant="glass" />
        </div>

        {/* Date Pill - Top Right */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-background/90 backdrop-blur-sm text-xs font-semibold text-foreground">
          {formatDatePill(event.event_date)}
        </div>

        {/* Match percentage if available */}
        {event.match_percentage && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold">
            {event.match_percentage}% Match
          </div>
        )}
      </div>

      {/* Content Section - Compact */}
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold text-foreground leading-snug line-clamp-2">
            {event.title}
          </h3>
          
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin size={14} className="text-primary/70 flex-shrink-0" />
            <span className="truncate">{event.venue_name}</span>
          </div>
        </div>

        {/* Metadata Row - Time, Attendees, Join */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {formatTime(event.event_time) && (
              <>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-primary/70" />
                  {formatTime(event.event_time)}
                </span>
                <span className="opacity-50">·</span>
              </>
            )}
            <span className="flex items-center gap-1">
              <Users size={14} className="text-primary/70" />
              <span className="font-medium">{event.attendee_count || 0}</span>
            </span>
          </div>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!hasJoined) {
                await hapticImpact('medium');
                onJoin?.();
              }
            }}
            disabled={isJoining || hasJoined}
            className={`px-4 py-2 min-h-[44px] rounded-2xl text-sm font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.95] ${
              hasJoined 
                ? 'bg-muted text-muted-foreground cursor-default' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            title={hasJoined ? 'Je doet al mee' : undefined}
          >
            {isJoining ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            <span>{isJoining ? 'Aanmelden...' : hasJoined ? 'Aangemeld' : 'Meedoen'}</span>
          </button>
        </div>
      </div>

      {/* Thread indicator for stacks */}
      {hasForks && (
        <div className="absolute -bottom-3 left-8 w-0.5 h-6 border-l-2 border-dashed border-border" />
      )}
    </motion.div>
  );
});

// Fork Card - Compact horizontal Reddit-style
const ForkEventCard = memo(function ForkEventCard({
  event,
  onClick,
  onJoin,
  isJoining,
  isLast,
  currentUserProfileId,
}: {
  event: EventWithAttendees;
  parentTitle: string;
  onClick?: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  isLast: boolean;
  currentUserProfileId?: string;
}) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const primaryImageUrl = getEventImage(event);
  const { src: imageUrl, onError: handleImageError } = useImageFallback(primaryImageUrl, event.category);
  
  const hasJoined = Boolean(
    currentUserProfileId && event.attendees?.some(
      attendee => attendee.profile?.id === currentUserProfileId
    )
  );

  return (
    <div className="flex">
      {/* Dotted thread line connector */}
      <div className="w-5 flex-shrink-0 relative">
        <div className={`absolute top-0 left-0 border-l-2 border-dashed border-border ${isLast ? 'h-5' : 'h-full'}`} />
        <div className="absolute top-5 left-0 h-0.5 w-4 border-t-2 border-dashed border-border" />
      </div>

      {/* Fork card content - Horizontal compact - rounded-2xl for squircle */}
      <motion.div
        className="flex-1 min-w-0 overflow-hidden rounded-2xl bg-card border border-border p-3 cursor-pointer hover:shadow-card-warm transition-all"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
      >
        <div className="flex gap-2.5 items-center">
          {/* Smaller Thumbnail */}
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            <img 
              src={imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
              onError={handleImageError}
              loading="lazy"
            />
          </div>

          {/* Content - improved typography */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-base text-foreground leading-tight line-clamp-1">
              {event.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span>{formatTime(event.event_time)}</span>
              <span className="opacity-50">·</span>
              <CategoryBadge category={categoryLabel} size="sm" />
            </div>
          </div>

          {/* Right side - Attendees & Action */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={12} />
              <span>{event.attendee_count || 0}</span>
            </div>
            
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!hasJoined) {
                  await hapticImpact('medium');
                  onJoin?.();
                }
              }}
              disabled={isJoining || hasJoined}
              className={`w-10 h-10 min-h-[44px] min-w-[44px] rounded-xl text-sm font-medium transition-all disabled:opacity-50 active:scale-[0.95] flex items-center justify-center ${
                hasJoined 
                  ? 'bg-muted text-muted-foreground cursor-default' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              title={hasJoined ? 'Je doet al mee' : undefined}
            >
              {isJoining ? <Loader2 size={14} className="animate-spin" /> : hasJoined ? '✓' : '+'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export const EventStackCard = memo(function EventStackCard({
  stack,
  onEventClick,
  onJoinEvent,
  joiningEventId,
  currentUserProfileId,
}: EventStackCardProps) {
  const { anchor, forks } = stack;

  return (
    <div className="space-y-0">
      {/* Anchor Event */}
      <AnchorEventCard
        event={anchor}
        onClick={() => onEventClick?.(anchor.id)}
        onJoin={() => onJoinEvent?.(anchor.id)}
        isJoining={joiningEventId === anchor.id}
        hasForks={forks.length > 0}
        currentUserProfileId={currentUserProfileId}
      />

      {/* Fork Events */}
      <AnimatePresence>
        {forks.length > 0 && (
          <motion.div
            className="space-y-2 pt-5 pl-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {forks.map((fork, index) => (
              <ForkEventCard
                key={fork.id}
                event={fork}
                parentTitle={anchor.title}
                onClick={() => onEventClick?.(fork.id)}
                onJoin={() => onJoinEvent?.(fork.id)}
                isJoining={joiningEventId === fork.id}
                isLast={index === forks.length - 1}
                currentUserProfileId={currentUserProfileId}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

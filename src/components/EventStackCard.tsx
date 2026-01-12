import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerDownRight, Users, Clock, Loader2 } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { DistanceBadge } from './DistanceBadge';
import type { EventStack } from '@/lib/feedGrouping';
import type { EventWithAttendees } from '@/lib/hooks';
import { CATEGORY_MAP } from '@/lib/categories';
import { isMockEvent } from '@/lib/utils';

// Fallback images by category - Dutch/Netherlands themed
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  active: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=900&q=80', // Football field
  gaming: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80', // Board games
  family: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80', // Park
  social: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80', // Terrace
  outdoors: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80', // Dutch canal
  music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=900&q=80', // Jazz
  workshops: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80', // Kitchen workshop
  foodie: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80', // Market food
  community: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80', // Community gathering
  entertainment: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80', // Social event
  default: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80', // Dutch canal default
};

// Ultimate fallback - subtle grey pattern (data URI)
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

// Custom hook for image error handling with fallback chain
const useImageFallback = (primaryUrl: string, category: string) => {
  const [currentSrc, setCurrentSrc] = useState(primaryUrl);
  const [errorCount, setErrorCount] = useState(0);

  const handleError = useCallback(() => {
    setErrorCount(prev => {
      const newCount = prev + 1;
      if (newCount === 1) {
        // First error: try category fallback
        setCurrentSrc(getCategoryFallback(category));
      } else {
        // Second error: use grey pattern
        setCurrentSrc(GREY_PATTERN_FALLBACK);
      }
      return newCount;
    });
  }, [category]);

  return { src: currentSrc, onError: handleError };
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Anchor Card - Main event card with prominent visual design
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
  
  // Check if this is a mock event (cannot be joined)
  const isDemo = isMockEvent(event.id);
  
  // Check if current user has already joined this event
  const hasJoined = Boolean(
    currentUserProfileId && event.attendees?.some(
      attendee => attendee.profile?.id === currentUserProfileId
    )
  );

  return (
    <motion.div
      className="relative w-full rounded-3xl overflow-hidden bg-card shadow-lg cursor-pointer group"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      layout
    >
      {/* Image Section */}
      <div className="relative h-56 overflow-hidden bg-muted">
        <img 
          src={imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={handleImageError}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Category Badge */}
        <div className="absolute top-4 left-4">
          <CategoryBadge category={categoryLabel} variant="glass" />
        </div>

        {/* Match percentage if available */}
        {event.match_percentage && (
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold">
            {event.match_percentage}% Match
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-foreground leading-tight line-clamp-2">
            {event.title}
          </h3>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <DistanceBadge venueName={event.venue_name} size="md" />
            <span className="opacity-50">·</span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />
              {formatDate(event.event_date)} · {formatTime(event.event_time)}
            </span>
          </div>
        </div>

        {/* Attendees & Action */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users size={16} className="text-primary/70" />
            <span className="font-medium">{event.attendee_count || 0} going</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isDemo && !hasJoined) {
                onJoin?.();
              }
            }}
            disabled={isJoining || isDemo || hasJoined}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 ${
              hasJoined 
                ? 'bg-muted text-muted-foreground cursor-default' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            title={isDemo ? 'Demo event - cannot join' : hasJoined ? 'Already joined' : undefined}
          >
            {isJoining ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Users size={16} />
            )}
            <span>{isJoining ? 'Joining...' : hasJoined ? 'Joined' : isDemo ? 'Demo' : 'Join'}</span>
          </button>
        </div>
      </div>

      {/* Thread indicator for stacks */}
      {hasForks && (
        <div className="absolute -bottom-3 left-8 w-0.5 h-6 bg-border" />
      )}
    </motion.div>
  );
});

// Fork Card - Compact child event card
const ForkEventCard = memo(function ForkEventCard({
  event,
  parentTitle,
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
  
  // Check if this is a mock event (cannot be joined)
  const isDemo = isMockEvent(event.id);
  
  // Check if current user has already joined this event
  const hasJoined = Boolean(
    currentUserProfileId && event.attendees?.some(
      attendee => attendee.profile?.id === currentUserProfileId
    )
  );

  return (
    <div className="flex">
      {/* Thread line connector */}
      <div className="w-6 flex-shrink-0 relative">
        {/* Vertical line */}
        <div className={`absolute top-0 left-0 w-0.5 bg-border ${isLast ? 'h-6' : 'h-full'}`} />
        {/* Horizontal elbow */}
        <div className="absolute top-6 left-0 h-0.5 w-4 bg-border" />
        {/* Corner icon */}
        <CornerDownRight 
          size={14} 
          className="absolute top-3 left-2 text-muted-foreground" 
        />
      </div>

      {/* Fork card content */}
      <motion.div
        className="flex-1 min-w-0 overflow-hidden rounded-2xl bg-muted/50 border border-border p-3 cursor-pointer hover:bg-muted/80 transition-colors"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
      >
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
            <img 
              src={imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
              onError={handleImageError}
              loading="lazy"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Reply indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Fork from</span>
              <span className="font-medium text-foreground truncate">{parentTitle}</span>
            </div>

            <h4 className="font-semibold text-foreground leading-tight line-clamp-1">
              {event.title}
            </h4>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatTime(event.event_time)}</span>
              <CategoryBadge category={categoryLabel} size="sm" />
            </div>
          </div>

          {/* Action */}
          <div className="flex flex-col justify-between items-end flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={12} />
              <span>{event.attendee_count || 0}</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isDemo && !hasJoined) {
                  onJoin?.();
                }
              }}
              disabled={isJoining || isDemo || hasJoined}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 active:scale-95 ${
                hasJoined 
                  ? 'bg-muted text-muted-foreground cursor-default' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              title={isDemo ? 'Demo event - cannot join' : hasJoined ? 'Already joined' : undefined}
            >
              {isJoining ? <Loader2 size={12} className="animate-spin" /> : hasJoined ? 'Joined' : isDemo ? 'Demo' : 'Join'}
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
  const { anchor, forks, type } = stack;

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
            className="space-y-3 pt-6 pl-2"
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

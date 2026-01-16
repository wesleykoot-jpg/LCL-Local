import { memo, useState, useCallback, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Loader2, MapPin, Heart, ChevronRight, Baby, Sparkles } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { EventActionsMenu } from './EventActionsMenu';
import type { EventStack } from '../api/feedGrouping';
import type { EventWithAttendees } from '../hooks/hooks';
import { CATEGORY_MAP } from '@/shared/lib/categories';
import { hapticImpact } from '@/shared/lib/haptics';
import { formatEventDate, formatEventTime } from '@/shared/lib/formatters';
import { 
  useImageFallback, 
  getEventImage
} from '../hooks/useImageFallback';
import { useFeedMode } from '@/contexts/FeedContext';

interface EventStackCardProps {
  stack: EventStack;
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  joiningEventId?: string;
  currentUserProfileId?: string;
  userLocation?: { lat: number; lng: number } | null;
}

// Helper to determine context badge
function getContextBadge(category: string, feedMode: 'family' | 'social' | 'default') {
  if (feedMode === 'family' && category === 'family') {
    return { text: 'Parent Favorite', icon: Baby, color: 'teal' };
  }
  if (feedMode === 'family' && (category === 'outdoors' || category === 'active')) {
    return { text: 'Family Fun', icon: Baby, color: 'teal' };
  }
  if (feedMode === 'social' && (category === 'social' || category === 'music' || category === 'foodie')) {
    return { text: 'Solo Friendly', icon: Sparkles, color: 'blue' };
  }
  return null;
}

// Airbnb-style Event Card
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
  userLocation?: { lat: number; lng: number } | null;
}) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const primaryImageUrl = getEventImage(event.image_url, event.category);
  const { src: imageUrl, onError: handleImageError } = useImageFallback(primaryImageUrl, event.category);
  const [isSaved, setIsSaved] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { feedMode } = useFeedMode();
  
  const hasJoined = Boolean(
    currentUserProfileId && event.attendees?.some(
      attendee => attendee.profile?.id === currentUserProfileId
    )
  );

  const handleSave = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    await hapticImpact('light');
    setIsSaved(prev => !prev);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const contextBadge = getContextBadge(event.category, feedMode);

  return (
    <motion.div
      className="relative w-full cursor-pointer group"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted mb-3">
        <motion.img 
          src={imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
          initial={{ opacity: 0 }}
          animate={{ opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
        
        {/* Action buttons - top right */}
        <div className="absolute top-3 right-3 flex gap-2">
          {/* Actions Menu (Report/Block) */}
          <div className="bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
            <EventActionsMenu
              eventId={event.id}
              hostUserId={event.created_by || undefined}
              currentUserProfileId={currentUserProfileId}
            />
          </div>
          
          {/* Heart/Save button - Airbnb style */}
          <button
            onClick={handleSave}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
          >
            <Heart 
              size={16} 
              className={isSaved ? 'text-primary fill-primary' : 'text-foreground'} 
            />
          </button>
        </div>
        
        {/* Category badge - top left */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <CategoryBadge category={categoryLabel} variant="glass" size="sm" />
          
          {/* Context badge - only shown when feed mode is active */}
          {contextBadge && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-sm text-[11px] font-semibold shadow-sm ${
              contextBadge.color === 'teal' 
                ? 'bg-teal-500/90 text-white' 
                : 'bg-blue-500/90 text-white'
            }`}>
              <contextBadge.icon size={12} />
              {contextBadge.text}
            </div>
          )}
        </div>

        {/* Date badge */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-sm text-[13px] font-semibold text-foreground shadow-sm">
          {formatEventDate(event.event_date)}
        </div>
      </div>
      
      {/* Content Section - Below image (Airbnb style) */}
      <div className="space-y-1">
        {/* Title */}
        <h3 className="text-[17px] font-semibold text-foreground leading-tight line-clamp-1">
          {event.title}
        </h3>
        
        {/* Location */}
        <p className="text-[15px] text-muted-foreground flex items-center gap-1">
          <MapPin size={14} className="flex-shrink-0" />
          <span className="truncate">{event.venue_name}</span>
        </p>
        
        {/* Metadata row */}
        <div className="flex items-center gap-3 text-[13px] text-muted-foreground pt-1">
          {formatEventTime(event.event_time) && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatEventTime(event.event_time)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} />
            {event.attendee_count || 0} going
          </span>
        </div>
        
        {/* Join button */}
        <div className="pt-3">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!hasJoined) {
                await hapticImpact('medium');
                onJoin?.();
              }
            }}
            disabled={isJoining || hasJoined}
            className={`w-full h-[48px] rounded-xl text-[15px] font-semibold transition-all active:scale-[0.98] ${
              hasJoined
                ? 'bg-muted text-muted-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isJoining ? (
              <Loader2 size={18} className="animate-spin mx-auto" />
            ) : hasJoined ? (
              '✓ Joined'
            ) : (
              'Join Event'
            )}
          </button>
        </div>
      </div>

      {/* Thread indicator for stacks */}
      {hasForks && (
        <div className="absolute -bottom-4 left-6 w-0.5 h-6 bg-border rounded-full" />
      )}
    </motion.div>
  );
});

// Fork Card - Compact
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
  const primaryImageUrl = getEventImage(event.image_url, event.category);
  const { src: imageUrl, onError: handleImageError } = useImageFallback(primaryImageUrl, event.category);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const hasJoined = Boolean(
    currentUserProfileId && event.attendees?.some(
      attendee => attendee.profile?.id === currentUserProfileId
    )
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  return (
    <div className="flex">
      {/* Thread connector */}
      <div className="w-6 flex-shrink-0 relative">
        <div className={`absolute top-0 left-[3px] w-0.5 bg-border ${isLast ? 'h-6' : 'h-full'} rounded-full`} />
        <div className="absolute top-6 left-[3px] h-0.5 w-5 bg-border rounded-full" />
      </div>

      {/* Fork card */}
      <motion.div
        className="flex-1 min-w-0 overflow-hidden rounded-xl bg-card border border-border p-3 cursor-pointer hover:border-muted-foreground/30 transition-all"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
      >
        <div className="flex gap-3 items-center">
          {/* Thumbnail */}
          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            <motion.img 
              src={imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
              onError={handleImageError}
              onLoad={handleImageLoad}
              loading="lazy"
              initial={{ opacity: 0 }}
              animate={{ opacity: imageLoaded ? 1 : 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[15px] text-foreground leading-tight line-clamp-1">
              {event.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-[13px] text-muted-foreground">
              <span>{formatEventTime(event.event_time)}</span>
              <span>•</span>
              <span>{event.attendee_count || 0} going</span>
            </div>
          </div>

          {/* Join button */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!hasJoined) {
                await hapticImpact('medium');
                onJoin?.();
              }
            }}
            disabled={isJoining || hasJoined}
            className={`min-h-[36px] px-4 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.95] ${
              hasJoined 
                ? 'bg-muted text-muted-foreground' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isJoining ? (
              <Loader2 size={14} className="animate-spin" />
            ) : hasJoined ? (
              '✓'
            ) : (
              'Join'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
});

// Main EventStackCard component
export const EventStackCard = memo(function EventStackCard({
  stack,
  onEventClick,
  onJoinEvent,
  joiningEventId,
  currentUserProfileId,
  userLocation,
}: EventStackCardProps) {
  const [showForks, setShowForks] = useState(true);
  const hasForks = stack.forks.length > 0;

  const handleToggleForks = useCallback(async () => {
    await hapticImpact('light');
    setShowForks(prev => !prev);
  }, []);

  return (
    <div className="space-y-2">
      <AnchorEventCard
        event={stack.anchor}
        onClick={() => onEventClick?.(stack.anchor.id)}
        onJoin={() => onJoinEvent?.(stack.anchor.id)}
        isJoining={joiningEventId === stack.anchor.id}
        hasForks={hasForks}
        currentUserProfileId={currentUserProfileId}
        userLocation={userLocation}
      />

      {hasForks && (
        <div className="pl-4 space-y-2 pt-2">
          {/* Forks toggle button */}
          <button
            onClick={handleToggleForks}
            className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium hover:text-foreground transition-colors py-2 px-1 min-h-[44px] active:opacity-70"
          >
            <motion.div
              animate={{ rotate: showForks ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight size={14} />
            </motion.div>
            <span>{stack.forks.length} alternative{stack.forks.length !== 1 ? 's' : ''}</span>
          </button>

          <AnimatePresence>
            {showForks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-2 overflow-hidden"
              >
                {stack.forks.map((fork, index) => (
                  <ForkEventCard
                    key={fork.id}
                    event={fork}
                    parentTitle={stack.anchor.title}
                    onClick={() => onEventClick?.(fork.id)}
                    onJoin={() => onJoinEvent?.(fork.id)}
                    isJoining={joiningEventId === fork.id}
                    isLast={index === stack.forks.length - 1}
                    currentUserProfileId={currentUserProfileId}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

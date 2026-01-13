import { memo, useState, useCallback, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Loader2, MapPin, Share2, Bookmark, Navigation, ShieldCheck, ChevronRight } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import type { EventStack } from '@/lib/feedGrouping';
import type { EventWithAttendees } from '@/lib/hooks';
import { CATEGORY_MAP } from '@/lib/categories';
import { hapticImpact } from '@/lib/haptics';
import { Facepile } from './Facepile';
import { DistanceBadge } from './DistanceBadge';

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
const DEFAULT_AVATAR_URL = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100';

const parseEventCoordinates = (location: unknown): { lat: number; lng: number } | null => {
  if (!location) return null;
  if (typeof location === 'string') {
    const match = location.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
  }
  if (typeof location === 'object' && (location as { coordinates?: number[] }).coordinates) {
    const coords = (location as { coordinates?: number[] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: Number(coords[0]), lat: Number(coords[1]) };
    }
  }
  return null;
};

const openInMaps = (venue: string, coords?: { lat: number; lng: number } | null) => {
  const query = coords ? `${coords.lat},${coords.lng}` : venue;
  const encoded = encodeURIComponent(query || venue);
  window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
};

interface EventStackCardProps {
  stack: EventStack;
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  joiningEventId?: string;
  currentUserProfileId?: string;
  userLocation?: { lat: number; lng: number } | null;
}

const getEventImage = (event: EventWithAttendees): string => {
  if (event.image_url) return event.image_url;
  const category = CATEGORY_MAP[event.category] || event.category;
  return CATEGORY_FALLBACK_IMAGES[category] || GREY_PATTERN_FALLBACK;
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
  
  return eventDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' });
};

// Dutch 24-hour time format
const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  const descriptiveMap: Record<string, string> = {
    'TBD': '',
    'Hele dag': 'Hele dag',
    'Avond': 'Avond',
    'Middag': 'Middag',
    'Ochtend': 'Ochtend',
  };
  
  return descriptiveMap[timeStr] ?? timeStr;
};

// Netflix-style Billboard Card - Full-bleed with gradient overlay
const AnchorEventCard = memo(function AnchorEventCard({
  event,
  onClick,
  onJoin,
  isJoining,
  hasForks,
  currentUserProfileId,
  userLocation,
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
  const primaryImageUrl = getEventImage(event);
  const { src: imageUrl, onError: handleImageError } = useImageFallback(primaryImageUrl, event.category);
  const [isSaved, setIsSaved] = useState(false);
  const venueCoords = parseEventCoordinates(event.location_coordinates) || parseEventCoordinates(event.location) || null;
  
  const hasJoined = Boolean(
    currentUserProfileId && event.attendees?.some(
      attendee => attendee.profile?.id === currentUserProfileId
    )
  );

  const attendeeFaces = (event.attendees || []).map((attendee, idx) => ({
    id: attendee.profile?.id || `attendee-${idx}`,
    image: attendee.profile?.avatar_url || DEFAULT_AVATAR_URL,
    alt: attendee.profile?.full_name || 'Aanwezige',
  }));
  const extraAttendees = Math.max(0, (event.attendee_count || 0) - attendeeFaces.length);

  const trustLabel = event.match_percentage && event.match_percentage >= 70
    ? `${event.match_percentage}% match`
    : event.created_by
      ? 'Actieve host'
      : null;

  const handleShare = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    await hapticImpact('light');
    const shareUrl = `${window.location.origin}/events/${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `${event.title} · ${event.venue_name}`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (err) {
      console.error('Share failed', err);
    }
  }, [event.id, event.title, event.venue_name]);

  const handleSave = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    await hapticImpact('light');
    setIsSaved(prev => !prev);
  }, []);

  const handleDirections = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    await hapticImpact('light');
    openInMaps(event.venue_name, venueCoords ?? null);
  }, [event.venue_name, venueCoords]);

  return (
    <motion.div
      className="relative w-full rounded-[2.5rem] overflow-hidden bg-card cursor-pointer group border-[0.5px] border-border/30"
      style={{
        boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.08), 0 16px 64px -16px rgba(0, 0, 0, 0.06)'
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.12), 0 20px 70px -16px rgba(0, 0, 0, 0.1)' }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      layout
    >
      {/* Netflix Billboard Image - Taller aspect ratio */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img 
          src={imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={handleImageError}
          loading="lazy"
        />
        {/* Cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        
        {/* Top metadata rail */}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CategoryBadge category={categoryLabel} variant="glass" />
          </div>
          
          {/* Date pill - Airbnb style */}
          <div className="px-3 py-1.5 rounded-[1rem] bg-background/95 backdrop-blur-xl text-[13px] font-semibold text-foreground border-[0.5px] border-border/20">
            {formatDatePill(event.event_date)}
          </div>
        </div>

        {/* Bottom content overlay - Netflix style */}
        <div className="absolute bottom-0 left-0 right-0 p-5 pt-16">
          {/* Time & Distance pills */}
          <div className="flex items-center gap-2 mb-3">
            {formatTime(event.event_time) && (
              <span className="px-3 py-1.5 rounded-[1rem] bg-background/90 backdrop-blur-xl text-[13px] font-semibold text-foreground flex items-center gap-1.5 border-[0.5px] border-white/10">
                <Clock size={13} className="text-primary" />
                {formatTime(event.event_time)}
              </span>
            )}
            <DistanceBadge
              venueCoordinates={venueCoords}
              userLocation={userLocation || null}
              size="sm"
              className="px-3 py-1.5 rounded-[1rem] bg-background/80 backdrop-blur-xl border-[0.5px] border-white/10"
            />
            {trustLabel && (
              <div className="px-3 py-1.5 rounded-[1rem] bg-primary/90 backdrop-blur-xl text-[13px] font-semibold text-primary-foreground flex items-center gap-1.5">
                <ShieldCheck size={13} />
                {trustLabel}
              </div>
            )}
          </div>
          
          {/* Title - iOS 17pt body scale equivalent */}
          <h3 className="text-[22px] font-semibold text-white leading-tight line-clamp-2 mb-1.5 tracking-tight">
            {event.title}
          </h3>
          
          {/* Venue with icon */}
          <div className="flex items-center gap-1.5 text-[15px] text-white/80">
            <MapPin size={14} className="text-white/60 flex-shrink-0" />
            <span className="truncate">{event.venue_name}</span>
          </div>
        </div>
      </div>

      {/* Content Section - Generous padding, iOS spacing */}
      <div className="p-5 pt-4 space-y-4">
        {/* Description if available */}
        {event.description && (
          <p className="text-[15px] text-muted-foreground leading-normal line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Attendee row - aligned heights */}
        <div className="flex items-center justify-between h-8">
          <div className="flex items-center gap-3 h-full">
            <Facepile users={attendeeFaces} extraCount={extraAttendees} />
            <span className="text-[15px] text-muted-foreground font-medium">
              {event.attendee_count || 0} gaan
            </span>
          </div>
        </div>

        {/* Action buttons - Thumb zone optimized */}
        <div className="flex items-center gap-2.5 pt-1">
          {/* Primary CTA - Squircle geometry */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!hasJoined) {
                await hapticImpact('medium');
                onJoin?.();
              }
            }}
            disabled={isJoining || hasJoined}
            className={`flex-1 px-6 h-[52px] rounded-[1.5rem] text-[17px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.97] border-[0.5px] ${
              hasJoined 
                ? 'bg-muted text-muted-foreground border-border/30 cursor-default' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary/20'
            }`}
            title={hasJoined ? 'Je doet al mee' : undefined}
          >
            {isJoining ? (
              <Loader2 size={18} className="animate-spin" />
            ) : null}
            <span>{isJoining ? 'Aanmelden...' : hasJoined ? 'Aangemeld' : 'Meedoen'}</span>
          </button>
          
          {/* Secondary actions - 52px consistent */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSave}
              className={`w-[52px] h-[52px] min-h-[44px] min-w-[44px] rounded-[1.5rem] border-[0.5px] flex items-center justify-center transition-all active:scale-[0.95] ${
                isSaved ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border/50 hover:border-border'
              }`}
              title={isSaved ? 'Opgeslagen' : 'Sla op'}
            >
              <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleShare}
              className="w-[52px] h-[52px] min-h-[44px] min-w-[44px] rounded-[1.5rem] border-[0.5px] border-border/50 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all active:scale-[0.95]"
              title="Deel"
            >
              <Share2 size={20} />
            </button>
            <button
              onClick={handleDirections}
              className="w-[52px] h-[52px] min-h-[44px] min-w-[44px] rounded-[1.5rem] border-[0.5px] border-border/50 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-all active:scale-[0.95]"
              title="Route"
            >
              <Navigation size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Thread indicator for stacks */}
      {hasForks && (
        <div className="absolute -bottom-4 left-5 w-[2px] h-8 bg-border/40 rounded-full" />
      )}
    </motion.div>
  );
});

// Fork Card - Compact horizontal with squircle geometry
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
      {/* Thread connector */}
      <div className="w-6 flex-shrink-0 relative">
        <div className={`absolute top-0 left-[3px] w-[2px] bg-border/40 ${isLast ? 'h-6' : 'h-full'} rounded-full`} />
        <div className="absolute top-6 left-[3px] h-[2px] w-5 bg-border/40 rounded-full" />
      </div>

      {/* Fork card - Squircle geometry */}
      <motion.div
        className="flex-1 min-w-0 overflow-hidden rounded-[1.5rem] bg-card border-[0.5px] border-border/40 p-4 cursor-pointer hover:border-border/60 transition-all"
        style={{
          boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.05)'
        }}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        whileHover={{ y: -2, boxShadow: '0 6px 20px -4px rgba(0, 0, 0, 0.08)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
      >
        <div className="flex gap-3 items-center">
          {/* Thumbnail - Squircle 48px */}
          <div className="w-12 h-12 rounded-[1rem] overflow-hidden flex-shrink-0 bg-muted">
            <img 
              src={imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
              onError={handleImageError}
              loading="lazy"
            />
          </div>

          {/* Content - iOS typography */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[17px] text-foreground leading-tight line-clamp-1 tracking-tight">
              {event.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-[13px] text-muted-foreground">
              <span className="font-medium">{formatTime(event.event_time)}</span>
              <span className="opacity-40">·</span>
              <CategoryBadge category={categoryLabel} size="sm" />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Users size={14} />
              <span className="font-medium">{event.attendee_count || 0}</span>
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
              className={`min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-[1rem] text-[15px] font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-[0.95] border-[0.5px] ${
                hasJoined 
                  ? 'bg-muted text-muted-foreground border-border/30' 
                  : 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90'
              }`}
            >
              {isJoining ? (
                <Loader2 size={14} className="animate-spin" />
              ) : hasJoined ? (
                <span>✓</span>
              ) : (
                <span>Meedoen</span>
              )}
            </button>
          </div>
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
        <div className="pl-4 space-y-2">
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
            <span>{stack.forks.length} alternatieve{stack.forks.length !== 1 ? 'n' : ''}</span>
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

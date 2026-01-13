import { memo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Loader2, Users, Clock, MapPin } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { CATEGORY_MAP } from '@/lib/categories';
import { hapticImpact } from '@/lib/haptics';
import type { EventWithAttendees } from '@/lib/hooks';

interface HorizontalEventCarouselProps {
  title: string;
  events: EventWithAttendees[];
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  joiningEventId?: string;
  currentUserProfileId?: string;
  onSeeAll?: () => void;
}

// Get fallback image
const getEventImage = (event: EventWithAttendees): string => {
  if (event.image_url) return event.image_url;
  
  const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
    active: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=600&q=80',
    gaming: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=600&q=80',
    social: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    outdoors: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=600&q=80',
    music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=600&q=80',
    default: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=600&q=80',
  };
  
  const category = CATEGORY_MAP[event.category] || event.category;
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default;
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  return timeStr;
};

const formatDateShort = (dateStr: string) => {
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

// Netflix-style carousel card
const CarouselEventCard = memo(function CarouselEventCard({
  event,
  onClick,
  onJoin,
  isJoining,
  hasJoined,
}: {
  event: EventWithAttendees;
  onClick?: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  hasJoined?: boolean;
}) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = getEventImage(event);

  return (
    <motion.div
      className="flex-shrink-0 w-[min(280px,75vw)] rounded-[1.5rem] overflow-hidden bg-card cursor-pointer group border-[0.5px] border-border/30"
      style={{
        boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.08)'
      }}
      whileHover={{ y: -4, boxShadow: '0 8px 28px -4px rgba(0, 0, 0, 0.12)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img 
          src={imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <CategoryBadge category={categoryLabel} variant="glass" size="sm" />
        </div>
        
        {/* Date */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-[0.75rem] bg-background/90 backdrop-blur-sm text-[13px] font-semibold text-foreground">
          {formatDateShort(event.event_date)}
        </div>
        
        {/* Bottom info */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-[17px] font-semibold text-white leading-tight line-clamp-2 tracking-tight">
            {event.title}
          </h3>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Metadata */}
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {formatTime(event.event_time) && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatTime(event.event_time)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} />
            {event.attendee_count || 0}
          </span>
        </div>
        
        {/* Venue */}
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin size={12} className="flex-shrink-0" />
          <span className="truncate">{event.venue_name}</span>
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
          className={`w-full h-[44px] rounded-[1rem] text-[15px] font-semibold transition-all active:scale-[0.97] border-[0.5px] flex items-center justify-center ${
            hasJoined
              ? 'bg-muted text-muted-foreground border-border/30'
              : 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90'
          }`}
        >
          {isJoining ? (
            <Loader2 size={16} className="animate-spin" />
          ) : hasJoined ? (
            'Aangemeld'
          ) : (
            'Meedoen'
          )}
        </button>
      </div>
    </motion.div>
  );
});

export const HorizontalEventCarousel = memo(function HorizontalEventCarousel({
  title,
  events,
  onEventClick,
  onJoinEvent,
  joiningEventId,
  currentUserProfileId,
  onSeeAll,
}: HorizontalEventCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSeeAll = useCallback(async () => {
    await hapticImpact('light');
    onSeeAll?.();
  }, [onSeeAll]);

  if (events.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
          {title}
        </h2>
        {onSeeAll && events.length > 3 && (
          <button
            onClick={handleSeeAll}
            className="flex items-center gap-1 text-[15px] font-medium text-primary hover:text-primary/80 transition-colors min-h-[44px] px-2 active:opacity-70"
          >
            <span>Alles</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      
      {/* Horizontal scroll - proper padding */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 pl-4 pr-4 -ml-4 -mr-4 scrollbar-hide snap-x snap-mandatory scroll-pl-4"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {events.map((event) => {
          const hasJoined = Boolean(
            currentUserProfileId && event.attendees?.some(
              attendee => attendee.profile?.id === currentUserProfileId
            )
          );
          
          return (
            <div key={event.id} className="snap-start">
              <CarouselEventCard
                event={event}
                onClick={() => onEventClick?.(event.id)}
                onJoin={() => onJoinEvent?.(event.id)}
                isJoining={joiningEventId === event.id}
                hasJoined={hasJoined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
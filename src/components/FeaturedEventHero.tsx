import { memo, useCallback, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Play, Plus, Info, Clock, MapPin, Users, Loader2 } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { CATEGORY_MAP } from '@/lib/categories';
import { hapticImpact } from '@/lib/haptics';
import type { EventWithAttendees } from '@/lib/hooks';

interface FeaturedEventHeroProps {
  event: EventWithAttendees;
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  isJoining?: boolean;
  hasJoined?: boolean;
}

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  return timeStr;
};

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
  
  return eventDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' });
};

// Get fallback image
const getEventImage = (event: EventWithAttendees): string => {
  if (event.image_url) return event.image_url;
  
  const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
    active: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80',
    gaming: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1200&q=80',
    social: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    outdoors: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1200&q=80',
    music: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=1200&q=80',
    default: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1200&q=80',
  };
  
  const category = CATEGORY_MAP[event.category] || event.category;
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default;
};

export const FeaturedEventHero = memo(function FeaturedEventHero({
  event,
  onEventClick,
  onJoinEvent,
  isJoining,
  hasJoined,
}: FeaturedEventHeroProps) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = getEventImage(event);

  const handleJoin = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    if (!hasJoined) {
      await hapticImpact('medium');
      onJoinEvent?.(event.id);
    }
  }, [hasJoined, onJoinEvent, event.id]);

  const handleInfo = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    await hapticImpact('light');
    onEventClick?.(event.id);
  }, [onEventClick, event.id]);

  return (
    <motion.div
      className="relative w-full overflow-hidden rounded-[2rem] cursor-pointer group"
      style={{
        aspectRatio: '16/10',
        boxShadow: '0 12px 40px -12px rgba(0, 0, 0, 0.15)'
      }}
      onClick={() => onEventClick?.(event.id)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Full-bleed background image */}
      <img 
        src={imageUrl} 
        alt={event.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        loading="eager"
      />
      
      {/* Netflix-style gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
      
      {/* Featured badge - top left with consistent heights */}
      <div className="absolute top-4 left-4 flex items-center gap-2 h-8">
        <div className="flex items-center gap-1.5 px-3 h-full rounded-full bg-primary text-primary-foreground text-[13px] font-semibold">
          <Play size={12} fill="currentColor" />
          <span>Uitgelicht</span>
        </div>
        <CategoryBadge category={categoryLabel} variant="glass" size="md" />
      </div>

      {/* Content - bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-5 pt-20">
        {/* Date */}
        <p className="text-[13px] text-white/80 font-medium mb-2">
          {formatDatePill(event.event_date)}
        </p>
        
        {/* Title - Large, impactful */}
        <h2 className="text-[28px] font-bold text-white leading-tight tracking-tight mb-2 line-clamp-2">
          {event.title}
        </h2>
        
        {/* Metadata row - responsive wrapping */}
        <div className="flex flex-wrap items-center gap-3 text-[14px] text-white/80 mb-5">
          {formatTime(event.event_time) && (
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {formatTime(event.event_time)}
            </span>
          )}
          <span className="flex items-center gap-1.5 min-w-0">
            <MapPin size={14} className="flex-shrink-0" />
            <span className="truncate flex-1">{event.venue_name}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={14} />
            {event.attendee_count || 0} gaan
          </span>
        </div>
        
        {/* Action buttons - Thumb zone with identical heights */}
        <div className="flex items-center gap-3">
          {/* Primary CTA */}
          <button
            onClick={handleJoin}
            disabled={isJoining || hasJoined}
            className={`flex items-center justify-center gap-2 px-8 h-[52px] rounded-[1.5rem] text-[17px] font-semibold transition-all active:scale-[0.97] ${
              hasJoined
                ? 'bg-white/20 text-white/80'
                : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            {isJoining ? (
              <Loader2 size={20} className="animate-spin" />
            ) : hasJoined ? (
              <>
                <span>✓</span>
                <span>Aangemeld</span>
              </>
            ) : (
              <>
                <Plus size={20} strokeWidth={2.5} />
                <span>Meedoen</span>
              </>
            )}
          </button>
          
          {/* Info button - matching height */}
          <button
            onClick={handleInfo}
            className="flex items-center justify-center gap-2 px-6 h-[52px] rounded-[1.5rem] bg-white/10 backdrop-blur-sm text-white text-[17px] font-semibold hover:bg-white/20 transition-all active:scale-[0.97] border-[0.5px] border-white/20"
          >
            <Info size={20} />
            <span>Meer info</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
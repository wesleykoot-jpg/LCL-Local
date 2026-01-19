import { memo, useCallback, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Heart, Clock, MapPin, Users, Loader2 } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { CATEGORY_MAP } from '@/shared/lib/categories';
import { hapticImpact } from '@/shared/lib/haptics';
import type { EventWithAttendees } from '../hooks/hooks';

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
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
    return 'Today';
  } else if (eventDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }
  
  return eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

  const handleSave = useCallback(async (e: MouseEvent) => {
    e.stopPropagation();
    await hapticImpact('light');
    // Save functionality
  }, []);

  return (
    <motion.div
      className="relative w-full overflow-hidden rounded-card cursor-pointer group bg-white shadow-card"
      onClick={() => onEventClick?.(event.id)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img 
          src={imageUrl} 
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="eager"
        />
        {/* Netflix-style Scrim */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
        
        {/* Heart/Save button - Airbnb style top right */}
        <button
          onClick={handleSave}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white flex items-center justify-center text-text-secondary hover:scale-110 transition-transform shadow-card"
        >
          <Heart size={16} />
        </button>
        
        {/* Category badge - top left */}
        <div className="absolute top-3 left-3">
          <CategoryBadge category={categoryLabel} variant="glass" size="sm" />
        </div>

        {/* Date badge */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-button bg-white text-[13px] font-semibold text-text-primary shadow-card">
          {formatDatePill(event.event_date)}
        </div>
      </div>
      
      {/* Content Section - Below image (Airbnb style) */}
      <div className="p-4">
        {/* Title */}
        <h2 className="text-[17px] font-semibold text-text-primary leading-tight mb-1 line-clamp-1">
          {event.title}
        </h2>
        
        {/* Location */}
        <p className="text-[15px] text-text-secondary mb-2 flex items-center gap-1">
          <MapPin size={14} className="flex-shrink-0" />
          <span className="truncate">{event.venue_name}</span>
        </p>
        
        {/* Metadata row */}
        <div className="flex items-center gap-3 text-[13px] text-text-secondary mb-4">
          {formatTime(event.event_time) && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatTime(event.event_time)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} />
            {event.attendee_count || 0} going
          </span>
        </div>
        
        {/* Join button */}
        <button
          onClick={handleJoin}
          disabled={isJoining || hasJoined}
          className={`w-full h-[48px] rounded-button text-[15px] font-semibold transition-all active:scale-[0.98] ${
            hasJoined
              ? 'bg-muted text-text-secondary'
              : 'bg-brand-primary text-white hover:bg-brand-secondary'
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
    </motion.div>
  );
});

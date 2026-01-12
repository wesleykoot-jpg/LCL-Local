import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CornerDownRight, Users, MapPin, Clock, Loader2 } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';
import { Facepile } from './Facepile';
import type { EventStack } from '@/lib/feedGrouping';
import type { EventWithAttendees } from '@/lib/hooks';
import { CATEGORY_MAP } from '@/lib/categories';

// Fallback images by category
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  active: 'https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=900&q=80',
  gaming: 'https://images.unsplash.com/photo-1505764706515-aa95265c5abc?auto=format&fit=crop&w=900&q=80',
  family: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
  social: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=900&q=80',
  outdoors: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
  music: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  workshops: 'https://images.unsplash.com/photo-1521292270410-a8c2eaff8701?auto=format&fit=crop&w=900&q=80',
  foodie: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
  community: 'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=900&q=80',
  entertainment: 'https://images.unsplash.com/photo-1507306300249-2bf49030b4ce?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
};

interface EventStackCardProps {
  stack: EventStack;
  onEventClick?: (eventId: string) => void;
  onJoinEvent?: (eventId: string) => Promise<void>;
  joiningEventId?: string;
}

const getEventImage = (event: EventWithAttendees): string => {
  if (event.image_url) return event.image_url;
  const category = CATEGORY_MAP[event.category] || event.category;
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default;
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
}: {
  event: EventWithAttendees;
  onClick?: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  hasForks: boolean;
}) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = getEventImage(event);
  
  // Create attendee display from nested data
  const attendeeDisplay = event.attendees?.slice(0, 4).map(a => ({
    id: a.profile?.id || '',
    image: a.profile?.avatar_url || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
    alt: a.profile?.full_name || 'Attendee',
  })) || [];

  return (
    <motion.div
      className="relative w-full rounded-3xl overflow-hidden bg-card shadow-lg cursor-pointer group"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      layout
    >
      {/* Image Section */}
      <div className="relative h-56 overflow-hidden">
        <img 
          src={imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-primary" />
              {event.venue_name}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />
              {formatDate(event.event_date)} · {formatTime(event.event_time)}
            </span>
          </div>
        </div>

        {/* Attendees & Action */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            {attendeeDisplay.length > 0 && (
              <Facepile 
                users={attendeeDisplay} 
                extraCount={Math.max(0, (event.attendee_count || 0) - attendeeDisplay.length)} 
              />
            )}
            <span className="text-sm text-muted-foreground">
              {event.attendee_count || 0} going
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin?.();
            }}
            disabled={isJoining}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {isJoining ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Users size={16} />
            )}
            <span>{isJoining ? 'Joining...' : 'Join'}</span>
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
}: {
  event: EventWithAttendees;
  parentTitle: string;
  onClick?: () => void;
  onJoin?: () => void;
  isJoining?: boolean;
  isLast: boolean;
}) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const imageUrl = getEventImage(event);
  
  const attendeeDisplay = event.attendees?.slice(0, 3).map(a => ({
    id: a.profile?.id || '',
    image: a.profile?.avatar_url || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100',
    alt: a.profile?.full_name || 'Attendee',
  })) || [];

  return (
    <div className="flex">
      {/* Thread line connector */}
      <div className="w-8 flex-shrink-0 relative">
        {/* Vertical line */}
        <div className={`absolute top-0 left-0 w-0.5 bg-border ${isLast ? 'h-6' : 'h-full'}`} />
        {/* Horizontal elbow */}
        <div className="absolute top-6 left-0 h-0.5 w-5 bg-border" />
        {/* Corner icon */}
        <CornerDownRight 
          size={16} 
          className="absolute top-3 left-3 text-muted-foreground" 
        />
      </div>

      {/* Fork card content */}
      <motion.div
        className="flex-1 rounded-2xl bg-muted/50 border border-border p-4 cursor-pointer hover:bg-muted/80 transition-colors"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
      >
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
            <img 
              src={imageUrl} 
              alt={event.title}
              className="w-full h-full object-cover"
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
          <div className="flex flex-col justify-between items-end">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={12} />
              <span>{event.attendee_count || 0}</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoin?.();
              }}
              disabled={isJoining}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95"
            >
              {isJoining ? <Loader2 size={12} className="animate-spin" /> : 'Join'}
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
      />

      {/* Fork Events */}
      <AnimatePresence>
        {forks.length > 0 && (
          <motion.div
            className="space-y-3 pt-6 pl-4"
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
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

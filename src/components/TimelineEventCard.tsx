import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Users, Ticket } from 'lucide-react';
import { CATEGORY_MAP, getCategoryConfig } from '@/lib/categories';
import type { EventWithAttendees } from '@/features/events/hooks/hooks';

interface TimelineEventCardProps {
  event: EventWithAttendees & { 
    ticket_number?: string;
    image_url?: string | null;
  };
  isPast?: boolean;
}

// Format time like "7:00 PM"
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  
  // Handle HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  return timeStr;
}

// Category to ambient color mapping (HSL values for CSS custom property)
const CATEGORY_AMBIENT_COLORS: Record<string, string> = {
  active: 'hsla(27, 96%, 61%, 0.15)',
  gaming: 'hsla(262, 83%, 58%, 0.15)',
  entertainment: 'hsla(350, 89%, 60%, 0.15)',
  social: 'hsla(217, 91%, 60%, 0.15)',
  family: 'hsla(168, 76%, 42%, 0.15)',
  outdoors: 'hsla(160, 84%, 39%, 0.15)',
  music: 'hsla(239, 84%, 67%, 0.15)',
  workshops: 'hsla(38, 92%, 50%, 0.15)',
  foodie: 'hsla(330, 81%, 60%, 0.15)',
  community: 'hsla(215, 14%, 45%, 0.15)',
};

function getAmbientColor(category: string): string {
  const mapped = CATEGORY_MAP[category] || category;
  return CATEGORY_AMBIENT_COLORS[mapped] || CATEGORY_AMBIENT_COLORS.community;
}

export const TimelineEventCard = memo(function TimelineEventCard({
  event,
  isPast = false,
}: TimelineEventCardProps) {
  const categoryConfig = getCategoryConfig(event.category);
  const categoryLabel = categoryConfig.label;
  const attendeeCount = event.attendee_count || 0;
  const ambientColor = useMemo(() => getAmbientColor(event.category), [event.category]);

  return (
    <div className="tilt-transform">
      <motion.div
        className={`tilt-content relative rounded-[28px] border-2 bg-card overflow-hidden transition-all ${
          isPast 
            ? 'border-border/50 opacity-60' 
            : 'border-border hover:border-primary/30 hover:shadow-sm'
        }`}
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d',
        }}
        whileTap={{ scale: 0.98 }}
      >
        {/* IO26: Ambient Shadow - bleeds category color into glass background */}
        <div 
          className="ambient-shadow" 
          style={{ '--ambient-color': ambientColor } as React.CSSProperties}
          aria-hidden="true" 
        />

        {/* Specular Glint Overlay */}
        <div className="specular-glint" aria-hidden="true" />

        {/* IO26: Edge-to-edge 16:9 imagery (Airbnb-style) */}
        {event.image_url && (
          <div className="relative w-full aspect-video -mt-0 mb-3 overflow-hidden rounded-t-[28px]">
            <img 
              src={event.image_url} 
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
          </div>
        )}

        {/* Card content */}
        <div className="p-4 pt-0">
          {/* Row 1: Time + Attendee Count */}
          <div className="relative z-10 flex items-center justify-between mb-1">
            <span className={`text-[15px] font-semibold ${
              isPast ? 'text-muted-foreground' : 'text-foreground'
            }`}>
              {formatTime(event.event_time)}
            </span>
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Users size={14} />
              <span className="font-medium">{attendeeCount} going</span>
            </div>
          </div>

          {/* Row 2: Event Title */}
          <h4 className={`relative z-10 text-[17px] font-semibold leading-tight line-clamp-1 mb-1 ${
            isPast ? 'text-muted-foreground' : 'text-foreground'
          }`}>
            {event.title}
          </h4>

          {/* Row 3: Location + Category */}
          <div className="relative z-10 flex items-center gap-2 text-[13px] text-muted-foreground">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <MapPin size={12} className="flex-shrink-0" />
              <span className="truncate">{event.venue_name}</span>
            </div>
            <span className="text-border">•</span>
            <span className={`flex-shrink-0 capitalize ${categoryConfig.textClass}`}>
              {categoryLabel}
            </span>
          </div>

          {/* Optional: Ticket Number Badge */}
          {event.ticket_number && (
            <div className="relative z-10 mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Ticket size={12} />
                <span className="font-mono font-medium">{event.ticket_number}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});

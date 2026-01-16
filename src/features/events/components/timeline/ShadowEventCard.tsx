/**
 * Shadow Event Card Component
 * 
 * Displays external calendar events (Google Calendar, etc.) as translucent "ghost" cards.
 * These are read-only items without action buttons, appearing as part of the timeline
 * but visually distinct from native LCL events.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ExternalLink } from 'lucide-react';
import type { ItineraryItem } from '../../hooks/useUnifiedItinerary';
import type { GoogleCalendarExternalEvent } from '@/integrations/googleCalendar';

interface ShadowEventCardProps {
  item: ItineraryItem;
  isPast?: boolean;
}

/**
 * Shadow Event Card - translucent "ghost" style for external calendar events
 */
export const ShadowEventCard = memo(function ShadowEventCard({
  item,
  isPast = false,
}: ShadowEventCardProps) {
  const googleEvent = item.data as GoogleCalendarExternalEvent;
  const hasLocation = Boolean(item.location);
  const hasExternalLink = Boolean(googleEvent.htmlLink);
  const timeLabel = item.isAllDay
    ? 'All Day'
    : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(item.startTime);

  return (
    <motion.div
      className={`
        relative rounded-xl border bg-card/50 backdrop-blur-sm p-3 
        transition-all duration-200 group
        ${isPast 
          ? 'border-border/30 opacity-50 grayscale' 
          : 'border-border/40 hover:border-border/60 hover:bg-card/70'
        }
      `}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isPast ? 0.5 : 0.85 }}
      whileHover={{ opacity: 1 }}
    >
      {/* Main Content Row */}
      <div className="flex items-start gap-3">
        {/* Icon/Time Bubble */}
        <div className="flex-shrink-0 flex flex-col items-center">
          {item.icon ? (
            <span className="text-lg" role="img" aria-label="Event type">
              {item.icon}
            </span>
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
              <span className="text-[10px] font-medium text-muted-foreground">
                CAL
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Time */}
          <span className={`text-[12px] font-medium ${
            isPast ? 'text-muted-foreground/70' : 'text-muted-foreground'
          }`}>
            {timeLabel}
          </span>

          {/* Title */}
          <h4 className={`text-[15px] font-medium leading-tight line-clamp-1 ${
            isPast ? 'text-muted-foreground' : 'text-foreground/80'
          }`}>
            {item.title}
          </h4>

          {/* Location (if available) */}
          {hasLocation && (
            <div className="flex items-center gap-1 mt-0.5 text-[12px] text-muted-foreground/70">
              <MapPin size={10} className="flex-shrink-0" />
              <span className="truncate">{item.location}</span>
            </div>
          )}
        </div>

        {/* External Link Icon */}
        {hasExternalLink && !isPast && (
          <a
            href={googleEvent.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 rounded-full hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open in Google Calendar"
          >
            <ExternalLink size={14} className="text-muted-foreground" />
          </a>
        )}
      </div>

      {/* Source Badge */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider">
          Google Calendar
        </span>
      </div>
    </motion.div>
  );
});

/**
 * Shadow Event Card Component
 * 
 * Displays external calendar events (Google Calendar, etc.) as translucent "ghost" cards.
 * These are read-only items without action buttons, appearing as part of the timeline
 * but visually distinct from native LCL events.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ExternalLink, Calendar } from 'lucide-react';
import type { ItineraryItem } from '../hooks/useUnifiedItinerary';
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
  const googleEvent = (item as any).data as GoogleCalendarExternalEvent;
  const hasLocation = Boolean(item.location);
  const hasExternalLink = Boolean(googleEvent.htmlLink);
  const timeLabel = (item as any).isAllDay
    ? 'All Day'
    : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(item.startTime);

  return (
    <motion.div
      className={`
        relative rounded-xl p-3 
        transition-all duration-200 group
        border-2 border-dashed
        ${isPast 
          ? 'border-muted-foreground/20 bg-muted/20 opacity-60' 
          : 'border-[#4285F4]/40 bg-[#4285F4]/5 hover:border-[#4285F4]/60 hover:bg-[#4285F4]/10'
        }
      `}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      {/* Google Calendar Badge - Always Visible */}
      <div className={`
        absolute -top-2.5 left-3 px-2 py-0.5 rounded-full 
        flex items-center gap-1.5
        ${isPast 
          ? 'bg-muted text-muted-foreground' 
          : 'bg-[#4285F4] text-white'
        }
      `}>
        <Calendar size={10} className="flex-shrink-0" />
        <span className="text-[9px] font-semibold uppercase tracking-wide">
          Google Calendar
        </span>
      </div>

      {/* Main Content Row */}
      <div className="flex items-start gap-3 mt-1">
        {/* Icon/Time Bubble */}
        <div className="flex-shrink-0 flex flex-col items-center">
          {(item as any).icon ? (
            <span className="text-lg" role="img" aria-label="Event type">
              {(item as any).icon}
            </span>
          ) : (
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center
              ${isPast 
                ? 'bg-muted/50' 
                : 'bg-[#4285F4]/15 border border-[#4285F4]/30'
              }
            `}>
              <Calendar size={18} className={isPast ? 'text-muted-foreground' : 'text-[#4285F4]'} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Time */}
          <span className={`text-[11px] font-medium uppercase tracking-wide ${
            isPast ? 'text-muted-foreground/70' : 'text-[#4285F4]'
          }`}>
            {timeLabel}
          </span>

          {/* Title */}
          <h4 className={`text-[15px] font-medium leading-tight line-clamp-2 mt-0.5 ${
            isPast ? 'text-muted-foreground' : 'text-foreground'
          }`}>
            {item.title}
          </h4>

          {/* Location (if available) */}
          {hasLocation && (
            <div className={`flex items-center gap-1 mt-1 text-[12px] ${
              isPast ? 'text-muted-foreground/60' : 'text-muted-foreground'
            }`}>
              <MapPin size={11} className="flex-shrink-0" />
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
            className="flex-shrink-0 p-2 rounded-full bg-[#4285F4]/10 hover:bg-[#4285F4]/20 transition-colors"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open in Google Calendar"
          >
            <ExternalLink size={14} className="text-[#4285F4]" />
          </a>
        )}
      </div>

      {/* Ghost Pattern Overlay */}
      <div 
        className="absolute inset-0 rounded-xl pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            currentColor 10px,
            currentColor 11px
          )`
        }}
      />
    </motion.div>
  );
});
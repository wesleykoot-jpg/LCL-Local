/**
 * Itinerary Timeline Component
 * 
 * TripAdvisor-style unified timeline view that displays both LCL events
 * and external calendar events in a visual journey format.
 * 
 * Features:
 * - Vertical glass rail connecting events
 * - Time nodes instead of numbers
 * - Sticky day headers with blur effect
 * - Staggered entry animations
 * - Ghost cards for external events
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { TimelineEventCard } from './TimelineEventCard';
import { ShadowEventCard } from './ShadowEventCard';
import type { DayGroup, ItineraryItem } from '../hooks/useUnifiedItinerary';
import type { EventWithAttendees } from '../hooks/hooks';

interface ItineraryTimelineProps {
  dayGroups: DayGroup[];
}

/**
 * Time node component - displays time in a glassmorphism bubble on the timeline rail
 */
const TimeNode = memo(function TimeNode({ 
  time, 
  isAllDay,
  isPast 
}: { 
  time: string; 
  isAllDay: boolean;
  isPast: boolean;
}) {
  return (
    <div className={`
      relative z-10 flex items-center justify-center
      min-w-[52px] h-7 px-2 rounded-full
      text-[11px] font-semibold tracking-tight
      backdrop-blur-md border shadow-sm
      ${isPast 
        ? 'bg-muted/40 border-border/30 text-muted-foreground' 
        : 'bg-card/80 border-white/20 text-foreground'
      }
    `}>
      {isAllDay ? '📅' : time}
    </div>
  );
});

/**
 * Single timeline item with rail connection
 */
const TimelineItem = memo(function TimelineItem({
  item,
  index,
  isLast,
  isPast,
}: {
  item: ItineraryItem;
  index: number;
  isLast: boolean;
  isPast: boolean;
}) {
  const isAllDay = item.time === 'All Day';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        delay: index * 0.05, 
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      className="relative flex gap-3"
    >
      {/* Left Rail with Time Node */}
      <div className="flex flex-col items-center flex-shrink-0">
        {/* Time Node */}
        <TimeNode time={item.time} isAllDay={isAllDay} isPast={isPast} />
        
        {/* Connecting Line (unless last item) */}
        {!isLast && (
          <div className={`
            flex-1 w-[2px] min-h-[16px] mt-2
            ${isPast 
              ? 'bg-gradient-to-b from-border/30 to-border/10' 
              : 'bg-gradient-to-b from-white/20 to-white/5'
            }
          `} />
        )}
      </div>

      {/* Card Content */}
      <div className="flex-1 pb-4 min-w-0">
        {item.visualStyle === 'shadow' ? (
          <ShadowEventCard item={item} isPast={isPast} />
        ) : (
          <TimelineEventCard 
            event={item.data as EventWithAttendees & { ticket_number?: string }}
            isPast={isPast}
          />
        )}
      </div>
    </motion.div>
  );
});

/**
 * Day section with sticky header
 */
const DaySection = memo(function DaySection({
  group,
  groupIndex,
}: {
  group: DayGroup;
  groupIndex: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: groupIndex * 0.1, 
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className="mb-6"
    >
      {/* Sticky Day Header */}
      <div className={`
        sticky top-[120px] z-20 -mx-5 px-5 py-2 mb-4
        backdrop-blur-xl border-b
        ${group.isToday 
          ? 'bg-primary/5 border-primary/20' 
          : group.isPast 
            ? 'bg-muted/30 border-border/30' 
            : 'bg-card/80 border-border/50'
        }
      `}>
        <div className="flex items-center gap-3">
          <h3 className={`text-[16px] font-bold ${
            group.isToday 
              ? 'text-primary' 
              : group.isPast 
                ? 'text-muted-foreground' 
                : 'text-foreground'
          }`}>
            {group.label}
          </h3>
          
          {group.isToday && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full uppercase tracking-wider">
              Now
            </span>
          )}
          
          <span className="text-[12px] text-muted-foreground">
            {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
          </span>
        </div>
      </div>

      {/* Timeline Items */}
      <div className="relative pl-1">
        {/* Main vertical rail line (background) */}
        <div className="absolute left-[25px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-white/10 via-white/5 to-transparent rounded-full" />
        
        {/* Items */}
        <div className="relative">
          {group.items.map((item, index) => (
            <TimelineItem
              key={item.id}
              item={item}
              index={index}
              isLast={index === group.items.length - 1}
              isPast={group.isPast}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
});

/**
 * Main Itinerary Timeline Component
 */
export const ItineraryTimeline = memo(function ItineraryTimeline({
  dayGroups,
}: ItineraryTimelineProps) {
  return (
    <motion.div 
      className="px-5 py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {dayGroups.map((group, index) => (
        <DaySection 
          key={group.dateKey} 
          group={group} 
          groupIndex={index} 
        />
      ))}
    </motion.div>
  );
});

import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TimelineEventCard } from './TimelineEventCard';
import type { EventWithAttendees } from '../hooks/hooks';

// Format time like "7:00 PM" - force 12-hour format
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Calculate duration between two times
function calculateDuration(start: Date, end?: Date): string | null {
  if (!end) return null;
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0 && diffMinutes > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else if (diffHours > 0) {
    return `${diffHours}h`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m`;
  }
  return null;
}

// Type guard to check if originalData is EventWithAttendees
function isEventWithAttendees(data: any): data is EventWithAttendees {
  return (
    data &&
    typeof data === 'object' &&
    'id' in data &&
    'title' in data &&
    'category' in data
  );
}

export const ItineraryTimeline = ({ groupedItems }: { groupedItems: Record<string, ItineraryItem[]> }) => {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', month: 'short', day: 'numeric' 
  });

  return (
    <div className="w-full pb-32 px-4">
      {Object.entries(groupedItems).map(([dateHeader, items]) => {
        const isToday = dateHeader === today;
        
        return (
          <div key={dateHeader} className="mb-10 relative">
            {/* Sticky Date Header - Discovery Style */}
            <div className="sticky top-[60px] z-20 py-3 mb-6 backdrop-blur-xl bg-background/90 border-b border-border -mx-4 px-6">
              <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {dateHeader}
                {isToday && (
                  <span className="ml-2 text-[11px] px-2.5 py-1 bg-primary text-primary-foreground rounded-full font-semibold">
                    Today
                  </span>
                )}
              </h3>
            </div>

            {/* Timeline Items */}
            <div className="space-y-6">
              {items.map((item, index) => {
                const startTime = formatTime(item.startTime);
                const duration = calculateDuration(item.startTime, item.endTime);
                const isLastItem = index === items.length - 1;
                
                return (
                  <div key={item.id} className="relative">
                    {/* 3-Column Grid: Time | Line | Card */}
                    <div className="flex gap-4">
                      {/* Column 1: Time - Compact */}
                      <div className="w-[56px] flex-shrink-0 text-right pt-3">
                        <div className="text-sm font-semibold text-foreground leading-tight">
                          {startTime}
                        </div>
                        {duration && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {duration}
                          </div>
                        )}
                      </div>

                      {/* Column 2: Journey Line */}
                      <div className="w-[20px] flex-shrink-0 flex flex-col items-center relative">
                        {/* Waypoint Dot */}
                        <div className={cn(
                          "w-3 h-3 rounded-full border-2 border-background z-10 mt-4 flex-shrink-0",
                          item.type === 'LCL_EVENT' 
                            ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" 
                            : "bg-muted-foreground/40"
                        )} />
                        
                        {/* Connecting Line */}
                        {!isLastItem && (
                          <div className="w-[2px] flex-1 bg-border mt-2 min-h-[40px]" />
                        )}
                      </div>

                      {/* Column 3: Event Card - Full Width */}
                      <div className="flex-1 min-w-0 pb-2">
                        {item.type === 'LCL_EVENT' && isEventWithAttendees(item.originalData) ? (
                          /* TimelineEventCard with trip-card variant handles title internally 
                             as an overlay on the poster, so no external title is needed here */
                          <motion.div 
                            className="transform transition-all"
                            whileTap={{ scale: 0.98 }}
                          >
                            <TimelineEventCard
                              event={item.originalData}
                              variant="trip-card"
                              showJoinButton={false}
                            />
                          </motion.div>
                        ) : item.type === 'LCL_EVENT' ? (
                          <div className="text-muted-foreground text-sm p-4 rounded-xl bg-muted/50">
                            Event data unavailable
                          </div>
                        ) : (
                          /* Google Calendar Ghost Card - Light blue with diagonal pattern */
                          <motion.div 
                            className="relative rounded-2xl border-2 border-dashed border-sky-300/60 p-4 transition-all hover:border-sky-400/80 hover:shadow-md overflow-hidden"
                            whileTap={{ scale: 0.98 }}
                            style={{
                              backgroundColor: 'hsl(204, 100%, 97%)',
                              backgroundImage: `repeating-linear-gradient(
                                135deg,
                                transparent,
                                transparent 8px,
                                hsl(204, 100%, 92%) 8px,
                                hsl(204, 100%, 92%) 9px
                              )`
                            }}
                          >
                            {/* Google Calendar Badge */}
                            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/80 flex items-center gap-1.5 shadow-sm">
                              <Calendar size={12} className="text-[#4285F4]" />
                              <span className="text-[10px] font-semibold text-[#4285F4] uppercase tracking-wide">
                                Calendar
                              </span>
                            </div>

                            {/* Title */}
                            <h4 className="text-base font-semibold text-sky-900 leading-snug line-clamp-2 mb-2 pr-20">
                              {item.title}
                            </h4>

                            {/* Location + Time */}
                            <div className="flex items-center gap-3 text-[13px] text-sky-700/80">
                              {item.location && (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <MapPin size={13} className="flex-shrink-0 text-sky-500" />
                                  <span className="truncate">{item.location}</span>
                                </div>
                              )}
                              {item.endTime && (
                                <span className="flex-shrink-0 text-sky-600/60">
                                  ends {formatTime(item.endTime)}
                                </span>
                              )}
                            </div>

                            {/* External Link */}
                            {(item.originalData as { htmlLink?: string })?.htmlLink && (
                              <a
                                href={(item.originalData as { htmlLink?: string })?.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-[#4285F4] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={12} />
                                Open in Google Calendar
                              </a>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

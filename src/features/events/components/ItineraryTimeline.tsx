import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { Calendar, MapPin, Users, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_MAP } from '@/shared/lib/categories';
import { motion } from 'framer-motion';
import { TimelineEventCard } from './TimelineEventCard';
import type { EventWithAttendees } from '../hooks/hooks';

// Format time like "7:00 PM"
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Calculate duration between two times
function calculateDuration(start: Date, end?: Date): string | null {
  if (!end) return null;
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0 && diffMinutes > 0) {
    return `${diffHours}h ${diffMinutes}m • Ends ${formatTime(end)}`;
  } else if (diffHours > 0) {
    return `${diffHours}h • Ends ${formatTime(end)}`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m • Ends ${formatTime(end)}`;
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
          <div key={dateHeader} className="mb-8 relative">
            {/* Sticky Header */}
            <div className="sticky top-[60px] z-20 py-3 mb-6 backdrop-blur-xl bg-background/80 border-b border-border -mx-4 px-8">
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {dateHeader}
                {isToday && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                    Today
                  </span>
                )}
              </h3>
            </div>

            {/* Timeline Items with Generous Spacing */}
            <div className="space-y-12">
              {items.map((item, index) => {
                const startTime = formatTime(item.startTime);
                const duration = calculateDuration(item.startTime, item.endTime);
                const isLastItem = index === items.length - 1;
                
                return (
                  <div key={item.id} className="relative">
                    {/* 3-Column Grid: Chronometer | Journey Line | Experience */}
                    <div className="flex gap-6">
                      {/* Column 1: The Chronometer - Fixed 80px, Right-Aligned */}
                      <div className="w-[80px] flex-shrink-0 text-right pt-0.5">
                        <div className="text-xl font-bold text-white leading-tight">
                          {startTime}
                        </div>
                        {duration && (
                          <div className="text-xs text-white/40 mt-1 leading-tight">
                            {duration}
                          </div>
                        )}
                      </div>

                      {/* Column 2: The Journey Line - Fixed 24px */}
                      <div className="w-[24px] flex-shrink-0 flex flex-col items-center relative">
                        {/* Waypoint Icon - Different for LCL vs Google Calendar */}
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 border-background z-10 mt-1.5 flex-shrink-0",
                          item.type === 'LCL_EVENT' 
                            ? "bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)] ring-2 ring-primary/20" 
                            : "bg-white/20 border-white/40"
                        )} />
                        
                        {/* Vertical Connecting Line - Break behind the node using z-index */}
                        {!isLastItem && (
                          <div className="w-[2px] flex-1 bg-white/10 mt-2 min-h-[60px]" />
                        )}
                      </div>

                      {/* Column 3: The Experience - Flexible Width */}
                      <div className="flex-1 min-w-0 pb-12">
                        {/* Element A: Location Header (Logistics) */}
                        {item.location && (
                          <div className="flex items-center gap-2 text-sm text-white/60 mb-3 font-medium uppercase tracking-wide">
                            <MapPin size={14} className="flex-shrink-0" />
                            <span className="truncate">{item.location}</span>
                            {/* TODO: Add distance calculation when available */}
                          </div>
                        )}

                        {/* Element B: The Card (Visual) */}
                        {item.type === 'LCL_EVENT' && isEventWithAttendees(item.originalData) ? (
                          <div className="transform transition-all hover:scale-[1.01]">
                            <TimelineEventCard
                              event={item.originalData}
                              variant="trip-card"
                              showJoinButton={false}
                            />
                          </div>
                        ) : item.type === 'LCL_EVENT' ? (
                          /* Fallback for LCL events without valid data */
                          <div className="text-white/40 text-sm">Event data unavailable</div>
                        ) : (
                          /* Phase 3: Google Calendar Ghost Card - Travel Notes Style */
                          <motion.div 
                            className="relative rounded-xl bg-white/5 border-2 border-dashed border-white/20 p-4 transition-all hover:bg-white/[0.07] hover:border-white/30"
                            whileTap={{ scale: 0.98 }}
                          >
                            {/* Horizontal Flex Layout */}
                            <div className="flex items-start gap-3">
                              {/* Left: Icon Box */}
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
                                <Calendar size={18} className="text-[#4285F4]" />
                              </div>
                              
                              {/* Right: Title + Subtext */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-medium text-[16px] leading-snug line-clamp-2 mb-1">
                                  {item.title}
                                </h4>
                                <p className="text-white/40 text-[12px] font-medium uppercase tracking-wide">
                                  Imported from Calendar
                                </p>
                              </div>
                              
                              {/* External Link */}
                              {(item.originalData as { htmlLink?: string })?.htmlLink && (
                                <a
                                  href={(item.originalData as { htmlLink?: string })?.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Open in Google Calendar"
                                >
                                  <ExternalLink size={14} className="text-white/60" />
                                </a>
                              )}
                            </div>
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

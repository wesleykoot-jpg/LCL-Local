import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { Calendar, MapPin, Users, Ticket, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_MAP } from '@/shared/lib/categories';
import { motion } from 'framer-motion';

// Format time like "7:00 PM"
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const ItineraryEventCard = ({ item }: { item: ItineraryItem }) => {
  const categoryLabel = item.category ? (CATEGORY_MAP[item.category] || item.category) : null;

  return (
    <motion.div
      className="relative rounded-2xl border-2 bg-card p-4 transition-all border-border hover:border-primary/30 hover:shadow-sm"
      whileTap={{ scale: 0.98 }}
    >
      {/* Category Badge - Top Right Corner */}
      {categoryLabel && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-primary/10 text-primary">
          <span className="text-[11px] font-semibold uppercase tracking-wide capitalize">
            {categoryLabel}
          </span>
        </div>
      )}

      {/* Event Title */}
      <h4 className="text-[17px] font-semibold leading-tight line-clamp-1 mb-2 text-foreground pr-16">
        {item.title}
      </h4>

      {/* Attendee Count */}
      {item.attendeeCount !== undefined && (
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Users size={14} />
          <span className="font-medium">{item.attendeeCount} going</span>
        </div>
      )}

      {/* Optional: Ticket Number Badge */}
      {item.ticketNumber && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Ticket size={12} />
            <span className="font-mono font-medium">{item.ticketNumber}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

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

            <div className="space-y-8">
              {items.map((item) => {
                const startTime = formatTime(item.startTime);
                const endTime = item.endTime ? formatTime(item.endTime) : null;
                
                return (
                  <div key={item.id} className="flex gap-4 pb-8">
                    {/* Column 1: Time Anchor (Fixed Width, Right-Aligned) */}
                    <div className="w-[80px] flex-shrink-0 text-right pt-1">
                      <div className="text-[18px] font-bold text-foreground leading-tight">
                        {startTime}
                      </div>
                      {endTime && (
                        <div className="text-[12px] text-muted-foreground mt-0.5">
                          {endTime}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Thread (Center) */}
                    <div className="flex flex-col items-center flex-shrink-0 relative">
                      {/* Node (aligned with start time) */}
                      <div className={cn(
                        "w-3 h-3 rounded-full border-2 border-background z-10 mt-1.5",
                        item.type === 'LCL_EVENT' 
                          ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" 
                          : "bg-muted-foreground/30"
                      )} />
                      {/* Vertical Line */}
                      <div className="w-[2px] flex-1 bg-border" />
                    </div>

                    {/* Column 3: Content (Flex-Grow) */}
                    <div className="flex-1 min-w-0">
                      {/* Location Header (Section Title) */}
                      {item.location && (
                        <div className="flex items-center gap-1.5 mb-2 text-[13px] text-muted-foreground">
                          <MapPin size={13} className="flex-shrink-0" />
                          <span className="font-medium truncate">{item.location}</span>
                        </div>
                      )}

                      {/* Card */}
                      {item.type === 'LCL_EVENT' ? (
                        <div className="transform transition-all hover:scale-[1.01]">
                          <ItineraryEventCard item={item} />
                        </div>
                      ) : (
                        // 💎 Google Calendar Ghost Card (Minimal Layout)
                        <motion.div 
                          className="relative rounded-xl border-2 border-dashed border-[#4285F4]/40 bg-[#4285F4]/5 p-4 group hover:border-[#4285F4]/60 hover:bg-[#4285F4]/10 transition-all overflow-hidden"
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Google Calendar Badge */}
                          <div className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full bg-[#4285F4] text-white flex items-center gap-1.5">
                            <Calendar size={10} className="flex-shrink-0" />
                            <span className="text-[9px] font-semibold uppercase tracking-wide">
                              Google Calendar
                            </span>
                          </div>
                          
                          {/* Content Container */}
                          <div className="relative z-10 mt-1">
                            {/* Title + External Link */}
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="text-foreground font-medium text-[16px] leading-snug flex-1 line-clamp-2">
                                {item.title}
                              </h4>
                              <a
                                href={(item.originalData as { htmlLink?: string })?.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 p-2 rounded-full bg-[#4285F4]/10 hover:bg-[#4285F4]/20 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Open in Google Calendar"
                              >
                                <ExternalLink size={14} className="text-[#4285F4]" />
                              </a>
                            </div>
                          </div>
                          
                          {/* Subtle diagonal pattern overlay */}
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
                      )}
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

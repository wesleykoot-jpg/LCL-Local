import React from 'react';
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
      {/* Row 1: Time + Attendee Count */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[15px] font-semibold text-foreground">
          {formatTime(item.startTime)}
        </span>
        {item.attendeeCount !== undefined && (
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Users size={14} />
            <span className="font-medium">{item.attendeeCount} going</span>
          </div>
        )}
      </div>

      {/* Row 2: Event Title */}
      <h4 className="text-[17px] font-semibold leading-tight line-clamp-1 mb-1 text-foreground">
        {item.title}
      </h4>

      {/* Row 3: Location + Category */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        {item.location && (
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>
        )}
        {categoryLabel && (
          <>
            <span className="text-border">•</span>
            <span className="flex-shrink-0 capitalize">{categoryLabel}</span>
          </>
        )}
      </div>

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

            {/* Vertical Thread */}
            <div className="absolute left-[23px] top-12 bottom-0 w-[2px] bg-border" />

            <div className="space-y-8">
              {items.map((item) => (
                <div key={item.id} className="relative pl-10">
                  {/* Time Node */}
                  <div className={cn(
                    "absolute left-[16px] top-6 w-4 h-4 rounded-full border-2 border-background z-10",
                    item.type === 'LCL_EVENT' 
                      ? "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]" 
                      : "bg-muted-foreground/30"
                  )} />

                  {/* Time Label */}
                  <div className="mb-2 flex items-center text-xs font-medium text-muted-foreground gap-3">
                    <span className="bg-muted px-2 py-1 rounded border border-border">
                      {formatTime(item.startTime)}
                    </span>
                    {item.location && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <MapPin className="w-3 h-3" /> {item.location}
                      </span>
                    )}
                  </div>

                  {/* Card */}
                  {item.type === 'LCL_EVENT' ? (
                    <div className="transform transition-all hover:scale-[1.01]">
                      <ItineraryEventCard item={item} />
                    </div>
                  ) : (
                    // 💎 HOLOGRAPHIC MEMO (Google Calendar)
                    <motion.div 
                      className="relative rounded-xl bg-white/5 border border-white/10 border-l-2 border-l-blue-500/50 p-4 backdrop-blur-sm group hover:bg-white/[0.08] transition-all overflow-hidden"
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Subtle Calendar Icon Watermark */}
                      <div className="absolute top-3 right-3 opacity-[0.15] pointer-events-none">
                        <Calendar className="w-16 h-16 text-white" />
                      </div>
                      
                      {/* Content Container */}
                      <div className="relative z-10">
                        {/* Row 1: Title + External Badge */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="text-white/90 font-medium text-[16px] leading-snug flex-1 line-clamp-2">
                            {item.title}
                          </h4>
                          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/10">
                            <ExternalLink className="w-3 h-3 text-blue-400" />
                            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">External</span>
                          </div>
                        </div>
                        
                        {/* Row 2: Time Range • Location */}
                        <div className="flex items-center gap-2 text-[13px] text-white/50">
                          <span className="font-mono font-medium text-white/70">
                            {formatTime(item.startTime)}
                            {item.endTime && ` - ${formatTime(item.endTime)}`}
                          </span>
                          {item.location && (
                            <>
                              <span className="text-white/20">•</span>
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                <MapPin size={11} className="flex-shrink-0 text-white/40" />
                                <span className="truncate">{item.location}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

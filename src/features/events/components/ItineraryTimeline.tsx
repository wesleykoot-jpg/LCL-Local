import React from 'react';
import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { Calendar, MapPin, Users, Ticket } from 'lucide-react';
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
                    // 👻 GHOST CARD (Google Calendar)
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex justify-between items-center group hover:bg-white/10 transition-colors">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium text-base">{item.title}</h4>
                          <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                            {item.location && <span>{item.location} • </span>}
                            Google Calendar
                          </p>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Optional Action for Calendar items */}
                      </div>
                    </div>
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

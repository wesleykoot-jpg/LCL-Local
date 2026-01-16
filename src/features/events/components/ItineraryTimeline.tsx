import React from 'react';
import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { TimelineEventCard } from './TimelineEventCard';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ItineraryTimeline = ({ groupedItems }: { groupedItems: Record<string, ItineraryItem[]> }) => {
  return (
    <div className="w-full pb-32 px-4">
      {Object.entries(groupedItems).map(([dateHeader, items]) => (
        <div key={dateHeader} className="mb-8 relative">
          {/* Sticky Header */}
          <div className="sticky top-[60px] z-20 py-3 mb-6 backdrop-blur-xl bg-black/40 border-b border-white/10 -mx-4 px-8">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-400" />
              {dateHeader}
            </h3>
          </div>

          {/* Vertical Thread */}
          <div className="absolute left-[23px] top-12 bottom-0 w-[2px] bg-white/10" />

          <div className="space-y-8">
            {items.map((item) => (
              <div key={item.id} className="relative pl-10">
                {/* Time Node */}
                <div className={cn(
                  "absolute left-[16px] top-6 w-4 h-4 rounded-full border-2 border-black z-10",
                  item.type === 'LCL_EVENT' ? "bg-primary-500 shadow-[0_0_10px_rgba(56,189,248,0.5)]" : "bg-white/30"
                )} />

                {/* Time Label */}
                <div className="mb-2 flex items-center text-xs font-medium text-white/60 gap-3">
                  <span className="bg-white/5 px-2 py-1 rounded border border-white/10">
                    {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    <TimelineEventCard event={item.originalData} />
                  </div>
                ) : (
                  // Ghost Card for Calendar Items
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-white font-medium">{item.title}</h4>
                        <p className="text-white/40 text-xs mt-1">Google Calendar</p>
                      </div>
                      <Clock className="w-4 h-4 text-white/40" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

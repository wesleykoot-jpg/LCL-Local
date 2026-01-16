/**
 * Itinerary Timeline Component
 *
 * Displays LCL and Google Calendar events in a unified, day-grouped timeline.
 * Uses a continuous vertical rail, glass time nodes, and sticky day headers.
 */

import { memo } from 'react';
import { TimelineEventCard } from '../TimelineEventCard';
import type { ItineraryItem, GroupedTimeline } from '../../hooks/useUnifiedItinerary';

interface ItineraryTimelineProps {
  groupedTimeline: GroupedTimeline;
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const TimeNode = memo(function TimeNode({
  label,
}: {
  label: string;
}) {
  return (
    <div className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-foreground/90 backdrop-blur-md shadow-sm">
      {label}
    </div>
  );
});

const GoogleCalendarCard = memo(function GoogleCalendarCard({
  item,
}: {
  item: Extract<ItineraryItem, { type: 'GOOGLE_CALENDAR' }>;
}) {
  const googleEvent = item.data;
  const timeLabel = item.isAllDay ? 'All Day' : timeFormatter.format(item.startTime);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur-md">
      <div className="text-[12px] text-muted-foreground">{timeLabel}</div>
      <div className="text-[15px] font-semibold text-foreground/80">{item.title}</div>
      {googleEvent.location && (
        <div className="mt-1 text-[12px] text-muted-foreground/80">{googleEvent.location}</div>
      )}
    </div>
  );
});

export const ItineraryTimeline = memo(function ItineraryTimeline({
  groupedTimeline,
}: ItineraryTimelineProps) {
  const groupedEntries = Object.entries(groupedTimeline);

  return (
    <div className="px-5 py-4">
      <div className="relative border-l-2 border-white/10 pl-6">
        {groupedEntries.map(([label, items]) => (
          <div key={label} className="pb-8">
            <div className="sticky top-[96px] z-20 -ml-6 mb-4 flex items-center bg-background/70 py-2 pl-6 backdrop-blur-xl">
              <h3 className="text-[15px] font-semibold text-foreground">{label}</h3>
            </div>
            <div className="space-y-6">
              {items.map((item) => {
                const timeLabel = item.isAllDay ? 'All Day' : timeFormatter.format(item.startTime);

                return (
                  <div key={item.id} className="relative">
                    <div className="absolute -left-[30px] top-4">
                      <TimeNode label={timeLabel} />
                    </div>
                    <div className="pl-2">
                      {item.type === 'LCL_EVENT' ? (
                        <TimelineEventCard event={item.data} />
                      ) : (
                        <GoogleCalendarCard item={item} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

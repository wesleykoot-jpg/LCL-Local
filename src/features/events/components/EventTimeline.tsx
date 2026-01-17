import React, { useMemo } from 'react';
import { TimelineEventCard } from './TimelineEventCard';
import { EventWithAttendees } from '../hooks/hooks';
import { Calendar } from 'lucide-react';

interface EventTimelineProps {
  events: EventWithAttendees[];
  showJoinButton?: boolean;
}

/**
 * Groups events by date and displays them in a timeline format
 */
export const EventTimeline: React.FC<EventTimelineProps> = ({ 
  events, 
  showJoinButton = false 
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Defensive UI filter: exclude 'Jazz & Wine Tasting' events
  // This prevents them from appearing in the timeline even if present in data
  const filteredEvents = useMemo(() => {
    return events.filter(e => !/jazz\s*&\s*wine\s*tasting/i.test(e.title || ''));
  }, [events]);

  // Group events by day
  const groupedEvents = useMemo(() => {
    const groups: Record<string, EventWithAttendees[]> = {};
    
    filteredEvents.forEach(event => {
      const eventDate = new Date(event.event_date);
      const dateKey = eventDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return groups;
  }, [filteredEvents]);

  // Check if a date string represents today
  const isToday = (dateKey: string) => {
    const todayKey = today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
    return dateKey === todayKey;
  };

  // Check if event is in the past
  const isPastEvent = (event: EventWithAttendees) => {
    const eventDate = new Date(event.event_date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  if (filteredEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground">No events</h3>
        <p className="text-muted-foreground text-sm">No events to display</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-32 px-4">
      {Object.entries(groupedEvents).map(([dateHeader, dayEvents]) => {
        const todayBadge = isToday(dateHeader);

        return (
          <div key={dateHeader} className="mb-8 relative">
            {/* Sticky Date Header */}
            <div className="sticky top-[60px] z-20 py-3 mb-6  bg-background/80 border-b border-border -mx-4 px-8">
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {dateHeader}
                {todayBadge && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                    Today
                  </span>
                )}
              </h3>
            </div>

            {/* Vertical Thread */}
            <div className="absolute left-[23px] top-12 bottom-0 w-[2px] bg-border" />

            <div className="space-y-6">
              {dayEvents.map((event) => (
                <div key={event.id} className="relative pl-10">
                  {/* Time Node */}
                  <div className={`absolute left-[16px] top-6 w-4 h-4 rounded-full border-2 border-background z-10 ${
                    isPastEvent(event) 
                      ? "bg-muted-foreground/30" 
                      : "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
                  }`} />

                  {/* Event Card */}
                  <div className="transform transition-all hover:scale-[1.01]">
                    <TimelineEventCard 
                      event={event} 
                      isPast={isPastEvent(event)}
                      showJoinButton={showJoinButton}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
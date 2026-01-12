import React from 'react';
import { motion } from 'framer-motion';
import { TimelineEventCard } from './TimelineEventCard';
import type { EventWithAttendees } from '@/lib/hooks';

interface GroupedEvents {
  [monthYear: string]: Array<EventWithAttendees & { ticket_number?: string }>;
}

interface EventTimelineProps {
  groupedByMonth: GroupedEvents;
}

export function EventTimeline({ groupedByMonth }: EventTimelineProps) {
  const months = Object.keys(groupedByMonth).sort((a, b) => {
    // Sort by date - parse "March 2025" format
    const [monthA, yearA] = a.split(' ');
    const [monthB, yearB] = b.split(' ');
    const dateA = new Date(`${monthA} 1, ${yearA}`);
    const dateB = new Date(`${monthB} 1, ${yearB}`);
    return dateA.getTime() - dateB.getTime();
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="px-5 py-6">
      {months.map((monthYear, monthIndex) => (
        <motion.div
          key={monthYear}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: monthIndex * 0.1 }}
          className="mb-8"
        >
          {/* Month Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="text-lg font-headline text-foreground">
              {monthYear}
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Events in this month */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-border rounded-full" />

            <div className="space-y-4">
              {groupedByMonth[monthYear].map((event, eventIndex) => {
                const eventDate = new Date(event.event_date);
                eventDate.setHours(0, 0, 0, 0);
                const isToday = eventDate.getTime() === today.getTime();
                const isPast = eventDate.getTime() < today.getTime();

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: monthIndex * 0.1 + eventIndex * 0.05 }}
                    className="relative flex gap-4"
                  >
                    {/* Timeline node */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-primary ring-4 ring-primary/20'
                            : isPast
                            ? 'bg-muted'
                            : 'bg-card border-2 border-border'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isToday
                              ? 'bg-primary-foreground'
                              : isPast
                              ? 'bg-muted-foreground'
                              : 'bg-primary'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Date label + Event card */}
                    <div className="flex-1 min-w-0">
                      {/* Date label */}
                      <div
                        className={`text-xs font-medium mb-2 ${
                          isToday
                            ? 'text-primary'
                            : isPast
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {isToday ? 'Today' : formatDateLabel(event.event_date)}
                      </div>

                      {/* Event card */}
                      <TimelineEventCard event={event} isPast={isPast} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

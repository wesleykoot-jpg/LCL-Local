import { motion } from 'framer-motion';
import { TimelineEventCard } from './TimelineEventCard';
import type { EventWithAttendees } from '@/features/events/hooks/hooks';

interface DayGroupedEvents {
  [dayKey: string]: Array<EventWithAttendees & { ticket_number?: string }>;
}

interface GroupedEvents {
  [monthYear: string]: Array<EventWithAttendees & { ticket_number?: string }>;
}

interface EventTimelineProps {
  groupedByMonth: GroupedEvents;
}

// Group events by day within a month
function groupEventsByDay(events: Array<EventWithAttendees & { ticket_number?: string }>): DayGroupedEvents {
  const grouped: DayGroupedEvents = {};
  
  events.forEach(event => {
    const dateKey = event.event_date.split('T')[0].split(' ')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(event);
  });
  
  return grouped;
}

// Format day header like "Tuesday, March 4"
function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Check if date is today
function isToday(dateStr: string): boolean {
  const eventDate = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDate.getTime() === today.getTime();
}

// Check if date is in the past
function isPastDate(dateStr: string): boolean {
  const eventDate = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDate.getTime() < today.getTime();
}

export function EventTimeline({ groupedByMonth }: EventTimelineProps) {
  const months = Object.keys(groupedByMonth).sort((a, b) => {
    const dateA = new Date(groupedByMonth[a][0]?.event_date || '');
    const dateB = new Date(groupedByMonth[b][0]?.event_date || '');
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="px-5 py-4">
      {months.map((month, monthIndex) => {
        const dayGroups = groupEventsByDay(groupedByMonth[month]);
        const sortedDays = Object.keys(dayGroups).sort();

        return (
          <motion.div
            key={month}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: monthIndex * 0.1, duration: 0.3 }}
            className="mb-8"
          >
            {/* Month Header */}
            <h2 className="text-[22px] font-bold text-foreground tracking-tight mb-5">
              {month}
            </h2>

            {/* Day Sections */}
            <div className="space-y-6">
              {sortedDays.map((dayKey, dayIndex) => {
                const dayEvents = dayGroups[dayKey];
                const isPast = isPastDate(dayKey);
                const isTodayDate = isToday(dayKey);

                return (
                  <motion.div
                    key={dayKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: monthIndex * 0.1 + dayIndex * 0.05, duration: 0.2 }}
                  >
                    {/* Day Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className={`text-[15px] font-semibold ${
                        isTodayDate 
                          ? 'text-primary' 
                          : isPast 
                            ? 'text-muted-foreground' 
                            : 'text-foreground'
                      }`}>
                        {isTodayDate ? 'Today' : formatDayHeader(dayKey)}
                      </h3>
                      {isTodayDate && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-full">
                          NOW
                        </span>
                      )}
                    </div>

                    {/* Events for this day */}
                    <div className="space-y-3">
                      {dayEvents.map((event, eventIndex) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: eventIndex * 0.05, duration: 0.2 }}
                        >
                          <TimelineEventCard 
                            event={event} 
                            isPast={isPast}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

import { memo, useMemo, useState, Fragment, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Clock } from 'lucide-react';
import { EventStackCard } from './EventStackCard';
import { CategorySubscribeCard } from './CategorySubscribeCard';
import { TimeFilterPills, type TimeFilter } from './TimeFilterPills';
import { groupEventsIntoStacks, type EventStack } from '@/lib/feedGrouping';
import { rankEvents, type UserPreferences } from '@/lib/feedAlgorithm';
import { getCategoryConfig } from '@/lib/categories';
import { useJoinEvent } from '@/lib/hooks';
import type { EventWithAttendees } from '@/lib/hooks';

// Reliable Unsplash images for Meppel, Netherlands events
const MEPPEL_EVENT_IMAGES = {
  football: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=900&q=80',
  borrel: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80',
  boardGames: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=80',
  park: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
  picnic: 'https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=900&q=80',
  iceCream: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=900&q=80',
  terrace: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
  canal: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=900&q=80',
  jazz: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=900&q=80',
  afterparty: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80',
  market: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
};

// Mock events removed - using real scraped events from Supabase

// Vibe header configuration
type VibeType = 'tonight' | 'weekend' | 'later';

interface VibeHeader {
  type: VibeType;
  label: string;
  icon: typeof Sparkles;
  className: string;
}

const VIBE_HEADERS: Record<VibeType, VibeHeader> = {
  tonight: {
    type: 'tonight',
    label: 'Happening Tonight',
    icon: Sparkles,
    className: 'text-primary',
  },
  weekend: {
    type: 'weekend',
    label: 'This Weekend',
    icon: Calendar,
    className: 'text-accent-foreground',
  },
  later: {
    type: 'later',
    label: 'Coming Up',
    icon: Clock,
    className: 'text-muted-foreground',
  },
};

// Parse date string as local date (not UTC) - fixes timezone issues
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

// Date helper functions
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

function getUpcomingWeekend(today: Date): { friday: Date; sunday: Date } {
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // If today is Friday, get next Friday
  
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  friday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);
  
  return { friday, sunday };
}

function isWithinWeekend(eventDate: Date, friday: Date, sunday: Date): boolean {
  return eventDate >= friday && eventDate <= sunday;
}

// Filter events by time
function filterEventsByTime(events: EventWithAttendees[], filter: TimeFilter): EventWithAttendees[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (filter) {
    case 'tonight':
      return events.filter(e => {
        const eventDay = parseLocalDate(e.event_date);
        return isSameDay(eventDay, today);
      });
      
    case 'tomorrow':
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return events.filter(e => {
        const eventDay = parseLocalDate(e.event_date);
        return isSameDay(eventDay, tomorrow);
      });
      
    case 'weekend':
      const { friday, sunday } = getUpcomingWeekend(today);
      return events.filter(e => {
        const eventDay = parseLocalDate(e.event_date);
        return isWithinWeekend(eventDay, friday, sunday);
      });
      
    case 'all':
    default:
      return events;
  }
}

// Helper to determine vibe type for a date
function getVibeType(eventDate: string): VibeType {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const eventDay = parseLocalDate(eventDate);
  
  // Check if today or past (show as "tonight" for immediate relevance)
  if (eventDay.getTime() <= today.getTime()) {
    return 'tonight';
  }
  
  // Check if tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (eventDay.getTime() === tomorrow.getTime()) {
    return 'tonight'; // Group tomorrow with tonight for urgency
  }
  
  // Check if this weekend (Friday-Sunday)
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + (daysUntilFriday === 0 ? 0 : daysUntilFriday));
  friday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);
  
  if (eventDay >= friday && eventDay <= sunday) {
    return 'weekend';
  }
  
  return 'later';
}

// Group stacks by vibe type
interface VibeGroup {
  vibe: VibeType;
  stacks: EventStack[];
}

function groupStacksByVibe(stacks: EventStack[]): VibeGroup[] {
  const groups: Map<VibeType, EventStack[]> = new Map();
  
  stacks.forEach(stack => {
    const vibe = getVibeType(stack.anchor.event_date);
    const existing = groups.get(vibe) || [];
    existing.push(stack);
    groups.set(vibe, existing);
  });
  
  // Return in order: tonight, weekend, later
  const result: VibeGroup[] = [];
  const order: VibeType[] = ['tonight', 'weekend', 'later'];
  
  order.forEach(vibe => {
    const stacks = groups.get(vibe);
    if (stacks && stacks.length > 0) {
      result.push({ vibe, stacks });
    }
  });
  
  return result;
}

interface EventFeedProps {
  events: EventWithAttendees[];
  onEventClick?: (eventId: string) => void;
  userPreferences?: UserPreferences | null;
  showVibeHeaders?: boolean;
  profileId?: string;
  onEventsChange?: () => void;
}

// Vibe Header Component - Centered divider style
const VibeHeaderSection = memo(function VibeHeaderSection({ vibe }: { vibe: VibeType }) {
  const config = VIBE_HEADERS[vibe];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="section-divider my-5 first:mt-0"
    >
      <span className="section-divider-label">
        <Icon size={14} />
        {config.label}
      </span>
    </motion.div>
  );
});

export const EventFeed = memo(function EventFeed({
  events,
  onEventClick,
  userPreferences,
  showVibeHeaders = false,
  profileId,
  onEventsChange,
}: EventFeedProps) {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('all');

  // Use real Supabase join event hook
  const { handleJoinEvent, isJoining } = useJoinEvent(profileId, onEventsChange);

  // Use real events directly (no mock data)
  const allEvents = events;

  // Filter events by time first
  const filteredEvents = useMemo(() => {
    return filterEventsByTime(allEvents, activeFilter);
  }, [allEvents, activeFilter]);

  // Apply smart ranking algorithm
  const rankedEvents = useMemo(() => {
    return rankEvents(filteredEvents, userPreferences || null, {
      ensureDiversity: true,
      debug: false, // Disable debug logging
    });
  }, [filteredEvents, userPreferences]);

  // Group events into stacks (anchor + forks)
  const eventStacks = useMemo(() => {
    return groupEventsIntoStacks(rankedEvents);
  }, [rankedEvents]);

  // Group stacks by vibe if headers are enabled and filter is 'all'
  const vibeGroups = useMemo(() => {
    if (!showVibeHeaders || activeFilter !== 'all') return [];
    return groupStacksByVibe(eventStacks);
  }, [eventStacks, showVibeHeaders, activeFilter]);

  // Handler for category subscription (reserved for future use)
  const _handleCategorySubscribe = useCallback((category: string) => {
    console.log('Subscribed to category:', category);
  }, []);

  // Render a single stack card
  const renderStackCard = (stack: EventStack, index: number, injectSubscribeCard: boolean = false, totalInGroup: number = 0) => {
    // Check if any event in the stack (anchor or any fork) is being joined
    const joiningId = isJoining(stack.anchor.id) 
      ? stack.anchor.id 
      : stack.forks.find(fork => isJoining(fork.id))?.id;

    return (
      <Fragment key={stack.anchor.id}>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          layout
        >
          <EventStackCard
            stack={stack}
            onEventClick={onEventClick}
            onJoinEvent={handleJoinEvent}
            joiningEventId={joiningId}
            currentUserProfileId={profileId}
          />
        </motion.div>
        {/* Inject CategorySubscribeCard after 2nd event in "later" group */}
        {injectSubscribeCard && index === 1 && totalInGroup > 2 && (
          <CategorySubscribeCard
            categoryLabel={getCategoryConfig(stack.anchor.category).label}
          />
        )}
      </Fragment>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky Time Filter Pills */}
      <div className="sticky top-[60px] z-30 bg-background/80 backdrop-blur-xl -mx-4 px-4 py-3">
        <TimeFilterPills
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      <motion.div 
        className="max-w-md mx-auto w-full flex flex-col gap-5 overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        }}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6"
          >
            {eventStacks.length > 0 ? (
              activeFilter === 'all' && vibeGroups.length > 0 ? (
                vibeGroups.map(group => (
                  <Fragment key={group.vibe}>
                    <VibeHeaderSection vibe={group.vibe} />
                    {group.stacks.map((stack, index) => 
                      renderStackCard(stack, index, group.vibe === 'later', group.stacks.length)
                    )}
                  </Fragment>
                ))
              ) : (
                eventStacks.map((stack, index) => renderStackCard(stack, index))
              )
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-muted-foreground text-lg">No events found for this time</p>
                <p className="text-muted-foreground/60 text-sm mt-2">Try selecting a different filter</p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
});

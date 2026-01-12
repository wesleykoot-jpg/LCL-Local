import { memo, useMemo, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Clock } from 'lucide-react';
import { EventStackCard } from './EventStackCard';
import { CategorySubscribeCard } from './CategorySubscribeCard';
import { TimeFilterPills, type TimeFilter } from './TimeFilterPills';
import { groupEventsIntoStacks, type EventStack } from '@/lib/feedGrouping';
import { rankEvents, type UserPreferences } from '@/lib/feedAlgorithm';
import { getCategoryConfig } from '@/lib/categories';
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

// Mock events data for Meppel, Netherlands
const MOCK_MEPPEL_EVENTS: EventWithAttendees[] = [
  {
    id: 'mock-1',
    title: 'FC Meppel thuiswedstrijd op Ezinge',
    category: 'active',
    venue_name: 'Sportpark Ezinge, Meppel',
    event_date: new Date().toISOString().split('T')[0], // Today - for "Tonight"
    event_time: '19:30',
    event_type: 'anchor',
    image_url: MEPPEL_EVENT_IMAGES.football,
    match_percentage: 92,
    attendee_count: 24,
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    parent_event_id: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-1-fork',
    title: 'Pre-match borrel bij de kantine',
    category: 'social',
    venue_name: 'Sportkantine Ezinge',
    event_date: new Date().toISOString().split('T')[0], // Today
    event_time: '17:30',
    event_type: 'fork',
    image_url: MEPPEL_EVENT_IMAGES.borrel,
    match_percentage: 78,
    attendee_count: 12,
    parent_event_id: 'mock-1',
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-2',
    title: 'Spellenavond bij Café De Kansel',
    category: 'gaming',
    venue_name: 'Café De Kansel, Woldstraat',
    event_date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })(), // Tomorrow
    event_time: '19:30',
    event_type: 'anchor',
    image_url: MEPPEL_EVENT_IMAGES.boardGames,
    match_percentage: 85,
    attendee_count: 16,
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    parent_event_id: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-3',
    title: 'Speelmiddag in Wilhelminapark',
    category: 'family',
    venue_name: 'Wilhelminapark Meppel',
    event_date: (() => { const d = new Date(); const day = d.getDay(); const diff = (5 - day + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d.toISOString().split('T')[0]; })(), // This Friday
    event_time: '14:00',
    event_type: 'anchor',
    image_url: MEPPEL_EVENT_IMAGES.park,
    match_percentage: 78,
    attendee_count: 8,
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    parent_event_id: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-3-fork-1',
    title: 'Picknicken na afloop',
    category: 'foodie',
    venue_name: 'Wilhelminapark grasveld',
    event_date: (() => { const d = new Date(); const day = d.getDay(); const diff = (5 - day + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d.toISOString().split('T')[0]; })(), // This Friday
    event_time: '16:30',
    event_type: 'fork',
    image_url: MEPPEL_EVENT_IMAGES.picnic,
    match_percentage: 72,
    attendee_count: 5,
    parent_event_id: 'mock-3',
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-4',
    title: 'Vrijmibo bij Café 1761',
    category: 'social',
    venue_name: 'Café 1761, Prinsengracht',
    event_date: (() => { const d = new Date(); const day = d.getDay(); const diff = (6 - day + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d.toISOString().split('T')[0]; })(), // This Saturday
    event_time: '17:00',
    event_type: 'anchor',
    image_url: MEPPEL_EVENT_IMAGES.terrace,
    match_percentage: 88,
    attendee_count: 18,
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    parent_event_id: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-5',
    title: 'Vaartocht over het Meppeler Diep',
    category: 'outdoors',
    venue_name: 'Meppeler Haven (Stouwepad)',
    event_date: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0]; })(), // 2 weeks
    event_time: '13:00',
    event_type: 'anchor',
    image_url: MEPPEL_EVENT_IMAGES.canal,
    match_percentage: 72,
    attendee_count: 15,
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    parent_event_id: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-6',
    title: 'Jazzavond in Schouwburg Ogterop',
    category: 'music',
    venue_name: 'Schouwburg Ogterop',
    event_date: (() => { const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().split('T')[0]; })(), // 3 weeks
    event_time: '20:30',
    event_type: 'anchor',
    image_url: MEPPEL_EVENT_IMAGES.jazz,
    match_percentage: 82,
    attendee_count: 45,
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    parent_event_id: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-6-fork',
    title: 'Naborrelen met de artiesten',
    category: 'social',
    venue_name: 'Foyer Schouwburg',
    event_date: (() => { const d = new Date(); d.setDate(d.getDate() + 21); return d.toISOString().split('T')[0]; })(),
    event_time: '22:30',
    event_type: 'fork',
    image_url: MEPPEL_EVENT_IMAGES.afterparty,
    match_percentage: 75,
    attendee_count: 20,
    parent_event_id: 'mock-6',
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    status: 'active',
    updated_at: null,
  },
  {
    id: 'mock-7',
    title: 'Streekmarkt Hoofdstraat',
    category: 'foodie',
    venue_name: 'Hoofdstraat Meppel',
    event_date: (() => { const d = new Date(); d.setDate(d.getDate() + 28); return d.toISOString().split('T')[0]; })(), // 4 weeks
    event_time: '11:00',
    event_type: 'anchor',
    image_url: MEPPEL_EVENT_IMAGES.market,
    match_percentage: 95,
    attendee_count: 120,
    description: null,
    created_at: null,
    created_by: null,
    location: null,
    max_attendees: null,
    parent_event_id: null,
    status: 'active',
    updated_at: null,
  },
];

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
}

// Vibe Header Component
const VibeHeaderSection = memo(function VibeHeaderSection({ vibe }: { vibe: VibeType }) {
  const config = VIBE_HEADERS[vibe];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2.5 mt-6 mb-4 first:mt-0"
    >
      <Icon size={20} className={config.className} />
      <h3 className={`font-display text-xl font-bold ${config.className}`}>
        {config.label}
      </h3>
    </motion.div>
  );
});

export const EventFeed = memo(function EventFeed({
  events,
  onEventClick,
  userPreferences,
  showVibeHeaders = false,
}: EventFeedProps) {
  const [joiningEventId, setJoiningEventId] = useState<string | undefined>();
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('all');

  // Combine real events with mock data
  const allEvents = useMemo(() => {
    const combined = events.length === 0 
      ? MOCK_MEPPEL_EVENTS 
      : [...events, ...MOCK_MEPPEL_EVENTS.slice(0, Math.max(0, 8 - events.length))];
    return combined;
  }, [events]);

  // Filter events by time first
  const filteredEvents = useMemo(() => {
    return filterEventsByTime(allEvents, activeFilter);
  }, [allEvents, activeFilter]);

  // Apply smart ranking algorithm
  const rankedEvents = useMemo(() => {
    return rankEvents(filteredEvents, userPreferences, {
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

  // Mock join handler
  const handleJoinEvent = async (eventId: string) => {
    setJoiningEventId(eventId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setJoiningEventId(undefined);
    console.log('Joined event:', eventId);
  };

  // Handler for category subscription
  const handleCategorySubscribe = (category: string) => {
    console.log('Subscribed to category:', category);
  };

  // Render a single stack card
  const renderStackCard = (stack: EventStack, index: number, injectSubscribeCard: boolean = false, totalInGroup: number = 0) => (
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
          joiningEventId={joiningEventId}
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

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky Time Filter Pills */}
      <div className="sticky top-[60px] z-30 bg-background/95 backdrop-blur-xl border-b border-border -mx-4 px-4 py-2">
        <TimeFilterPills
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      <motion.div 
        className="max-w-md mx-auto w-full flex flex-col gap-6 overflow-hidden"
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

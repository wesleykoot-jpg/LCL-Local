import { memo, useMemo, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, Clock } from 'lucide-react';
import { EventStackCard } from './EventStackCard';
import { groupEventsIntoStacks, type EventStack } from '@/lib/feedGrouping';
import { rankEvents, type UserPreferences } from '@/lib/feedAlgorithm';
import type { EventWithAttendees } from '@/lib/hooks';

// Mock events data for Meppel, Netherlands - all with images
const MOCK_MEPPEL_EVENTS: EventWithAttendees[] = [
  {
    id: 'mock-1',
    title: 'FC Meppel thuiswedstrijd op Ezinge',
    category: 'active',
    venue_name: 'Sportpark Ezinge, Meppel',
    event_date: '2025-04-12',
    event_time: '14:30',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-04-12',
    event_time: '12:30',
    event_type: 'fork',
    image_url: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-03-28',
    event_time: '19:30',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-05-10',
    event_time: '10:30',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-05-10',
    event_time: '12:30',
    event_type: 'fork',
    image_url: 'https://images.unsplash.com/photo-1526401485004-46910ecc8e51?auto=format&fit=crop&w=900&q=80',
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
    id: 'mock-3-fork-2',
    title: 'IJsjes halen bij Marktkraam',
    category: 'foodie',
    venue_name: 'IJssalon op de Markt',
    event_date: '2025-05-10',
    event_time: '14:00',
    event_type: 'fork',
    image_url: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=900&q=80',
    match_percentage: 65,
    attendee_count: 4,
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
    event_date: '2025-03-21',
    event_time: '17:00',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-06-22',
    event_time: '13:00',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-04-19',
    event_time: '20:30',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-04-19',
    event_time: '22:30',
    event_type: 'fork',
    image_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80',
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
    event_date: '2025-05-18',
    event_time: '11:00',
    event_type: 'anchor',
    image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80',
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

// Helper to determine vibe type for a date
function getVibeType(eventDate: string): VibeType {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);
  
  // Check if today
  if (eventDay.getTime() === today.getTime()) {
    return 'tonight';
  }
  
  // Check if this weekend (Friday-Sunday)
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  
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

  // Combine real events with mock data
  const allEvents = useMemo(() => {
    if (events.length === 0) {
      return MOCK_MEPPEL_EVENTS;
    }
    return [...events, ...MOCK_MEPPEL_EVENTS.slice(0, Math.max(0, 8 - events.length))];
  }, [events]);

  // Apply smart ranking algorithm
  const rankedEvents = useMemo(() => {
    return rankEvents(allEvents, userPreferences, {
      ensureDiversity: true,
      debug: import.meta.env.DEV,
    });
  }, [allEvents, userPreferences]);

  // Group events into stacks (anchor + forks)
  const eventStacks = useMemo(() => {
    return groupEventsIntoStacks(rankedEvents);
  }, [rankedEvents]);

  // Group stacks by vibe if headers are enabled
  const vibeGroups = useMemo(() => {
    if (!showVibeHeaders) return null;
    return groupStacksByVibe(eventStacks);
  }, [eventStacks, showVibeHeaders]);

  // Mock join handler
  const handleJoinEvent = async (eventId: string) => {
    setJoiningEventId(eventId);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setJoiningEventId(undefined);
    console.log('Joined event:', eventId);
  };

  // Render a single stack card
  const renderStackCard = (stack: EventStack) => (
    <motion.div
      key={stack.anchor.id}
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
  );

  return (
    <motion.div 
      className="max-w-md mx-auto flex flex-col gap-6"
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
        {showVibeHeaders && vibeGroups ? (
          // Render with vibe headers
          vibeGroups.map(group => (
            <Fragment key={group.vibe}>
              <VibeHeaderSection vibe={group.vibe} />
              {group.stacks.map(renderStackCard)}
            </Fragment>
          ))
        ) : (
          // Render without vibe headers
          eventStacks.map(renderStackCard)
        )}
      </AnimatePresence>
    </motion.div>
  );
});

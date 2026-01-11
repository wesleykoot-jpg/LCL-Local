import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EventCard } from './EventCard';
import { CATEGORY_MAP } from '@/lib/categories';

// Fallback images by category - ensures every card has an image
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  active: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  gaming: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  family: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  social: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  outdoors: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  music: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  workshops: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  foodie: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  community: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  entertainment: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=900&q=80',
};

// Mock events data for Meppel, Netherlands - all with images
const MOCK_MEPPEL_EVENTS = [
  {
    id: 'mock-1',
    title: 'FC Meppel thuiswedstrijd op Ezinge',
    category: 'active',
    venue_name: 'Sportpark Ezinge, Meppel',
    event_date: '2025-04-12',
    event_time: '14:30',
    image_url: 'https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=900&q=80',
    match_percentage: 92,
    attendee_count: 24,
  },
  {
    id: 'mock-2',
    title: 'Spellenavond bij Café De Kansel',
    category: 'gaming',
    venue_name: 'Café De Kansel, Woldstraat',
    event_date: '2025-03-28',
    event_time: '19:30',
    image_url: 'https://images.unsplash.com/photo-1505764706515-aa95265c5abc?auto=format&fit=crop&w=900&q=80',
    match_percentage: 85,
    attendee_count: 16,
  },
  {
    id: 'mock-3',
    title: 'Speelmiddag in Wilhelminapark',
    category: 'family',
    venue_name: 'Wilhelminapark Meppel',
    event_date: '2025-05-10',
    event_time: '10:30',
    image_url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
    match_percentage: 78,
    attendee_count: 8,
  },
  {
    id: 'mock-4',
    title: 'Vrijmibo bij Café 1761',
    category: 'social',
    venue_name: 'Café 1761, Prinsengracht',
    event_date: '2025-03-21',
    event_time: '17:00',
    image_url: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=900&q=80',
    match_percentage: 88,
    attendee_count: 18,
  },
  {
    id: 'mock-5',
    title: 'Vaartocht over het Meppeler Diep',
    category: 'outdoors',
    venue_name: 'Meppeler Haven (Stouwepad)',
    event_date: '2025-06-22',
    event_time: '13:00',
    image_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
    match_percentage: 72,
    attendee_count: 15,
  },
  {
    id: 'mock-6',
    title: 'Jazzavond in Schouwburg Ogterop',
    category: 'music',
    venue_name: 'Schouwburg Ogterop',
    event_date: '2025-04-19',
    event_time: '20:30',
    image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    match_percentage: 82,
    attendee_count: 45,
  },
  {
    id: 'mock-7',
    title: 'Stroopwafelworkshop bij De Plataan',
    category: 'workshops',
    venue_name: 'Kulturhus De Plataan',
    event_date: '2025-02-15',
    event_time: '18:00',
    image_url: 'https://images.unsplash.com/photo-1521292270410-a8c2eaff8701?auto=format&fit=crop&w=900&q=80',
    match_percentage: 75,
    attendee_count: 10,
  },
  {
    id: 'mock-8',
    title: 'Streekmarkt Hoofdstraat',
    category: 'foodie',
    venue_name: 'Hoofdstraat Meppel',
    event_date: '2025-05-18',
    event_time: '11:00',
    image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
    match_percentage: 95,
    attendee_count: 120,
  },
  {
    id: 'mock-9',
    title: 'Buurtcleanup Haveltermade',
    category: 'community',
    venue_name: 'Haveltermade',
    event_date: '2025-04-05',
    event_time: '09:30',
    image_url: 'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=900&q=80',
    match_percentage: 68,
    attendee_count: 22,
  },
  {
    id: 'mock-10',
    title: 'Open podium Grand Café De Wheem',
    category: 'entertainment',
    venue_name: 'Grand Café De Wheem',
    event_date: '2025-03-29',
    event_time: '21:00',
    image_url: 'https://images.unsplash.com/photo-1507306300249-2bf49030b4ce?auto=format&fit=crop&w=900&q=80',
    match_percentage: 79,
    attendee_count: 35,
  },
];

interface EventData {
  id: string;
  title: string;
  category: string;
  venue_name: string;
  event_date: string;
  event_time: string;
  image_url?: string | null;
  match_percentage?: number | null;
  attendee_count?: number;
  attendees?: Array<{ id: string; image: string; name?: string; isFriend?: boolean }>;
}

interface EventFeedProps {
  events: EventData[];
  onEventClick?: (eventId: string) => void;
}

// Get image for event - always returns an image URL
const getEventImage = (event: EventData): string => {
  if (event.image_url) return event.image_url;
  const category = CATEGORY_MAP[event.category] || event.category;
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.default;
};

export const EventFeed = memo(function EventFeed({
  events,
  onEventClick,
}: EventFeedProps) {
  // Combine real events with mock data
  const allEvents = useMemo(() => {
    if (events.length === 0) {
      return MOCK_MEPPEL_EVENTS;
    }
    return [...events, ...MOCK_MEPPEL_EVENTS.slice(0, Math.max(0, 8 - events.length))];
  }, [events]);

  // Add mock attendees for demo
  const processedEvents = useMemo(() => {
    return allEvents.map(event => ({
      ...event,
      // Ensure every event has an image
      image_url: getEventImage(event),
      attendees: [
        { id: '1', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100', name: 'Jan', isFriend: Math.random() > 0.5 },
        { id: '2', image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', name: 'Pieter', isFriend: Math.random() > 0.6 },
        { id: '3', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', name: 'Emma', isFriend: Math.random() > 0.7 },
      ],
    }));
  }, [allEvents]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 gap-5"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08 }
        }
      }}
    >
      <AnimatePresence mode="popLayout">
        {processedEvents.map((event) => (
          <EventCard
            key={event.id}
            id={event.id}
            title={event.title}
            category={CATEGORY_MAP[event.category] || event.category}
            venue={event.venue_name}
            date={formatDate(event.event_date)}
            imageUrl={event.image_url}
            attendees={event.attendees}
            totalAttendees={event.attendee_count || event.attendees?.length || 0}
            onClick={() => onEventClick?.(event.id)}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
});

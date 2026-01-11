import { memo, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { BentoEventCard } from './BentoEventCard';
import { CATEGORY_MAP } from '@/lib/categories';

// Mock events data for Meppel, Netherlands
const MOCK_MEPPEL_EVENTS = [
  {
    id: 'mock-1',
    title: 'Sunday Football Match - FC Meppel',
    category: 'active',
    venue_name: 'Sportpark Ezinge',
    event_date: '2026-01-18',
    event_time: '14:00',
    image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=60',
    match_percentage: 92,
    attendee_count: 24,
  },
  {
    id: 'mock-2',
    title: 'Board Game Night at De Ogge',
    category: 'gaming',
    venue_name: 'Café De Ogge',
    event_date: '2026-01-17',
    event_time: '19:30',
    image_url: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&auto=format&fit=crop&q=60',
    match_percentage: 85,
    attendee_count: 12,
  },
  {
    id: 'mock-3',
    title: 'Kids Playdate at Wilhelminapark',
    category: 'family',
    venue_name: 'Wilhelminapark Meppel',
    event_date: '2026-01-18',
    event_time: '10:00',
    image_url: 'https://images.unsplash.com/photo-1544776193-352d25ca82cd?w=800&auto=format&fit=crop&q=60',
    match_percentage: 78,
    attendee_count: 8,
  },
  {
    id: 'mock-4',
    title: 'Friday Drinks at Café 1761',
    category: 'social',
    venue_name: 'Café 1761',
    event_date: '2026-01-17',
    event_time: '17:00',
    image_url: 'https://images.unsplash.com/photo-1575037614876-c38a4c44f5bd?w=800&auto=format&fit=crop&q=60',
    match_percentage: 88,
    attendee_count: 18,
  },
  {
    id: 'mock-5',
    title: 'Morning Yoga in the Park',
    category: 'outdoors',
    venue_name: 'Stadspark Meppel',
    event_date: '2026-01-19',
    event_time: '08:00',
    image_url: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&auto=format&fit=crop&q=60',
    match_percentage: 72,
    attendee_count: 15,
  },
  {
    id: 'mock-6',
    title: 'Jazz Night at Schouwburg Ogterop',
    category: 'music',
    venue_name: 'Schouwburg Ogterop',
    event_date: '2026-01-18',
    event_time: '20:30',
    image_url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&auto=format&fit=crop&q=60',
    match_percentage: 82,
    attendee_count: 45,
  },
  {
    id: 'mock-7',
    title: 'Dutch Cooking Workshop',
    category: 'workshops',
    venue_name: 'Kulturhus De Plataan',
    event_date: '2026-01-20',
    event_time: '18:00',
    image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&auto=format&fit=crop&q=60',
    match_percentage: 75,
    attendee_count: 10,
  },
  {
    id: 'mock-8',
    title: 'Food Truck Festival Meppel',
    category: 'foodie',
    venue_name: 'Hoofdstraat Meppel',
    event_date: '2026-01-19',
    event_time: '12:00',
    image_url: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=800&auto=format&fit=crop&q=60',
    match_percentage: 95,
    attendee_count: 120,
  },
  {
    id: 'mock-9',
    title: 'Neighborhood Cleanup Day',
    category: 'community',
    venue_name: 'Haveltermade',
    event_date: '2026-01-21',
    event_time: '09:00',
    image_url: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&auto=format&fit=crop&q=60',
    match_percentage: 68,
    attendee_count: 22,
  },
  {
    id: 'mock-10',
    title: 'Open Mic Night',
    category: 'entertainment',
    venue_name: 'Grand Café Markt',
    event_date: '2026-01-17',
    event_time: '21:00',
    image_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=60',
    match_percentage: 79,
    attendee_count: 35,
  },
  {
    id: 'mock-11',
    title: 'Running Club - Drentse Aa Trail',
    category: 'active',
    venue_name: 'Drentse Aa Trail Start',
    event_date: '2026-01-18',
    event_time: '07:30',
    image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&auto=format&fit=crop&q=60',
    match_percentage: 84,
    attendee_count: 16,
  },
  {
    id: 'mock-12',
    title: 'Retro Gaming Tournament',
    category: 'gaming',
    venue_name: 'Youth Center Meppel',
    event_date: '2026-01-19',
    event_time: '14:00',
    image_url: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=800&auto=format&fit=crop&q=60',
    match_percentage: 91,
    attendee_count: 28,
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

interface BentoGridProps {
  events: EventData[];
  onJoin: (eventId: string) => Promise<void>;
  joiningEvents: Set<string>;
}

// Calculate tile size based on relevance score
const getTileSize = (score: number, index: number): 'hero' | 'tower' | 'standard' => {
  if (score >= 85 && index === 0) return 'hero';
  if (score >= 75 && index < 3) return 'tower';
  return 'standard';
};

// Weighted relevance calculation
const calculateRelevance = (event: EventData, hasFriends: boolean): number => {
  const socialScore = hasFriends ? 50 : (event.attendee_count || 0) > 10 ? 30 : 15;
  const interestScore = ((event.match_percentage || 50) / 100) * 30;
  const proximityScore = 20;
  return socialScore + interestScore + proximityScore;
};

export const BentoGrid = memo(function BentoGrid({
  events,
  onJoin,
  joiningEvents,
}: BentoGridProps) {
  // Combine real events with mock data, prioritizing mock for demo
  const allEvents = useMemo(() => {
    if (events.length === 0) {
      return MOCK_MEPPEL_EVENTS;
    }
    return [...events, ...MOCK_MEPPEL_EVENTS.slice(0, Math.max(0, 8 - events.length))];
  }, [events]);

  // Process events with friend data and relevance scoring
  const processedEvents = useMemo(() => {
    const eventsWithFriends = allEvents.map(event => ({
      ...event,
      attendees: [
        { id: '1', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100', name: 'Jan', isFriend: Math.random() > 0.5 },
        { id: '2', image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', name: 'Pieter', isFriend: Math.random() > 0.6 },
        { id: '3', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', name: 'Emma', isFriend: Math.random() > 0.7 },
      ],
    }));

    const scored = eventsWithFriends.map(event => ({
      ...event,
      relevanceScore: calculateRelevance(event, event.attendees?.some(a => a.isFriend) || false),
    }));

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scored.map((event, index) => ({
      ...event,
      tileSize: getTileSize(event.relevanceScore, index),
    }));
  }, [allEvents]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <LayoutGroup>
      <motion.div className="grid grid-cols-2 gap-3 auto-rows-[180px]" layout>
        <AnimatePresence mode="popLayout">
          {processedEvents.map((event) => (
            <BentoEventCard
              key={event.id}
              id={event.id}
              title={event.title}
              category={CATEGORY_MAP[event.category] || event.category}
              venue={event.venue_name}
              date={formatDate(event.event_date)}
              imageUrl={event.image_url || undefined}
              attendees={event.attendees}
              totalAttendees={event.attendee_count || event.attendees?.length || 0}
              relevanceScore={event.relevanceScore}
              size={event.tileSize}
              onJoin={onJoin}
              isJoining={joiningEvents.has(event.id)}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
});
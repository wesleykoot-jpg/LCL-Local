import { memo, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { BentoEventCard } from './BentoEventCard';
import { CATEGORY_MAP } from '@/lib/categories';

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
  viewMode: 'pulse' | 'tribe';
  onJoin: (eventId: string) => Promise<void>;
  joiningEvents: Set<string>;
}

// Calculate tile size based on relevance score
const getTileSize = (score: number, index: number): 'hero' | 'tower' | 'standard' => {
  // First high-scoring event gets hero treatment
  if (score >= 80 && index === 0) return 'hero';
  // High scoring events get tower
  if (score >= 70 && index < 3) return 'tower';
  // Standard for everything else
  return 'standard';
};

// Weighted relevance calculation
const calculateRelevance = (event: EventData, hasFriends: boolean): number => {
  // Social Signal (50%) - Friends attending
  const socialScore = hasFriends ? 50 : (event.attendee_count || 0) > 5 ? 25 : 0;
  
  // Interest Match (30%) - Based on match percentage
  const interestScore = ((event.match_percentage || 50) / 100) * 30;
  
  // Proximity (20%) - Placeholder, would use real location
  const proximityScore = 20; // Assume local for now
  
  return socialScore + interestScore + proximityScore;
};

export const BentoGrid = memo(function BentoGrid({
  events,
  viewMode,
  onJoin,
  joiningEvents,
}: BentoGridProps) {
  // Sort and calculate tile sizes
  const processedEvents = useMemo(() => {
    // Add mock friend data for demo
    const eventsWithFriends = events.map(event => ({
      ...event,
      attendees: [
        { id: '1', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100', name: 'Alex', isFriend: Math.random() > 0.6 },
        { id: '2', image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', name: 'Sam', isFriend: Math.random() > 0.7 },
        { id: '3', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', name: 'Jordan', isFriend: Math.random() > 0.8 },
      ],
    }));

    // Filter for tribe mode
    const filteredEvents = viewMode === 'tribe'
      ? eventsWithFriends.filter(e => e.attendees?.some(a => a.isFriend))
      : eventsWithFriends;

    // Calculate relevance and sort
    const scored = filteredEvents.map(event => ({
      ...event,
      relevanceScore: calculateRelevance(
        event,
        event.attendees?.some(a => a.isFriend) || false
      ),
    }));

    // Sort by relevance (highest first)
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Assign tile sizes
    return scored.map((event, index) => ({
      ...event,
      tileSize: getTileSize(event.relevanceScore, index),
    }));
  }, [events, viewMode]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <LayoutGroup>
      <motion.div
        className="grid grid-cols-2 gap-3 auto-rows-[180px]"
        layout
      >
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
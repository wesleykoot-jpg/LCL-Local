import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Stamp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedItinerary, ItineraryItem } from '@/features/events/hooks/useUnifiedItinerary';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import { TicketStub } from '@/components/ui/TicketStub';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * LivingPassport - A vertical timeline of past events
 * 
 * Part of the v5.0 "Social Air" Design System.
 * Replaces the "Passport Grid" with a rich vertical timeline showing
 * event details, dates, locations, and friends who attended.
 * 
 * Features:
 * - Vertical "Journey Line" connecting event cards
 * - "Ticket Stub" style event cards with date blocks
 * - Zero state for empty passports with CTA
 * - Loading skeleton with bg-gray-100 per v5.0 spec
 */

export function LivingPassport() {
  const { timelineItems, isLoading } = useUnifiedItinerary();

  const navigate = useNavigate();

  // Filter for past events only
  const pastEvents = useMemo(() => {
    const now = new Date();
    return timelineItems.filter(item => item.startTime < now);
  }, [timelineItems]);

  // Loading State with Skeletons
  if (isLoading) {
    return (
      <div className="space-y-4">
        <TimelineLoadingSkeleton />
        <TimelineLoadingSkeleton />
        <TimelineLoadingSkeleton />
      </div>
    );
  }

  // Zero State
  if (pastEvents.length === 0) {
    return <PassportZeroState onDiscoverClick={() => navigate('/')} />;
  }

  // Group events by month/year
  const groupedEvents = groupEventsByMonth(pastEvents);

  return (
    <div className="space-y-6">
      {Object.entries(groupedEvents).map(([monthYear, events]) => (
        <div key={monthYear}>
          {/* Month/Year Header */}
          <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">
            {monthYear}
          </h3>
          
          {/* Journey Line Container */}
          <div className="relative">
            {/* Vertical Journey Line */}
            <div 
              className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"
              aria-hidden="true"
            />
            
            {/* Event Cards */}
            <div className="space-y-3 pl-10">
              {events.map((event, index) => (
                <TicketStub
                  key={event.id}
                  id={event.id}
                  date={event.startTime}
                  title={event.title}
                  location={event.location}
                  time={event.originalData?.event_time}
                  // TODO(api): Fetch co-attendees (friends who also attended) from event_attendees join
                  friends={[]}
                  onClick={() => navigate(`/events/${event.id}`)}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Group events by Month Year (e.g., "January 2024")
 */
function groupEventsByMonth(events: ItineraryItem[]): Record<string, ItineraryItem[]> {
  const groups: Record<string, ItineraryItem[]> = {};
  
  // Sort events by date descending (most recent first)
  const sorted = [...events].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  
  sorted.forEach(event => {
    const monthYear = event.startTime.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(event);
  });
  
  return groups;
}

/**
 * Loading Skeleton for Timeline Items
 * Uses bg-gray-100 per v5.0 design spec
 */
function TimelineLoadingSkeleton() {
  return (
    <div className="flex items-stretch gap-4 p-4 bg-surface-card rounded-card shadow-card">
      {/* Date block skeleton */}
      <div className="flex flex-col items-center justify-center w-14 shrink-0">
        <Skeleton className="h-7 w-8 mb-1 bg-gray-100" />
        <Skeleton className="h-3 w-10 bg-gray-100" />
      </div>
      
      {/* Divider */}
      <div className="w-px bg-gray-200 self-stretch" />
      
      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4 bg-gray-100" />
        <Skeleton className="h-4 w-1/2 bg-gray-100" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-6 w-6 rounded-full bg-gray-100" />
          <Skeleton className="h-6 w-6 rounded-full bg-gray-100" />
          <Skeleton className="h-6 w-6 rounded-full bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

/**
 * Zero State Component - Empty Passport
 * Grayscale passport illustration with "First Mission" CTA
 */
interface PassportZeroStateProps {
  onDiscoverClick: () => void;
}

function PassportZeroState({ onDiscoverClick }: PassportZeroStateProps) {
  const motionPreset = useMotionPreset();

  return (
    <motion.div
      className="bg-surface-card rounded-card shadow-card p-12 text-center"
      {...motionPreset.slideUp}
    >
      {/* Grayscale Passport Book Illustration */}
      <div className="relative w-32 h-32 mx-auto mb-6">
        {/* Stack of passport pages */}
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-gray-300 bg-gray-50"
          style={{ transform: 'rotate(-3deg)' }}
          {...(motionPreset.prefersReducedMotion ? {} : {
            initial: { scale: 0.8, opacity: 0 },
            animate: { scale: 1, opacity: 0.3 },
            transition: { delay: 0.1 },
          })}
        />
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-gray-300 bg-gray-50"
          style={{ transform: 'rotate(2deg)' }}
          {...(motionPreset.prefersReducedMotion ? {} : {
            initial: { scale: 0.8, opacity: 0 },
            animate: { scale: 1, opacity: 0.4 },
            transition: { delay: 0.2 },
          })}
        />
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-gray-200 bg-gray-100 flex items-center justify-center"
          {...(motionPreset.prefersReducedMotion ? {} : {
            initial: { scale: 0.8, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            transition: { delay: 0.3 },
          })}
        >
          <Stamp size={48} className="text-gray-400" strokeWidth={1.5} />
        </motion.div>
      </div>

      <h3 className="text-xl font-bold text-text-primary mb-2">
        Your Journey Awaits
      </h3>
      <p className="text-sm text-text-secondary mb-6 max-w-xs mx-auto">
        Your passport is empty! Attend events to collect stamps and build your social story.
      </p>

      {/* Discover Events CTA */}
      <motion.button
        onClick={onDiscoverClick}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-button bg-brand-primary hover:bg-brand-secondary text-white font-medium transition-colors"
        whileHover={motionPreset.prefersReducedMotion ? {} : { scale: 1.05 }}
        whileTap={motionPreset.prefersReducedMotion ? {} : { scale: 0.95 }}
      >
        <Sparkles size={18} />
        <span>Discover Events</span>
      </motion.button>
    </motion.div>
  );
}

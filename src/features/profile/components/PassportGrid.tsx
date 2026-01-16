import { motion, useReducedMotion } from 'framer-motion';
import { Stamp } from 'lucide-react';
import { useUnifiedItinerary, ItineraryItem } from '@/features/events/hooks/useUnifiedItinerary';
import { useMemo } from 'react';

/**
 * Format date as "MON YY" (e.g., "OCT 26")
 */
function formatStampDate(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const year = date.toLocaleDateString('en-US', { year: '2-digit' });
  return `${month} ${year}`;
}

/**
 * PassportGrid - Travel History Stamps
 * 
 * Displays past events as "passport stamps" in a 3-column grid.
 * Each stamp shows the event image in grayscale with a circular stamp overlay
 * showing the month/year.
 */

export function PassportGrid() {
  const { timelineItems, isLoading } = useUnifiedItinerary();
  const prefersReducedMotion = useReducedMotion();

  // Filter for past events only
  const pastEvents = useMemo(() => {
    const now = new Date();
    return timelineItems.filter(item => item.startTime < now);
  }, [timelineItems]);

  // Empty state
  if (!isLoading && pastEvents.length === 0) {
    return (
      <div className="px-5">
        <motion.div
          className="bg-muted/50 rounded-2xl p-12 text-center"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Stamp size={40} className="text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No History Yet</h3>
          <p className="text-sm text-muted-foreground">
            Start exploring and attending events to collect your passport stamps!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-5">
      {/* 3-Column Grid */}
      <div className="grid grid-cols-3 gap-1">
        {pastEvents.map((event, index) => (
          <PassportStamp
            key={event.id}
            event={event}
            index={index}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual Passport Stamp Item
 */
interface PassportStampProps {
  event: ItineraryItem;
  index: number;
  prefersReducedMotion: boolean;
}

function PassportStamp({ event, index, prefersReducedMotion }: PassportStampProps) {
  const stampDate = formatStampDate(event.startTime);

  // Get image URL - fallback to a placeholder if not available
  const imageUrl = event.image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80';

  return (
    <motion.div
      className="relative aspect-square overflow-hidden rounded-lg"
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', damping: 15 }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
    >
      {/* Grayscale Event Image */}
      <img
        src={imageUrl}
        alt={event.title}
        className="w-full h-full object-cover grayscale"
      />

      {/* Stamp Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          {/* Circular Stamp Border */}
          <div
            className="w-20 h-20 rounded-full border-4 border-white/80 bg-white/10 backdrop-blur-sm flex items-center justify-center rotate-12"
            style={{
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div className="text-center">
              <p className="text-white text-xs font-bold leading-tight tracking-wide">
                {stampDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Event Title Overlay (on hover) */}
      <motion.div
        className="absolute inset-0 bg-black/60 flex items-end opacity-0 hover:opacity-100 transition-opacity p-2"
        initial={{ opacity: 0 }}
      >
        <p className="text-white text-xs font-medium line-clamp-2 leading-tight">
          {event.title}
        </p>
      </motion.div>
    </motion.div>
  );
}

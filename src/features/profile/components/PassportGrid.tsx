import { motion } from 'framer-motion';
import { Stamp, Sparkles } from 'lucide-react';
import { useUnifiedItinerary, ItineraryItem } from '@/features/events/hooks/useUnifiedItinerary';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMotionPreset } from '@/hooks/useMotionPreset';

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
  const motionPreset = useMotionPreset();
  const navigate = useNavigate();

  // Filter for past events only
  const pastEvents = useMemo(() => {
    const now = new Date();
    return timelineItems.filter(item => item.startTime < now);
  }, [timelineItems]);

  // Empty state
  if (!isLoading && pastEvents.length === 0) {
    return (
      <motion.div
        className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 text-center"
        {...motionPreset.slideUp}
      >
        {/* Ghost Stamp Book Illustration */}
        <div className="relative w-32 h-32 mx-auto mb-6">
          {/* Stack of stamp book pages */}
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-white/20 bg-white/5"
            style={{ transform: 'rotate(-3deg)' }}
            {...motionPreset.initial({ scale: 0.8, opacity: 0 })}
            animate={{ scale: 1, opacity: 0.3 }}
            transition={{ delay: 0.1 }}
          />
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-white/20 bg-white/5"
            style={{ transform: 'rotate(2deg)' }}
            {...motionPreset.initial({ scale: 0.8, opacity: 0 })}
            animate={{ scale: 1, opacity: 0.4 }}
            transition={{ delay: 0.2 }}
          />
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-white/30 bg-white/10 flex items-center justify-center"
            {...motionPreset.initial({ scale: 0.8, opacity: 0 })}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Stamp size={48} className="text-white/40" strokeWidth={1.5} />
          </motion.div>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">No History Yet</h3>
        <p className="text-sm text-white/60 mb-6 max-w-xs mx-auto">
          Your passport is empty! Start exploring and attending events to collect your stamps.
        </p>

        {/* Discover Events Button */}
        <motion.button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white font-medium transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Sparkles size={18} />
          <span>Discover Events</span>
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div>
      {/* 3-Column Grid */}
      <div className="grid grid-cols-3 gap-1">
        {pastEvents.map((event, index) => (
          <PassportStamp
            key={event.id}
            event={event}
            index={index}
            motionPreset={motionPreset}
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
  motionPreset: ReturnType<typeof useMotionPreset>;
}

function PassportStamp({ event, index, motionPreset }: PassportStampProps) {
  const stampDate = formatStampDate(event.startTime);

  // Get image URL - fallback to a placeholder if not available
  const imageUrl = event.image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=400&q=80';

  return (
    <motion.div
      className="relative aspect-square overflow-hidden rounded-lg"
      {...motionPreset.initial({ opacity: 0, scale: 0.8 })}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', damping: 15 }}
      whileHover={motionPreset.prefersReducedMotion ? {} : { scale: 1.05 }}
    >
      {/* Grayscale Event Image */}
      <img
        src={imageUrl}
        alt={event.title}
        className="w-full h-full object-cover grayscale"
        loading="lazy"
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

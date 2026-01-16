import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { EventWithAttendees } from '@/features/events/hooks/hooks';
import { hapticImpact } from '@/shared/lib/haptics';
import { getEventImage } from '../hooks/useImageFallback';

interface LiveEventCardProps {
  event: EventWithAttendees & { distanceKm?: number };
  /** Callback when the card or navigation arrow is pressed */
  onClick?: (event: EventWithAttendees) => void;
}

type EventStatus = 'open' | 'closing_soon' | 'upcoming';

/**
 * Get the status of an event (Open Now, Closing Soon, or Upcoming)
 */
function getEventStatus(event: EventWithAttendees): EventStatus {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const eventDate = event.event_date?.split('T')[0];
  
  if (eventDate !== today) return 'upcoming';
  
  const eventTime = event.event_time || '00:00';
  const [hours, minutes] = eventTime.split(':').map(Number);
  const eventStart = new Date(now);
  eventStart.setHours(hours, minutes, 0, 0);
  
  // Event time boundaries
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  
  // Event started within last 2 hours = Open Now
  if (eventStart <= now && eventStart >= twoHoursAgo) {
    return 'open';
  }
  
  // Event started 2-3 hours ago = Closing Soon
  if (eventStart < twoHoursAgo && eventStart >= threeHoursAgo) {
    return 'closing_soon';
  }
  
  // Event starts within next hour = Starting Soon
  if (eventStart > now && eventStart <= oneHourFromNow) {
    return 'upcoming';
  }
  
  return 'upcoming';
}

/**
 * Format distance for display
 */
function formatDistance(distanceKm?: number): string {
  if (distanceKm === undefined) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * LiveEventCard - Compact Row Card for Now Page
 * 
 * Social Concierge design with light/glass theme:
 * - Layout: Compact Row (not big card) with square image left, info right
 * - Image: Square (w-20 h-20) with rounded-lg
 * - Right side: Title, Distance (bold), and Status indicator
 * - Action: Simple navigation arrow button on the far right
 * - Status: 🟢 Open Now or 🟡 Closing Soon
 */
export const LiveEventCard = memo(function LiveEventCard({
  event,
  onClick,
}: LiveEventCardProps) {
  const status = useMemo(() => getEventStatus(event), [event]);
  const imageUrl = getEventImage(event.image_url, event.category);
  const distanceText = formatDistance((event as EventWithAttendees & { distanceKm?: number }).distanceKm);

  const handleClick = async () => {
    await hapticImpact('light');
    onClick?.(event);
  };

  const statusConfig = {
    open: { emoji: '🟢', text: 'Open Now', className: 'text-green-600' },
    closing_soon: { emoji: '🟡', text: 'Closing Soon', className: 'text-yellow-600' },
    upcoming: { emoji: '🔵', text: 'Starting Soon', className: 'text-blue-600' },
  };

  const currentStatus = statusConfig[status];

  return (
    <motion.button
      onClick={handleClick}
      className="w-full flex items-center gap-3 p-3 bg-card/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-sm transition-all active:scale-[0.98]"
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Square Image - Left */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt={event.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Info Section - Center/Right */}
      <div className="flex-1 min-w-0 text-left">
        {/* Title */}
        <h3 className="text-foreground font-semibold text-[15px] leading-tight line-clamp-1">
          {event.title}
        </h3>
        
        {/* Distance (bold) */}
        {distanceText && (
          <p className="text-foreground font-bold text-[14px] mt-1">
            {distanceText}
          </p>
        )}
        
        {/* Status indicator */}
        <div className={`flex items-center gap-1.5 mt-1 ${currentStatus.className}`}>
          <span className="text-[12px]">{currentStatus.emoji}</span>
          <span className="text-[12px] font-medium">{currentStatus.text}</span>
        </div>
      </div>

      {/* Navigation Arrow - Far Right */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-muted/50">
        <ChevronRight size={20} className="text-muted-foreground" />
      </div>
    </motion.button>
  );
});

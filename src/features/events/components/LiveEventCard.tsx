import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Users, ExternalLink, Share2 } from 'lucide-react';
import type { EventWithAttendees } from '@/features/events/hooks/hooks';
import { hapticImpact } from '@/shared/lib/haptics';

interface LiveEventCardProps {
  event: EventWithAttendees;
  /** Calculated walking distance in minutes */
  walkingMinutes?: number;
  /** Callback when "Go" button is pressed (opens map) */
  onGo?: (event: EventWithAttendees) => void;
  /** Callback when "Summon" button is pressed (share location) */
  onSummon?: (event: EventWithAttendees) => void;
}

/**
 * Check if event is currently happening
 */
function isHappeningNow(event: EventWithAttendees): boolean {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const eventDate = event.event_date?.split('T')[0];
  
  if (eventDate !== today) return false;
  
  const eventTime = event.event_time || '00:00';
  const [hours, minutes] = eventTime.split(':').map(Number);
  const eventStart = new Date(now);
  eventStart.setHours(hours, minutes, 0, 0);
  
  // Event is happening if it started within the last 3 hours
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  
  return eventStart <= now && eventStart >= threeHoursAgo;
}

/**
 * Format time for display
 */
function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  return timeStr;
}

/**
 * LiveEventCard - Night Mode Event Card
 * 
 * Exclusive UI for the "Now" page with dark glass aesthetic.
 * - Background: Dark Glass (bg-white/10) with backdrop blur
 * - Layout: Compact, Horizontal (Image Left, Info Right) - "Ticket Stub" shape
 * - Typography: White text, high contrast
 * - Indicators: Pulsing green dot for "Happening Now", walking distance
 * - Actions: "Go" (Opens Map), "Summon" (Share location to friends)
 */
export const LiveEventCard = memo(function LiveEventCard({
  event,
  walkingMinutes,
  onGo,
  onSummon,
}: LiveEventCardProps) {
  const happening = useMemo(() => isHappeningNow(event), [event]);
  const attendeeCount = event.attendee_count || 0;

  const handleGo = async () => {
    await hapticImpact('medium');
    onGo?.(event);
  };

  const handleSummon = async () => {
    await hapticImpact('light');
    onSummon?.(event);
  };

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-white/10"
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex">
        {/* Image Section - Left */}
        <div className="w-24 h-28 flex-shrink-0 relative overflow-hidden">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255,107,44,0.3) 0%, rgba(107,70,193,0.3) 100%)',
              }}
            >
              <span className="text-3xl opacity-50">🎉</span>
            </div>
          )}
          
          {/* Happening Now indicator */}
          {happening && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/90">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-semibold text-white uppercase tracking-wide">
                Live
              </span>
            </div>
          )}
        </div>

        {/* Info Section - Right */}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          {/* Title & Time */}
          <div>
            <h3 className="text-white font-semibold text-[15px] leading-tight line-clamp-1">
              {event.title}
            </h3>
            <p className="text-white/60 text-[13px] mt-0.5">
              {formatTime(event.event_time)}
            </p>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-2">
            {/* Location / Walking distance */}
            <div className="flex items-center gap-1 text-white/70">
              <MapPin size={12} />
              <span className="text-[12px]">
                {walkingMinutes 
                  ? `${walkingMinutes} min walk` 
                  : event.venue_name?.slice(0, 15) || 'Nearby'}
              </span>
            </div>
            
            {/* Attendee count */}
            <div className="flex items-center gap-1 text-white/70">
              <Users size={12} />
              <span className="text-[12px]">{attendeeCount}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleGo}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-black font-semibold text-[13px] min-h-[36px] transition-transform active:scale-95"
            >
              <ExternalLink size={14} />
              Go
            </button>
            <button
              onClick={handleSummon}
              className="flex items-center justify-center w-10 rounded-xl bg-white/10 text-white transition-transform active:scale-95"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

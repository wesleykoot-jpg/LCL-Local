import { memo } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Users, Ticket, Loader2 } from 'lucide-react';
import { CATEGORY_MAP } from '@/shared/lib/categories';
import type { EventWithAttendees } from '../hooks/hooks';
import { useJoinEvent } from '../hooks/hooks';
import { useAuth } from '@/features/auth';

interface TimelineEventCardProps {
  event: EventWithAttendees & { ticket_number?: string };
  isPast?: boolean;
  showJoinButton?: boolean;
}

// Format time like "7:00 PM"
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  
  // Handle HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  return timeStr;
}

export const TimelineEventCard = memo(function TimelineEventCard({
  event,
  isPast = false,
  showJoinButton = false,
}: TimelineEventCardProps) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const attendeeCount = event.attendee_count || 0;
  const { profile } = useAuth();
  const { handleJoinEvent, isJoining } = useJoinEvent(profile?.id);
  const queryClient = useQueryClient();
  
  const hasJoined = Boolean(
    profile?.id && event.attendees?.some(
      attendee => attendee.profile?.id === profile.id
    )
  );
  
  const isCurrentEventJoining = isJoining(event.id);

  return (
    <motion.div
      className={`relative rounded-2xl border-2 bg-card p-4 transition-all ${
        isPast 
          ? 'border-border/50 opacity-60' 
          : 'border-border hover:border-primary/30 hover:shadow-sm'
      }`}
      whileTap={{ scale: 0.98 }}
    >
      {/* Row 1: Time + Attendee Count */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[15px] font-semibold ${
          isPast ? 'text-muted-foreground' : 'text-foreground'
        }`}>
          {formatTime(event.event_time)}
        </span>
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Users size={14} />
          <span className="font-medium">{attendeeCount} going</span>
        </div>
      </div>

      {/* Row 2: Event Title */}
      <h4 className={`text-[17px] font-semibold leading-tight line-clamp-1 mb-1 ${
        isPast ? 'text-muted-foreground' : 'text-foreground'
      }`}>
        {event.title}
      </h4>

      {/* Row 3: Location + Category */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <MapPin size={12} className="flex-shrink-0" />
          <span className="truncate">{event.venue_name}</span>
        </div>
        <span className="text-border">•</span>
        <span className="flex-shrink-0 capitalize">{categoryLabel}</span>
      </div>

      {/* Optional: Ticket Number Badge */}
      {event.ticket_number && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Ticket size={12} />
            <span className="font-mono font-medium">{event.ticket_number}</span>
          </div>
        </div>
      )}

      {/* Join Button - Only show if not past and showJoinButton is true */}
      {!isPast && showJoinButton && !hasJoined && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await handleJoinEvent(event.id);
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['my-events'] }),
                  queryClient.invalidateQueries({ queryKey: ['events'] }),
                ]);
              } catch (error) {
                // Error is already handled by useJoinEvent hook
                // This catch prevents unhandled promise rejections if component unmounts
                console.error('Error in join button handler:', error);
              }
            }}
            disabled={isCurrentEventJoining}
            className={`w-full h-[44px] rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98] ${
              isCurrentEventJoining
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isCurrentEventJoining ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Joining...</span>
              </div>
            ) : (
              'Join Event'
            )}
          </button>
        </div>
      )}

      {/* Already Joined Badge */}
      {!isPast && showJoinButton && hasJoined && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="w-full h-[44px] rounded-xl text-[14px] font-semibold flex items-center justify-center bg-secondary text-foreground border-2 border-primary/20">
            ✓ Going
          </div>
        </div>
      )}
    </motion.div>
  );
});

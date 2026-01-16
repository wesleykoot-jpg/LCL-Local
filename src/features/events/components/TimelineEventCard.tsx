import { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Users, Loader2, Check } from 'lucide-react';
import { CATEGORY_MAP } from '@/shared/lib/categories';
import type { EventWithAttendees } from '../hooks/hooks';
import { useJoinEvent } from '../hooks/hooks';
import { useAuth } from '@/features/auth';

interface TimelineEventCardProps {
  event: EventWithAttendees & { ticket_number?: string };
  isPast?: boolean;
  showJoinButton?: boolean;
  variant?: 'default' | 'minimal' | 'trip-card';
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
  variant = 'default',
}: TimelineEventCardProps) {
  const categoryLabel = CATEGORY_MAP[event.category] || event.category;
  const attendeeCount = event.attendee_count || 0;
  const { profile } = useAuth();
  const { handleJoinEvent, isJoining } = useJoinEvent(profile?.id);
  const queryClient = useQueryClient();
  
  // Optimistic UI state - starts as false, becomes true immediately on click
  const [optimisticJoined, setOptimisticJoined] = useState(false);
  
  const hasJoined = optimisticJoined || Boolean(
    profile?.id && event.attendees?.some(
      attendee => attendee.profile?.id === profile.id
    )
  );
  
  const isCurrentEventJoining = isJoining(event.id);
  
  // Optimistic join handler with immediate UI feedback
  const handleOptimisticJoin = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Immediate optimistic update - show "Going ✓" right away
    setOptimisticJoined(true);
    
    try {
      await handleJoinEvent(event.id);
      // Force refresh of Planning page and events feed
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-events'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticJoined(false);
      // Error is already handled by useJoinEvent hook with toast
      console.error('Error in join button handler:', error);
    }
  }, [event.id, handleJoinEvent, queryClient]);

  // Trip Card Variant - Visual Poster Design (TripAdvisor Style)
  if (variant === 'trip-card') {
    return (
      <motion.div
        className="relative rounded-2xl overflow-hidden bg-card border-2 border-border hover:border-primary/30 transition-all hover:shadow-lg"
        whileTap={{ scale: 0.98 }}
      >
        {/* Image - Cinema Style (2:1 aspect ratio) */}
        {event.image_url && (
          <div className="relative w-full aspect-[2/1] bg-gradient-to-br from-primary/10 to-primary/5">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {/* Category Badge - Floating over image */}
            <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {categoryLabel}
              </span>
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="p-4">
          {/* Category Badge - Inline at top when no image */}
          {!event.image_url && (
            <div className="mb-2">
              <span className="inline-flex px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wide">
                {categoryLabel}
              </span>
            </div>
          )}

          {/* Title - Large and Bold */}
          <h4 className="text-base font-bold text-foreground leading-tight line-clamp-2 mb-2">
            {event.title}
          </h4>

          {/* Venue */}
          {event.venue_name && (
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-2">
              <MapPin size={13} className="flex-shrink-0 text-primary/60" />
              <span className="truncate">{event.venue_name}</span>
            </div>
          )}

          {/* Action Bar - Attendee Count */}
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Users size={14} />
            <span className="font-medium">{attendeeCount} going</span>
          </div>

          {/* Join Button - Only show if not past and showJoinButton is true */}
          {!isPast && showJoinButton && !hasJoined && (
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={handleOptimisticJoin}
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
              <div className="w-full h-[44px] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-secondary text-foreground border-2 border-primary/20">
                <Check size={16} className="text-primary" />
                <span>Going</span>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    );
  }

  // Default and Minimal Variants
  return (
    <motion.div
      className={`relative rounded-2xl border-2 bg-card p-4 transition-all ${
        isPast 
          ? 'border-border/50 opacity-60' 
          : 'border-border hover:border-primary/30 hover:shadow-sm'
      }`}
      whileTap={{ scale: 0.98 }}
    >
      {/* Row 1: Time + Attendee Count (hidden in minimal variant) */}
      {variant === 'default' && (
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
      )}

      {/* Category Badge - Top Right Corner for minimal variant */}
      {variant === 'minimal' && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-primary/10 text-primary">
          <span className="text-[11px] font-semibold uppercase tracking-wide capitalize">
            {categoryLabel}
          </span>
        </div>
      )}

      {/* Row 2: Event Title */}
      <h4 className={`text-[17px] font-semibold leading-tight line-clamp-1 ${
        variant === 'default' ? 'mb-1' : 'mb-2'
      } ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
        {event.title}
      </h4>

      {/* Row 3: Location + Category (hidden in minimal variant) */}
      {variant === 'default' && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="truncate">{event.venue_name}</span>
          </div>
          <span className="text-border">•</span>
          <span className="flex-shrink-0 capitalize">{categoryLabel}</span>
        </div>
      )}

      {/* Attendee Count for minimal variant (moved below title) */}
      {variant === 'minimal' && (
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Users size={14} />
          <span className="font-medium">{attendeeCount} going</span>
        </div>
      )}


      {/* Join Button - Only show if not past and showJoinButton is true */}
      {!isPast && showJoinButton && !hasJoined && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={handleOptimisticJoin}
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

      {/* Already Joined Badge - Shows immediately via optimistic update */}
      {!isPast && showJoinButton && hasJoined && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="w-full h-[44px] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-secondary text-foreground border-2 border-primary/20">
            <Check size={16} className="text-primary" />
            <span>Going</span>
          </div>
        </div>
      )}
    </motion.div>
  );
});

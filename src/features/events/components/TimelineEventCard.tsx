import { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Users, Loader2, Check, Share2, Calendar } from 'lucide-react';
import { getCategoryConfig } from '@/shared/lib/categories';
import type { EventWithAttendees } from '../hooks/hooks';
import { useJoinEvent } from '../hooks/hooks';
import { useAuth } from '@/features/auth';
import { SmartTimeLabel } from '@/components/SmartTimeLabel';
import type { TimeMode, OpeningHours } from '@/lib/openingHours';
import { hapticImpact } from '@/shared/lib/haptics';
import { useEventSyncStatus } from '../hooks/useEventSyncStatus';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

interface TimelineEventCardProps {
  event: EventWithAttendees & { ticket_number?: string };
  isPast?: boolean;
  showJoinButton?: boolean;
  variant?: 'default' | 'minimal' | 'trip-card';
}

// Format time like "7:00 PM"
/*
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
*/

export const TimelineEventCard = memo(function TimelineEventCard({
  event,
  isPast = false,
  showJoinButton = false,
  variant = 'default',
}: TimelineEventCardProps) {
  const categoryConfig = getCategoryConfig(event.category);
  const categoryLabel = categoryConfig.label;
  const attendeeCount = event.attendee_count || 0;
  const { profile } = useAuth();
  const { handleJoinEvent, isJoining } = useJoinEvent(profile?.id);
  const queryClient = useQueryClient();
  
  // Google Calendar sync status
  const { data: syncStatus } = useEventSyncStatus(event.id);
  const { isConnected: isGoogleConnected, syncEventToCalendar } = useGoogleCalendar();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Optimistic UI state - starts as false, becomes true immediately on click
  const [optimisticJoined, setOptimisticJoined] = useState(false);
  
  const hasJoined = optimisticJoined || Boolean(
    profile?.id && event.attendees?.some(
      attendee => attendee.profile?.id === profile.id
    )
  );
  
  const isCurrentEventJoining = isJoining(event.id);
  
  // Handle Google Calendar sync
  const handleSyncToGoogle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isGoogleConnected) {
      console.log('Google Calendar not connected');
      return;
    }
    
    if (syncStatus?.isSynced) {
      console.log('Event already synced');
      return;
    }
    
    setIsSyncing(true);
    await hapticImpact('light');
    
    try {
      const success = await syncEventToCalendar({
        id: event.id,
        title: event.title,
        description: event.description,
        venue_name: event.venue_name || "",
        event_date: event.event_date || "",
        event_time: event.event_time || "",
      });
      
      if (success) {
        // Invalidate sync status to refresh badge
        queryClient.invalidateQueries({ queryKey: ['event-sync-status', profile?.id, event.id] });
        console.log('Event synced to Google Calendar');
      }
    } catch (error) {
      console.error('Failed to sync event:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [event, isGoogleConnected, syncStatus, syncEventToCalendar, queryClient, profile?.id]);
  
  // Handle sharing event
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await hapticImpact('light');
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out this event: ${event.title}${event.venue_name ? ` at ${event.venue_name}` : ''}`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed - not an error
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback for browsers without Web Share API
      // Copy link to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        console.log('Link copied to clipboard');
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  }, [event.title, event.venue_name]);
  
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
        className="relative rounded-2xl overflow-hidden bg-card border-2 border-border hover:border-primary/30 transition-all hover:shadow-lg shadow-sm"
        whileTap={{ scale: 0.96 }}
      >
        {/* Share Button - Floating top-right */}
        <div className="absolute right-3 top-3 z-30">
          <button
            onClick={handleShare}
            aria-label="Share event"
            className="p-2 rounded-full bg-white/90 hover:bg-white transition-colors shadow-sm border border-border/20 active:scale-95"
          >
            <Share2 className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Image - Reduced height (3:1 aspect ratio) with subtle gradient only */}
        {event.image_url && (
          <div className="relative w-full aspect-[3/1] overflow-hidden rounded-t-[20px]">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Subtle gradient overlay for visual depth only */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
          </div>
        )}

        {/* Content Section - Title in body, lighter padding */}
        <div className="p-4 pt-3">
          {/* Title at top of body section */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-bold text-foreground leading-tight flex-1 pr-2">{event.title}</h3>
          </div>

          {/* Venue */}
          {event.venue_name && (
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-2">
              <MapPin size={13} className="flex-shrink-0 text-primary/60" />
              <span className="truncate">{event.venue_name}</span>
            </div>
          )}

          {/* Google Calendar Sync Badge */}
          {syncStatus?.isSynced && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                <Calendar size={10} />
                <span>Synced with Google</span>
              </div>
            </div>
          )}

          {/* Sync to Google Button - Only show if connected and not synced */}
          {!isPast && isGoogleConnected && !syncStatus?.isSynced && (
            <button
              onClick={handleSyncToGoogle}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Calendar size={12} />
              <span>{isSyncing ? 'Syncing...' : 'Sync to Google'}</span>
            </button>
          )}

          {/* Action Bar - Attendee Count + Category */}
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users size={14} />
              <span className="font-medium">{attendeeCount} going</span>
            </div>
            {/* Category Badge - Always at bottom right with color */}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${categoryConfig.bgClass} ${categoryConfig.textClass}`}>
              {categoryLabel}
            </span>
          </div>

          {/* Ticket Number - if present */}
          {event.ticket_number && (
            <div className="mt-2 text-[11px] text-muted-foreground font-mono">
              {event.ticket_number}
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

          {/* Already Joined Badge */}
          {!isPast && showJoinButton && hasJoined && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="w-full h-[44px] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-secondary text-foreground border-2 border-primary/20">
                <Check size={16} className="text-brand-primary" />
                <span>Going</span>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    );
  }

  // Default and Minimal Variants
  // Get time_mode with fallback to 'fixed' for existing events
  const timeMode = ((event as any).time_mode || 'fixed') as TimeMode;
  const openingHours = (event as any).opening_hours as OpeningHours | null;
  
  return (
    <motion.div
      className={`relative rounded-2xl border-2 bg-card p-4 transition-all ${
        isPast 
          ? 'border-border/50 opacity-60' 
          : 'border-border hover:border-primary/30 hover:shadow-sm'
      }`}
      whileTap={{ scale: 0.96 }}
    >
      {/* Share Button - Floating top-right for all variants */}
      <div className="absolute right-3 top-3 z-20">
        <button
          onClick={handleShare}
          aria-label="Share event"
          className="p-2 rounded-full bg-muted/60 hover:bg-muted transition-colors active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Row 1: Time Intelligence + Attendee Count (hidden in minimal variant) */}
      {variant === 'default' && (
        <div className="flex items-center justify-between mb-1">
          <SmartTimeLabel
            timeMode={timeMode}
            eventTime={event.event_time || undefined}
            eventDate={event.event_date}
            openingHours={openingHours}
            category={event.category}
            className={isPast ? 'opacity-60' : ''}
          />
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Users size={14} />
            <span className="font-medium">{attendeeCount} going</span>
          </div>
        </div>
      )}

      {/* Category Badge - Top Right Corner for minimal variant */}
      {variant === 'minimal' && (
        <div className={`absolute top-3 right-3 px-2 py-1 rounded-full ${categoryConfig.bgClass}`}>
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${categoryConfig.textClass}`}>
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
          <span className={`flex-shrink-0 ${categoryConfig.textClass}`}>{categoryLabel}</span>
        </div>
      )}

      {/* Google Calendar Sync Badge */}
      {syncStatus?.isSynced && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
            <Calendar size={10} />
            <span>Synced with Google</span>
          </div>
        </div>
      )}

      {/* Sync to Google Button - Only show if connected and not synced */}
      {!isPast && isGoogleConnected && !syncStatus?.isSynced && variant === 'default' && (
        <button
          onClick={handleSyncToGoogle}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Calendar size={12} />
          <span>{isSyncing ? 'Syncing...' : 'Sync to Google'}</span>
        </button>
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
            <Check size={16} className="text-brand-primary" />
            <span>Going</span>
          </div>
        </div>
      )}
    </motion.div>
  );
});

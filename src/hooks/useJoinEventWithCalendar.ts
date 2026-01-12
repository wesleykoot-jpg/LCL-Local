/**
 * Enhanced Event Joining Hook with Google Calendar Sync
 * 
 * This hook wraps the base useJoinEvent hook and adds automatic
 * Google Calendar synchronization when joining events.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useJoinEvent } from '@/lib/hooks';
import { useGoogleCalendar } from './useGoogleCalendar';
import type { LCLEventData } from '@/lib/utils';

interface UseJoinEventWithCalendarOptions {
  profileId: string | undefined;
  onSuccess?: () => void;
}

/**
 * Enhanced hook for joining events with automatic Google Calendar sync
 * 
 * This hook:
 * 1. Joins the event using the base joinEvent functionality
 * 2. If user has connected Google Calendar, syncs the event automatically
 * 
 * @param options - Options including profileId and onSuccess callback
 * @returns Enhanced handleJoinEvent function and helper methods
 */
export function useJoinEventWithCalendar({ profileId, onSuccess }: UseJoinEventWithCalendarOptions) {
  const { isConnected, syncEventToCalendar } = useGoogleCalendar();
  
  // Fetch event details for calendar sync
  const fetchEventDetails = useCallback(async (eventId: string): Promise<LCLEventData | null> => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, venue_name, event_date, event_time')
        .eq('id', eventId)
        .maybeSingle();

      if (error || !data) return null;
      return data as LCLEventData;
    } catch (error) {
      console.error('[useJoinEventWithCalendar] Error fetching event:', error);
      return null;
    }
  }, []);

  // Enhanced success callback that syncs to Google Calendar
  const handleSuccessWithCalendarSync = useCallback(async () => {
    // Call the original onSuccess callback
    onSuccess?.();
  }, [onSuccess]);

  // Use the base hook with our enhanced callback
  const { handleJoinEvent: baseHandleJoinEvent, joiningEvents, isJoining } = useJoinEvent(
    profileId,
    handleSuccessWithCalendarSync
  );

  // Enhanced join handler that adds calendar sync
  const handleJoinEvent = useCallback(
    async (eventId: string) => {
      // First, join the event using the base handler
      await baseHandleJoinEvent(eventId);

      // If user has connected Google Calendar, sync the event
      if (isConnected && profileId) {
        try {
          const eventDetails = await fetchEventDetails(eventId);
          if (eventDetails) {
            await syncEventToCalendar(eventDetails);
            // Note: We don't show a separate toast for calendar sync
            // to avoid overwhelming the user with notifications
          }
        } catch (error) {
          // Log error but don't fail the join operation
          console.error('[useJoinEventWithCalendar] Calendar sync failed:', error);
        }
      }
    },
    [baseHandleJoinEvent, isConnected, profileId, fetchEventDetails, syncEventToCalendar]
  );

  return {
    handleJoinEvent,
    joiningEvents,
    isJoining,
    isCalendarConnected: isConnected,
  };
}

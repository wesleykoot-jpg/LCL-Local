/**
 * Hook to check Google Calendar sync status for events
 * 
 * Provides sync status information to display badges on event cards
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getSyncedEventId } from '@/integrations/googleCalendar/service';

export interface EventSyncStatus {
  isSynced: boolean;
  googleEventId?: string | null;
}

/**
 * Get sync status for a single event
 */
export function useEventSyncStatus(eventId: string) {
  const { profile } = useAuth();
  const profileId = profile?.id;

  return useQuery({
    queryKey: ['event-sync-status', profileId, eventId],
    queryFn: async () => {
      if (!profileId) {
        return { isSynced: false, googleEventId: null };
      }
      
      const googleEventId = await getSyncedEventId(profileId, eventId);
      
      return {
        isSynced: !!googleEventId,
        googleEventId,
      };
    },
    enabled: !!profileId && !!eventId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Get sync status for multiple events
 * Returns a map of eventId -> sync status
 */
export function useMultipleEventSyncStatus(eventIds: string[]) {
  const { profile } = useAuth();
  const profileId = profile?.id;

  return useQuery({
    queryKey: ['multiple-event-sync-status', profileId, eventIds],
    queryFn: async () => {
      if (!profileId || eventIds.length === 0) {
        return {};
      }

      const statusMap: Record<string, EventSyncStatus> = {};
      
      // Fetch sync status for all events in parallel
      await Promise.all(
        eventIds.map(async (eventId) => {
          const googleEventId = await getSyncedEventId(profileId, eventId);
          statusMap[eventId] = {
            isSynced: !!googleEventId,
            googleEventId,
          };
        })
      );
      
      return statusMap;
    },
    enabled: !!profileId && eventIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EventWithAttendees, EventAttendee } from './hooks';
import { parseEventsWithAttendees } from '@/lib/api/schemas';

const ATTENDEE_LIMIT = 4;

interface UseLiveEventsQueryOptions {
  /** Time offset in minutes from now (0 = live, 60 = 1 hour from now, etc.) */
  timeOffsetMinutes: number;
  /** User's location for distance sorting */
  userLocation?: { lat: number; lng: number } | null;
  /** Radius in km for filtering */
  radiusKm?: number;
  /** Current user's profile ID for filtering */
  currentUserProfileId?: string;
  /** Debounce enabled flag - when true, query will be disabled during dragging */
  enabled?: boolean;
}

/**
 * Fetches live events happening within a time window.
 * 
 * Mode: 'live' - filters events by:
 * - Time range: Now to Now + timeOffsetMinutes
 * - Sort: Distance (proximity is king for spontaneous decisions)
 * 
 * Designed to be used with debounced timeOffset updates from the TimeDial.
 */
export function useLiveEventsQuery(options: UseLiveEventsQueryOptions) {
  const {
    timeOffsetMinutes,
    userLocation,
    radiusKm = 25,
    currentUserProfileId,
    enabled = true,
  } = options;

  const queryKey = [
    'events',
    'live',
    {
      timeOffset: timeOffsetMinutes,
      location: userLocation ? `${userLocation.lat},${userLocation.lng}` : 'none',
      radius: radiusKm,
      userId: currentUserProfileId || 'anonymous',
    },
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<EventWithAttendees[]> => {
      const now = new Date();
      const endTime = new Date(now.getTime() + timeOffsetMinutes * 60 * 1000);
      
      // Format dates for comparison
      const todayStr = now.toISOString().split('T')[0];
      const endDateStr = endTime.toISOString().split('T')[0];
      
      // Format times as HH:MM
      const nowTime = now.toTimeString().slice(0, 5);
      const endTimeStr = endTime.toTimeString().slice(0, 5);

      // Fetch blocked user IDs
      let blockedUserIds: string[] = [];
      if (currentUserProfileId) {
        const { data: blockedData } = await supabase
          .from('user_blocks')
          .select('blocked_id')
          .eq('blocker_id', currentUserProfileId);
        
        blockedUserIds = (blockedData || []).map(b => b.blocked_id);
      }

      // Build query for events happening now or starting soon
      // Events that:
      // 1. Are happening today
      // 2. Start time is between now and now + offset, OR already started (for "Happening Now")
      const query = supabase
        .from('events')
        .select(`
          *,
          attendee_count:event_attendees(count),
          attendees:event_attendees(
            profile:profiles(
              id,
              avatar_url,
              full_name
            )
          )
        `)
        .gte('event_date', todayStr)
        .lte('event_date', endDateStr)
        .limit(ATTENDEE_LIMIT, { foreignTable: 'event_attendees' });

      const { data, error } = await query;

      if (error) throw error;

      // Filter events by time window
      const filteredEvents = (data || []).filter(event => {
        // Skip events from blocked users
        if (event.created_by && blockedUserIds.includes(event.created_by)) {
          return false;
        }

        const eventDate = event.event_date.split('T')[0];
        const eventTime = event.event_time || '00:00';
        
        // For today's events
        if (eventDate === todayStr) {
          // Include events that have started (happening now) or will start within the window
          return eventTime <= endTimeStr;
        }
        
        // For future dates within the window (when offset spans midnight)
        return eventDate <= endDateStr;
      });

      // Transform to EventWithAttendees format
      const eventsWithData = filteredEvents.map(event => {
        const count = Array.isArray(event.attendee_count)
          ? event.attendee_count[0]?.count || 0
          : 0;
        
        const attendees = Array.isArray(event.attendees)
          ? event.attendees as EventAttendee[]
          : [];

        return {
          ...event,
          attendee_count: count,
          attendees,
        };
      });

      // Sort by distance if user location is available
      // For now, we'll keep the default order and let the component handle distance display
      // In a production app, you'd use PostGIS for distance-based sorting

      return parseEventsWithAttendees(eventsWithData);
    },
    enabled,
    staleTime: 1000 * 30, // 30 seconds for live events
    gcTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60, // Refetch every minute for live updates
  });

  return {
    events: query.data || [],
    loading: query.isLoading,
    error: query.error,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}

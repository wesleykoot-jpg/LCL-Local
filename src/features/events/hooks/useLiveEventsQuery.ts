import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EventWithAttendees, EventAttendee } from './hooks';
import { parseEventsWithAttendees } from '@/lib/api/schemas';

const ATTENDEE_LIMIT = 4;

/** Daypart mode based on time of day */
export type DaypartMode = 'morning' | 'afternoon' | 'evening';

/** Categories suggested for each daypart */
export const DAYPART_CATEGORIES: Record<DaypartMode, string[]> = {
  morning: ['cafe', 'park', 'market', 'wellness', 'outdoor'],
  afternoon: ['museum', 'crafts', 'food', 'family', 'outdoor'],
  evening: ['music', 'food', 'cinema', 'gaming', 'sports'],
};

/**
 * Determines the current "vibe" mode based on the user's local time.
 * Morning: 5:00 - 11:59
 * Afternoon: 12:00 - 16:59
 * Evening: 17:00 - 4:59
 */
export function getDaypartMode(date: Date = new Date()): DaypartMode {
  const currentHour = date.getHours();
  
  if (currentHour >= 5 && currentHour < 12) {
    return 'morning';
  } else if (currentHour >= 12 && currentHour < 17) {
    return 'afternoon';
  } else {
    return 'evening';
  }
}

/**
 * Gets a friendly greeting based on the daypart mode
 */
export function getDaypartGreeting(mode: DaypartMode, userName?: string): string {
  const name = userName ? `, ${userName}` : '';
  switch (mode) {
    case 'morning':
      return `Good Morning${name}`;
    case 'afternoon':
      return `Good Afternoon${name}`;
    case 'evening':
      return `Good Evening${name}`;
  }
}

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
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetches live events happening within a time window.
 * 
 * Smart Context (Dayparting):
 * - Morning (5-12): Prioritizes cafes, parks, markets, wellness
 * - Afternoon (12-17): Prioritizes museums, crafts, food, family
 * - Evening (17-5): Prioritizes music, food, cinema, gaming, sports
 * 
 * Sorting: Distance-first (proximity is king for spontaneous decisions)
 * 
 * Designed to be used with the "Now" page for real-time discovery.
 */
export function useLiveEventsQuery(options: UseLiveEventsQueryOptions) {
  const {
    timeOffsetMinutes,
    userLocation,
    radiusKm = 25,
    currentUserProfileId,
    enabled = true,
  } = options;

  // Compute current daypart mode
  const daypartMode = useMemo(() => getDaypartMode(), []);
  const suggestedCategories = useMemo(() => DAYPART_CATEGORIES[daypartMode], [daypartMode]);

  const queryKey = [
    'events',
    'live',
    {
      timeOffset: timeOffsetMinutes,
      location: userLocation ? `${userLocation.lat},${userLocation.lng}` : 'none',
      radius: radiusKm,
      userId: currentUserProfileId || 'anonymous',
      daypart: daypartMode,
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
      const dbQuery = supabase
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

      const { data, error } = await dbQuery;

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

      // Transform to EventWithAttendees format with distance calculation
      const eventsWithData = filteredEvents.map(event => {
        const count = Array.isArray(event.attendee_count)
          ? event.attendee_count[0]?.count || 0
          : 0;
        
        const attendees = Array.isArray(event.attendees)
          ? event.attendees as EventAttendee[]
          : [];

        // Calculate distance if user location and event location are available
        let distanceKm: number | undefined;
        if (userLocation && (event as any).latitude && (event as any).longitude) {
          distanceKm = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            (event as any).latitude,
            (event as any).longitude
          );
        }

        return {
          ...event,
          attendee_count: count,
          attendees,
          distanceKm,
        };
      });

      // Sort by distance (proximity is king for "Now" page)
      // Events without location go to the end
      eventsWithData.sort((a, b) => {
        const distA = a.distanceKm ?? Infinity;
        const distB = b.distanceKm ?? Infinity;
        return distA - distB;
      });

      // Boost daypart-relevant categories to the top (while maintaining distance order within groups)
      const daypartCategories = DAYPART_CATEGORIES[daypartMode];
      const relevantEvents = eventsWithData.filter(
        e => e.category && daypartCategories.includes(e.category)
      );
      const otherEvents = eventsWithData.filter(
        e => !e.category || !daypartCategories.includes(e.category)
      );

      // Combine: relevant events first (sorted by distance), then others (sorted by distance)
      const sortedEvents = [...relevantEvents, ...otherEvents];

      return parseEventsWithAttendees(sortedEvents);
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
    daypartMode,
    suggestedCategories,
  };
}

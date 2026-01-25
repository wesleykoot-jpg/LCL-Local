import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EventWithAttendees, EventAttendee } from "./hooks";
import type { Database } from "@/integrations/supabase/types";
import {
  parseEventsWithAttendees,
  parsePersonalizedFeedRows,
  parseUserAttendanceRows,
} from "@/lib/api/schemas";

type Event = Database["public"]["Tables"]["events"]["Row"];

const ATTENDEE_LIMIT = 4;

interface UseEventsQueryOptions {
  category?: string[];
  eventType?: string[];
  userLocation?: { lat: number; lng: number } | null;
  radiusKm?: number;
  currentUserProfileId?: string;
  usePersonalizedFeed?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Fetches events using TanStack Query with optional personalized feed RPC
 *
 * Benefits:
 * - Automatic caching and background refetching
 * - Window focus refetching for fresh data
 * - Stale-while-revalidate pattern
 * - Optimistic updates support
 */
export function useEventsQuery(options?: UseEventsQueryOptions) {
  const queryClient = useQueryClient();

  const {
    category,
    eventType,
    userLocation,
    radiusKm = 25,
    currentUserProfileId,
    usePersonalizedFeed = false,
    limit = 100,
    offset = 0,
  } = options || {};

  // Create stable query key from options
  const queryKey = [
    "events",
    {
      category: category?.sort().join(",") || "all",
      eventType: eventType?.sort().join(",") || "all",
      location: userLocation
        ? `${userLocation.lat},${userLocation.lng}`
        : "none",
      radius: radiusKm,
      userId: currentUserProfileId || "anonymous",
      personalized: usePersonalizedFeed,
      limit,
      offset,
    },
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<EventWithAttendees[]> => {
      // Fetch blocked user IDs once per query
      let blockedUserIds: string[] = [];
      if (currentUserProfileId) {
        const { data: blockedData } = await supabase
          .from("user_blocks")
          .select("blocked_id")
          .eq("blocker_id", currentUserProfileId);

        blockedUserIds = (blockedData || []).map((b) => b.blocked_id);
      }

      // Use personalized feed RPC if enabled and user location is available
      if (usePersonalizedFeed && userLocation && currentUserProfileId) {
        const { data, error } = await (supabase.rpc as any)(
          "get_personalized_feed",
          {
            user_lat: userLocation.lat,
            user_long: userLocation.lng,
            user_id: currentUserProfileId,
            limit_count: limit,
            offset_count: offset,
          },
        );

        if (error) {
          console.error("[useEventsQuery] RPC Error:", error);
          throw error;
        }

        // Transform RPC result to EventWithAttendees format
        const rpcEvents = parsePersonalizedFeedRows(data);
        console.log("[useEventsQuery] RPC Raw Data:", data);
        console.log("[useEventsQuery] Parsed Events:", rpcEvents);

        if (rpcEvents.length === 0) {
          console.warn("[useEventsQuery] RPC returned 0 events");
          return [];
        }

        // Fetch attendees for these events separately
        const eventIds = rpcEvents.map((e) => e.event_id);
        const { data: attendeesData } = await supabase
          .from("event_attendees")
          .select(
            `
            event_id,
            profile:profiles(
              id,
              avatar_url,
              full_name
            )
          `,
          )
          .in("event_id", eventIds)
          .limit(ATTENDEE_LIMIT);

        // Group attendees by event
        const attendeesByEvent = new Map<string, EventAttendee[]>();
        (attendeesData || []).forEach((att: any) => {
          if (!attendeesByEvent.has(att.event_id)) {
            attendeesByEvent.set(att.event_id, []);
          }
          attendeesByEvent.get(att.event_id)!.push({
            profile: att.profile,
          });
        });

        // Fetch event details including created_by to filter blocked users
        const { data: fullEventsData } = await supabase
          .from("events")
          .select("id, created_by")
          .in("id", eventIds);

        const eventCreatorMap = new Map<string, string | null>();
        (fullEventsData || []).forEach((e) => {
          eventCreatorMap.set(e.id, e.created_by);
        });

        // Combine RPC data with attendees and filter blocked users
        const combinedEvents = rpcEvents
          .filter((rpcEvent) => {
            const creatorId = eventCreatorMap.get(rpcEvent.event_id);
            // Filter out events created by blocked users
            return !creatorId || !blockedUserIds.includes(creatorId);
          })
          .map(
            (rpcEvent) =>
              ({
                id: rpcEvent.event_id,
                title: rpcEvent.title,
                description: rpcEvent.description,
                category: rpcEvent.category as Event["category"],
                event_type: rpcEvent.event_type as Event["event_type"],
                parent_event_id: rpcEvent.parent_event_id,
                venue_name: rpcEvent.venue_name,
                location: rpcEvent.location,
                event_date: rpcEvent.event_date,
                event_time: rpcEvent.event_time,
                image_url: rpcEvent.image_url,
                match_percentage: rpcEvent.match_percentage,
                attendee_count: rpcEvent.attendee_count,
                attendees: attendeesByEvent.get(rpcEvent.event_id) || [],
                created_by: eventCreatorMap.get(rpcEvent.event_id) || null,
                created_at: new Date().toISOString(),
                source_id: null,
                event_fingerprint: null,
                max_attendees: null,
                structured_date: null,
                structured_location: null,
                organizer: null,
                parent_event: null,
                distance_km: rpcEvent.distance_km || null,
              }) as unknown as EventWithAttendees,
          );

        return combinedEvents;
      }

      // NEW: Use location-based RPC if user has location but no personalized feed
      if (userLocation) {
        // Prepare filters - pass as arrays to match RPC parameter types
        const categoryFilter = category && category.length > 0 ? category : [];
        const typeFilter = eventType && eventType.length > 0 ? eventType : [];

        const { data, error } = await supabase.rpc("get_nearby_events", {
          user_lat: userLocation.lat,
          user_long: userLocation.lng,
          radius_km: radiusKm,
          limit_count: limit,
          offset_count: offset,
          filter_category: categoryFilter,
          filter_type: typeFilter,
        });

        if (error) {
          console.error("[useEventsQuery] get_nearby_events RPC Error:", error);
          throw error;
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
          return [];
        }

        // Fetch attendees for these events separately
        const eventIds = (data as any[]).map((e: any) => e.id);
        const { data: attendeesData } = await supabase
          .from("event_attendees")
          .select(
            `
            event_id,
            profile:profiles(
              id,
              avatar_url,
              full_name
            )
          `,
          )
          .in("event_id", eventIds)
          .limit(ATTENDEE_LIMIT);

        // Group attendees by event
        const attendeesByEvent = new Map<string, EventAttendee[]>();

        if (attendeesData && Array.isArray(attendeesData)) {
          attendeesData.forEach((att: any) => {
            if (!attendeesByEvent.has(att.event_id)) {
              attendeesByEvent.set(att.event_id, []);
            }
            attendeesByEvent.get(att.event_id)!.push({
              profile: att.profile,
            });
          });
        }

        return (data as any[])
          .filter(
            (e: any) => !e.created_by || !blockedUserIds.includes(e.created_by),
          )
          .map((e: any) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            category: e.category as Event["category"],
            event_type: e.event_type as Event["event_type"],
            parent_event_id: e.parent_event_id,
            venue_name: e.venue_name,
            location: e.location,
            event_date: e.event_date,
            event_time: e.event_time,
            image_url: e.image_url,
            match_percentage: e.match_percentage,
            attendee_count: Number(e.attendee_count), // RPC returns bigint
            attendees: attendeesByEvent.get(e.id) || [],
            created_by: e.created_by,
            created_at: e.created_at,
            source_id: null,
            event_fingerprint: null,
            max_attendees: null,
            structured_date: null,
            structured_location: null,
            organizer: null,
            parent_event: null,
            distance_km: e.distance_km,
          })) as unknown as EventWithAttendees[];
      }

      // Fallback to standard query (existing behavior)
      let query = supabase
        .from("events")
        .select(
          `
          *,
          attendee_count:event_attendees(count),
          attendees:event_attendees(
            profile:profiles(
              id,
              avatar_url,
              full_name
            )
          )
        `,
        )
        .eq("status", "published")
        .order("event_date", { ascending: true })
        .range(offset, offset + limit - 1)
        .limit(ATTENDEE_LIMIT, { foreignTable: "event_attendees" });

      if (category && category.length > 0) {
        query = query.in("category", category);
      }

      if (eventType && eventType.length > 0) {
        query = query.in("event_type", eventType);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[useEventsQuery] Fallback Query Error:", error);
        throw error;
      }

      let eventsWithData = (data || [])
        // Filter out events from blocked users
        .filter(
          (event) =>
            !event.created_by || !blockedUserIds.includes(event.created_by),
        )
        .map((event) => {
          const count = Array.isArray(event.attendee_count)
            ? event.attendee_count[0]?.count || 0
            : 0;

          const attendees = Array.isArray(event.attendees)
            ? (event.attendees as EventAttendee[])
            : [];

          return {
            ...event,
            attendee_count: count,
            attendees,
          };
        });

      // Fetch current user's attendance if provided
      if (currentUserProfileId && eventsWithData.length > 0) {
        const eventIds = eventsWithData.map((e) => e.id);
        const { data: userAttendances } = await supabase
          .from("event_attendees")
          .select("event_id, profile_id, profiles(id, avatar_url, full_name)")
          .eq("profile_id", currentUserProfileId)
          .in("event_id", eventIds);

        const attendanceRows = parseUserAttendanceRows(userAttendances);
        if (attendanceRows.length > 0) {
          eventsWithData = eventsWithData.map((event) => {
            const userAttendance = attendanceRows.find(
              (a) => a.event_id === event.id,
            );
            if (userAttendance) {
              const isInList = event.attendees?.some(
                (a) => a.profile?.id === currentUserProfileId,
              );
              if (!isInList && userAttendance.profiles) {
                return {
                  ...event,
                  attendees: [
                    {
                      profile: {
                        id: userAttendance.profiles.id,
                        avatar_url: userAttendance.profiles.avatar_url,
                        full_name: userAttendance.profiles.full_name as string,
                      },
                    },
                    ...(event.attendees || []),
                  ],
                };
              }
            }
            return event;
          });
        }
      }

      return parseEventsWithAttendees(eventsWithData) as EventWithAttendees[];
    },
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
    gcTime: 1000 * 60 * 10, // Keep unused data in cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
    refetchOnReconnect: true, // Refetch when internet reconnects
    refetchInterval: 1000 * 60 * 5, // Background refetch every 5 minutes
  });

  // Provide a refetch function for manual updates
  const refetch = () => {
    return queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  return {
    events: query.data || [],
    loading: query.isLoading,
    error: query.error,
    isRefetching: query.isRefetching,
    refetch,
  };
}

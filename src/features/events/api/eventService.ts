import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  DiscoveryLayout,
  MissionIntent,
  MissionModeResponse,
} from "../types/discoveryTypes";

type EventAttendee = Database["public"]["Tables"]["event_attendees"]["Insert"];
type JoinEventRpcResult = {
  status: "ok" | "exists" | "full" | "error";
  message?: string;
  event_id?: string;
  profile_id?: string;
};
type JoinEventResult = {
  data: EventAttendee | null;
  rpcResult?: JoinEventRpcResult | null;
  error: Error | null;
  waitlisted: boolean;
};

export interface JoinEventParams {
  eventId: string;
  profileId: string;
  status?: "going" | "interested" | "waitlist";
}

export interface CreateEventParams {
  title: string;
  description?: string;
  category: "cinema" | "market" | "crafts" | "sports" | "gaming";
  event_type: "anchor" | "fork" | "signal";
  event_date: string;
  event_time: string;
  venue_name: string;
  location: string;
  image_url?: string;
  parent_event_id?: string;
  creator_profile_id: string;
  max_attendees?: number;
  is_private?: boolean;
  invited_user_ids?: string[];
}

const stripHtmlTags = (value?: string) =>
  (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value: string) =>
  value.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase(),
  );

const normalizeEventTime = (value: string) => {
  const trimmed = (value || "").trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return trimmed;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const buildUtcTimestamp = (date: string, time: string) => {
  const [year, month, day] = (date || "").split("-").map(Number);
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
  const hours = timeMatch ? Number(timeMatch[1]) : 12;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;
  if (!year || !month || !day) return date;
  const utc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  return utc.toISOString();
};

/**
 * Fetches discovery rails with traditional, AI-driven, and social sections
 * @param userId - User's profile ID
 * @param userLocation - User's current location
 * @param radiusKm - Search radius in kilometers
 * @returns Discovery layout with multiple rail sections
 */
export async function fetchDiscoveryRails(
  userId: string,
  userLocation: { lat: number; lng: number },
  radiusKm: number = 25,
): Promise<DiscoveryLayout> {
  const { handleSupabaseError } = await import("@/lib/errorHandler");
  const { queryWithTimeout, QUERY_TIMEOUTS } =
    await import("@/lib/queryTimeout");
  const { retrySupabaseQuery } = await import("@/lib/retryWithBackoff");
  const { monitorQuery } = await import("@/lib/queryMonitor");

  try {
    return await monitorQuery(
      "fetchDiscoveryRails",
      async () => {
        return await retrySupabaseQuery(async () => {
          return await queryWithTimeout(async () => {
            // Handle anonymous user by using NIL UUID to satisfy UUID type in RPC
            const safeUserId =
              userId && userId !== "anonymous"
                ? userId
                : "00000000-0000-0000-0000-000000000000";

            const { data, error } = await supabase.rpc("get_discovery_rails", {
              p_user_id: safeUserId,
              p_user_lat: userLocation.lat,
              p_user_long: userLocation.lng,
              p_radius_km: radiusKm,
              p_limit_per_rail: 10,
            });

            if (error) throw error;
            if (!data) throw new Error("No discovery rails data returned");

            return data as unknown as DiscoveryLayout;
          }, QUERY_TIMEOUTS.COMPLEX);
        });
      },
      2000, // 2s threshold for slow query warning
    );
  } catch (error) {
    handleSupabaseError(error, {
      operation: "fetchDiscoveryRails",
      component: "eventService",
      metadata: { userId, radiusKm, userLocation },
    });

    // Explicitly log the error for debugging discovery rails
    console.error("[fetchDiscoveryRails] Failed to fetch rails:", error);

    // Return empty layout on error
    return { sections: [] };
  }
}

/**
 * Fetches events for mission mode (immediate intent queries)
 * @param intent - Mission intent (lunch, coffee, drinks, explore)
 * @param userLocation - User's current location
 * @param maxDistanceKm - Maximum walking distance in kilometers
 * @returns Mission mode response with filtered events
 */
export async function fetchMissionModeEvents(
  intent: MissionIntent,
  userLocation: { lat: number; lng: number },
  maxDistanceKm: number = 1.0,
): Promise<MissionModeResponse> {
  try {
    const { data, error } = await supabase.rpc("get_mission_mode_events", {
      p_intent: intent,
      p_user_lat: userLocation.lat,
      p_user_long: userLocation.lng,
      p_max_distance_km: maxDistanceKm,
      p_limit: 10,
    });

    if (error) throw error;
    if (!data) throw new Error("No mission mode data returned");

    return data as unknown as MissionModeResponse;
  } catch (error) {
    console.error("Error fetching mission mode events:", error);
    // Return empty response on error
    return { intent, events: [] };
  }
}

/**
 * Adds a user to an event as an attendee, with automatic waitlist handling
 * @param eventId - ID of the event to join
 * @param profileId - ID of the user's profile
 * @param status - Attendance status (default: 'going', or 'waitlist' if full)
 * @returns Object with data, waitlisted flag, and error (if any)
 */
export async function joinEvent({
  eventId,
  profileId,
  status = "going",
}: JoinEventParams): Promise<JoinEventResult> {
  try {
    // Use atomic RPC as PRIMARY method to prevent race conditions
    const { data: rawData, error: rpcError } = await supabase.rpc(
      "join_event_atomic",
      {
        p_event_id: eventId,
        p_profile_id: profileId,
        p_status: status,
      },
    );

    if (rpcError) throw rpcError;

    const rpcResult = rawData as JoinEventRpcResult | null;

    // Handle RPC responses
    if (rpcResult?.status === "exists") {
      return {
        data: null,
        rpcResult,
        error: new Error("already_joined"),
        waitlisted: false,
      };
    }

    if (rpcResult?.status === "full" && status === "going") {
      return {
        data: null,
        rpcResult,
        error: new Error("event_full"),
        waitlisted: true,
      };
    }

    // Success path for RPC
    if (rpcResult?.status === "ok") {
      return { data: null, rpcResult, error: null, waitlisted: false };
    }

    // Unexpected RPC status
    return {
      data: null,
      rpcResult,
      error: new Error(rpcResult?.message || "Unable to join event"),
      waitlisted: false,
    };
  } catch (error) {
    console.error("Error joining event:", error);
    return { data: null, error: error as Error, waitlisted: false };
  }
}

/**
 * Checks if a user is attending a specific event
 * @param eventId - ID of the event
 * @param profileId - ID of the user's profile
 * @returns Object with attendance status and error (if any)
 */
export async function checkEventAttendance(eventId: string, profileId: string) {
  try {
    const { data, error } = await supabase
      .from("event_attendees")
      .select("status")
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) throw error;

    return { isAttending: !!data, status: data?.status, error: null };
  } catch (error) {
    console.error("Error checking attendance:", error);
    return { isAttending: false, status: null, error: error as Error };
  }
}

/**
 * Creates a new event and automatically adds the creator as an attendee
 * @param params - Event creation parameters
 * @returns Object with created event data and error (if any)
 */
export async function createEvent(params: CreateEventParams) {
  try {
    const {
      creator_profile_id,
      parent_event_id,
      is_private,
      invited_user_ids,
      ...eventParams
    } = params;
    const cleanedTitle = stripHtmlTags(eventParams.title).trim();
    const normalizedTitle = toTitleCase(cleanedTitle);
    const normalizedDescription = stripHtmlTags(eventParams.description);
    const normalizedTime = normalizeEventTime(eventParams.event_time);
    const eventDateIso = buildUtcTimestamp(
      eventParams.event_date,
      normalizedTime,
    );

    if (eventParams.event_type === "fork" && !parent_event_id) {
      throw new Error("Fork events require parent_event_id");
    }

    if (eventParams.event_type !== "fork" && parent_event_id) {
      throw new Error("Only fork events can include parent_event_id");
    }

    const event = {
      ...eventParams,
      title: normalizedTitle,
      description: normalizedDescription,
      event_time: normalizedTime,
      event_date: eventDateIso,
      parent_event_id:
        eventParams.event_type === "fork" ? parent_event_id : undefined,
      created_by: creator_profile_id,
      created_at: new Date().toISOString(),
      status: "active",
      match_percentage: 85,
      is_private: is_private || false,
    };

    const { data, error } = await supabase
      .from("events")
      .insert(event)
      .select()
      .single();

    if (error) throw error;

    if (data) {
      // Add creator as attendee
      await joinEvent({
        eventId: data.id,
        profileId: params.creator_profile_id,
        status: "going",
      });

      // Create invites for invited users if this is a private event
      if (is_private && invited_user_ids && invited_user_ids.length > 0) {
        const invites = invited_user_ids.map((invitedUserId) => ({
          event_id: data.id,
          invited_user_id: invitedUserId,
          invited_by: creator_profile_id,
          status: "pending",
        }));

        const { error: invitesError } = await supabase
          .from("event_invites")
          .insert(invites);

        if (invitesError) {
          console.error("Error creating invites:", invitesError);
          // Don't fail event creation if invites fail
        }

        // Best-effort: Create notifications for invited users
        // Check if notifications table exists and create notification rows
        try {
          // Query to check if notifications table exists
          const { error: tableCheckError } = await (
            supabase.from("notifications" as any) as any
          )
            .select("id")
            .limit(1);

          // If no error, table exists - create notifications
          if (!tableCheckError) {
            const notifications = invited_user_ids.map((invitedUserId) => ({
              user_id: invitedUserId,
              type: "event_invite",
              title: "Event Invitation",
              message: `You've been invited to ${normalizedTitle}`,
              data: {
                event_id: data.id,
                invited_by: creator_profile_id,
              },
            }));

            await (supabase.from("notifications" as any) as any).insert(
              notifications,
            );
          }
        } catch (notificationError) {
          // Silent fail - notifications are best-effort
          console.log(
            "Notifications not created (table may not exist):",
            notificationError,
          );
        }
      }
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error creating event:", error);
    return { data: null, error: error as Error };
  }
}

/**
 * Fetches all events a user is attending
 * @param userId - User ID (from auth)
 * @returns Array of events with attendee info
 */
export async function fetchUserEvents(profileIdOrUserId: string) {
  try {
    // Try to find profile by user_id first, then fall back to treating it as profile_id
    let profileId = profileIdOrUserId;

    const { data: profileByUserId } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", profileIdOrUserId)
      .maybeSingle();

    if (profileByUserId?.id) {
      profileId = profileByUserId.id;
    } else {
      // Check if the ID is actually a valid profile_id (for test users without user_id)
      const { data: profileById } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", profileIdOrUserId)
        .maybeSingle();

      if (profileById?.id) {
        profileId = profileById.id;
      }
    }

    // Fetch events the user is attending
    const { data, error } = await supabase
      .from("event_attendees")
      .select(
        `
        *,
        event:events(
          *,
          attendee_count:event_attendees(count)
        )
      `,
      )
      .eq("profile_id", profileId)
      .eq("status", "going");

    if (error) throw error;

    // Transform to event format expected by timeline
    return (data || [])
      .map((attendance) => {
        const event = attendance.event as any;
        if (!event) return null;

        const count = Array.isArray(event.attendee_count)
          ? event.attendee_count[0]?.count || 0
          : 0;

        return {
          id: event.id,
          title: event.title,
          date: event.event_date,
          event_time: event.event_time,
          location: event.venue_name,
          venue_name: event.venue_name,
          category: event.category,
          image_url: event.image_url,
          attendee_count: count,
          ticket_number: attendance.ticket_number,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("Error fetching user events:", error);
    return [];
  }
}

/**
 * Service object for event-related API calls
 */
export const eventService = {
  joinEvent,
  checkEventAttendance,
  createEvent,
  fetchUserEvents,
  fetchDiscoveryRails,
  fetchMissionModeEvents,
};

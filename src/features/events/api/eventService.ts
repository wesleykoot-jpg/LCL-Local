import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type EventAttendee = Database['public']['Tables']['event_attendees']['Insert'];
type JoinEventRpcResult = {
  status: 'ok' | 'exists' | 'full' | 'error';
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
  status?: 'going' | 'interested' | 'waitlist';
}

export interface CreateEventParams {
  title: string;
  description?: string;
  category: 'cinema' | 'market' | 'crafts' | 'sports' | 'gaming';
  event_type: 'anchor' | 'fork' | 'signal';
  event_date: string;
  event_time: string;
  venue_name: string;
  location: string;
  image_url?: string;
  parent_event_id?: string;
  creator_profile_id: string;
  max_attendees?: number;
}

const stripHtmlTags = (value?: string) =>
  (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toTitleCase = (value: string) =>
  value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

const normalizeEventTime = (value: string) => {
  const trimmed = (value || '').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return trimmed;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildUtcTimestamp = (date: string, time: string) => {
  const [year, month, day] = (date || '').split('-').map(Number);
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
  const hours = timeMatch ? Number(timeMatch[1]) : 12;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;
  if (!year || !month || !day) return date;
  const utc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  return utc.toISOString();
};

/**
 * Adds a user to an event as an attendee, with automatic waitlist handling
 * @param eventId - ID of the event to join
 * @param profileId - ID of the user's profile
 * @param status - Attendance status (default: 'going', or 'waitlist' if full)
 * @returns Object with data, waitlisted flag, and error (if any)
 */
export async function joinEvent({ eventId, profileId, status = 'going' }: JoinEventParams): Promise<JoinEventResult> {
  try {
    // Check if event has capacity limit and current attendance
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('max_attendees')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) throw new Error('Event not found');

    let finalStatus = status;
    let wasWaitlisted = false;

    // If event has capacity limit and user wants to go, check if full
    if (event.max_attendees && status === 'going') {
      const { count, error: countError } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'going');

      if (countError) throw countError;

      // If at capacity, automatically add to waitlist instead
      if (count && count >= event.max_attendees) {
        finalStatus = 'waitlist';
        wasWaitlisted = true;
      }
    }

    const attendee: EventAttendee = {
      event_id: eventId,
      profile_id: profileId,
      status: finalStatus,
      joined_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('event_attendees')
      .insert(attendee)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create attendance record');

    return { data, error: null, waitlisted: wasWaitlisted };
  } catch (error) {
    console.error('Error joining event:', error);

    // Fallback to atomic RPC to handle stricter RLS or race conditions in UAT
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('join_event_atomic', {
        p_event_id: eventId,
        p_profile_id: profileId,
        p_status: status,
      });

      if (rpcError) throw rpcError;

      if (rpcResult?.status === 'exists') {
        return { data: null, error: new Error('already_joined'), waitlisted: false };
      }

      if (rpcResult?.status === 'full' && status === 'going') {
        return { data: null, rpcResult, error: new Error('event_full'), waitlisted: true };
      }

      // Success path for RPC
      if (rpcResult?.status === 'ok') {
        return { data: null, rpcResult, error: null, waitlisted: false };
      }

      // Unexpected RPC status
      return { data: null, rpcResult, error: new Error(rpcResult?.message || 'Unable to join event'), waitlisted: false };
    } catch (fallbackError) {
      console.error('Fallback RPC join failed:', fallbackError);
      return { data: null, error: fallbackError as Error, waitlisted: false };
    }
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
      .from('event_attendees')
      .select('status')
      .eq('event_id', eventId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw error;

    return { isAttending: !!data, status: data?.status, error: null };
  } catch (error) {
    console.error('Error checking attendance:', error);
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
    const { creator_profile_id, parent_event_id, ...eventParams } = params;
    const cleanedTitle = stripHtmlTags(eventParams.title).trim();
    const normalizedTitle = toTitleCase(cleanedTitle);
    const normalizedDescription = stripHtmlTags(eventParams.description);
    const normalizedTime = normalizeEventTime(eventParams.event_time);
    const eventDateIso = buildUtcTimestamp(eventParams.event_date, normalizedTime);

    if (eventParams.event_type === 'fork' && !parent_event_id) {
      throw new Error('Fork events require parent_event_id');
    }

    if (eventParams.event_type !== 'fork' && parent_event_id) {
      throw new Error('Only fork events can include parent_event_id');
    }

    const event = {
      ...eventParams,
      title: normalizedTitle,
      description: normalizedDescription,
      event_time: normalizedTime,
      event_date: eventDateIso,
      parent_event_id: eventParams.event_type === 'fork' ? parent_event_id : undefined,
      created_by: creator_profile_id,
      created_at: new Date().toISOString(),
      status: 'active',
      match_percentage: 85,
    };

    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;

    if (data) {
      await joinEvent({
        eventId: data.id,
        profileId: params.creator_profile_id,
        status: 'going',
      });
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error creating event:', error);
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
      .from('profiles')
      .select('id')
      .eq('user_id', profileIdOrUserId)
      .maybeSingle();
    
    if (profileByUserId?.id) {
      profileId = profileByUserId.id;
    } else {
      // Check if the ID is actually a valid profile_id (for test users without user_id)
      const { data: profileById } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', profileIdOrUserId)
        .maybeSingle();
      
      if (profileById?.id) {
        profileId = profileById.id;
      }
    }

    // Fetch events the user is attending
    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        event:events(
          *,
          attendee_count:event_attendees(count)
        )
      `)
      .eq('profile_id', profileId)
      .eq('status', 'going');

    if (error) throw error;

    // Transform to event format expected by timeline
    return (data || [])
      .map(attendance => {
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
    console.error('Error fetching user events:', error);
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
};

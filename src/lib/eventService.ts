import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Event = Database['public']['Tables']['events']['Row'];
type EventAttendee = Database['public']['Tables']['event_attendees']['Insert'];
type JoinEventRpcResult = {
  status: 'ok' | 'exists' | 'full' | 'error';
  message?: string;
  event_id?: string;
  profile_id?: string;
};
type JoinEventResult = {
  data: EventAttendee | JoinEventRpcResult | null;
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
        const { data: waitlistData, error: waitlistError } = await supabase
          .from('event_attendees')
          .insert({
            event_id: eventId,
            profile_id: profileId,
            status: 'waitlist',
            joined_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (waitlistError) {
          return { data: null, error: waitlistError, waitlisted: false };
        }
        if (waitlistData) return { data: waitlistData, error: null, waitlisted: true };
      }

      // Success path for RPC
      if (rpcResult?.status === 'ok') {
        return { data: rpcResult, error: null, waitlisted: false };
      }

      // Unexpected RPC status
      return { data: null, error: new Error(rpcResult?.message || 'Unable to join event'), waitlisted: false };
    } catch (fallbackError) {
      console.error('Fallback RPC join failed:', fallbackError);
      return { data: null, error: fallbackError as Error, waitlisted: false };
    }

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
    const { creator_profile_id, ...eventParams } = params;
    const event = {
      ...eventParams,
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

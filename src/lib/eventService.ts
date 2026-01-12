import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  isCalendarConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  storeSyncedEvent,
  getSyncedEventId,
  deleteSyncedEvent,
} from '@/integrations/googleCalendar/service';
import type { GoogleCalendarEventData } from '@/integrations/googleCalendar/client';

type Event = Database['public']['Tables']['events']['Row'];
type EventAttendee = Database['public']['Tables']['event_attendees']['Insert'];

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
export async function joinEvent({ eventId, profileId, status = 'going' }: JoinEventParams) {
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
    return { data: null, error: error as Error, waitlisted: false };
  }
}

/**
 * Removes a user from an event's attendee list
 * @param eventId - ID of the event to leave
 * @param profileId - ID of the user's profile
 * @returns Object with error (if any)
 */
export async function leaveEvent(eventId: string, profileId: string) {
  try {
    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('profile_id', profileId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error leaving event:', error);
    return { error: error as Error };
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

export async function updateEvent(eventId: string, updates: Partial<Event>) {
  try {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .maybeSingle();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error updating event:', error);
    return { data: null, error: error as Error };
  }
}

export async function deleteEvent(eventId: string) {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting event:', error);
    return { error: error as Error };
  }
}

export async function getEventAttendees(eventId: string) {
  try {
    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq('event_id', eventId)
      .eq('status', 'going');

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching attendees:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Convert event to Google Calendar format
 */
function convertEventToGoogleCalendarFormat(event: Event): GoogleCalendarEventData {
  // Parse the date and time
  const [year, month, day] = event.event_date.split('-').map(Number);
  const [hours, minutes] = event.event_time.split(':').map(Number);
  
  // Create start datetime
  const startDate = new Date(year, month - 1, day, hours, minutes);
  
  // Default event duration: 2 hours
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  
  return {
    summary: event.title,
    description: event.description || `Event from LCL Local`,
    location: event.venue_name,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }, // 1 hour before
        { method: 'popup', minutes: 1440 }, // 1 day before
      ],
    },
  };
}

/**
 * Sync an event to a user's Google Calendar
 * @param eventId - ID of the LCL event
 * @param profileId - ID of the user's profile
 * @returns Object with success status and error (if any)
 */
export async function syncEventToGoogleCalendar(eventId: string, profileId: string) {
  try {
    // Check if user has connected Google Calendar
    const connected = await isCalendarConnected(profileId);
    if (!connected) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event) {
      return { success: false, error: 'Event not found' };
    }

    // Convert to Google Calendar format
    const googleEvent = convertEventToGoogleCalendarFormat(event);

    // Check if event is already synced
    const existingGoogleEventId = await getSyncedEventId(profileId, eventId);

    if (existingGoogleEventId) {
      // Update existing event
      const result = await updateCalendarEvent(profileId, existingGoogleEventId, googleEvent);
      return { success: result.success, error: result.error };
    } else {
      // Create new event
      const result = await createCalendarEvent(profileId, googleEvent);
      
      if (result.success && result.googleEventId) {
        await storeSyncedEvent(profileId, eventId, result.googleEventId);
      }
      
      return { success: result.success, error: result.error };
    }
  } catch (error) {
    console.error('Error syncing event to Google Calendar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

/**
 * Sync event updates to all attendees' Google Calendars
 * This should be called after updating an event
 * @param eventId - ID of the updated event
 */
export async function syncEventUpdateToAllAttendees(eventId: string) {
  try {
    // Get all attendees of the event
    const { data: attendees, error } = await getEventAttendees(eventId);
    
    if (error || !attendees) {
      console.error('Error fetching attendees for calendar sync:', error);
      return { success: false, error: 'Failed to fetch attendees' };
    }

    // Sync to each attendee's Google Calendar in parallel
    const syncPromises = attendees.map(async (attendee) => {
      try {
        await syncEventToGoogleCalendar(eventId, attendee.profile_id);
      } catch (err) {
        // Log but don't fail the entire operation
        console.error(`Failed to sync to attendee ${attendee.profile_id}:`, err);
      }
    });

    await Promise.allSettled(syncPromises);
    
    return { success: true };
  } catch (error) {
    console.error('Error syncing event update to attendees:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

/**
 * Remove an event from a user's Google Calendar
 * @param eventId - ID of the LCL event
 * @param profileId - ID of the user's profile
 */
export async function removeEventFromGoogleCalendar(eventId: string, profileId: string) {
  try {
    // Check if user has connected Google Calendar
    const connected = await isCalendarConnected(profileId);
    if (!connected) {
      return { success: true }; // Nothing to remove
    }

    // Get the Google event ID
    const googleEventId = await getSyncedEventId(profileId, eventId);
    if (!googleEventId) {
      return { success: true }; // Not synced, nothing to remove
    }

    // Delete from Google Calendar
    const result = await deleteCalendarEvent(profileId, googleEventId);
    
    if (result.success) {
      await deleteSyncedEvent(profileId, eventId);
    }

    return result;
  } catch (error) {
    console.error('Error removing event from Google Calendar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Remove failed' };
  }
}

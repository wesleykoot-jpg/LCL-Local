/**
 * Google Calendar Service
 * 
 * Handles synchronization of LCL events with Google Calendar.
 * Token exchange and refresh are handled securely via edge function.
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  GOOGLE_CALENDAR_API_BASE, 
  getRedirectUri,
  getEdgeFunctionUrl,
  type GoogleCalendarEventData,
  type GoogleCalendarEventResponse,
} from './client';
import { TOKEN_EXPIRY_BUFFER_MS } from '@/lib/utils';

export interface CalendarTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
}

export interface SyncResult {
  success: boolean;
  googleEventId?: string;
  error?: string;
}

/**
 * Exchange authorization code for tokens via edge function
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<{ tokens: CalendarTokens; error?: string }> {
  try {
    const response = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'exchange',
        code,
        redirectUri: getRedirectUri(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Token exchange failed');
    }
    
    const tokens: CalendarTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return { tokens };
  } catch (error) {
    console.error('[Google Calendar] Token exchange error:', error);
    return { 
      tokens: { accessToken: '', expiresAt: new Date() },
      error: error instanceof Error ? error.message : 'Token exchange failed'
    };
  }
}

/**
 * Store Google Calendar tokens in database
 */
export async function storeCalendarTokens(
  profileId: string, 
  tokens: CalendarTokens
): Promise<{ error?: string }> {
  try {
    const { error } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        profile_id: profileId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expiry: tokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'profile_id',
      });

    if (error) throw error;
    return {};
  } catch (error) {
    console.error('[Google Calendar] Token storage error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to store tokens' };
  }
}

/**
 * Get stored Google Calendar tokens for a profile
 */
export async function getCalendarTokens(profileId: string): Promise<CalendarTokens | null> {
  try {
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, token_expiry')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.token_expiry),
    };
  } catch (error) {
    console.error('[Google Calendar] Error fetching tokens:', error);
    return null;
  }
}

/**
 * Check if user has connected Google Calendar
 */
export async function isCalendarConnected(profileId: string): Promise<boolean> {
  const tokens = await getCalendarTokens(profileId);
  return tokens !== null;
}

/**
 * Refresh access token via edge function
 */
async function refreshAccessToken(profileId: string): Promise<string | null> {
  try {
    const response = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'refresh',
        profileId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Token refresh failed');
    }

    return data.access_token;
  } catch (error) {
    console.error('[Google Calendar] Token refresh error:', error);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(profileId: string): Promise<string | null> {
  const tokens = await getCalendarTokens(profileId);
  if (!tokens) return null;

  // Check if token is expired (with buffer time before expiry)
  const isExpired = tokens.expiresAt.getTime() < Date.now() + TOKEN_EXPIRY_BUFFER_MS;

  if (isExpired && tokens.refreshToken) {
    return refreshAccessToken(profileId);
  }

  return tokens.accessToken;
}

/**
 * Create a Google Calendar event
 */
export async function createCalendarEvent(
  profileId: string,
  eventData: GoogleCalendarEventData
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(profileId);
    if (!accessToken) {
      return { success: false, error: 'Not connected to Google Calendar' };
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to create calendar event');
    }

    const calendarEvent: GoogleCalendarEventResponse = await response.json();

    return { 
      success: true, 
      googleEventId: calendarEvent.id 
    };
  } catch (error) {
    console.error('[Google Calendar] Create event error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create calendar event' 
    };
  }
}

/**
 * Update a Google Calendar event
 */
export async function updateCalendarEvent(
  profileId: string,
  googleEventId: string,
  eventData: GoogleCalendarEventData
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(profileId);
    if (!accessToken) {
      return { success: false, error: 'Not connected to Google Calendar' };
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${googleEventId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to update calendar event');
    }

    return { success: true, googleEventId };
  } catch (error) {
    console.error('[Google Calendar] Update event error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update calendar event' 
    };
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(
  profileId: string,
  googleEventId: string
): Promise<SyncResult> {
  try {
    const accessToken = await getValidAccessToken(profileId);
    if (!accessToken) {
      return { success: false, error: 'Not connected to Google Calendar' };
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${googleEventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // Success cases:
    // - 204 No Content: Event was successfully deleted
    // - 410 Gone: Event was already deleted
    if (!response.ok && response.status !== 410) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to delete calendar event');
    }

    return { success: true };
  } catch (error) {
    console.error('[Google Calendar] Delete event error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete calendar event' 
    };
  }
}

/**
 * Disconnect Google Calendar
 */
export async function disconnectCalendar(profileId: string): Promise<{ error?: string }> {
  try {
    // Delete all synced events records
    await supabase
      .from('google_calendar_events')
      .delete()
      .eq('profile_id', profileId);

    // Delete tokens
    const { error } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('profile_id', profileId);

    if (error) throw error;
    return {};
  } catch (error) {
    console.error('[Google Calendar] Disconnect error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to disconnect' };
  }
}

/**
 * Store the mapping between LCL event and Google Calendar event
 */
export async function storeSyncedEvent(
  profileId: string,
  eventId: string,
  googleEventId: string
): Promise<{ error?: string }> {
  try {
    const { error } = await supabase
      .from('google_calendar_events')
      .upsert({
        profile_id: profileId,
        event_id: eventId,
        google_event_id: googleEventId,
      }, {
        onConflict: 'profile_id,event_id',
      });

    if (error) throw error;
    return {};
  } catch (error) {
    console.error('[Google Calendar] Store synced event error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to store sync record' };
  }
}

/**
 * Get the Google Event ID for a synced LCL event
 */
export async function getSyncedEventId(
  profileId: string,
  eventId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('google_calendar_events')
      .select('google_event_id')
      .eq('profile_id', profileId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (error || !data) return null;
    return data.google_event_id;
  } catch (error) {
    console.error('[Google Calendar] Get synced event error:', error);
    return null;
  }
}

/**
 * Delete synced event record
 */
export async function deleteSyncedEvent(
  profileId: string,
  eventId: string
): Promise<{ error?: string }> {
  try {
    const { error } = await supabase
      .from('google_calendar_events')
      .delete()
      .eq('profile_id', profileId)
      .eq('event_id', eventId);

    if (error) throw error;
    return {};
  } catch (error) {
    console.error('[Google Calendar] Delete synced event error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to delete sync record' };
  }
}

/**
 * External Google Calendar event structure
 */
export interface GoogleCalendarExternalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string; // For all-day events
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
}

/**
 * Fetch events from user's Google Calendar for a date range
 * @param profileId - User's profile ID
 * @param timeMin - Start of date range
 * @param timeMax - End of date range  
 * @param maxResults - Maximum number of events to return (default: 100)
 */
export async function fetchCalendarEvents(
  profileId: string,
  timeMin: Date,
  timeMax: Date,
  maxResults: number = 100
): Promise<{ events: GoogleCalendarExternalEvent[]; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(profileId);
    if (!accessToken) {
      return { events: [], error: 'Not connected to Google Calendar' };
    }

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(Math.min(maxResults, 2500)), // Google's max is 2500
    });

    const response = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch calendar events');
    }

    const data = await response.json();

    return { events: data.items || [] };
  } catch (error) {
    console.error('[Google Calendar] Fetch events error:', error);
    return {
      events: [],
      error: error instanceof Error ? error.message : 'Failed to fetch calendar events'
    };
  }
}

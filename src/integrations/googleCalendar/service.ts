/**
 * Google Calendar Service
 * 
 * Handles synchronization of LCL events with Google Calendar.
 * Manages token storage, event creation, and updates.
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  GOOGLE_CALENDAR_API_BASE, 
  getGoogleClientId, 
  getRedirectUri,
  type GoogleCalendarEventData,
  type GoogleCalendarEventResponse,
} from './client';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

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
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<{ tokens: CalendarTokens; error?: string }> {
  try {
    // For client-side apps, we need a backend to exchange codes securely
    // In this implementation, we'll use a serverless approach via Supabase Edge Function
    // For now, we'll store the code and simulate the exchange
    // In production, this should be handled by a backend service

    const clientId = getGoogleClientId();
    const redirectUri = getRedirectUri();

    // Note: In a production environment, the client_secret should be kept on the server
    // For this client-side implementation, we're using the implicit grant flow
    // The code exchange should ideally happen in a Supabase Edge Function

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || 'Token exchange failed');
    }

    const data = await response.json();
    
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
 * Refresh access token if expired
 */
async function refreshAccessToken(profileId: string, refreshToken: string): Promise<string | null> {
  try {
    const clientId = getGoogleClientId();

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    
    // Update stored tokens
    await storeCalendarTokens(profileId, {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Keep existing refresh token
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    });

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

  // Check if token is expired (with 5 minute buffer)
  const isExpired = tokens.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired && tokens.refreshToken) {
    return refreshAccessToken(profileId, tokens.refreshToken);
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

    // 204 No Content is success, 410 Gone means already deleted
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

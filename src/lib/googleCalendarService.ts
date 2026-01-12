import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CalendarIntegration = Database['public']['Tables']['calendar_integrations']['Row'];
type CalendarEventMapping = Database['public']['Tables']['calendar_event_mappings']['Insert'];
type Event = Database['public']['Tables']['events']['Row'];

// OAuth2 configuration
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const REDIRECT_URI = `${window.location.origin}/calendar/callback`;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  reminders?: {
    useDefault: boolean;
  };
}

/**
 * Generate Google OAuth consent URL
 */
export function getAuthorizationUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('Google OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  try {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to exchange code for tokens');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiryDate: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    };
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
}

/**
 * Save calendar integration to database
 */
export async function saveCalendarIntegration(
  profileId: string,
  accessToken: string,
  refreshToken: string | null | undefined,
  tokenExpiry: string | null
) {
  try {
    const { data, error } = await supabase
      .from('calendar_integrations')
      .upsert({
        profile_id: profileId,
        provider: 'google',
        access_token: accessToken,
        refresh_token: refreshToken || null,
        token_expiry: tokenExpiry,
        sync_enabled: true,
        calendar_id: 'primary',
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving calendar integration:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get user's calendar integration
 */
export async function getCalendarIntegration(profileId: string): Promise<CalendarIntegration | null> {
  try {
    const { data, error } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('profile_id', profileId)
      .eq('provider', 'google')
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching calendar integration:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(integration: CalendarIntegration): Promise<string> {
  if (!integration.refresh_token) {
    throw new Error('No refresh token available');
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to refresh access token');
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access token in refresh response');
  }

  // Update the integration with new token
  await supabase
    .from('calendar_integrations')
    .update({
      access_token: data.access_token,
      token_expiry: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    })
    .eq('id', integration.id);

  return data.access_token;
}

/**
 * Get valid access token (refresh if needed)
 */
async function getValidAccessToken(integration: CalendarIntegration): Promise<string> {
  if (!integration.access_token) {
    throw new Error('No access token available');
  }

  // Check if token is expired
  if (integration.token_expiry) {
    const expiry = new Date(integration.token_expiry);
    const now = new Date();

    // Refresh if token expires in less than 5 minutes
    if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
      return await refreshAccessToken(integration);
    }
  }

  return integration.access_token;
}

/**
 * Convert local event to Google Calendar event format
 */
function convertToGoogleCalendarEvent(event: Event): GoogleCalendarEvent {
  // Parse event date and time
  const eventDate = new Date(event.event_date);
  const [hours, minutes] = event.event_time.split(':').map(Number);

  const startDateTime = new Date(eventDate);
  startDateTime.setHours(hours || 0, minutes || 0, 0, 0);

  // Default event duration: 2 hours
  const endDateTime = new Date(startDateTime);
  endDateTime.setHours(endDateTime.getHours() + 2);

  return {
    summary: event.title,
    description: event.description || '',
    location: event.venue_name,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: true,
    },
  };
}

/**
 * Create event in Google Calendar
 */
export async function createCalendarEvent(
  profileId: string,
  event: Event
): Promise<{ success: boolean; externalEventId?: string; error?: string }> {
  try {
    const integration = await getCalendarIntegration(profileId);

    if (!integration || !integration.sync_enabled) {
      return { success: false, error: 'Calendar integration not enabled' };
    }

    const accessToken = await getValidAccessToken(integration);
    const googleEvent = convertToGoogleCalendarEvent(event);

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${integration.calendar_id || 'primary'}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create calendar event');
    }

    const data = await response.json();

    if (!data.id) {
      throw new Error('No event ID returned from Google Calendar');
    }

    // Save mapping
    const mapping: CalendarEventMapping = {
      event_id: event.id,
      profile_id: profileId,
      integration_id: integration.id,
      external_event_id: data.id,
      external_calendar_id: integration.calendar_id || 'primary',
      sync_status: 'synced',
    };

    await supabase.from('calendar_event_mappings').insert(mapping);

    return { success: true, externalEventId: data.id };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create calendar event',
    };
  }
}

/**
 * Update event in Google Calendar
 */
export async function updateCalendarEvent(
  profileId: string,
  event: Event
): Promise<{ success: boolean; error?: string }> {
  try {
    const integration = await getCalendarIntegration(profileId);

    if (!integration || !integration.sync_enabled) {
      return { success: false, error: 'Calendar integration not enabled' };
    }

    // Get mapping
    const { data: mapping } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('event_id', event.id)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (!mapping) {
      // Event not synced yet, create it
      return await createCalendarEvent(profileId, event);
    }

    const accessToken = await getValidAccessToken(integration);
    const googleEvent = convertToGoogleCalendarEvent(event);

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${mapping.external_calendar_id}/events/${mapping.external_event_id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update calendar event');
    }

    // Update mapping timestamp
    await supabase
      .from('calendar_event_mappings')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('id', mapping.id);

    return { success: true };
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update calendar event',
    };
  }
}

/**
 * Delete event from Google Calendar
 */
export async function deleteCalendarEvent(
  profileId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const integration = await getCalendarIntegration(profileId);

    if (!integration || !integration.sync_enabled) {
      return { success: false, error: 'Calendar integration not enabled' };
    }

    // Get mapping
    const { data: mapping } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('event_id', eventId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (!mapping) {
      return { success: true }; // Nothing to delete
    }

    const accessToken = await getValidAccessToken(integration);

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${mapping.external_calendar_id}/events/${mapping.external_event_id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete calendar event');
    }

    // Delete mapping
    await supabase.from('calendar_event_mappings').delete().eq('id', mapping.id);

    return { success: true };
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete calendar event',
    };
  }
}

/**
 * Disconnect calendar integration
 */
export async function disconnectCalendar(
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete all mappings
    await supabase.from('calendar_event_mappings').delete().eq('profile_id', profileId);

    // Delete integration
    await supabase
      .from('calendar_integrations')
      .delete()
      .eq('profile_id', profileId)
      .eq('provider', 'google');

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disconnect calendar',
    };
  }
}

/**
 * Check if event is synced to calendar
 */
export async function isEventSynced(profileId: string, eventId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('calendar_event_mappings')
      .select('id')
      .eq('event_id', eventId)
      .eq('profile_id', profileId)
      .maybeSingle();

    return !!data;
  } catch (error) {
    console.error('Error checking event sync status:', error);
    return false;
  }
}

import { google } from 'googleapis';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CalendarIntegration = Database['public']['Tables']['calendar_integrations']['Row'];
type CalendarEventMapping = Database['public']['Tables']['calendar_event_mappings']['Insert'];
type Event = Database['public']['Tables']['events']['Row'];

// OAuth2 configuration
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const REDIRECT_URI = `${window.location.origin}/calendar/callback`;

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
 * Get OAuth2 client configuration
 */
function getOAuth2Client() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

/**
 * Generate Google OAuth consent URL
 */
export function getAuthorizationUrl(): string {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
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

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: integration.refresh_token,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  // Update the integration with new token
  await supabase
    .from('calendar_integrations')
    .update({
      access_token: credentials.access_token,
      token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
    })
    .eq('id', integration.id);

  return credentials.access_token;
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
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const googleEvent = convertToGoogleCalendarEvent(event);

    const response = await calendar.events.insert({
      calendarId: integration.calendar_id || 'primary',
      requestBody: googleEvent,
    });

    if (!response.data.id) {
      throw new Error('No event ID returned from Google Calendar');
    }

    // Save mapping
    const mapping: CalendarEventMapping = {
      event_id: event.id,
      profile_id: profileId,
      integration_id: integration.id,
      external_event_id: response.data.id,
      external_calendar_id: integration.calendar_id || 'primary',
      sync_status: 'synced',
    };

    await supabase.from('calendar_event_mappings').insert(mapping);

    return { success: true, externalEventId: response.data.id };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create calendar event' 
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
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const googleEvent = convertToGoogleCalendarEvent(event);

    await calendar.events.update({
      calendarId: mapping.external_calendar_id,
      eventId: mapping.external_event_id,
      requestBody: googleEvent,
    });

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
      error: error instanceof Error ? error.message : 'Failed to update calendar event' 
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
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: mapping.external_calendar_id,
      eventId: mapping.external_event_id,
    });

    // Delete mapping
    await supabase
      .from('calendar_event_mappings')
      .delete()
      .eq('id', mapping.id);

    return { success: true };
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete calendar event' 
    };
  }
}

/**
 * Disconnect calendar integration
 */
export async function disconnectCalendar(profileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete all mappings
    await supabase
      .from('calendar_event_mappings')
      .delete()
      .eq('profile_id', profileId);

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
      error: error instanceof Error ? error.message : 'Failed to disconnect calendar' 
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

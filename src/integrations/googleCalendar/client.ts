/**
 * Google Calendar Integration Client
 * 
 * Handles OAuth 2.0 authentication flow with Google Calendar API
 * using the implicit grant flow suitable for client-side applications.
 */

// Google API scopes needed for calendar integration
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

// Google OAuth configuration
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Get the Google Client ID from environment
 */
export function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.warn('[Google Calendar] Missing VITE_GOOGLE_CLIENT_ID environment variable');
  }
  return clientId || '';
}

/**
 * Check if Google Calendar integration is configured
 */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(getGoogleClientId());
}

/**
 * Get the OAuth redirect URI
 */
export function getRedirectUri(): string {
  return `${window.location.origin}/profile/calendar`;
}

/**
 * Initiate OAuth flow to connect Google Calendar
 * Opens Google's OAuth consent screen
 */
export function initiateGoogleOAuth(): void {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google Calendar integration not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES.join(' '),
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Always show consent to get refresh token
    state: generateOAuthState(),
  });

  window.location.href = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Generate a random state parameter for OAuth security
 */
function generateOAuthState(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem('google_oauth_state', state);
  return state;
}

/**
 * Validate the OAuth state parameter
 */
export function validateOAuthState(state: string): boolean {
  const savedState = sessionStorage.getItem('google_oauth_state');
  sessionStorage.removeItem('google_oauth_state');
  return savedState === state;
}

/**
 * Parse OAuth callback parameters from URL
 */
export function parseOAuthCallback(): { code?: string; error?: string; state?: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get('code') || undefined,
    error: params.get('error') || undefined,
    state: params.get('state') || undefined,
  };
}

/**
 * Google Calendar API base URL
 */
export const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Event data structure for Google Calendar
 */
export interface GoogleCalendarEventData {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

/**
 * Response from Google Calendar API when creating/updating events
 */
export interface GoogleCalendarEventResponse {
  id: string;
  status: string;
  htmlLink: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

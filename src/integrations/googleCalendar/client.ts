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

// LocalStorage key for user-provided Google Client ID
const USER_CLIENT_ID_KEY = 'google_calendar_client_id';

// Custom event for configuration changes
const CONFIG_CHANGE_EVENT = 'google-calendar-config-changed';

/**
 * Dispatch a custom event when configuration changes
 */
function notifyConfigChange(): void {
  window.dispatchEvent(new Event(CONFIG_CHANGE_EVENT));
}

/**
 * Get user-provided Google Client ID from localStorage
 */
export function getUserProvidedClientId(): string | null {
  return localStorage.getItem(USER_CLIENT_ID_KEY);
}

/**
 * Set user-provided Google Client ID in localStorage
 */
export function setUserProvidedClientId(clientId: string): void {
  localStorage.setItem(USER_CLIENT_ID_KEY, clientId);
  notifyConfigChange();
}

/**
 * Clear user-provided Google Client ID from localStorage
 */
export function clearUserProvidedClientId(): void {
  localStorage.removeItem(USER_CLIENT_ID_KEY);
  notifyConfigChange();
}

/**
 * Hook to listen for configuration changes
 */
export function useConfigChange(callback: () => void): void {
  if (typeof window === 'undefined') return;
  
  window.addEventListener(CONFIG_CHANGE_EVENT, callback);
  return () => window.removeEventListener(CONFIG_CHANGE_EVENT, callback);
}

/**
 * Get the Google Client ID from user config or environment
 * Priority: User-provided > Environment variable
 */
export function getGoogleClientId(): string {
  // First check if user has provided their own Client ID
  const userClientId = getUserProvidedClientId();
  if (userClientId) {
    return userClientId;
  }
  
  // Fallback to environment variable (for admin configuration)
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!envClientId) {
    console.warn('[Google Calendar] No Client ID configured (user or environment)');
  }
  return envClientId || '';
}

/**
 * Check if Google Calendar integration is configured
 * Returns true if either user-provided or environment Client ID exists
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

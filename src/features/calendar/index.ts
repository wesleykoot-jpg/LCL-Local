// Calendar Feature Module - Public API
// Contains Google Calendar integration

// API / Client utilities
export { 
  GOOGLE_CALENDAR_SCOPES,
  getGoogleClientId,
  isGoogleCalendarConfigured,
  getRedirectUri,
  initiateGoogleOAuth,
  validateOAuthState,
  parseOAuthCallback,
  getEdgeFunctionUrl,
  GOOGLE_CALENDAR_API_BASE,
  type GoogleCalendarEventData,
  type GoogleCalendarEventResponse
} from './api/client';

// Service functions
export {
  exchangeCodeForTokens,
  storeCalendarTokens,
  getCalendarTokens,
  isCalendarConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  disconnectCalendar,
  storeSyncedEvent,
  getSyncedEventId,
  deleteSyncedEvent,
  type CalendarTokens,
  type SyncResult
} from './api/service';

// Hooks
export { useGoogleCalendar } from './hooks/useGoogleCalendar';

// Pages (for route usage)
export { default as GoogleCalendarSettingsPage } from './GoogleCalendarSettings';

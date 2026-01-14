// Calendar Feature Module - Public API
// Contains Google Calendar integration

// API / Services
export { 
  createGoogleCalendarClient, 
  calendarClient 
} from './api/client';

export {
  GoogleCalendarService,
  type CalendarEvent,
  type GoogleCalendarError
} from './api/service';

// Hooks
export { useGoogleCalendar } from './hooks/useGoogleCalendar';

// Pages (for route usage)
export { default as GoogleCalendarSettingsPage } from './GoogleCalendarSettings';

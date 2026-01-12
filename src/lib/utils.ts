import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with proper override handling
 * @param inputs - Class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// Event Type Detection
// ============================================

/** Prefix used to identify mock/demo events */
export const MOCK_EVENT_ID_PREFIX = 'mock-';

/**
 * Checks if an event is a mock/demo event
 * Mock events are used for demonstration purposes and cannot be joined
 * @param eventId - The event ID to check
 * @returns true if the event is a mock event
 */
export function isMockEvent(eventId: string): boolean {
  return eventId.startsWith(MOCK_EVENT_ID_PREFIX);
}

// ============================================
// Google Calendar Integration Constants & Types
// ============================================

/** Default event duration in hours for Google Calendar events */
export const DEFAULT_EVENT_DURATION_HOURS = 2;

/** Buffer time in milliseconds before token expiry to trigger refresh (5 minutes) */
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Represents an LCL event with the minimum fields needed for calendar sync
 */
export interface LCLEventData {
  id: string;
  title: string;
  description?: string | null;
  venue_name: string;
  event_date: string;
  event_time: string;
}

/**
 * Parses event date and time strings into start and end Date objects
 * @param eventDate - Date string in YYYY-MM-DD format
 * @param eventTime - Time string in HH:MM format
 * @param durationHours - Event duration in hours (default: 2)
 * @returns Object with startDate and endDate, or null if parsing fails
 */
export function parseEventDateTime(
  eventDate: string,
  eventTime: string,
  durationHours: number = DEFAULT_EVENT_DURATION_HOURS
): { startDate: Date; endDate: Date } | null {
  try {
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      console.error('[parseEventDateTime] Invalid date format:', eventDate);
      return null;
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(eventTime)) {
      console.error('[parseEventDateTime] Invalid time format:', eventTime);
      return null;
    }

    const [year, month, day] = eventDate.split('-').map(Number);
    const [hours, minutes] = eventTime.split(':').map(Number);

    // Validate parsed values
    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
      console.error('[parseEventDateTime] Failed to parse date/time values');
      return null;
    }

    // Create start datetime
    const startDate = new Date(year, month - 1, day, hours, minutes);
    
    // Validate the date is valid
    if (isNaN(startDate.getTime())) {
      console.error('[parseEventDateTime] Invalid date created');
      return null;
    }

    // Create end datetime based on duration
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

    return { startDate, endDate };
  } catch (error) {
    console.error('[parseEventDateTime] Error parsing date/time:', error);
    return null;
  }
}

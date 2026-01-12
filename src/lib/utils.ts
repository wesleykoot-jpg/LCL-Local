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

/**
 * Parses a PostGIS POINT geography string into latitude and longitude coordinates
 * @param geography - PostGIS POINT string in format "POINT(lng lat)"
 * @returns Object with lat and lng properties, or null if parsing fails
 * @example parseGeography("POINT(6.2 52.7)") // { lat: 52.7, lng: 6.2 }
 */
export function parseGeography(geography: string): { lat: number; lng: number } | null {
  if (!geography) return null;

  const match = geography.match(/POINT\(([0-9.-]+)\s+([0-9.-]+)\)/i);
  if (!match) return null;

  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2]),
  };
}

/**
 * Creates a PostGIS POINT geography string from latitude and longitude
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns PostGIS POINT string in format "POINT(lng lat)"
 * @example createGeography(52.7, 6.2) // "POINT(6.2 52.7)"
 */
export function createGeography(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}

/**
 * Calculates the distance between two geographic points using the Haversine formula
 * @param point1 - First point with lat and lng properties
 * @param point2 - Second point with lat and lng properties
 * @returns Distance in kilometers
 * @example calculateDistance({lat: 52.7, lng: 6.2}, {lat: 52.8, lng: 6.3}) // ~10.5
 */
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.lat - point1.lat);
  const dLon = toRadians(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) *
      Math.cos(toRadians(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formats event date and time into a human-readable string
 * @param eventDate - ISO date string
 * @param eventTime - Time string (e.g., "19:00")
 * @returns Formatted string like "Today • 19:00" or "Tomorrow • 19:00" or just the time
 * @example formatEventTime("2024-01-09", "19:00") // "Today • 19:00"
 */
export function formatEventTime(eventDate: string, eventTime: string): string {
  const date = new Date(eventDate);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return `Today • ${eventTime}`;
  } else if (isTomorrow) {
    return `Tomorrow • ${eventTime}`;
  } else {
    return eventTime;
  }
}

/**
 * Gets Tailwind CSS color classes for a given event category
 * @param category - Event category name
 * @returns Object with bg, border, and text color classes
 * @example getCategoryColor("cinema") // { bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-500" }
 */
export function getCategoryColor(category: string): {
  bg: string;
  border: string;
  text: string;
} {
  const colors = {
    cinema: {
      bg: 'bg-blue-500',
      border: 'border-blue-500',
      text: 'text-blue-500',
    },
    crafts: {
      bg: 'bg-amber-500',
      border: 'border-amber-500',
      text: 'text-amber-500',
    },
    sports: {
      bg: 'bg-yellow-500',
      border: 'border-yellow-500',
      text: 'text-yellow-500',
    },
    gaming: {
      bg: 'bg-green-500',
      border: 'border-green-500',
      text: 'text-green-500',
    },
    market: {
      bg: 'bg-purple-500',
      border: 'border-purple-500',
      text: 'text-purple-500',
    },
  };

  return colors[category as keyof typeof colors] || colors.cinema;
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

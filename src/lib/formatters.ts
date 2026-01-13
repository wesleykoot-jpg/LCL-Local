/**
 * Centralized formatters for event display.
 * These functions take structured data as input and return user-friendly strings.
 */

/**
 * Structured date/time representation for events (mirrors backend type).
 */
export interface StructuredDate {
  /** ISO 8601 string for the start time, in UTC */
  utc_start: string;
  /** ISO 8601 string for the end time (optional), in UTC */
  utc_end?: string;
  /** IANA timezone identifier (e.g., 'Europe/Amsterdam') */
  timezone?: string;
  /** Whether this is an all-day event */
  all_day?: boolean;
}

/**
 * Structured location representation for events (mirrors backend type).
 */
export interface StructuredLocation {
  /** Human-readable location/venue name */
  name: string;
  /** Geographic coordinates */
  coordinates?: {
    lat: number;
    lng: number;
  };
  /** Full address if available */
  address?: string;
  /** Reference to a venue ID if stored separately */
  venue_id?: string;
}

/**
 * Formats an event date for display.
 * @param dateStr - ISO date string or event_date field
 * @param structuredDate - Optional structured date data
 * @param formatType - 'pill' for compact display (e.g., "za 18"), 'full' for complete date
 * @returns Formatted date string in Dutch locale
 */
export function formatEventDate(
  dateStr: string,
  structuredDate?: StructuredDate | null,
  formatType: 'pill' | 'full' = 'pill'
): string {
  // Use structured date if available, otherwise parse dateStr
  const dateSource = structuredDate?.utc_start || dateStr;
  
  // Extract date part (handle both ISO timestamps and date-only strings)
  const datePart = dateSource.split('T')[0].split(' ')[0];
  const eventDate = new Date(datePart + 'T00:00:00');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Check for relative dates
  if (eventDate.getTime() === today.getTime()) {
    return 'Vandaag';
  } else if (eventDate.getTime() === tomorrow.getTime()) {
    return 'Morgen';
  }
  
  // Format based on type
  if (formatType === 'pill') {
    // Short format: "za 18"
    return eventDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' });
  } else {
    // Full format: "zaterdag 18 mei"
    return eventDate.toLocaleDateString('nl-NL', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  }
}

/**
 * Formats an event time for display.
 * @param timeStr - Time string (e.g., "20:00", "TBD", "Hele dag")
 * @param structuredDate - Optional structured date data
 * @returns Formatted time string
 */
export function formatEventTime(
  timeStr: string,
  structuredDate?: StructuredDate | null
): string {
  // Check if all-day event via structured data
  if (structuredDate?.all_day) {
    return 'Hele dag';
  }
  
  if (!timeStr) return '';
  
  // Handle descriptive time strings
  const descriptiveMap: Record<string, string> = {
    'TBD': '',
    'tbd': '',
    'Hele dag': 'Hele dag',
    'hele dag': 'Hele dag',
    'all day': 'Hele dag',
    'Avond': 'Avond',
    'avond': 'Avond',
    'Middag': 'Middag',
    'middag': 'Middag',
    'Ochtend': 'Ochtend',
    'ochtend': 'Ochtend',
  };
  
  if (descriptiveMap[timeStr] !== undefined) {
    return descriptiveMap[timeStr];
  }
  
  // Format HH:MM times with leading zeros
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  return timeStr;
}

/**
 * Formats an event location for display.
 * @param venueName - Legacy venue name field
 * @param structuredLocation - Optional structured location data
 * @returns Formatted location string
 */
export function formatEventLocation(
  venueName: string,
  structuredLocation?: StructuredLocation | null
): string {
  // Prefer structured location name if available
  if (structuredLocation?.name) {
    return structuredLocation.name;
  }
  
  return venueName || 'Locatie onbekend';
}

/**
 * Gets coordinates from structured location or parses from legacy location field.
 * @param location - Legacy location field (may be POINT string)
 * @param structuredLocation - Optional structured location data
 * @returns Coordinates object or null
 */
export function getEventCoordinates(
  location: unknown,
  structuredLocation?: StructuredLocation | null
): { lat: number; lng: number } | null {
  // Prefer structured location coordinates
  if (structuredLocation?.coordinates) {
    return structuredLocation.coordinates;
  }
  
  // Parse legacy POINT format
  if (!location) return null;
  
  if (typeof location === 'string') {
    const match = location.match(/POINT\s*\(\s*([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\s*\)/i);
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
  }
  
  if (typeof location === 'object' && (location as { coordinates?: number[] }).coordinates) {
    const coords = (location as { coordinates?: number[] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: Number(coords[0]), lat: Number(coords[1]) };
    }
  }
  
  return null;
}

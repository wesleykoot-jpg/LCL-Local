/**
 * Opening Hours Transformation Utilities
 * 
 * Transforms Google Places API opening_hours format to our schema format.
 * Handles edge cases like overnight hours, 24/7 venues, and closed days.
 * 
 * @module openingHoursTransform
 */

import type { 
  OpeningHours, 
  TimeRange, 
  GoogleOpeningHours, 
  GooglePeriod 
} from './types.ts';

/**
 * Day name mapping from Google's day numbers (0=Sunday) to our lowercase names
 */
const DAY_NAMES: readonly (keyof Omit<OpeningHours, 'always_open'>)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

/**
 * Convert Google time format "HHMM" to our "HH:MM" format
 */
function formatGoogleTime(time: string): string {
  // Validate length
  if (time.length !== 4) {
    console.warn(`Invalid Google time format (wrong length): ${time}`);
    return '00:00';
  }
  
  // Validate that all characters are digits
  if (!/^\d{4}$/.test(time)) {
    console.warn(`Invalid Google time format (non-numeric): ${time}`);
    return '00:00';
  }
  
  const hours = parseInt(time.slice(0, 2), 10);
  const minutes = parseInt(time.slice(2, 4), 10);
  
  // Validate ranges
  if (hours > 23 || minutes > 59) {
    console.warn(`Invalid Google time values: ${time} (hours=${hours}, minutes=${minutes})`);
    return '00:00';
  }
  
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
}

/**
 * Check if a period spans overnight (close day !== open day)
 */
function isOvernightPeriod(period: GooglePeriod): boolean {
  if (!period.close) return false;
  return period.close.day !== period.open.day;
}

/**
 * Check if a period represents 24 hours (open 0000, no close or close 0000 next day)
 */
function is24HourPeriod(period: GooglePeriod): boolean {
  // Open at midnight with no close, or close at midnight next day
  if (period.open.time === '0000' && !period.close) {
    return true;
  }
  if (period.open.time === '0000' && period.close?.time === '0000') {
    // Same day close at midnight means actually midnight to midnight
    // Next day close at midnight means 24 hours
    return period.close.day !== period.open.day;
  }
  return false;
}

/**
 * Transform a single Google period to our TimeRange format
 */
function transformPeriodToRange(period: GooglePeriod): TimeRange {
  const open = formatGoogleTime(period.open.time);
  
  // If no close time, assume midnight (edge case)
  const close = period.close 
    ? formatGoogleTime(period.close.time) 
    : '23:59';
  
  const closes_next_day = isOvernightPeriod(period);
  
  return closes_next_day ? { open, close, closes_next_day } : { open, close };
}

/**
 * Transform Google Places API opening_hours to our schema format
 * 
 * Google's format:
 * {
 *   "opening_hours": {
 *     "open_now": true,
 *     "periods": [
 *       { "open": {"day": 1, "time": "0900"}, "close": {"day": 1, "time": "1700"} },
 *       { "open": {"day": 5, "time": "1200"}, "close": {"day": 6, "time": "0200"} }
 *     ],
 *     "weekday_text": ["Monday: 9:00 AM – 5:00 PM", ...]
 *   }
 * }
 * 
 * Our format:
 * {
 *   "monday": [{"open": "09:00", "close": "17:00"}],
 *   "friday": [{"open": "12:00", "close": "02:00", "closes_next_day": true}],
 *   ...
 * }
 * 
 * @param googleHours - Google Places API opening_hours object
 * @returns Our OpeningHours schema or null if transformation fails
 */
export function transformGoogleHoursToSchema(
  googleHours: GoogleOpeningHours | null | undefined
): OpeningHours | null {
  if (!googleHours) {
    return null;
  }

  const periods = googleHours.periods;
  
  // Handle 24/7 venues
  // Google represents 24/7 as a single period with open day=0, time=0000, no close
  if (!periods || periods.length === 0) {
    // No periods usually means 24/7 in Google's format
    return { always_open: true };
  }
  
  // Check if it's a single 24/7 period
  if (periods.length === 1 && is24HourPeriod(periods[0])) {
    return { always_open: true };
  }
  
  // Build our hours structure
  const result: OpeningHours = {};
  
  // Group periods by day
  const periodsByDay: Map<number, GooglePeriod[]> = new Map();
  
  for (const period of periods) {
    const day = period.open.day;
    if (!periodsByDay.has(day)) {
      periodsByDay.set(day, []);
    }
    periodsByDay.get(day)!.push(period);
  }
  
  // Transform each day's periods
  for (const [dayNum, dayPeriods] of periodsByDay) {
    const dayName = DAY_NAMES[dayNum];
    
    // Sort periods by open time
    const sortedPeriods = [...dayPeriods].sort((a, b) => {
      return a.open.time.localeCompare(b.open.time);
    });
    
    // Transform each period
    const ranges: TimeRange[] = sortedPeriods.map(transformPeriodToRange);
    
    result[dayName] = ranges;
  }
  
  // Mark missing days as closed (optional - we could leave them undefined)
  // For clarity, we explicitly mark them
  for (const dayName of DAY_NAMES) {
    if (!result[dayName]) {
      result[dayName] = 'closed';
    }
  }
  
  return result;
}

/**
 * Validate our OpeningHours structure
 * 
 * Checks:
 * - No overlapping time ranges for same day
 * - Close time > open time (or overnight flag set)
 * - Valid day names
 * - Valid time format HH:MM
 * 
 * @param hours - OpeningHours to validate
 * @returns true if valid, false otherwise
 */
export function validateOpeningHours(hours: OpeningHours): boolean {
  if (hours.always_open) {
    return true; // 24/7 is always valid
  }
  
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  
  for (const dayName of DAY_NAMES) {
    const dayHours = hours[dayName];
    
    // Closed or missing is valid
    if (!dayHours || dayHours === 'closed') {
      continue;
    }
    
    // Must be an array of ranges
    if (!Array.isArray(dayHours)) {
      console.warn(`Invalid day hours for ${dayName}: not an array`);
      return false;
    }
    
    for (let i = 0; i < dayHours.length; i++) {
      const range = dayHours[i];
      
      // Validate time format
      if (!timePattern.test(range.open)) {
        console.warn(`Invalid open time format for ${dayName}: ${range.open}`);
        return false;
      }
      if (!timePattern.test(range.close)) {
        console.warn(`Invalid close time format for ${dayName}: ${range.close}`);
        return false;
      }
      
      // For non-overnight hours, close must be after open
      if (!range.closes_next_day) {
        if (range.close <= range.open) {
          console.warn(`Invalid time range for ${dayName}: ${range.open}-${range.close} (close before open without overnight flag)`);
          return false;
        }
      }
      
      // Check for overlapping ranges (simple check)
      for (let j = i + 1; j < dayHours.length; j++) {
        const otherRange = dayHours[j];
        if (rangesOverlap(range, otherRange)) {
          console.warn(`Overlapping ranges for ${dayName}`);
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Check if two time ranges overlap (simple implementation)
 */
function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  // For simplicity, don't consider overnight hours in overlap check
  if (a.closes_next_day || b.closes_next_day) {
    return false; // Complex case, skip overlap check
  }
  
  const aOpen = timeToMinutes(a.open);
  const aClose = timeToMinutes(a.close);
  const bOpen = timeToMinutes(b.open);
  const bClose = timeToMinutes(b.close);
  
  // Ranges overlap if one starts before the other ends
  return aOpen < bClose && bOpen < aClose;
}

/**
 * Convert time string "HH:MM" to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Format opening hours for human-readable display
 * 
 * @param hours - OpeningHours to format
 * @returns Array of formatted strings like "Monday: 9:00 AM – 5:00 PM"
 */
export function formatOpeningHoursForDisplay(hours: OpeningHours | null): string[] {
  if (!hours) {
    return ['Hours not available'];
  }
  
  if (hours.always_open) {
    return ['Open 24/7'];
  }
  
  const result: string[] = [];
  
  for (const dayName of DAY_NAMES) {
    const dayHours = hours[dayName];
    const formattedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    
    if (!dayHours || dayHours === 'closed') {
      result.push(`${formattedDay}: Closed`);
      continue;
    }
    
    const ranges = dayHours.map(range => {
      const openFormatted = formatTime12Hour(range.open);
      const closeFormatted = formatTime12Hour(range.close);
      const overnight = range.closes_next_day ? ' (next day)' : '';
      return `${openFormatted} – ${closeFormatted}${overnight}`;
    });
    
    result.push(`${formattedDay}: ${ranges.join(', ')}`);
  }
  
  return result;
}

/**
 * Format 24-hour time to 12-hour format
 */
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Merge opening hours from multiple sources (for updates)
 * Later source takes precedence for conflicts
 */
export function mergeOpeningHours(
  existing: OpeningHours | null,
  updates: Partial<OpeningHours>
): OpeningHours {
  if (!existing) {
    return updates as OpeningHours;
  }
  
  return { ...existing, ...updates };
}

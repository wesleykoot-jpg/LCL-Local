/**
 * Opening Hours Types and Utilities
 * 
 * Handles venue opening hours in Google-like structure:
 * {
 *   "monday": ["09:00-17:00"],
 *   "friday": ["09:00-12:00", "13:00-22:00"]
 * }
 */

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type TimeRange = string; // Format: "HH:MM-HH:MM"

export type OpeningHours = Partial<Record<DayOfWeek, TimeRange[]>>;

export type TimeMode = 'fixed' | 'window' | 'anytime';

export interface OpeningStatus {
  isOpen: boolean;
  nextChange?: {
    day: string;
    time: string;
    action: 'opens' | 'closes';
  };
}

/**
 * Checks if a venue is currently open based on its opening hours
 */
export function isOpenNow(openingHours: OpeningHours | null, checkTime: Date = new Date()): boolean {
  if (!openingHours) return false;

  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[checkTime.getDay()];
  
  const hoursForDay = openingHours[dayOfWeek];
  if (!hoursForDay || hoursForDay.length === 0) return false;

  const currentTime = checkTime.getHours() * 60 + checkTime.getMinutes(); // minutes since midnight

  for (const range of hoursForDay) {
    const [openStr, closeStr] = range.split('-');
    if (!openStr || !closeStr) continue;

    const [openHour, openMin] = openStr.split(':').map(Number);
    const [closeHour, closeMin] = closeStr.split(':').map(Number);
    
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    if (currentTime >= openTime && currentTime <= closeTime) {
      return true;
    }
  }

  return false;
}

/**
 * Gets the opening status with next change information
 */
export function getOpeningStatus(
  openingHours: OpeningHours | null,
  checkTime: Date = new Date()
): OpeningStatus {
  if (!openingHours) {
    return { isOpen: false };
  }

  const isOpen = isOpenNow(openingHours, checkTime);
  
  // TODO: Implement next change logic
  // This would require checking the current day's remaining hours and next days
  
  return { isOpen };
}

/**
 * Formats opening hours for display
 * Example: "Mon-Fri 9:00-17:00, Sat 10:00-14:00"
 */
export function formatOpeningHours(openingHours: OpeningHours | null): string {
  if (!openingHours) return 'Hours not available';

  const entries = Object.entries(openingHours) as [DayOfWeek, TimeRange[]][];
  if (entries.length === 0) return 'Hours not available';

  // Group consecutive days with same hours
  const formatted = entries
    .map(([day, ranges]) => {
      const dayShort = day.substring(0, 3);
      const hoursStr = ranges.join(', ');
      return `${capitalize(dayShort)} ${hoursStr}`;
    })
    .join(', ');

  return formatted;
}

/**
 * Gets next opening time from current time
 */
export function getNextOpeningTime(
  openingHours: OpeningHours | null,
  fromTime: Date = new Date()
): { day: string; time: string } | null {
  if (!openingHours) return null;

  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayIndex = fromTime.getDay();

  // Check next 7 days
  for (let offset = 0; offset < 7; offset++) {
    const checkDayIndex = (currentDayIndex + offset) % 7;
    const dayName = dayNames[checkDayIndex];
    const hoursForDay = openingHours[dayName];

    if (hoursForDay && hoursForDay.length > 0) {
      // Return first opening time for this day
      const firstRange = hoursForDay[0];
      const openTime = firstRange.split('-')[0];
      
      return {
        day: capitalize(dayName),
        time: openTime
      };
    }
  }

  return null;
}

/**
 * Gets closing time for today if venue is open
 */
export function getClosingTimeToday(
  openingHours: OpeningHours | null,
  checkTime: Date = new Date()
): string | null {
  if (!openingHours) return null;

  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[checkTime.getDay()];
  
  const hoursForDay = openingHours[dayOfWeek];
  if (!hoursForDay || hoursForDay.length === 0) return null;

  const currentTime = checkTime.getHours() * 60 + checkTime.getMinutes();

  // Find the range we're currently in
  for (const range of hoursForDay) {
    const [openStr, closeStr] = range.split('-');
    if (!openStr || !closeStr) continue;

    const [openHour, openMin] = openStr.split(':').map(Number);
    const [closeHour, closeMin] = closeStr.split(':').map(Number);
    
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    if (currentTime >= openTime && currentTime <= closeTime) {
      return closeStr;
    }
  }

  return null;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

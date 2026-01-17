/**
 * Opening Hours Types and Utilities
 *
 * Handles venue opening hours in day-based structure:
 * {
 *   "monday": [{"open": "09:00", "close": "17:00"}],
 *   "friday": [{"open": "23:00", "close": "02:00", "closes_next_day": true}],
 *   "saturday": "closed"
 * }
 *
 * Or always open:
 * { "always_open": true }
 */

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface OpeningPeriod {
  open: string; // HH:MM
  close: string; // HH:MM
  closes_next_day?: boolean; // true for overnight ranges
}

export type DailySchedule = OpeningPeriod[] | 'closed';

export interface OpeningHours {
  always_open?: boolean;
  monday?: DailySchedule;
  tuesday?: DailySchedule;
  wednesday?: DailySchedule;
  thursday?: DailySchedule;
  friday?: DailySchedule;
  saturday?: DailySchedule;
  sunday?: DailySchedule;
}

export type TimeMode = 'fixed' | 'window' | 'anytime';

export interface OpeningStatus {
  isOpen: boolean;
  nextChange?: {
    day: string;
    time: string;
    action: 'opens' | 'closes';
  };
}

const DAY_NAMES: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function parseTimeToMinutes(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getDaySchedule(openingHours: OpeningHours, day: DayOfWeek): OpeningPeriod[] | null {
  const schedule = openingHours[day];
  if (!schedule || schedule === 'closed') return null;
  return schedule;
}

/**
 * Checks if a venue is currently open based on its opening hours
 */
export function isOpenNow(openingHours: OpeningHours | null, checkTime: Date = new Date()): boolean {
  if (!openingHours) return false;
  if (openingHours.always_open) return true;

  const dayIndex = checkTime.getDay();
  const dayOfWeek = DAY_NAMES[dayIndex];
  const currentMinutes = checkTime.getHours() * 60 + checkTime.getMinutes();

  const todaysPeriods = getDaySchedule(openingHours, dayOfWeek) ?? [];
  for (const period of todaysPeriods) {
    const openMinutes = parseTimeToMinutes(period.open);
    const closeMinutes = parseTimeToMinutes(period.close);
    if (openMinutes === null || closeMinutes === null) continue;

    if (period.closes_next_day) {
      if (currentMinutes >= openMinutes) return true;
      continue;
    }

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return true;
    }
  }

  const previousDay = DAY_NAMES[(dayIndex + 6) % 7];
  const previousPeriods = getDaySchedule(openingHours, previousDay) ?? [];
  for (const period of previousPeriods) {
    if (!period.closes_next_day) continue;
    const closeMinutes = parseTimeToMinutes(period.close);
    if (closeMinutes === null) continue;
    if (currentMinutes < closeMinutes) return true;
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
  return { isOpen };
}

/**
 * Formats opening hours for display
 * Example: "Mon 09:00-17:00, Fri 23:00-02:00 (+1 day)"
 */
export function formatOpeningHours(openingHours: OpeningHours | null): string {
  if (!openingHours) return 'Hours not available';
  if (openingHours.always_open) return 'Open 24/7';

  const entries = DAY_NAMES.map((day) => [day, openingHours[day] ?? 'closed'] as const);
  const formatted = entries
    .map(([day, schedule]) => {
      const dayShort = capitalize(day.substring(0, 3));
      if (!schedule || schedule === 'closed') {
        return `${dayShort} Closed`;
      }

      const ranges = schedule
        .map((period) => {
          const suffix = period.closes_next_day ? ' (+1 day)' : '';
          return `${period.open}-${period.close}${suffix}`;
        })
        .join(', ');

      return `${dayShort} ${ranges}`;
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
  if (openingHours.always_open) return null;

  const currentDayIndex = fromTime.getDay();
  const currentMinutes = fromTime.getHours() * 60 + fromTime.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const checkDayIndex = (currentDayIndex + offset) % 7;
    const dayName = DAY_NAMES[checkDayIndex];
    const schedule = getDaySchedule(openingHours, dayName);

    if (!schedule || schedule.length === 0) continue;

    for (const period of schedule) {
      const openMinutes = parseTimeToMinutes(period.open);
      if (openMinutes === null) continue;

      if (offset === 0 && openMinutes <= currentMinutes) {
        continue;
      }

      return {
        day: capitalize(dayName),
        time: period.open,
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
  if (openingHours.always_open) return null;

  const dayIndex = checkTime.getDay();
  const dayOfWeek = DAY_NAMES[dayIndex];
  const currentMinutes = checkTime.getHours() * 60 + checkTime.getMinutes();

  const previousDay = DAY_NAMES[(dayIndex + 6) % 7];
  const previousPeriods = getDaySchedule(openingHours, previousDay) ?? [];
  for (const period of previousPeriods) {
    if (!period.closes_next_day) continue;
    const closeMinutes = parseTimeToMinutes(period.close);
    if (closeMinutes === null) continue;
    if (currentMinutes < closeMinutes) return period.close;
  }

  const todaysPeriods = getDaySchedule(openingHours, dayOfWeek) ?? [];
  for (const period of todaysPeriods) {
    const openMinutes = parseTimeToMinutes(period.open);
    const closeMinutes = parseTimeToMinutes(period.close);
    if (openMinutes === null || closeMinutes === null) continue;

    if (period.closes_next_day) {
      if (currentMinutes >= openMinutes) return period.close;
      continue;
    }

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return period.close;
    }
  }

  return null;
}

export interface GoogleOpeningPeriod {
  open: { day: number; time: string };
  close?: { day: number; time: string };
}

export interface GoogleOpeningHours {
  periods?: GoogleOpeningPeriod[];
}

/**
 * Converts Google opening hours periods into the OpeningHours schema.
 */
export function transformGoogleHoursToSchema(googleHours: GoogleOpeningHours): OpeningHours {
  const periods = googleHours.periods ?? [];
  if (periods.length === 0) {
    return { always_open: true };
  }

  const result: OpeningHours = {
    monday: 'closed',
    tuesday: 'closed',
    wednesday: 'closed',
    thursday: 'closed',
    friday: 'closed',
    saturday: 'closed',
    sunday: 'closed',
  };

  for (const period of periods) {
    const openDay = DAY_NAMES[period.open.day];
    if (!openDay) continue;
    const openTime = formatGoogleTime(period.open.time);
    const closeTime = period.close ? formatGoogleTime(period.close.time) : null;
    if (!openTime || !closeTime) continue;

    const closesNextDay = period.close?.day !== period.open.day;

    const daySchedule = result[openDay];
    const periodsArray = Array.isArray(daySchedule) ? daySchedule : [];

    periodsArray.push({
      open: openTime,
      close: closeTime,
      ...(closesNextDay ? { closes_next_day: true } : {}),
    });

    result[openDay] = periodsArray;
  }

  return result;
}

/**
 * Validates opening hours for overlaps, time format, and day names.
 */
export function validateOpeningHours(hours: OpeningHours): boolean {
  if (hours.always_open) return true;

  for (const day of DAY_NAMES) {
    const schedule = hours[day];
    if (!schedule || schedule === 'closed') continue;

    const ranges = schedule
      .map((period) => {
        const openMinutes = parseTimeToMinutes(period.open);
        const closeMinutes = parseTimeToMinutes(period.close);
        if (openMinutes === null || closeMinutes === null) return null;

        if (!period.closes_next_day && closeMinutes <= openMinutes) {
          return null;
        }

        const endMinutes = period.closes_next_day ? closeMinutes + 24 * 60 : closeMinutes;
        return { start: openMinutes, end: endMinutes };
      })
      .filter((range): range is { start: number; end: number } => Boolean(range));

    ranges.sort((a, b) => a.start - b.start);

    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i].start < ranges[i - 1].end) {
        return false;
      }
    }
  }

  return true;
}

function formatGoogleTime(value: string): string | null {
  if (!value) return null;
  const padded = value.padStart(4, '0');
  if (!/^\d{4}$/.test(padded)) return null;
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

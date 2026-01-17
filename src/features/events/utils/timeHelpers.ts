/**
 * Time Helper Utilities
 * 
 * Date-fns wrappers and time-related utilities for the events feature.
 * Provides Dutch-localized formatting and time overlap detection.
 */

import { format, formatDistanceToNow, isToday, isTomorrow, isThisWeek, parseISO, differenceInMinutes, addHours } from 'date-fns';
import { nl } from 'date-fns/locale';

/**
 * Format date in Dutch locale
 * @example formatDate('2024-01-15') => "maandag 15 januari 2024"
 */
export function formatDate(dateString: string, formatString: string = 'EEEE d MMMM yyyy'): string {
  try {
    const date = parseISO(dateString);
    return format(date, formatString, { locale: nl });
  } catch {
    return dateString;
  }
}

/**
 * Format time in 24-hour format (Dutch standard)
 * @example formatTime('19:30') => "19:30"
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';
  
  // Already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(timeString)) {
    const [hours, minutes] = timeString.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }
  
  return timeString;
}

/**
 * Get relative time label (human-readable)
 * @example getRelativeTime('2024-01-15') => "Vandaag", "Morgen", "Zaterdag", etc.
 */
export function getRelativeTimeLabel(dateString: string): string {
  try {
    const date = parseISO(dateString);
    
    if (isToday(date)) return 'Vandaag';
    if (isTomorrow(date)) return 'Morgen';
    if (isThisWeek(date, { weekStartsOn: 1 })) {
      return format(date, 'EEEE', { locale: nl }); // Day name in Dutch
    }
    
    return format(date, 'd MMM', { locale: nl });
  } catch {
    return dateString;
  }
}

/**
 * Get relative time to now (e.g., "in 2 hours", "5 minutes ago")
 */
export function getRelativeTime(dateString: string, addSuffix: boolean = true): string {
  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix, locale: nl });
  } catch {
    return dateString;
  }
}

/**
 * Check if two events overlap in time
 * Used for conflict detection in MyPlanning
 */
export interface TimeRange {
  startTime: Date;
  endTime?: Date;
}

export function doEventsOverlap(event1: TimeRange, event2: TimeRange): boolean {
  const start1 = event1.startTime;
  const end1 = event1.endTime || addHours(start1, 2); // Default 2-hour duration if no end time
  
  const start2 = event2.startTime;
  const end2 = event2.endTime || addHours(start2, 2);
  
  // Check if ranges overlap
  return start1 < end2 && start2 < end1;
}

/**
 * Detect conflicts in a list of events
 * Returns array of event pairs that overlap
 */
export function detectConflicts(events: TimeRange[]): Array<[number, number]> {
  const conflicts: Array<[number, number]> = [];
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (doEventsOverlap(events[i], events[j])) {
        conflicts.push([i, j]);
      }
    }
  }
  
  return conflicts;
}

/**
 * Calculate duration between two times in minutes
 */
export function calculateDurationMinutes(startTime: Date, endTime?: Date): number {
  if (!endTime) return 0;
  return differenceInMinutes(endTime, startTime);
}

/**
 * Format duration as human-readable string
 * @example formatDuration(90) => "1h 30m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Check if event is happening now
 */
export function isEventLiveNow(eventDate: string, eventTime?: string, durationHours: number = 2): boolean {
  try {
    const date = parseISO(eventDate);
    
    if (eventTime && /^\d{1,2}:\d{2}$/.test(eventTime)) {
      const [hours, minutes] = eventTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    }
    
    const now = new Date();
    const endTime = addHours(date, durationHours);
    
    return now >= date && now <= endTime;
  } catch {
    return false;
  }
}

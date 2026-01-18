import { memo } from 'react';
import { Calendar, Clock, Sun } from 'lucide-react';
import type { TimeMode, OpeningHours } from '@/lib/openingHours';
import { isOpenNow, getClosingTimeToday, getNextOpeningTime } from '@/lib/openingHours';
import { isMidnightValidCategory } from '@/shared/lib/categories';

interface SmartTimeLabelProps {
  timeMode: TimeMode;
  eventTime?: string;
  eventDate?: string | null;
  openingHours?: OpeningHours | null;
  className?: string;
  /** Categories that legitimately use midnight times (e.g., nightlife parties) */
  category?: string;
  /** If true, all_day events will show "All Day" instead of a time */
  isAllDay?: boolean;
}

/**
 * Check if a time string represents midnight (00:00)
 * @param timeStr - Time string in HH:MM format
 * @returns true if time is exactly midnight
 */
export function isMidnightTime(timeStr: string | undefined | null): boolean {
  if (!timeStr) return false;
  const normalized = timeStr.trim();
  // Match 00:00, 0:00, 00:00:00
  return /^0{1,2}:00(:00)?$/.test(normalized);
}

/**
 * Determine if we should suppress showing the time
 * Returns true if time is midnight and not a valid midnight category
 */
function shouldSuppressMidnight(
  timeStr: string | undefined | null,
  category: string | undefined
): boolean {
  if (!isMidnightTime(timeStr)) return false;
  return !isMidnightValidCategory(category);
}

/**
 * SmartTimeLabel - Intelligently displays time information based on event type
 * 
 * - Fixed Event: Shows specific date/time (e.g., "Sat 12 Oct • 20:00")
 * - Window Venue: Shows open/closed status (e.g., "🟢 Open Now • Closes 22:00")
 * - Anytime: Shows availability message (e.g., "☀️ Always Open")
 * 
 * Midnight Suppression: If time is 00:00 and category is not a nightlife event,
 * the time is treated as "Time TBA" to avoid showing technical fallback values.
 */
export const SmartTimeLabel = memo(function SmartTimeLabel({
  timeMode,
  eventTime,
  eventDate,
  openingHours,
  className = '',
  category,
  isAllDay = false,
}: SmartTimeLabelProps) {
  
  // Handle all-day events first
  if (isAllDay) {
    return (
      <div className={`flex items-center gap-1.5 text-primary ${className}`}>
        <Sun size={14} className="flex-shrink-0" />
        <span className="font-semibold text-[15px]">All Day</span>
      </div>
    );
  }
  
  // Case A: Fixed Event (Concert, Movie, etc.)
  if (timeMode === 'fixed' && eventDate) {
    const date = new Date(eventDate);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayOfMonth = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    
    // Check if time should be suppressed (midnight and not a nightlife event)
    const suppressTime = shouldSuppressMidnight(eventTime, category);
    
    // Format time - show "Time TBA" if suppressed, otherwise formatted time
    const displayTime = suppressTime 
      ? 'Time TBA' 
      : (eventTime ? formatTime(eventTime) : null);
    
    return (
      <div className={`flex items-center gap-1.5 text-primary ${className}`}>
        <Calendar size={14} className="flex-shrink-0" />
        <span className="font-semibold text-[15px]">
          {dayOfWeek} {dayOfMonth} {month}{displayTime ? ` • ${displayTime}` : ''}
        </span>
      </div>
    );
  }

  // Case B: Window Venue (Restaurant, Museum, etc.)
  if (timeMode === 'window') {
    const isOpen = isOpenNow(openingHours || null);
    const closingTime = isOpen ? getClosingTimeToday(openingHours || null) : null;
    const nextOpening = !isOpen ? getNextOpeningTime(openingHours || null) : null;

    if (isOpen) {
      return (
        <div className={`flex items-center gap-1.5 ${className}`}>
          <Clock size={14} className="flex-shrink-0 text-green-500" />
          <span className="font-semibold text-[15px]">
            <span className="text-green-500">
              <span aria-label="Open">🟢</span> Open Now
            </span>
            {closingTime && (
              <span className="text-muted-foreground"> • Closes {closingTime}</span>
            )}
          </span>
        </div>
      );
    } else {
      return (
        <div className={`flex items-center gap-1.5 ${className}`}>
          <Clock size={14} className="flex-shrink-0 text-red-500" />
          <span className="font-semibold text-[15px]">
            <span className="text-red-500">
              <span aria-label="Closed">🔴</span> Closed
            </span>
            {nextOpening && (
              <span className="text-muted-foreground">
                {' '}• Opens {nextOpening.day} {nextOpening.time}
              </span>
            )}
          </span>
        </div>
      );
    }
  }

  // Case C: Anytime (Park, Monument, etc.)
  if (timeMode === 'anytime') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Sun size={14} className="flex-shrink-0 text-amber-500" />
        <span className="font-semibold text-[15px] text-amber-600 dark:text-amber-500">
          <span aria-label="Always Open">☀️</span> Always Open
        </span>
      </div>
    );
  }

  // Fallback: Show event time if available (but suppress midnight if not valid category)
  if (eventTime) {
    const suppressTime = shouldSuppressMidnight(eventTime, category);
    
    // If time should be suppressed, show "Time TBA" instead of 00:00
    if (suppressTime) {
      return (
        <div className={`flex items-center gap-1.5 text-muted-foreground ${className}`}>
          <Clock size={14} className="flex-shrink-0" />
          <span className="font-semibold text-[15px]">Time TBA</span>
        </div>
      );
    }
    
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Clock size={14} className="flex-shrink-0" />
        <span className="font-semibold text-[15px]">
          {formatTime(eventTime)}
        </span>
      </div>
    );
  }

  return null;
});

// Format time like "7:00 PM"
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  
  // Handle HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  return timeStr;
}

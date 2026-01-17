import { memo } from 'react';
import { Calendar, Clock, Sun } from 'lucide-react';
import type { TimeMode, OpeningHours } from '@/lib/openingHours';
import { isOpenNow, getClosingTimeToday, getNextOpeningTime } from '@/lib/openingHours';

interface SmartTimeLabelProps {
  timeMode: TimeMode;
  eventTime?: string;
  eventDate?: string | null;
  openingHours?: OpeningHours | null;
  className?: string;
}

/**
 * SmartTimeLabel - Intelligently displays time information based on event type
 * 
 * - Fixed Event: Shows specific date/time (e.g., "Sat 12 Oct • 20:00")
 * - Window Venue: Shows open/closed status (e.g., "🟢 Open Now • Closes 22:00")
 * - Anytime: Shows availability message (e.g., "☀️ Always Open")
 */
export const SmartTimeLabel = memo(function SmartTimeLabel({
  timeMode,
  eventTime,
  eventDate,
  openingHours,
  className = '',
}: SmartTimeLabelProps) {
  
  // Case A: Fixed Event (Concert, Movie, etc.)
  if (timeMode === 'fixed' && eventDate) {
    const date = new Date(eventDate);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayOfMonth = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    
    // Format time
    const formattedTime = formatTime(eventTime || '');
    
    return (
      <div className={`flex items-center gap-1.5 text-primary ${className}`}>
        <Calendar size={14} className="flex-shrink-0" />
        <span className="font-semibold text-[15px]">
          {dayOfWeek} {dayOfMonth} {month} • {formattedTime}
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
            <span className="text-green-500">🟢 Open Now</span>
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
            <span className="text-red-500">🔴 Closed</span>
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
          ☀️ Always Open
        </span>
      </div>
    );
  }

  // Fallback: Show event time if available
  if (eventTime) {
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

/**
 * Calendar Export Utilities
 * 
 * Generates .ics files for device calendar integration.
 * Supports both iOS and Android calendar apps.
 */

import { format } from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime?: Date;
  url?: string;
}

/**
 * Format date for iCalendar format (YYYYMMDDTHHmmss)
 */
function formatICalDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss");
}

/**
 * Escape special characters for iCalendar format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate iCalendar (.ics) file content
 */
function generateICS(event: CalendarEvent): string {
  const startDate = formatICalDate(event.startTime);
  const endDate = event.endTime 
    ? formatICalDate(event.endTime) 
    : formatICalDate(new Date(event.startTime.getTime() + 2 * 60 * 60 * 1000)); // +2 hours default
  
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LCL Local//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@lcllocal.app`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${escapeICalText(event.title)}`,
  ];
  
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }
  
  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }
  
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  
  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  );
  
  return lines.join('\r\n');
}

/**
 * Download .ics file
 */
function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export event to device calendar
 * 
 * Creates a .ics file that can be imported into:
 * - iOS Calendar
 * - Google Calendar
 * - Outlook
 * - Any calendar app supporting iCalendar format
 */
export function exportToCalendar(event: CalendarEvent): void {
  const icsContent = generateICS(event);
  const filename = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
  downloadICS(icsContent, filename);
}

/**
 * Generate Google Calendar URL
 * Opens the "Add to Google Calendar" page in a new tab
 */
export function openGoogleCalendar(event: CalendarEvent): void {
  const startDate = format(event.startTime, "yyyyMMdd'T'HHmmss");
  const endDate = event.endTime 
    ? format(event.endTime, "yyyyMMdd'T'HHmmss")
    : format(new Date(event.startTime.getTime() + 2 * 60 * 60 * 1000), "yyyyMMdd'T'HHmmss");
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startDate}/${endDate}`,
    details: event.description || '',
    location: event.location || '',
  });
  
  if (event.url) {
    params.append('sprop', `website:${event.url}`);
  }
  
  const url = `https://www.google.com/calendar/render?${params.toString()}`;
  window.open(url, '_blank');
}

/**
 * Generate Apple Calendar URL (webcal://)
 * iOS will automatically open in the Calendar app
 */
export function openAppleCalendar(event: CalendarEvent): void {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  
  // Try to open with webcal:// protocol on iOS
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.location.href = `webcal://${url.replace('blob:', '')}`;
  } else {
    // Fallback to download
    downloadICS(icsContent, `${event.title}.ics`);
  }
  
  // Clean up after a delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

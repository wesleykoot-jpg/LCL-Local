/**
 * Google Calendar Integration
 * 
 * Provides functionality to sync LCL events with Google Calendar.
 * 
 * Usage:
 * ```typescript
 * import { useGoogleCalendar, isGoogleCalendarConfigured } from '@/integrations/googleCalendar';
 * 
 * // Check if integration is available
 * if (isGoogleCalendarConfigured()) {
 *   // Use the integration
 * }
 * ```
 */

export * from './client';
export * from './service';

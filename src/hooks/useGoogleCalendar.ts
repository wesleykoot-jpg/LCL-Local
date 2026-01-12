/**
 * Hook for Google Calendar synchronization
 * 
 * Provides easy-to-use functions for syncing LCL events with Google Calendar.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/useAuth';
import {
  isGoogleCalendarConfigured,
  initiateGoogleOAuth,
  parseOAuthCallback,
  validateOAuthState,
  type GoogleCalendarEventData,
  CONFIG_CHANGE_EVENT,
} from '@/integrations/googleCalendar/client';
import {
  exchangeCodeForTokens,
  storeCalendarTokens,
  isCalendarConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  storeSyncedEvent,
  getSyncedEventId,
  deleteSyncedEvent,
  disconnectCalendar,
} from '@/integrations/googleCalendar/service';
import { parseEventDateTime, type LCLEventData } from '@/lib/utils';
import toast from 'react-hot-toast';

export interface UseGoogleCalendarResult {
  isConfigured: boolean;
  isConnected: boolean;
  isLoading: boolean;
  connectCalendar: () => void;
  disconnectCalendar: () => Promise<void>;
  syncEventToCalendar: (event: LCLEventData) => Promise<boolean>;
  updateEventInCalendar: (event: LCLEventData) => Promise<boolean>;
  removeEventFromCalendar: (eventId: string) => Promise<boolean>;
  handleOAuthCallback: () => Promise<boolean>;
}

// Re-export the type for consumers
export type { LCLEventData as LCLEvent };

/**
 * Convert LCL event to Google Calendar event format
 */
function convertToGoogleEvent(event: LCLEventData): GoogleCalendarEventData | null {
  const parsed = parseEventDateTime(event.event_date, event.event_time);
  
  if (!parsed) {
    console.error('[convertToGoogleEvent] Failed to parse event date/time');
    return null;
  }

  const { startDate, endDate } = parsed;
  
  return {
    summary: event.title,
    description: event.description || `Event from LCL Local`,
    location: event.venue_name,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }, // 1 hour before
        { method: 'popup', minutes: 1440 }, // 1 day before
      ],
    },
  };
}

/**
 * Hook to manage Google Calendar integration
 */
export function useGoogleCalendar(): UseGoogleCalendarResult {
  const { profile } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(isGoogleCalendarConfigured());
  
  const profileId = profile?.id;

  // Listen for configuration changes
  useEffect(() => {
    const handleConfigChange = () => {
      setIsConfigured(isGoogleCalendarConfigured());
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener(CONFIG_CHANGE_EVENT, handleConfigChange);
      return () => window.removeEventListener(CONFIG_CHANGE_EVENT, handleConfigChange);
    }
  }, []);

  // Check connection status on mount and when profileId changes
  useEffect(() => {
    async function checkConnection() {
      if (!profileId) {
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      try {
        const connected = await isCalendarConnected(profileId);
        setIsConnected(connected);
      } catch (error) {
        console.error('[useGoogleCalendar] Connection check error:', error);
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkConnection();
  }, [profileId]);

  // Initiate OAuth flow
  const connectCalendar = useCallback(() => {
    if (!isConfigured) {
      toast.error('Google Calendar integration is not configured');
      return;
    }

    try {
      initiateGoogleOAuth();
    } catch (error) {
      console.error('[useGoogleCalendar] OAuth initiation error:', error);
      toast.error('Failed to connect to Google Calendar');
    }
  }, [isConfigured]);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async (): Promise<boolean> => {
    if (!profileId) {
      toast.error('Please sign in to connect Google Calendar');
      return false;
    }

    const { code, error, state } = parseOAuthCallback();

    if (error) {
      toast.error(`Authorization failed: ${error}`);
      return false;
    }

    if (!code) {
      return false; // Not a callback, no error
    }

    if (state && !validateOAuthState(state)) {
      toast.error('Invalid authorization state');
      return false;
    }

    setIsLoading(true);

    try {
      const { tokens, error: tokenError } = await exchangeCodeForTokens(code);

      if (tokenError) {
        toast.error(`Failed to connect: ${tokenError}`);
        return false;
      }

      const { error: storeError } = await storeCalendarTokens(profileId, tokens);

      if (storeError) {
        toast.error(`Failed to save connection: ${storeError}`);
        return false;
      }

      setIsConnected(true);
      toast.success('Google Calendar connected successfully!');
      return true;
    } catch (error) {
      console.error('[useGoogleCalendar] Callback error:', error);
      toast.error('Failed to complete Google Calendar connection');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Disconnect calendar
  const handleDisconnect = useCallback(async (): Promise<void> => {
    if (!profileId) return;

    setIsLoading(true);
    try {
      const { error } = await disconnectCalendar(profileId);
      if (error) {
        toast.error(`Failed to disconnect: ${error}`);
        return;
      }
      setIsConnected(false);
      toast.success('Google Calendar disconnected');
    } catch (error) {
      console.error('[useGoogleCalendar] Disconnect error:', error);
      toast.error('Failed to disconnect Google Calendar');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Sync event to calendar
  const syncEventToCalendar = useCallback(async (event: LCLEventData): Promise<boolean> => {
    if (!profileId || !isConnected) {
      return false;
    }

    try {
      const googleEvent = convertToGoogleEvent(event);
      if (!googleEvent) {
        console.error('[useGoogleCalendar] Failed to convert event to Google format');
        return false;
      }
      
      const result = await createCalendarEvent(profileId, googleEvent);

      if (!result.success) {
        console.error('[useGoogleCalendar] Sync failed:', result.error);
        return false;
      }

      if (result.googleEventId) {
        await storeSyncedEvent(profileId, event.id, result.googleEventId);
      }

      return true;
    } catch (error) {
      console.error('[useGoogleCalendar] Sync error:', error);
      return false;
    }
  }, [profileId, isConnected]);

  // Update event in calendar
  const updateEventInCalendar = useCallback(async (event: LCLEventData): Promise<boolean> => {
    if (!profileId || !isConnected) {
      return false;
    }

    try {
      const googleEventId = await getSyncedEventId(profileId, event.id);
      
      if (!googleEventId) {
        // Event not synced yet, create it instead
        return syncEventToCalendar(event);
      }

      const googleEvent = convertToGoogleEvent(event);
      if (!googleEvent) {
        console.error('[useGoogleCalendar] Failed to convert event to Google format');
        return false;
      }
      
      const result = await updateCalendarEvent(profileId, googleEventId, googleEvent);

      return result.success;
    } catch (error) {
      console.error('[useGoogleCalendar] Update error:', error);
      return false;
    }
  }, [profileId, isConnected, syncEventToCalendar]);

  // Remove event from calendar
  const removeEventFromCalendar = useCallback(async (eventId: string): Promise<boolean> => {
    if (!profileId || !isConnected) {
      return false;
    }

    try {
      const googleEventId = await getSyncedEventId(profileId, eventId);
      
      if (!googleEventId) {
        return true; // Not synced, nothing to remove
      }

      const result = await deleteCalendarEvent(profileId, googleEventId);

      if (result.success) {
        await deleteSyncedEvent(profileId, eventId);
      }

      return result.success;
    } catch (error) {
      console.error('[useGoogleCalendar] Remove error:', error);
      return false;
    }
  }, [profileId, isConnected]);

  return {
    isConfigured,
    isConnected,
    isLoading,
    connectCalendar,
    disconnectCalendar: handleDisconnect,
    syncEventToCalendar,
    updateEventInCalendar,
    removeEventFromCalendar,
    handleOAuthCallback,
  };
}

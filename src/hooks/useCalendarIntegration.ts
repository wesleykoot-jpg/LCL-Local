import { useState, useEffect } from 'react';
import { 
  getCalendarIntegration, 
  disconnectCalendar,
  exchangeCodeForTokens,
  saveCalendarIntegration,
  getAuthorizationUrl
} from '@/lib/googleCalendarService';
import type { Database } from '@/integrations/supabase/types';

type CalendarIntegration = Database['public']['Tables']['calendar_integrations']['Row'];

export interface UseCalendarIntegrationResult {
  integration: CalendarIntegration | null;
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
  handleCallback: (code: string) => Promise<void>;
}

/**
 * Hook for managing Google Calendar integration
 */
export function useCalendarIntegration(profileId: string): UseCalendarIntegrationResult {
  const [integration, setIntegration] = useState<CalendarIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load integration on mount
  useEffect(() => {
    async function loadIntegration() {
      try {
        setLoading(true);
        const data = await getCalendarIntegration(profileId);
        setIntegration(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    if (profileId) {
      loadIntegration();
    }
  }, [profileId]);

  const connect = () => {
    try {
      const authUrl = getAuthorizationUrl();
      window.location.href = authUrl;
    } catch (err) {
      setError(err as Error);
    }
  };

  const disconnect = async () => {
    try {
      setLoading(true);
      const result = await disconnectCalendar(profileId);
      if (result.error) {
        throw new Error(result.error);
      }
      setIntegration(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleCallback = async (code: string) => {
    try {
      setLoading(true);
      const tokens = await exchangeCodeForTokens(code);
      const result = await saveCalendarIntegration(
        profileId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiryDate
      );

      if (result.error) {
        throw result.error;
      }

      setIntegration(result.data);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    integration,
    loading,
    error,
    isConnected: !!integration,
    connect,
    disconnect,
    handleCallback,
  };
}

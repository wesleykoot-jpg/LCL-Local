/**
 * Calendar Sync Service
 * 
 * Main service for managing calendar synchronization between LCL and external providers
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database, CalendarProvider, CalendarSyncStatus } from '@/integrations/supabase/types';
import { GoogleCalendarClient } from './googleClient';
import { MicrosoftCalendarClient } from './microsoftClient';
import type {
  CalendarAccount,
  CalendarEventData,
  CalendarProviderClient,
  OAuthConfig,
} from './types';
import { CalendarSyncError } from './types';

type UserCalendarAccount = Database['public']['Tables']['user_calendar_accounts']['Row'];
type EventCalendarMapping = Database['public']['Tables']['event_calendar_mappings']['Row'];
type Event = Database['public']['Tables']['events']['Row'];

/**
 * Simple encryption/decryption for token storage
 * In production, use proper KMS or encryption service
 */
const encryptToken = (token: string): string => {
  // Base64 encode for simple obfuscation
  // In production, use proper encryption with CALENDAR_TOKEN_ENCRYPTION_KEY
  return btoa(token);
};

const decryptToken = (encrypted: string): string => {
  return atob(encrypted);
};

/**
 * Get OAuth configuration from environment
 */
const getGoogleConfig = (): OAuthConfig => ({
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
  redirectUri: import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URL || `${window.location.origin}/calendar/callback/google`,
});

const getMicrosoftConfig = (): OAuthConfig => ({
  clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_MICROSOFT_CLIENT_SECRET || '',
  redirectUri: import.meta.env.VITE_MICROSOFT_OAUTH_REDIRECT_URL || `${window.location.origin}/calendar/callback/microsoft`,
});

/**
 * Get the appropriate calendar client for a provider
 */
const getClient = (provider: CalendarProvider): CalendarProviderClient => {
  switch (provider) {
    case 'google':
      return new GoogleCalendarClient(getGoogleConfig());
    case 'microsoft':
      return new MicrosoftCalendarClient(getMicrosoftConfig());
    default:
      throw new Error(`Unsupported calendar provider: ${provider}`);
  }
};

/**
 * Convert database row to CalendarAccount
 */
const toCalendarAccount = (row: UserCalendarAccount): CalendarAccount => ({
  id: row.id,
  userId: row.user_id,
  provider: row.provider,
  providerAccountId: row.provider_account_id,
  providerEmail: row.provider_email,
  primaryCalendarId: row.primary_calendar_id,
  accessToken: decryptToken(row.access_token_encrypted),
  refreshToken: decryptToken(row.refresh_token_encrypted),
  tokenExpiresAt: new Date(row.token_expires_at),
  syncEnabled: row.sync_enabled,
  lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
  lastSyncError: row.last_sync_error,
});

/**
 * Calendar Sync Service
 */
export const calendarSyncService = {
  /**
   * Check if calendar sync is configured (OAuth credentials available)
   */
  isConfigured(): boolean {
    const googleConfig = getGoogleConfig();
    const microsoftConfig = getMicrosoftConfig();
    return Boolean(googleConfig.clientId) || Boolean(microsoftConfig.clientId);
  },

  /**
   * Check if a specific provider is configured
   */
  isProviderConfigured(provider: CalendarProvider): boolean {
    const config = provider === 'google' ? getGoogleConfig() : getMicrosoftConfig();
    return Boolean(config.clientId);
  },

  /**
   * Get the OAuth authorization URL for a provider
   */
  getAuthorizationUrl(provider: CalendarProvider, state?: string): string {
    const client = getClient(provider);
    const config = provider === 'google' ? getGoogleConfig() : getMicrosoftConfig();
    return client.getAuthorizationUrl(config.redirectUri, state || crypto.randomUUID());
  },

  /**
   * Handle OAuth callback and save account
   */
  async handleOAuthCallback(
    provider: CalendarProvider,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const client = getClient(provider);
      const config = provider === 'google' ? getGoogleConfig() : getMicrosoftConfig();

      // Exchange code for tokens
      const tokens = await client.exchangeCodeForTokens(code, config.redirectUri);
      
      // Get user info
      const userInfo = await client.getUserInfo(tokens.accessToken);

      // Upsert calendar account
      const { error } = await supabase
        .from('user_calendar_accounts')
        .upsert({
          user_id: user.id,
          provider,
          provider_account_id: userInfo.id,
          provider_email: userInfo.email,
          access_token_encrypted: encryptToken(tokens.accessToken),
          refresh_token_encrypted: encryptToken(tokens.refreshToken),
          token_expires_at: tokens.expiresAt.toISOString(),
          sync_enabled: true,
        }, {
          onConflict: 'user_id,provider',
        });

      if (error) {
        console.error('Failed to save calendar account:', error);
        return { success: false, error: 'Failed to save calendar connection' };
      }

      return { success: true };
    } catch (err) {
      console.error('OAuth callback error:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to connect calendar' 
      };
    }
  },

  /**
   * Disconnect a calendar account
   */
  async disconnectAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get account to revoke tokens
      const { data: account, error: fetchError } = await supabase
        .from('user_calendar_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (fetchError || !account) {
        return { success: false, error: 'Account not found' };
      }

      // Try to revoke tokens (best effort)
      try {
        const client = getClient(account.provider);
        await client.revokeTokens(decryptToken(account.access_token_encrypted));
      } catch {
        // Ignore revoke errors
      }

      // Delete mappings first (due to foreign key)
      await supabase
        .from('event_calendar_mappings')
        .delete()
        .eq('calendar_account_id', accountId);

      // Delete account
      const { error } = await supabase
        .from('user_calendar_accounts')
        .delete()
        .eq('id', accountId);

      if (error) {
        return { success: false, error: 'Failed to disconnect account' };
      }

      return { success: true };
    } catch (err) {
      console.error('Disconnect error:', err);
      return { success: false, error: 'Failed to disconnect account' };
    }
  },

  /**
   * Get all connected calendar accounts for the current user
   */
  async getAccounts(): Promise<{ 
    accounts: Omit<CalendarAccount, 'accessToken' | 'refreshToken'>[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('user_calendar_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { accounts: [], error: 'Failed to fetch accounts' };
      }

      // Return accounts without sensitive token data
      const accounts = (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        providerAccountId: row.provider_account_id,
        providerEmail: row.provider_email,
        primaryCalendarId: row.primary_calendar_id,
        tokenExpiresAt: new Date(row.token_expires_at),
        syncEnabled: row.sync_enabled,
        lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
        lastSyncError: row.last_sync_error,
      }));

      return { accounts };
    } catch {
      return { accounts: [], error: 'Failed to fetch accounts' };
    }
  },

  /**
   * Toggle sync enabled for an account
   */
  async toggleSync(accountId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('user_calendar_accounts')
      .update({ sync_enabled: enabled })
      .eq('id', accountId);

    if (error) {
      return { success: false, error: 'Failed to update sync setting' };
    }

    return { success: true };
  },

  /**
   * Create calendar events for a user joining an LCL event
   */
  async syncEventJoin(
    eventId: string,
    userId: string,
    event: Event
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Get all enabled calendar accounts for the user
      const { data: accounts, error: accountsError } = await supabase
        .from('user_calendar_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('sync_enabled', true);

      if (accountsError || !accounts || accounts.length === 0) {
        // No calendar accounts, nothing to sync
        return { success: true, errors: [] };
      }

      // Prepare event data
      const eventData = this.buildEventData(event);

      // Create calendar events for each account
      for (const accountRow of accounts) {
        try {
          const account = toCalendarAccount(accountRow);
          await this.createCalendarEvent(account, eventId, eventData);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${accountRow.provider}: ${errorMsg}`);
          
          // Update account with error
          await supabase
            .from('user_calendar_accounts')
            .update({ 
              last_sync_error: errorMsg,
              sync_enabled: err instanceof CalendarSyncError && err.code === 'TOKEN_REVOKED' ? false : true,
            })
            .eq('id', accountRow.id);
        }
      }

      return { success: errors.length === 0, errors };
    } catch (err) {
      console.error('Sync event join error:', err);
      return { success: false, errors: ['Failed to sync calendar'] };
    }
  },

  /**
   * Update calendar events when an LCL event is updated
   */
  async syncEventUpdate(
    eventId: string,
    event: Event
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Get all mappings for this event
      const { data: mappings, error: mappingsError } = await supabase
        .from('event_calendar_mappings')
        .select('*, user_calendar_accounts(*)')
        .eq('event_id', eventId)
        .eq('status', 'synced');

      if (mappingsError || !mappings || mappings.length === 0) {
        return { success: true, errors: [] };
      }

      const eventData = this.buildEventData(event);

      for (const mapping of mappings) {
        try {
          const accountData = mapping.user_calendar_accounts;
          if (!accountData || !Array.isArray(accountData) || accountData.length === 0) {
            continue;
          }
          
          const account = toCalendarAccount(accountData[0] as UserCalendarAccount);
          await this.updateCalendarEvent(account, mapping as EventCalendarMapping, eventData);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Mapping ${mapping.id}: ${errorMsg}`);
        }
      }

      return { success: errors.length === 0, errors };
    } catch (err) {
      console.error('Sync event update error:', err);
      return { success: false, errors: ['Failed to sync calendar updates'] };
    }
  },

  /**
   * Delete/cancel calendar events when a user leaves an LCL event
   */
  async syncEventLeave(
    eventId: string,
    userId: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Get all mappings for this user and event
      const { data: mappings, error: mappingsError } = await supabase
        .from('event_calendar_mappings')
        .select('*, user_calendar_accounts(*)')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .neq('status', 'canceled');

      if (mappingsError || !mappings || mappings.length === 0) {
        return { success: true, errors: [] };
      }

      for (const mapping of mappings) {
        try {
          const accountData = mapping.user_calendar_accounts;
          if (!accountData || !Array.isArray(accountData) || accountData.length === 0) {
            continue;
          }

          const account = toCalendarAccount(accountData[0] as UserCalendarAccount);
          await this.deleteCalendarEvent(account, mapping as EventCalendarMapping);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Mapping ${mapping.id}: ${errorMsg}`);
        }
      }

      return { success: errors.length === 0, errors };
    } catch (err) {
      console.error('Sync event leave error:', err);
      return { success: false, errors: ['Failed to sync calendar deletion'] };
    }
  },

  /**
   * Build CalendarEventData from an LCL event
   */
  buildEventData(event: Event): CalendarEventData {
    const startTime = new Date(event.event_date);
    // Default to 2 hour duration if no end time specified
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    return {
      title: event.title,
      description: event.description || '',
      location: event.venue_name,
      startTime,
      endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lclEventId: event.id,
      lclEventUrl: `${window.location.origin}/events/${event.id}`,
    };
  },

  /**
   * Create a calendar event in a provider
   */
  async createCalendarEvent(
    account: CalendarAccount,
    eventId: string,
    eventData: CalendarEventData
  ): Promise<void> {
    const client = getClient(account.provider);

    // Refresh token if needed
    const refreshedAccount = await this.refreshTokenIfNeeded(account);

    // Create the event
    const result = await client.createEvent(refreshedAccount, eventData);

    // Save mapping
    await supabase
      .from('event_calendar_mappings')
      .insert({
        event_id: eventId,
        user_id: account.userId,
        calendar_account_id: account.id,
        provider: account.provider,
        provider_event_id: result.providerEventId,
        provider_event_etag: result.etag || null,
        lcl_external_id: `lcl:${eventId}`,
        status: 'synced' as CalendarSyncStatus,
        last_synced_at: new Date().toISOString(),
      });

    // Update account last sync
    await supabase
      .from('user_calendar_accounts')
      .update({ 
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq('id', account.id);
  },

  /**
   * Update a calendar event in a provider
   */
  async updateCalendarEvent(
    account: CalendarAccount,
    mapping: EventCalendarMapping,
    eventData: CalendarEventData
  ): Promise<void> {
    const client = getClient(account.provider);

    // Refresh token if needed
    const refreshedAccount = await this.refreshTokenIfNeeded(account);

    try {
      // Update the event
      const result = await client.updateEvent(
        refreshedAccount,
        mapping.provider_event_id,
        eventData,
        mapping.provider_event_etag || undefined
      );

      // Update mapping
      await supabase
        .from('event_calendar_mappings')
        .update({
          provider_event_etag: result.etag || null,
          last_synced_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('id', mapping.id);
    } catch (err) {
      if (err instanceof CalendarSyncError && err.code === 'EVENT_NOT_FOUND') {
        // Event was deleted externally, recreate it
        const result = await client.createEvent(refreshedAccount, eventData);
        
        await supabase
          .from('event_calendar_mappings')
          .update({
            provider_event_id: result.providerEventId,
            provider_event_etag: result.etag || null,
            last_synced_at: new Date().toISOString(),
            sync_error: null,
          })
          .eq('id', mapping.id);
      } else {
        throw err;
      }
    }
  },

  /**
   * Delete a calendar event from a provider
   */
  async deleteCalendarEvent(
    account: CalendarAccount,
    mapping: EventCalendarMapping
  ): Promise<void> {
    const client = getClient(account.provider);

    // Refresh token if needed
    const refreshedAccount = await this.refreshTokenIfNeeded(account);

    try {
      await client.deleteEvent(refreshedAccount, mapping.provider_event_id);
    } catch (err) {
      // Ignore "not found" errors - event was already deleted
      if (!(err instanceof CalendarSyncError && err.code === 'EVENT_NOT_FOUND')) {
        throw err;
      }
    }

    // Update mapping status
    await supabase
      .from('event_calendar_mappings')
      .update({
        status: 'canceled' as CalendarSyncStatus,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', mapping.id);
  },

  /**
   * Refresh access token if it's expired or about to expire
   */
  async refreshTokenIfNeeded(account: CalendarAccount): Promise<CalendarAccount> {
    // Refresh if token expires in less than 5 minutes
    const expiresIn = account.tokenExpiresAt.getTime() - Date.now();
    if (expiresIn > 5 * 60 * 1000) {
      return account;
    }

    const client = getClient(account.provider);
    const tokens = await client.refreshAccessToken(account.refreshToken);

    // Update stored tokens
    await supabase
      .from('user_calendar_accounts')
      .update({
        access_token_encrypted: encryptToken(tokens.accessToken),
        refresh_token_encrypted: encryptToken(tokens.refreshToken),
        token_expires_at: tokens.expiresAt.toISOString(),
      })
      .eq('id', account.id);

    return {
      ...account,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    };
  },

  /**
   * Get sync status for an event and user
   */
  async getEventSyncStatus(eventId: string, userId: string): Promise<{
    synced: boolean;
    providers: { provider: CalendarProvider; status: CalendarSyncStatus }[];
  }> {
    const { data: mappings } = await supabase
      .from('event_calendar_mappings')
      .select('provider, status')
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (!mappings || mappings.length === 0) {
      return { synced: false, providers: [] };
    }

    return {
      synced: mappings.some(m => m.status === 'synced'),
      providers: mappings.map(m => ({
        provider: m.provider,
        status: m.status,
      })),
    };
  },
};

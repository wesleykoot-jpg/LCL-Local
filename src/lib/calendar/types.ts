/**
 * Calendar Sync Types
 * 
 * Types and interfaces for Google Calendar and Microsoft Outlook calendar sync
 */

import type { CalendarProvider, CalendarSyncStatus } from '@/integrations/supabase/types';

// Re-export for convenience
export type { CalendarProvider, CalendarSyncStatus };

/**
 * OAuth token data returned from providers
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType?: string;
  scope?: string;
}

/**
 * User info from OAuth provider
 */
export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
}

/**
 * Calendar account as stored in the database (with decrypted tokens)
 */
export interface CalendarAccount {
  id: string;
  userId: string;
  provider: CalendarProvider;
  providerAccountId: string;
  providerEmail: string | null;
  primaryCalendarId: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
}

/**
 * Calendar event data for creating/updating provider events
 */
export interface CalendarEventData {
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  lclEventId: string;
  lclEventUrl: string;
}

/**
 * Result from creating/updating a calendar event
 */
export interface CalendarEventResult {
  providerEventId: string;
  etag?: string;
  htmlLink?: string;
}

/**
 * Calendar sync job data
 */
export interface CalendarSyncJob {
  type: 'create' | 'update' | 'delete';
  eventId: string;
  userId: string;
  calendarAccountId: string;
  eventData?: CalendarEventData;
}

/**
 * Interface for calendar provider clients
 */
export interface CalendarProviderClient {
  /**
   * Create a new calendar event
   */
  createEvent(
    account: CalendarAccount,
    eventData: CalendarEventData
  ): Promise<CalendarEventResult>;

  /**
   * Update an existing calendar event
   */
  updateEvent(
    account: CalendarAccount,
    providerEventId: string,
    eventData: CalendarEventData,
    etag?: string
  ): Promise<CalendarEventResult>;

  /**
   * Delete/cancel a calendar event
   */
  deleteEvent(
    account: CalendarAccount,
    providerEventId: string
  ): Promise<void>;

  /**
   * Refresh the access token if expired
   */
  refreshAccessToken(
    refreshToken: string
  ): Promise<OAuthTokens>;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokens>;

  /**
   * Get user info from the provider
   */
  getUserInfo(
    accessToken: string
  ): Promise<OAuthUserInfo>;

  /**
   * Revoke the tokens (on disconnect)
   */
  revokeTokens(
    accessToken: string
  ): Promise<void>;

  /**
   * Get the OAuth authorization URL
   */
  getAuthorizationUrl(
    redirectUri: string,
    state: string
  ): string;
}

/**
 * OAuth configuration for a provider
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Google-specific OAuth scopes
 */
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
];

/**
 * Microsoft-specific OAuth scopes
 */
export const MICROSOFT_OAUTH_SCOPES = [
  'Calendars.ReadWrite',
  'User.Read',
  'offline_access',
  'openid',
  'profile',
  'email',
];

/**
 * Error types for calendar sync operations
 */
export class CalendarSyncError extends Error {
  constructor(
    message: string,
    public readonly code: CalendarErrorCode,
    public readonly provider: CalendarProvider,
    public readonly isRetryable: boolean = false,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'CalendarSyncError';
  }
}

export type CalendarErrorCode =
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'EVENT_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INVALID_REQUEST'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

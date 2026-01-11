/**
 * Google Calendar Client
 * 
 * Client for interacting with Google Calendar API
 */

import type {
  CalendarProviderClient,
  CalendarAccount,
  CalendarEventData,
  CalendarEventResult,
  OAuthTokens,
  OAuthUserInfo,
  OAuthConfig,
} from './types';
import { CalendarSyncError, GOOGLE_OAUTH_SCOPES } from './types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export class GoogleCalendarClient implements CalendarProviderClient {
  constructor(private config: OAuthConfig) {}

  /**
   * Get the OAuth authorization URL for Google
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_OAUTH_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new CalendarSyncError(
        `Failed to exchange code for tokens: ${error}`,
        'INVALID_REQUEST',
        'google',
        false
      );
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 400 || response.status === 401) {
        throw new CalendarSyncError(
          'Refresh token has been revoked',
          'TOKEN_REVOKED',
          'google',
          false
        );
      }
      
      throw new CalendarSyncError(
        `Failed to refresh token: ${error}`,
        'UNKNOWN',
        'google',
        true
      );
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new CalendarSyncError(
        'Failed to get user info',
        'INVALID_REQUEST',
        'google',
        false
      );
    }

    const data = await response.json();
    
    return {
      id: data.id,
      email: data.email,
      name: data.name,
    };
  }

  /**
   * Create a calendar event in Google Calendar
   */
  async createEvent(
    account: CalendarAccount,
    eventData: CalendarEventData
  ): Promise<CalendarEventResult> {
    const calendarId = account.primaryCalendarId || 'primary';
    
    const event = this.buildGoogleEvent(eventData);

    const response = await this.makeCalendarRequest(
      account,
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify(event),
      }
    );

    return {
      providerEventId: response.id,
      etag: response.etag,
      htmlLink: response.htmlLink,
    };
  }

  /**
   * Update a calendar event in Google Calendar
   */
  async updateEvent(
    account: CalendarAccount,
    providerEventId: string,
    eventData: CalendarEventData,
    etag?: string
  ): Promise<CalendarEventResult> {
    const calendarId = account.primaryCalendarId || 'primary';
    
    const event = this.buildGoogleEvent(eventData);

    const headers: Record<string, string> = {};
    if (etag) {
      headers['If-Match'] = etag;
    }

    const response = await this.makeCalendarRequest(
      account,
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(providerEventId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(event),
      }
    );

    return {
      providerEventId: response.id,
      etag: response.etag,
      htmlLink: response.htmlLink,
    };
  }

  /**
   * Delete a calendar event from Google Calendar
   */
  async deleteEvent(
    account: CalendarAccount,
    providerEventId: string
  ): Promise<void> {
    const calendarId = account.primaryCalendarId || 'primary';

    await this.makeCalendarRequest(
      account,
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(providerEventId)}`,
      {
        method: 'DELETE',
      },
      false
    );
  }

  /**
   * Revoke tokens on disconnect
   */
  async revokeTokens(accessToken: string): Promise<void> {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${accessToken}`, {
        method: 'POST',
      });
    } catch {
      // Ignore revoke errors - best effort
    }
  }

  /**
   * Build a Google Calendar event object
   */
  private buildGoogleEvent(eventData: CalendarEventData): Record<string, unknown> {
    return {
      summary: eventData.title,
      description: `${eventData.description}\n\n---\nView event in LCL: ${eventData.lclEventUrl}`,
      location: eventData.location,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timeZone,
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: eventData.timeZone,
      },
      extendedProperties: {
        private: {
          lclEventId: eventData.lclEventId,
        },
      },
    };
  }

  /**
   * Make an authenticated request to Google Calendar API
   */
  private async makeCalendarRequest(
    account: CalendarAccount,
    url: string,
    options: RequestInit,
    expectJson: boolean = true
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    if (!expectJson || response.status === 204) {
      return {};
    }

    return response.json();
  }

  /**
   * Handle API errors and throw appropriate CalendarSyncError
   */
  private async handleApiError(response: Response): Promise<never> {
    const errorText = await response.text();
    
    switch (response.status) {
      case 401:
        throw new CalendarSyncError(
          'Access token expired',
          'TOKEN_EXPIRED',
          'google',
          true
        );
      case 403:
        throw new CalendarSyncError(
          'Access denied - token may be revoked',
          'TOKEN_REVOKED',
          'google',
          false
        );
      case 404:
        throw new CalendarSyncError(
          'Calendar event not found',
          'EVENT_NOT_FOUND',
          'google',
          false
        );
      case 409:
      case 412:
        throw new CalendarSyncError(
          'Calendar event conflict',
          'CONFLICT',
          'google',
          true
        );
      case 429:
        throw new CalendarSyncError(
          'Rate limited by Google Calendar API',
          'RATE_LIMITED',
          'google',
          true
        );
      default:
        throw new CalendarSyncError(
          `Google Calendar API error: ${errorText}`,
          'UNKNOWN',
          'google',
          response.status >= 500
        );
    }
  }
}

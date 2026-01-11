/**
 * Microsoft Calendar Client
 * 
 * Client for interacting with Microsoft Graph Calendar API
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
import { CalendarSyncError, MICROSOFT_OAUTH_SCOPES } from './types';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_GRAPH_API = 'https://graph.microsoft.com/v1.0';

export class MicrosoftCalendarClient implements CalendarProviderClient {
  constructor(private config: OAuthConfig) {}

  /**
   * Get the OAuth authorization URL for Microsoft
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: MICROSOFT_OAUTH_SCOPES.join(' '),
      response_mode: 'query',
      prompt: 'consent',
      state,
    });

    return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(MICROSOFT_TOKEN_URL, {
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
        scope: MICROSOFT_OAUTH_SCOPES.join(' '),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new CalendarSyncError(
        `Failed to exchange code for tokens: ${error}`,
        'INVALID_REQUEST',
        'microsoft',
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
    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: MICROSOFT_OAUTH_SCOPES.join(' '),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 400 || response.status === 401) {
        throw new CalendarSyncError(
          'Refresh token has been revoked',
          'TOKEN_REVOKED',
          'microsoft',
          false
        );
      }
      
      throw new CalendarSyncError(
        `Failed to refresh token: ${error}`,
        'UNKNOWN',
        'microsoft',
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
   * Get user info from Microsoft Graph
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(`${MICROSOFT_GRAPH_API}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new CalendarSyncError(
        'Failed to get user info',
        'INVALID_REQUEST',
        'microsoft',
        false
      );
    }

    const data = await response.json();
    
    return {
      id: data.id,
      email: data.mail || data.userPrincipalName,
      name: data.displayName,
    };
  }

  /**
   * Create a calendar event in Microsoft Calendar
   */
  async createEvent(
    account: CalendarAccount,
    eventData: CalendarEventData
  ): Promise<CalendarEventResult> {
    const calendarId = account.primaryCalendarId || 'primary';
    const endpoint = calendarId === 'primary'
      ? `${MICROSOFT_GRAPH_API}/me/calendar/events`
      : `${MICROSOFT_GRAPH_API}/me/calendars/${calendarId}/events`;
    
    const event = this.buildMicrosoftEvent(eventData);

    const response = await this.makeGraphRequest(
      account,
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(event),
      }
    );

    return {
      providerEventId: response.id as string,
      etag: response['@odata.etag'] as string | undefined,
      htmlLink: response.webLink as string | undefined,
    };
  }

  /**
   * Update a calendar event in Microsoft Calendar
   */
  async updateEvent(
    account: CalendarAccount,
    providerEventId: string,
    eventData: CalendarEventData,
    etag?: string
  ): Promise<CalendarEventResult> {
    const event = this.buildMicrosoftEvent(eventData);

    const headers: Record<string, string> = {};
    if (etag) {
      headers['If-Match'] = etag;
    }

    const response = await this.makeGraphRequest(
      account,
      `${MICROSOFT_GRAPH_API}/me/events/${providerEventId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(event),
      }
    );

    return {
      providerEventId: response.id as string,
      etag: response['@odata.etag'] as string | undefined,
      htmlLink: response.webLink as string | undefined,
    };
  }

  /**
   * Delete a calendar event from Microsoft Calendar
   */
  async deleteEvent(
    account: CalendarAccount,
    providerEventId: string
  ): Promise<void> {
    await this.makeGraphRequest(
      account,
      `${MICROSOFT_GRAPH_API}/me/events/${providerEventId}`,
      {
        method: 'DELETE',
      },
      false
    );
  }

  /**
   * Revoke tokens on disconnect
   * Note: Microsoft doesn't have a simple token revocation endpoint
   * Users need to revoke access from their Microsoft account settings
   */
  async revokeTokens(_accessToken: string): Promise<void> {
    // Microsoft Graph API doesn't have a token revocation endpoint
    // The app access can be revoked from https://account.live.com/consent/Manage
  }

  /**
   * Build a Microsoft Graph Calendar event object
   * 
   * Microsoft Graph API expects dateTime in local time format (without timezone suffix)
   * along with a separate timeZone field. We convert UTC to the target timezone.
   */
  private buildMicrosoftEvent(eventData: CalendarEventData): Record<string, unknown> {
    // Format datetime for Microsoft Graph API
    // The API expects: "2024-01-15T14:30:00" (no Z suffix) with timeZone specified separately
    const formatForMicrosoft = (date: Date): string => {
      // Create a formatter for the target timezone
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: eventData.timeZone,
      };
      
      const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
      const values: Record<string, string> = {};
      parts.forEach(({ type, value }) => {
        values[type] = value;
      });
      
      return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
    };

    return {
      subject: eventData.title,
      body: {
        contentType: 'text',
        content: `${eventData.description}\n\n---\nView event in LCL: ${eventData.lclEventUrl}`,
      },
      location: {
        displayName: eventData.location,
      },
      start: {
        dateTime: formatForMicrosoft(eventData.startTime),
        timeZone: eventData.timeZone,
      },
      end: {
        dateTime: formatForMicrosoft(eventData.endTime),
        timeZone: eventData.timeZone,
      },
      singleValueExtendedProperties: [
        {
          id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name lclEventId',
          value: eventData.lclEventId,
        },
      ],
    };
  }

  /**
   * Make an authenticated request to Microsoft Graph API
   */
  private async makeGraphRequest(
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
          'microsoft',
          true
        );
      case 403:
        throw new CalendarSyncError(
          'Access denied - token may be revoked',
          'TOKEN_REVOKED',
          'microsoft',
          false
        );
      case 404:
        throw new CalendarSyncError(
          'Calendar event not found',
          'EVENT_NOT_FOUND',
          'microsoft',
          false
        );
      case 409:
      case 412:
        throw new CalendarSyncError(
          'Calendar event conflict',
          'CONFLICT',
          'microsoft',
          true
        );
      case 429:
        throw new CalendarSyncError(
          'Rate limited by Microsoft Graph API',
          'RATE_LIMITED',
          'microsoft',
          true
        );
      default:
        throw new CalendarSyncError(
          `Microsoft Graph API error: ${errorText}`,
          'UNKNOWN',
          'microsoft',
          response.status >= 500
        );
    }
  }
}

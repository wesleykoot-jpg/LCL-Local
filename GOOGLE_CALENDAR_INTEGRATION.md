# Google Calendar Integration

This document explains how the Google Calendar integration works and how to set it up.

## Overview

The Google Calendar integration allows users to automatically sync their LCL events with Google Calendar. When a user joins an event, it's automatically added to their Google Calendar. Updates to the event are reflected in the calendar, and when a user leaves an event, it's removed from their calendar.

## Features

- **Automatic Sync**: Events are automatically synced when users join them
- **Real-time Updates**: Changes to event details are pushed to Google Calendar
- **Bidirectional**: Updates from joined events can be handled (foundation for future enhancements)
- **Secure**: OAuth 2.0 authentication with token refresh
- **Privacy-focused**: Users control what's synced

## Architecture

### Database Schema

Two new tables support the calendar integration:

1. **calendar_integrations**: Stores user's calendar connection settings
   - OAuth tokens (access & refresh)
   - Token expiry tracking
   - Sync preferences
   - Provider (google, outlook, apple - future)

2. **calendar_event_mappings**: Maps LCL events to external calendar events
   - Links local event IDs to Google Calendar event IDs
   - Tracks sync status
   - Stores error messages for troubleshooting

### Service Layer

**googleCalendarService.ts**: Core integration service
- Browser-compatible REST API implementation
- OAuth flow management using fetch API
- Token refresh handling
- CRUD operations for calendar events
- Event format conversion
- No Node.js dependencies - works entirely in the browser

**Technical Implementation Note**: The service uses browser-native `fetch()` API to make direct REST API calls to Google Calendar API v3. This approach avoids Node.js-specific dependencies like the `googleapis` npm package, making the code fully compatible with browser environments and Vite bundling.

**eventService.ts**: Updated to trigger calendar sync
- Syncs events when users join (status: 'going')
- Removes events when users leave
- Non-blocking: calendar sync failures don't block event actions

### UI Components

**CalendarSettings**: Settings panel in Profile
- Connect/disconnect Google Calendar
- View sync status
- Display last sync time

**CalendarCallback**: OAuth redirect handler
- Processes authorization code
- Saves tokens
- Redirects to profile

**CalendarSyncBadge**: Visual indicator component
- Shows when an event is synced to calendar
- Displays on event cards
- Updates in real-time

## Setup Instructions

⚠️ **IMPORTANT SECURITY NOTE**: The current implementation includes the client secret in frontend code for simplicity. This is suitable for development and testing but **NOT recommended for production**. See `SECURITY_CALENDAR.md` for production-ready implementation using backend proxy or PKCE flow.

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - Development: `http://localhost:5173/calendar/callback`
     - Production: `https://yourdomain.com/calendar/callback`
   - Save the Client ID and Client Secret

### 2. Environment Configuration

Add the following to your `.env` file:

```bash
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
VITE_GOOGLE_CLIENT_SECRET="your-client-secret"
```

### 3. Database Migration

Run the migration to add the calendar integration tables:

```bash
# Apply the migration in Supabase
# Navigate to SQL Editor and run:
supabase/migrations/20260112_add_calendar_integration.sql
```

Or copy the SQL from the migration file and run it in your Supabase SQL editor.

### 4. Update Database Types

The database types have been updated to include the new tables. Run:

```bash
npm run dev
```

The TypeScript types should be automatically recognized.

## Usage

### For Users

1. **Connect Calendar**:
   - Go to Profile page
   - Find the "Calendar Integration" section
   - Click "Connect Google Calendar"
   - Authorize the application
   - You'll be redirected back to your profile

2. **Auto-Sync Events**:
   - Join any event with status "Going"
   - The event automatically appears in Google Calendar
   - Updates to the event sync automatically
   - Leave an event to remove it from your calendar

3. **Disconnect Calendar**:
   - Go to Profile page
   - Click "Disconnect Google Calendar"
   - All synced events remain in Google Calendar but won't update

### For Developers

**Check if user has calendar connected**:
```typescript
import { getCalendarIntegration } from '@/lib/googleCalendarService';

const integration = await getCalendarIntegration(profileId);
if (integration?.sync_enabled) {
  // User has calendar connected
}
```

**Manually sync an event**:
```typescript
import { createCalendarEvent } from '@/lib/googleCalendarService';

const result = await createCalendarEvent(profileId, event);
if (result.success) {
  console.log('Event synced:', result.externalEventId);
}
```

**Update a synced event**:
```typescript
import { updateCalendarEvent } from '@/lib/googleCalendarService';

const result = await updateCalendarEvent(profileId, event);
```

**Remove from calendar**:
```typescript
import { deleteCalendarEvent } from '@/lib/googleCalendarService';

const result = await deleteCalendarEvent(profileId, eventId);
```

## How It Works

### OAuth Flow

1. User clicks "Connect Google Calendar"
2. Redirected to Google's OAuth consent screen
3. User authorizes the application
4. Google redirects back with authorization code
5. App exchanges code for access & refresh tokens
6. Tokens stored securely in database

### Event Sync Flow

1. User joins an event (status: 'going')
2. `joinEvent()` checks for calendar integration
3. If enabled, fetches full event details
4. Converts event to Google Calendar format
5. Creates event via Google Calendar API
6. Stores mapping in `calendar_event_mappings`

### Token Refresh

- Access tokens expire after ~1 hour
- Service automatically checks token expiry
- Refreshes token if needed (< 5 minutes remaining)
- Updates stored token in database
- Seamless to the user

## Future Enhancements

### Webhook Support (Planned)

To handle updates from Google Calendar:

1. Set up webhook endpoint
2. Register watch notification with Google Calendar API
3. Process incoming notifications
4. Update local events accordingly

### Outlook & Apple Calendar (Planned)

The architecture supports multiple providers:
- Provider field in `calendar_integrations`
- Abstracted service interface
- Can add new providers without changing core logic

### Two-way Sync (Planned)

Currently one-way (LCL → Google Calendar). Future:
- User creates event in Google Calendar
- Webhook notifies LCL
- Event created/suggested in LCL

## Troubleshooting

### "No access token available"

- User needs to reconnect their calendar
- Refresh token may have expired or been revoked

### "Failed to create calendar event"

- Check `calendar_event_mappings.error_message` for details
- Verify Google Calendar API is enabled
- Check token hasn't been revoked

### OAuth redirect not working

- Verify redirect URI in Google Console matches exactly
- Include port number for localhost
- Use HTTPS in production

### Events not syncing

- Check `calendar_integrations.sync_enabled` is true
- Verify user joined event with status 'going'
- Check browser console for errors
- Review Supabase logs

## Security Considerations

1. **Token Storage**: 
   - Tokens stored in Supabase with RLS policies
   - Only user can access their own tokens

2. **Scopes**: 
   - Minimal scope: only calendar.events
   - Can't access user's email or other Google data

3. **Refresh Tokens**:
   - Securely stored and encrypted at rest
   - Used to obtain new access tokens

4. **User Control**:
   - Users can disconnect anytime
   - Disconnecting removes all tokens
   - Events remain in calendar but won't update

## API Reference

See the following files for detailed API:
- `src/lib/googleCalendarService.ts` - Core service
- `src/hooks/useCalendarIntegration.ts` - React hook
- `src/lib/eventService.ts` - Event service with calendar sync

## Testing

To test the integration:

1. Set up development environment with credentials
2. Start development server: `npm run dev`
3. Navigate to Profile page
4. Click "Connect Google Calendar"
5. Authorize the application
6. Join an event
7. Check your Google Calendar to verify sync

## Support

For issues or questions:
- Check troubleshooting section above
- Review browser console for errors
- Check Supabase logs for backend issues
- Ensure all environment variables are set correctly

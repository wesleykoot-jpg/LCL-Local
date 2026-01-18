# Google Calendar Self-Service Configuration - Testing Guide

## Overview
This implementation allows users to configure their own Google Calendar integration without administrator intervention. Users can provide their own Google Client ID through a friendly UI dialog.

## What Changed

### 1. **Client Configuration (src/integrations/googleCalendar/client.ts)**
Added localStorage-based user configuration with these new functions:
- `getUserProvidedClientId()` - Retrieves user's Client ID from localStorage
- `setUserProvidedClientId(clientId)` - Stores user's Client ID in localStorage  
- `clearUserProvidedClientId()` - Removes user's Client ID from localStorage
- Updated `getGoogleClientId()` - Now checks user config first, then falls back to environment variable

**Priority**: User-provided Client ID > Environment variable `VITE_GOOGLE_CLIENT_ID`

### 2. **Setup Dialog (src/components/GoogleCalendarSetupDialog.tsx)**
New component that provides:
- Step-by-step instructions for creating a Google Cloud project
- Guidance on enabling Google Calendar API
- Instructions for creating OAuth 2.0 credentials
- Input field with validation for Client ID
- Direct links to Google Cloud Console and documentation

### 3. **Settings Page (src/pages/GoogleCalendarSettings.tsx)**
Updated to:
- Show "Setup Required" with instructions instead of "Contact Administrator"
- Display "Setup Google Calendar" button that opens the setup dialog
- Add configuration management section for users who configured their own
- Include "Reconfigure" and "Clear Setup" buttons for user control

## How to Test

### Prerequisites
- A Google Cloud account (free tier works fine)
- Access to Google Cloud Console: https://console.cloud.google.com

### Test Scenario 1: New User Setup

1. **Navigate to Google Calendar Settings**
   - Go to `/profile/calendar` route
   - You should see "Setup Required" message with blue info box
   - Click "Setup Google Calendar" button

2. **Setup Dialog Opens**
   - Dialog shows comprehensive step-by-step instructions
   - Three main steps are displayed:
     1. Create a Google Cloud Project
     2. Enable Google Calendar API
     3. Create OAuth 2.0 Credentials
   
3. **Follow Setup Steps** (in Google Cloud Console):
   - Create new project or select existing one
   - Go to "APIs & Services" → "Library"
   - Search "Google Calendar API" and enable it
   - Go to "APIs & Services" → "Credentials"
   - Create "OAuth client ID" (Web application type)
   - Add authorized redirect URI: `http://localhost:5173/profile/calendar` (or your domain)
   - Copy the generated Client ID

4. **Configure in App**
   - Paste Client ID into the input field
   - Should end with `.apps.googleusercontent.com`
   - Click "Save Configuration"
   - Page will reload with configuration applied

5. **Connect Google Calendar**
   - After reload, "Connect Google Calendar" button appears
   - Click button to start OAuth flow
   - Google consent screen opens in popup/redirect
   - Authorize the requested permissions
   - Redirected back to settings page
   - Calendar shows as "Connected" ✓

### Test Scenario 2: Reconfiguration

1. **Access Configuration Management**
   - As a user who has already configured, you'll see "Configuration" section at bottom
   - Two buttons available: "Reconfigure" and "Clear Setup"

2. **Reconfigure**
   - Click "Reconfigure" button
   - Setup dialog opens again with empty field
   - Enter new Client ID
   - Save to update configuration

3. **Clear Setup**
   - Click "Clear Setup" button
   - Confirmation prompt appears
   - Confirms removal and disconnection
   - Page reloads showing "Setup Required" again

### Test Scenario 3: Admin Configuration (Backward Compatibility)

1. **Set Environment Variable**
   - Add `VITE_GOOGLE_CLIENT_ID` to `.env` file
   - Restart the application

2. **Verify Behavior**
   - Navigate to `/profile/calendar`
   - Should skip setup and show "Connect Google Calendar" directly
   - No "Setup Required" message
   - Environment configuration takes precedence if no user config exists

### Test Scenario 4: Error Handling

1. **Invalid Client ID**
   - Enter Client ID without `.apps.googleusercontent.com` suffix
   - Error message displays: "Client ID should end with .apps.googleusercontent.com"
   - Cannot save until valid format

2. **Empty Client ID**
   - Try to save with empty field
   - Error message: "Please enter a Client ID"

## Expected Behavior

### Before Configuration
```
┌──────────────────────────────────────┐
│ Google Calendar Sync                 │
│                                      │
│ [i] Setup Required                   │
│     Configure Google Calendar        │
│     integration with your own        │
│     credentials...                   │
│                                      │
│ [Setup Google Calendar Button]       │
│                                      │
│ What you'll need: A free Google      │
│ Cloud account...                     │
└──────────────────────────────────────┘
```

### After Configuration (Not Connected)
```
┌──────────────────────────────────────┐
│ Google Calendar Sync              ✓  │
│                                      │
│ When you connect Google Calendar,    │
│ events you join will be...           │
│                                      │
│ [Connect Google Calendar Button]     │
│                                      │
│ ─────────────────────────────────    │
│ Configuration                        │
│ [Reconfigure] [Clear Setup]          │
│ You configured this integration...   │
└──────────────────────────────────────┘
```

### After Connection
```
┌──────────────────────────────────────┐
│ Google Calendar Sync              ✓  │
│ [Connected Badge]                    │
│                                      │
│ When you connect Google Calendar,    │
│ events you join will be...           │
│                                      │
│ [Disconnect Google Calendar Button]  │
│                                      │
│ ─────────────────────────────────    │
│ Configuration                        │
│ [Reconfigure] [Clear Setup]          │
│ You configured this integration...   │
└──────────────────────────────────────┘
```

## Storage Details

### LocalStorage Key
- **Key**: `google_calendar_client_id`
- **Value**: The Google Client ID (string)
- **Location**: Browser's localStorage
- **Scope**: Per-domain, persists across sessions

### Security Considerations

1. **Client ID is Not Secret**: 
   - Google Client IDs are public and can be exposed in client-side code
   - They are designed to be used in public applications
   - The actual security comes from the OAuth flow and redirect URI validation

2. **User Data Protection**:
   - Access tokens and refresh tokens are stored in Supabase database (encrypted)
   - Only the Client ID is stored in localStorage
   - OAuth flow validates redirect URIs server-side at Google

3. **Redirect URI Validation**:
   - Must match exactly what's configured in Google Cloud Console
   - Prevents unauthorized applications from using the Client ID

## Validation Rules

The setup dialog validates:
1. **Not empty**: Client ID must be provided
2. **Format**: Must end with `.apps.googleusercontent.com`
3. **Pattern**: Matches Google's standard Client ID format

Example valid Client ID:
```
1234567890-abcdefghij1234567890abcdef.apps.googleusercontent.com
```

## Troubleshooting

### OAuth Flow Fails
1. Verify redirect URI in Google Cloud Console matches exactly
2. Check Client ID is correctly copied (no extra spaces)
3. Ensure Google Calendar API is enabled in the project
4. Check browser console for detailed error messages

### "Integration Not Configured" Still Shows
1. Verify Client ID was saved (check localStorage in browser dev tools)
2. Try refreshing the page
3. Clear browser cache and localStorage, then reconfigure

### Can't Connect After Setup
1. Verify OAuth consent screen is configured in Google Cloud
2. Check that user is authorized (if in testing mode, user must be added)
3. Ensure Calendar API permissions are granted during OAuth flow

## Benefits of This Implementation

1. **No Administrator Needed**: Users can self-serve
2. **Flexible**: Works for both personal and organizational use
3. **Educational**: Users learn about OAuth and Google Cloud
4. **Control**: Users own their credentials and can change them
5. **Privacy**: Each user can use their own Google Cloud project
6. **Backward Compatible**: Environment-based config still works

## Future Enhancements

Possible improvements for future versions:
1. Add visual wizard/stepper for setup process
2. Integrate screenshots/video in setup instructions
3. Add "Test Configuration" button to verify Client ID
4. Support for multiple OAuth providers (Microsoft, Apple Calendar)
5. Export/import configuration for backup
6. Admin dashboard to see usage statistics

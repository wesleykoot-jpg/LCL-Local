# Quick Start: Google Calendar Integration

⚠️ **SECURITY NOTICE**: This guide is for development and testing. For production deployment, see `SECURITY_CALENDAR.md` to implement secure backend proxy.

Follow these steps to enable Google Calendar integration in your LCL app.

## Prerequisites

- Google account
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Supabase project set up

## Step 1: Google Cloud Console Setup (5 minutes)

### 1.1 Create/Select a Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown at the top
3. Click "New Project" (or select an existing one)
4. Name your project (e.g., "LCL Calendar Integration")
5. Click "Create"

### 1.2 Enable Google Calendar API

1. In the left sidebar, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: **LCL Local**
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `../auth/calendar.events` (or leave default for now)
   - Test users: Add your Google email (for testing)
   - Save and continue

4. Back on Credentials page, click **Create Credentials** > **OAuth client ID** again
5. Application type: **Web application**
6. Name: **LCL Web Client**
7. Authorized redirect URIs:
   - For development: `http://localhost:5173/calendar/callback`
   - For production: `https://yourdomain.com/calendar/callback`
8. Click **Create**

9. **Copy the Client ID and Client Secret** - you'll need these next!

## Step 2: Configure Environment Variables

1. In your project root, find or create `.env` file
2. Add these lines (replace with your actual values):

```bash
# From Google Cloud Console
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
VITE_GOOGLE_CLIENT_SECRET="your-client-secret"

# Your existing Supabase config
VITE_SUPABASE_URL="your-supabase-url"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
```

## Step 3: Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `supabase/migrations/20260112_add_calendar_integration.sql`
4. Copy all the SQL content
5. Paste into SQL Editor
6. Click **Run** or press `Cmd/Ctrl + Enter`
7. Verify: You should see "Success. No rows returned" message

### Option B: Using Supabase CLI

```bash
# Make sure you're in the project root
cd /path/to/LCL-Local

# Apply migrations
supabase db push

# Or reset and reapply
supabase db reset
```

### Verify Migration

Run this query in SQL Editor to confirm tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('calendar_integrations', 'calendar_event_mappings');
```

You should see both tables listed.

## Step 4: Test the Integration

### 4.1 Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

### 4.2 Connect Google Calendar

1. Log in to your app (or continue as guest if in dev mode)
2. Navigate to **Profile** page
3. Scroll to the **Calendar Integration** section
4. Click **Connect Google Calendar**
5. You'll be redirected to Google's authorization page
6. Click **Allow** to grant calendar access
7. You'll be redirected back to your profile
8. You should see "Google Calendar Connected" with a green checkmark

### 4.3 Test Event Syncing

1. Go to **Feed** page
2. Find an event and click **Join** or **I'm going**
3. The event should appear in your Google Calendar
4. Check your Google Calendar at [calendar.google.com](https://calendar.google.com)
5. Verify the event is there with correct details

### 4.4 Test Event Removal

1. Go to **My Events** page
2. Leave one of your joined events
3. Check Google Calendar - the event should be removed

## Troubleshooting

### "OAuth credentials not configured"

- Make sure your `.env` file has the correct `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_SECRET`
- Restart your dev server after adding environment variables

### "Redirect URI mismatch"

- In Google Cloud Console, verify redirect URIs exactly match
- For local dev: `http://localhost:5173/calendar/callback` (note the port!)
- No trailing slash
- Protocol must match (http vs https)

### "Access blocked: This app's request is invalid"

- Make sure you added your email to "Test users" in OAuth consent screen
- App must be in "Testing" mode for external users
- Scopes must include calendar access

### Events not syncing

1. Check browser console for errors
2. Verify calendar integration is connected in Profile
3. Make sure you're joining events (not just viewing them)
4. Check Supabase logs for backend errors

### Token expired errors

- The integration automatically refreshes tokens
- If issues persist, disconnect and reconnect calendar

## Production Deployment

### Additional Steps for Production

1. **Update OAuth Redirect URIs** in Google Cloud Console:
   - Add your production URL: `https://yourdomain.com/calendar/callback`

2. **Update Environment Variables** on your hosting platform:
   - Add `VITE_GOOGLE_CLIENT_ID`
   - Add `VITE_GOOGLE_CLIENT_SECRET`

3. **OAuth Consent Screen**:
   - Consider publishing your app for public use
   - Otherwise, add users individually to Test users list

4. **Security**:
   - Never commit `.env` file to Git
   - Keep Client Secret secure
   - Use environment variables on hosting platform

## Next Steps

### Enhance the Integration

- Add calendar sync status indicators on event cards
- Show sync errors to users
- Allow users to choose which events to sync
- Implement two-way sync (Google → LCL)

### Add More Providers

The architecture supports multiple calendar providers:
- Microsoft Outlook Calendar
- Apple Calendar (iCloud)

See `GOOGLE_CALENDAR_INTEGRATION.md` for detailed architecture documentation.

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review `GOOGLE_CALENDAR_INTEGRATION.md` for detailed docs
3. Check browser console and Supabase logs
4. Verify all environment variables are set correctly

## Security Notes

- OAuth tokens are stored encrypted in Supabase
- Row-level security ensures users only access their own tokens
- Refresh tokens allow persistent access without re-authorization
- Tokens are automatically refreshed when needed
- Minimal scopes requested (only calendar.events)

Happy syncing! 🗓️

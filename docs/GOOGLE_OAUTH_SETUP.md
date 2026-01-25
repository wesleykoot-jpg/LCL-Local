# Google OAuth Login Setup Guide

This guide walks you through enabling Google login for your LCL Local application using Supabase Auth. **Both Supabase and Google OAuth are free** for standard usage.

## Prerequisites

- A Supabase project (free tier works fine)
- A Google account for creating OAuth credentials

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account

### 1.2 Create or Select a Project
1. Click the project dropdown at the top of the page
2. Click "New Project" or select an existing project
3. Give it a name like "LCL Local"

### 1.3 Enable OAuth Consent Screen
1. In the left sidebar, navigate to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (allows any Google user to log in)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: LCL Local
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **Save and Continue**
6. Skip "Scopes" and "Test users" (click **Save and Continue** for each)
7. Click **Back to Dashboard**

### 1.4 Create OAuth Credentials
1. In the left sidebar, click **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Select **Web application** as the application type
4. Give it a name like "LCL Local Web Client"
5. Add the following **Authorized redirect URIs**:
   ```
   https://<your-supabase-project-id>.supabase.co/auth/v1/callback
   ```
   - Replace `<your-supabase-project-id>` with your actual Supabase project ID
   - You can find this in your Supabase dashboard URL

6. Click **Create**
7. **Copy the Client ID and Client Secret** - you'll need these for Step 2

## Step 2: Configure Supabase Auth Provider

### 2.1 Open Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project

### 2.2 Enable Google Provider
1. In the left sidebar, click **Authentication** → **Providers**
2. Find **Google** in the list and click to expand it
3. Toggle **Enable Google** to ON
4. Enter the **Client ID** from Step 1.4
5. Enter the **Client Secret** from Step 1.4
6. Click **Save**

## Step 3: Configure Your Environment

Make sure your `.env` file has the correct Supabase URL and key:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
```

You can find these values in your Supabase project settings under **Settings** → **API**.

## Step 4: Test the Login Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/login` in your browser

3. Click **"Continue with Google"**

4. You should be redirected to Google's login page

5. After authenticating, you'll be redirected back to your app and logged in

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Make sure the redirect URI in Google Cloud Console **exactly matches** your Supabase callback URL
- The format should be: `https://<project-id>.supabase.co/auth/v1/callback`

### "Access blocked: This app's request is invalid"
- Ensure you've completed the OAuth consent screen setup in Step 1.3

### "Invalid credentials" after Google login
- Verify that the Client ID and Secret in Supabase match those from Google Cloud Console
- Make sure the Google provider is enabled in Supabase

### User profile not created after login
- The app automatically creates a profile for new OAuth users
- Check the browser console for any profile creation errors
- Verify RLS policies allow profile insertion

## How It Works

The Google login flow in LCL Local:

1. User clicks "Continue with Google" button
2. `signInWithGoogle()` from `AuthContext` initiates OAuth flow via Supabase
3. User is redirected to Google's login page
4. After successful authentication, Google redirects back to Supabase
5. Supabase creates/updates the user and redirects to your app
6. `AuthContext` detects the session and:
   - If user has no profile: Creates one with their Google name/email
   - If user has a profile: Fetches and sets it in context
7. User is now authenticated and can access protected features

## Code Reference

The Google OAuth is implemented in:

- **`src/features/auth/AuthContext.tsx`**: Core authentication logic
  - `signInWithGoogle()`: Initiates OAuth flow
  - `createProfileForUser()`: Creates profile for new OAuth users
  
- **`src/features/auth/components/LoginView.tsx`**: Login UI with Google button

- **`src/features/auth/components/SignUpView.tsx`**: Signup UI with Google option

## Security Notes

- Never commit your `.env` file with real credentials
- The Client Secret should only be stored in Supabase (not in your frontend code)
- Supabase handles the OAuth token exchange securely on the backend
- User sessions are managed by Supabase with automatic token refresh

## Additional Resources

- [Supabase Auth with Google Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth Overview](https://supabase.com/docs/guides/auth)

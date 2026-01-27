# Google OAuth Redirect URL Issue - Root Cause & Fix

## Problem Analysis

### Observed Error URL
```
https://mlpefjsbriqgxcaqxhic.supabase.co/localapp.cloud#access_token=...
```

### What's Happening

1. User clicks "Continue with Google" button
2. Supabase initiates OAuth flow with Google
3. Google redirects back to Supabase auth callback: `https://mlpefjsbriqgxcaqxhic.supabase.co/auth/v1/callback`
4. Supabase attempts to redirect to the `redirectTo` URL specified in the code
5. **Instead of redirecting to `https://localapp.cloud/explore`, it redirects to `/localapp/cloud` as a relative path**

### Root Cause

The redirect URL `https://localapp.cloud/explore` is **NOT whitelisted** in the Supabase project settings. When Supabase receives a redirect URL that isn't in the allowed list, it treats it as a relative path instead of an absolute URL.

### Evidence

From the error URL:
- Expected: `https://localapp.cloud/explore`
- Actual: `https://mlpefjsbriqgxcaqxhic.supabase.co/localapp.cloud`

Notice how `localapp.cloud` appears as a path segment after the Supabase domain instead of as a separate domain.

## Required Fix

### Step 1: Whitelist Redirect URL in Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `mlpefjsbriqgxcaqxhic`
3. Navigate to: **Authentication** → **URL Configuration**
4. Add the following to **Redirect URLs**:
   ```
   https://localapp.cloud/*
   ```
   Or more specifically:
   ```
   https://localapp.cloud/explore
   https://localapp.cloud
   ```
5. Click **Save**

### Step 2: Verify Google Cloud Console Configuration

Ensure your Google OAuth client has the correct redirect URI:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Verify the **Authorized redirect URIs** includes:
   ```
   https://mlpefjsbriqgxcaqxhic.supabase.co/auth/v1/callback
   ```

### Step 3: Test the Fix

1. Clear your browser cookies and localStorage for `localapp.cloud`
2. Restart your development server
3. Navigate to `/login`
4. Click "Continue with Google"
5. Check browser console for the debug logs:
   ```
   [Auth] VITE_SITE_URL: https://localapp.cloud
   [Auth] window.location.origin: https://localapp.cloud
   [Auth] Using redirect URL: https://localapp.cloud
   [Auth] Full redirect URL: https://localapp.cloud/explore
   [Auth] Initiating Google OAuth with redirect: https://localapp.cloud/explore
   ```
6. Verify you're redirected to `https://localapp.cloud/explore` after authentication

## Alternative: Use Window Location Origin

If you prefer not to whitelist URLs in Supabase, you can modify the code to use `window.location.origin` instead of `VITE_SITE_URL`:

```typescript
// In AuthContext.tsx
const redirectUrl = window.location.origin; // Use current origin instead of VITE_SITE_URL
const fullRedirectUrl = `${redirectUrl}/explore`;
```

This approach works because:
- The current origin is always whitelisted by default in Supabase
- No additional configuration needed
- Works in both development and production (as long as you're accessing the app from the correct domain)

### To Apply This Alternative

Change line 251 in [`src/features/auth/AuthContext.tsx`](src/features/auth/AuthContext.tsx:251):

```typescript
// Before
const redirectUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

// After
const redirectUrl = window.location.origin;
```

## Why This Happens

Supabase OAuth redirect URLs must be whitelisted for security reasons. This prevents:

1. **Open Redirect Vulnerabilities**: Attackers can't redirect users to arbitrary URLs
2. **Phishing Attacks**: OAuth tokens can't be sent to malicious sites
3. **Cross-Site Request Forgery**: Ensures redirects only go to trusted domains

When a redirect URL isn't whitelisted, Supabase treats it as a relative path to prevent security issues.

## Debugging Added

I've added comprehensive logging to [`AuthContext.tsx`](src/features/auth/AuthContext.tsx:251-266) to help diagnose issues:

```typescript
console.log("[Auth] VITE_SITE_URL:", import.meta.env.VITE_SITE_URL);
console.log("[Auth] window.location.origin:", window.location.origin);
console.log("[Auth] Using redirect URL:", redirectUrl);
console.log("[Auth] Full redirect URL:", fullRedirectUrl);
console.log("[Auth] Initiating Google OAuth with redirect:", fullRedirectUrl);
```

Check the browser console when clicking the Google login button to see exactly what URLs are being used.

## Summary

| Issue | Cause | Fix |
|-------|-------|-----|
| Redirect URL treated as relative path | URL not whitelisted in Supabase | Add `https://localapp.cloud/*` to Supabase Redirect URLs |
| OR | Use `window.location.origin` instead of `VITE_SITE_URL` | Modify code to use current origin |

**Recommended Fix**: Whitelist the redirect URL in Supabase Dashboard (Step 1 above). This is the proper solution and allows you to control exactly which domains can receive OAuth callbacks.

## Additional Resources

- [Supabase Auth URL Configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Original Analysis](plans/google-oauth-integration-analysis.md)

# Google OAuth Wildcard Fix

## Problem

After whitelisting `https://localapp.cloud/*` in Supabase redirect URLs, users encountered:

```
[Error] 404 Error: User attempted to access non-existent route: – "/*"
```

## Root Cause

When using wildcard patterns (`*`) in Supabase redirect URLs, Supabase was interpreting the wildcard **literally** as `/*` in the redirect path instead of matching it to any path.

## Solution Applied

Changed the OAuth redirect URL to use the **root URL only**, without a specific path:

### Before
```typescript
const fullRedirectUrl = `${redirectUrl}/explore`;
// Result: https://localapp.cloud/explore
```

### After
```typescript
const redirectUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
// Result: https://localapp.cloud
```

## Why This Works

1. **Root URL is always whitelisted**: The base domain is implicitly allowed in Supabase
2. **No wildcard needed**: By redirecting to root, we avoid wildcard interpretation issues
3. **App handles routing**: After OAuth completes, React Router will show the appropriate page based on user's state
4. **More flexible**: Works regardless of which route user should land on

## Changes Made

### File: [`src/features/auth/AuthContext.tsx`](src/features/auth/AuthContext.tsx:251-273)

**Changed**:
- Removed `/explore` path from redirect URL
- Simplified redirect to use base URL only
- Kept Apple OAuth consistent (already using base URL)

**Code**:
```typescript
const redirectUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
console.log("[Auth] VITE_SITE_URL:", import.meta.env.VITE_SITE_URL);
console.log("[Auth] window.location.origin:", window.location.origin);
console.log("[Auth] Using redirect URL:", redirectUrl);

const signInWithGoogle = async () => {
  try {
    console.log("[Auth] Initiating Google OAuth with redirect:", redirectUrl);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,  // Just the base URL, no path
      },
    });
    if (error) {
      console.error("[Auth] Google OAuth error:", error);
    }
    return { error };
  } catch (error) {
    console.error("[Auth] Google OAuth exception:", error);
    return { error: error as AuthError };
  }
};
```

## Supabase Configuration

You can now **remove** the wildcard pattern from Supabase redirect URLs:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to: **Authentication** → **URL Configuration**
3. **Remove**: `https://localapp.cloud/*`
4. **Add** (if not already present): `https://localapp.cloud`
5. Click **Save**

The base URL `https://localapp.cloud` is sufficient and avoids wildcard interpretation issues.

## Testing

### Step 1: Clear Browser State
```bash
# Clear cookies and localStorage for localapp.cloud
# Or use incognito/private window for testing
```

### Step 2: Restart Development Server
```bash
npm run dev
```

### Step 3: Test OAuth Flow

1. Navigate to `/login`
2. Click "Continue with Google"
3. Check browser console for debug logs:
   ```
   [Auth] VITE_SITE_URL: https://localapp.cloud
   [Auth] window.location.origin: https://localapp.cloud
   [Auth] Using redirect URL: https://localapp.cloud
   [Auth] Initiating Google OAuth with redirect: https://localapp.cloud
   ```
4. Complete Google authentication
5. Verify you're redirected to `https://localapp.cloud` (root)
6. App should show appropriate page based on auth state

### Step 4: Verify Profile Creation

For new OAuth users, verify:
- User is logged in
- Profile is created automatically
- User can access protected features

## Expected Behavior After Fix

1. User clicks "Continue with Google"
2. Redirected to Google OAuth page
3. User authenticates with Google
4. Google redirects to Supabase callback
5. Supabase redirects to `https://localapp.cloud` (root)
6. React Router loads the app
7. AuthContext detects session
8. User is logged in and can use the app

## Debugging

If issues persist, check browser console for:
- `[Auth]` logs showing redirect URL
- Any Supabase auth errors
- Network tab for failed requests

## Summary

| Issue | Cause | Fix |
|-------|-------|-----|
| `/*` route error | Wildcard interpreted literally | Use base URL without path |
| Redirect to `/explore` failed | Path-specific redirect not whitelisted | Redirect to root, let app handle routing |

## Related Documentation

- [Original Analysis](plans/google-oauth-integration-analysis.md)
- [Redirect Fix](plans/google-oauth-redirect-fix.md)
- [Google OAuth Setup Guide](docs/GOOGLE_OAUTH_SETUP.md)

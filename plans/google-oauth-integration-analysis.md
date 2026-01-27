# Google OAuth Integration Analysis

## Executive Summary

The current Google OAuth implementation in LCL Local has a critical configuration mismatch causing an "invalid path" error during login. The issue stems from a redirect URL pointing to a non-existent route. However, the **current implementation using Supabase's built-in Google OAuth is actually the recommended approach** - it just needs proper configuration.

## Current Implementation Analysis

### What's Working ✅

1. **Supabase Native OAuth Integration**: The app correctly uses Supabase's built-in OAuth provider via [`signInWithOAuth()`](src/features/auth/AuthContext.tsx:256-266)
2. **Profile Auto-Creation**: New OAuth users automatically get profiles created (lines 146-171)
3. **Session Management**: Proper session handling with automatic token refresh
4. **Security**: Client secret is stored securely in Supabase, not in frontend code

### Root Cause of "Invalid Path" Error ❌

**Issue**: The redirect URL points to `/discovery` but the actual route is `/explore`

**Location**: [`AuthContext.tsx:259`](src/features/auth/AuthContext.tsx:259)
```typescript
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${redirectUrl}/discovery`,  // ❌ This route doesn't exist
    },
  });
  return { error };
};
```

**Actual Routes** (from [`App.tsx:101-104`](src/App.tsx:101-104)):
```typescript
<Route path="/" element={<DiscoveryPage />} />
<Route path="/explore" element={<DiscoveryPage />} />  // ✅ This is the correct route
<Route path="/now" element={<NowPage />} />
<Route path="/planning" element={<MyPlanningPage />} />
```

**Environment Configuration** (from [`.env:18`](.env:18)):
```env
VITE_SITE_URL="https://localapp.cloud"
```

This means users are redirected to `https://localapp.cloud/discovery` after OAuth, which doesn't exist, causing the 404 "invalid path" error.

### Local Development Configuration Issue

**Location**: [`supabase/config.toml:69-70`](supabase/config.toml:69-70)
```toml
[auth.external.google]
enabled = false  # ❌ Disabled in local development
```

Google OAuth is explicitly disabled in the local Supabase configuration, which means OAuth won't work during local development.

## Why Supabase Google Integration is the Right Choice ✅

### Advantages of Current Approach

1. **Security**: Supabase handles OAuth token exchange securely on the backend
2. **Simplicity**: Minimal code required - just use `signInWithOAuth()`
3. **Built-in Session Management**: Automatic token refresh and session persistence
4. **Profile Sync**: User metadata (name, email) is automatically available
5. **No Additional Infrastructure**: No need for custom OAuth backend or middleware
6. **Free Tier**: Both Supabase and Google OAuth are free for standard usage
7. **Production Ready**: Battle-tested by thousands of applications

### Alternative Approaches (Not Recommended)

| Approach | Complexity | Security | Maintenance | Recommendation |
|----------|-----------|----------|-------------|----------------|
| **Supabase Native OAuth** (current) | Low | High | Low | ✅ **Recommended** |
| Custom Google OAuth Implementation | High | Medium | High | ❌ Over-engineering |
| NextAuth.js / Auth.js | Medium | High | Medium | ❌ Unnecessary overhead |
| Firebase Auth | Medium | High | Medium | ❌ Vendor lock-in |

## Recommended Fixes

### Fix 1: Correct the Redirect URL (Critical)

**File**: [`src/features/auth/AuthContext.tsx`](src/features/auth/AuthContext.tsx:259)

**Change**:
```typescript
// Before
redirectTo: `${redirectUrl}/discovery`,

// After
redirectTo: `${redirectUrl}/explore`,
```

**Or better yet**, redirect to root and let the app handle routing:
```typescript
redirectTo: redirectUrl,
```

### Fix 2: Enable Google OAuth in Local Development

**File**: [`supabase/config.toml`](supabase/config.toml:69-70)

**Change**:
```toml
[auth.external.google]
enabled = true  # Enable for local testing
```

**Note**: You'll also need to configure Google OAuth credentials in your local Supabase instance.

### Fix 3: Add Missing Environment Variable

**File**: [`.env.example`](.env.example)

**Add**:
```env
# Site URL for OAuth redirects (production)
VITE_SITE_URL="https://your-production-url.com"
```

This is referenced in [`AuthContext.tsx:251`](src/features/auth/AuthContext.tsx:251) but missing from the example file.

## Implementation Plan

### Phase 1: Immediate Fixes (Critical Path)

1. **Update redirect URL** in [`AuthContext.tsx`](src/features/auth/AuthContext.tsx:259)
2. **Add VITE_SITE_URL** to [`.env.example`](.env.example)
3. **Test OAuth flow** with corrected redirect

### Phase 2: Local Development Setup

1. **Enable Google OAuth** in [`supabase/config.toml`](supabase/config.toml:69-70)
2. **Configure local Google credentials** (if testing locally)
3. **Update documentation** with local OAuth setup instructions

### Phase 3: Production Configuration

1. **Verify Google Cloud Console** has correct redirect URIs
2. **Confirm Supabase dashboard** has Google provider enabled
3. **Test production OAuth flow** end-to-end

## Google Cloud Console Configuration Checklist

### Required Redirect URIs

Make sure these are added to your Google OAuth client:

```
https://<your-supabase-project-id>.supabase.co/auth/v1/callback
```

### OAuth Consent Screen

1. **App Name**: LCL Local
2. **User Support Email**: Your support email
3. **Developer Contact Email**: Your email
4. **Scopes**: Email, Profile (basic)

### OAuth Client Settings

1. **Application Type**: Web application
2. **Authorized JavaScript Origins**: Your app domains
3. **Authorized Redirect URIs**: Supabase callback URL (above)

## Supabase Dashboard Configuration Checklist

### Authentication → Providers → Google

- [ ] Enable Google provider: **ON**
- [ ] Client ID: From Google Cloud Console
- [ ] Client Secret: From Google Cloud Console
- [ ] Save configuration

### Site URL Configuration

- **Development**: `http://localhost:5173` (or your dev server)
- **Production**: Your production URL (e.g., `https://localapp.cloud`)

## Testing Procedure

### Local Development Testing

```bash
# 1. Start Supabase local
supabase start

# 2. Start dev server
npm run dev

# 3. Navigate to /login
# 4. Click "Continue with Google"
# 5. Verify redirect to /explore (not /discovery)
# 6. Verify profile is created automatically
```

### Production Testing

```bash
# 1. Deploy to production
# 2. Clear browser localStorage/cookies
# 3. Navigate to production /login
# 4. Click "Continue with Google"
# 5. Verify redirect to /explore
# 6. Verify profile is created automatically
```

## Troubleshooting Guide

### Error: "redirect_uri_mismatch"

**Cause**: Google Cloud Console redirect URI doesn't match Supabase callback URL

**Solution**: 
1. Check Supabase project URL: `https://<project-id>.supabase.co/auth/v1/callback`
2. Update Google Cloud Console with exact match

### Error: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen not configured

**Solution**: Complete OAuth consent screen setup in Google Cloud Console

### Error: "Invalid path" (404)

**Cause**: Redirect URL points to non-existent route

**Solution**: Update `redirectTo` in [`AuthContext.tsx:259`](src/features/auth/AuthContext.tsx:259) to `/explore` or root

### Error: "Provider not enabled"

**Cause**: Google provider disabled in Supabase

**Solution**: Enable Google provider in Supabase Dashboard → Authentication → Providers

## Security Considerations

### Current Implementation (Secure) ✅

- Client secret stored in Supabase (not exposed to frontend)
- OAuth tokens managed by Supabase
- Automatic token refresh
- Secure session storage (localStorage with proper headers)

### Best Practices

1. **Never expose** Client Secret in frontend code
2. **Use HTTPS** in production
3. **Validate** redirect URLs
4. **Monitor** OAuth usage in Supabase dashboard
5. **Rotate** secrets periodically (if compromised)

## Conclusion

The current implementation using **Supabase's native Google OAuth is the optimal approach** for LCL Local. It provides:

- ✅ Security (server-side token handling)
- ✅ Simplicity (minimal code)
- ✅ Reliability (battle-tested)
- ✅ Free tier support
- ✅ Easy maintenance

The only issues are **configuration problems**, not architectural problems:

1. **Critical**: Redirect URL points to non-existent `/discovery` route
2. **Important**: Google OAuth disabled in local development
3. **Minor**: Missing `VITE_SITE_URL` in `.env.example`

**Recommendation**: Fix the configuration issues (as outlined above) rather than changing the integration approach. The current Supabase OAuth implementation is production-ready and follows best practices.

## Additional Resources

- [Supabase Auth with Google Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Existing Setup Guide](docs/GOOGLE_OAUTH_SETUP.md)
- [Supabase Quick Reference](docs/SUPABASE_QUICK_REFERENCE.md)

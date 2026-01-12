# SECURITY CONSIDERATIONS - Google Calendar Integration

## ⚠️ IMPORTANT: Client Secret in Frontend Code

### Current Implementation

The current implementation includes the Google OAuth Client Secret in the frontend code. This is **not recommended for production use** as it exposes the secret in the browser.

### Why This Approach?

This implementation was chosen for:
1. **Simplicity**: No backend server required
2. **Quick Setup**: Works immediately for development/testing
3. **Demonstration**: Shows the complete OAuth flow

### Security Risks

- Client secret is visible in browser devtools
- Anyone can extract and potentially abuse the secret
- Not compliant with OAuth 2.0 best practices for public clients

## Recommended Production Solutions

### Option 1: Backend Proxy (Recommended)

Create a secure backend endpoint to handle OAuth token exchange:

```typescript
// Backend endpoint (e.g., Supabase Edge Function)
export async function exchangeToken(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET, // Secret stays on server
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  return response.json();
}
```

Frontend calls this endpoint instead of Google directly.

### Option 2: OAuth 2.0 PKCE Flow

Use PKCE (Proof Key for Code Exchange) which doesn't require a client secret:

1. Generate code verifier and challenge
2. Include challenge in authorization request
3. Include verifier in token exchange
4. No client secret needed!

This is the **recommended approach** for browser-based apps.

### Option 3: Supabase Edge Functions

Leverage Supabase Edge Functions to proxy OAuth requests:

```typescript
// supabase/functions/google-calendar-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { code } = await req.json()
  
  // Exchange code for tokens securely
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: Deno.env.get('REDIRECT_URI')!,
      grant_type: 'authorization_code',
    }),
  })
  
  return new Response(JSON.stringify(await response.json()), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

## Implementation Guide: Backend Proxy with Supabase

### Step 1: Create Edge Function

```bash
# Create new edge function
supabase functions new google-calendar-auth

# Deploy
supabase functions deploy google-calendar-auth
```

### Step 2: Set Environment Variables

```bash
supabase secrets set GOOGLE_CLIENT_ID=your-client-id
supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
supabase secrets set REDIRECT_URI=your-redirect-uri
```

### Step 3: Update Frontend Code

```typescript
// Instead of calling Google directly, call your edge function
export async function exchangeCodeForTokens(code: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ action: 'exchange_token', code }),
    }
  );
  
  return response.json();
}

// Similar for token refresh
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ action: 'refresh_token', refresh_token: refreshToken }),
    }
  );
  
  return response.json();
}
```

### Step 4: Remove Client Secret from Frontend

Delete `VITE_GOOGLE_CLIENT_SECRET` from `.env` and frontend code.

## Other Security Considerations

### 1. Token Storage

✅ **Good**: Tokens are stored in Supabase with Row Level Security
- Only users can access their own tokens
- Encrypted at rest by Supabase

### 2. Token Refresh

⚠️ **Needs Improvement**: Refresh should happen on backend
- Current: Frontend refreshes tokens (exposes client secret)
- Better: Backend endpoint handles refresh

### 3. Scope Minimization

✅ **Good**: Only requesting necessary scopes
- `https://www.googleapis.com/auth/calendar.events`
- Can read/write calendar events only
- Cannot access other Google data

### 4. HTTPS

✅ **Required for Production**
- OAuth redirect URIs must use HTTPS
- Development can use localhost with HTTP

### 5. Rate Limiting

Consider implementing:
- Rate limiting on token exchange endpoint
- Monitoring for abuse
- IP-based restrictions if needed

## Immediate Actions for Production

1. **DO NOT deploy with client secret in frontend code**
2. Implement backend proxy using Supabase Edge Functions
3. Remove `VITE_GOOGLE_CLIENT_SECRET` from frontend
4. Test OAuth flow with backend proxy
5. Consider implementing PKCE flow for additional security

## For Development/Testing Only

If you're using this for development or personal use only:

1. Restrict OAuth app to your email only (Test users)
2. Keep client secret in `.env` (never commit to Git)
3. Use a separate Google project for dev/prod
4. Monitor Google Cloud Console for unusual activity

## Additional Resources

- [OAuth 2.0 for Mobile & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Google Calendar API Security](https://developers.google.com/calendar/api/guides/auth)

## Summary

**Current State**: Functional but not production-ready due to client secret exposure

**Next Steps**: Implement backend proxy via Supabase Edge Functions

**Priority**: HIGH - Do this before any public release

## Questions?

Refer to the main documentation or open an issue for security-related questions.

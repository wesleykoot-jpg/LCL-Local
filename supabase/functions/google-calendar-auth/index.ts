/**
 * Google Calendar Auth Edge Function
 * 
 * Securely handles OAuth token exchange and refresh for Google Calendar integration.
 * The Client Secret is kept server-side for security.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withErrorLogging, logSupabaseError, logHttpError } from '../_shared/errorLogging.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

interface TokenExchangeRequest {
  action: 'exchange';
  code: string;
  redirectUri: string;
}

interface TokenRefreshRequest {
  action: 'refresh';
  profileId: string;
}

type RequestBody = TokenExchangeRequest | TokenRefreshRequest;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withErrorLogging(
    'google-calendar-auth',
    'handler',
    'Process Google Calendar OAuth request',
    async () => {
      const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
      const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.error('[google-calendar-auth] Missing Google OAuth credentials');
        return new Response(
          JSON.stringify({ error: 'Google Calendar integration not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[google-calendar-auth] Missing Supabase credentials');
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body: RequestBody = await req.json();

    if (body.action === 'exchange') {
      // Exchange authorization code for tokens
      const { code, redirectUri } = body;

      if (!code || !redirectUri) {
        return new Response(
          JSON.stringify({ error: 'Missing code or redirectUri' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[google-calendar-auth] Token exchange failed:', data);
        await logHttpError(
          'google-calendar-auth',
          'exchange',
          'Google OAuth token exchange',
          GOOGLE_TOKEN_ENDPOINT,
          response.status,
          JSON.stringify(data),
          undefined,
          { code_provided: !!code, redirect_uri: redirectUri }
        );
        return new Response(
          JSON.stringify({ error: data.error_description || 'Token exchange failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return tokens to client (they'll store them via their own Supabase call)
      return new Response(
        JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token || null,
          expires_in: data.expires_in,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (body.action === 'refresh') {
      // Refresh access token
      const { profileId } = body;

      if (!profileId) {
        return new Response(
          JSON.stringify({ error: 'Missing profileId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get refresh token from database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: tokenData, error: dbError } = await supabase
        .from('google_calendar_tokens')
        .select('refresh_token')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (dbError || !tokenData?.refresh_token) {
        console.error('[google-calendar-auth] No refresh token found:', dbError);
        if (dbError) {
          await logSupabaseError(
            'google-calendar-auth',
            'refresh',
            'Fetch refresh token from database',
            dbError,
            { profile_id: profileId }
          );
        }
        return new Response(
          JSON.stringify({ error: 'No refresh token available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh the token
      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: tokenData.refresh_token,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[google-calendar-auth] Token refresh failed:', data);
        await logHttpError(
          'google-calendar-auth',
          'refresh',
          'Google OAuth token refresh',
          GOOGLE_TOKEN_ENDPOINT,
          response.status,
          JSON.stringify(data),
          undefined,
          { profile_id: profileId }
        );
        return new Response(
          JSON.stringify({ error: data.error_description || 'Token refresh failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update tokens in database
      const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
      
      const { error: updateError } = await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: data.access_token,
          token_expiry: newExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', profileId);

      if (updateError) {
        console.error('[google-calendar-auth] Failed to update tokens:', updateError);
        await logSupabaseError(
          'google-calendar-auth',
          'refresh',
          'Update refreshed tokens in database',
          updateError,
          { profile_id: profileId }
        );
        return new Response(
          JSON.stringify({ error: 'Failed to save refreshed token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          access_token: data.access_token,
          expires_in: data.expires_in,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    },
    {
      method: req.method,
      url: req.url,
    }
  ).catch((error) => {
    console.error('[google-calendar-auth] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  });
});

/**
 * Process Calendar Insights Edge Function
 * 
 * Scans connected Google Calendars for parenting signals to automatically
 * detect if a user is a parent. Updates the is_parent_detected flag when
 * sufficient signals are found.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARENTING_KEYWORDS = [
  'School',
  'Zwemles',
  'Voetbal',
  'Kinderopvang',
  'Birthday Party',
  'Opvang',
  'Daycare',
  'Playdate',
  'Kids',
  'Children',
  'Soccer',
  'Swimming',
  'Kindergarten',
  'Parent-Teacher',
  'Preschool',
];

interface CalendarEvent {
  summary?: string;
  description?: string;
}

function scanForParentingSignals(events: CalendarEvent[]): number {
  let matchCount = 0;
  
  for (const event of events) {
    const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
    
    for (const keyword of PARENTING_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
        break; // Count once per event
      }
    }
  }
  
  return matchCount;
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  const timeMin = new Date();
  timeMin.setMonth(timeMin.getMonth() - 3); // Look back 3 months
  
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('maxResults', '100');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.items || [];
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('[process-calendar-insights] Missing Google OAuth credentials');
      return new Response(
        JSON.stringify({ error: 'Google Calendar integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[process-calendar-insights] Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get profileId from request body
    const { profileId } = await req.json();
    
    if (!profileId) {
      return new Response(
        JSON.stringify({ error: 'profileId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get calendar token for this profile
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: 'No calendar connection found for this profile' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = tokenData.access_token;
    
    // Check if token is expired and refresh if needed
    const tokenExpiry = new Date(tokenData.token_expiry);
    const now = new Date();
    
    if (tokenExpiry <= now && tokenData.refresh_token) {
      try {
        accessToken = await refreshAccessToken(
          tokenData.refresh_token,
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET
        );
        
        // Update the access token in the database
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 1);
        
        await supabase
          .from('google_calendar_tokens')
          .update({
            access_token: accessToken,
            token_expiry: newExpiry.toISOString(),
          })
          .eq('profile_id', profileId);
      } catch (refreshError) {
        console.error('[process-calendar-insights] Token refresh failed:', refreshError);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh calendar access token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch calendar events
    const events = await fetchCalendarEvents(accessToken, tokenData.calendar_id);
    
    // Scan for parenting signals
    const matchCount = scanForParentingSignals(events);
    
    console.log(`[process-calendar-insights] Found ${matchCount} parenting signals for profile ${profileId}`);
    
    // If more than 3 matches, set is_parent_detected to true
    if (matchCount > 3) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_parent_detected: true })
        .eq('id', profileId);
      
      if (updateError) {
        console.error('[process-calendar-insights] Failed to update profile:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update parent detection status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchCount,
        isParentDetected: matchCount > 3,
        eventsScanned: events.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[process-calendar-insights] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

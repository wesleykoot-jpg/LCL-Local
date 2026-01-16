// Delete User Account Edge Function
// Handles permanent account deletion with cascading cleanup
// Required for App Store GDPR compliance

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteAccountRequest {
  confirmationText?: string;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[delete-user-account] Starting deletion for user: ${user.id}`);

    // Parse request body for confirmation
    let confirmationText = '';
    if (req.method === 'POST') {
      try {
        const body: DeleteAccountRequest = await req.json();
        confirmationText = body.confirmationText || '';
      } catch (e) {
        // Body is optional, continue without it
        console.log('[delete-user-account] No body or invalid JSON, continuing...');
      }
    }

    // Optional: Validate confirmation text (can be enforced in frontend)
    if (confirmationText && confirmationText.toUpperCase() !== 'DELETE') {
      return new Response(
        JSON.stringify({ error: 'Invalid confirmation text. Please type DELETE to confirm.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create admin client for deletion (requires service role key)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Delete from auth.users
    // This should trigger CASCADE deletes on:
    // - profiles (via ON DELETE CASCADE on profiles.user_id)
    // - events (via ON DELETE CASCADE on events.created_by -> profiles.id)
    // - event_attendees (via ON DELETE CASCADE on event_attendees.profile_id -> profiles.id)
    // - user_blocks (via ON DELETE CASCADE on both blocker_id and blocked_id)
    // - content_reports (via ON DELETE CASCADE on reporter_id, reported_user_id)
    // - calendar_tokens (via ON DELETE CASCADE on calendar_tokens.profile_id -> profiles.id)
    // - persona_stats, persona_badges, etc.
    
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[delete-user-account] Error deleting user:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete account',
          details: deleteError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[delete-user-account] Successfully deleted user: ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Account deleted successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[delete-user-account] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

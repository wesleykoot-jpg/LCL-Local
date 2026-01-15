/**
 * [FUNCTION NAME] Edge Function
 * 
 * [Brief description of what this function does]
 * 
 * Usage:
 * POST /functions/v1/[function-name]
 * Body: {
 *   // Request parameters
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
// IMPORTANT: Always import error logging utilities
import { 
  withErrorLogging, 
  logSupabaseError, 
  logHttpError, 
  logFetchError,
  logWarning,
  logInfo 
} from "../_shared/errorLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ Helper Functions ============

// Put helper functions here

// ============ Main Handler ============

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // IMPORTANT: Wrap main handler logic with withErrorLogging
  // This automatically logs any uncaught exceptions
  return withErrorLogging(
    '[function-name]',           // Source identifier
    'handler',                    // Function name
    'Process [function] request', // Operation description
    async () => {
      // Get environment variables
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase environment variables");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Parse request body
      let body: any = {};
      try {
        const text = await req.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch (parseError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid JSON in request body",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ Main Logic ============

      // Example: Supabase query with error logging
      const { data, error } = await supabase
        .from("some_table")
        .select("*");
      
      if (error) {
        // IMPORTANT: Always log Supabase errors
        await logSupabaseError(
          '[function-name]',
          'handler',
          'Fetch data from some_table',
          error,
          { /* additional context */ }
        );
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Example: External API call with error logging
      const apiResponse = await fetch('https://api.example.com/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* data */ }),
      });

      if (!apiResponse.ok) {
        const responseBody = await apiResponse.text();
        // IMPORTANT: Always log HTTP/API errors
        await logHttpError(
          '[function-name]',
          'handler',
          'Call external API',
          'https://api.example.com/endpoint',
          apiResponse.status,
          responseBody,
          undefined,
          { /* additional context */ }
        );
        throw new Error(`API call failed with status ${apiResponse.status}`);
      }

      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          message: "Operation completed successfully",
          data: data,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    },
    {
      // Context for error logging
      method: req.method,
      url: req.url,
    }
  ).catch((error) => {
    // Fallback error handler
    // withErrorLogging already logged the error, we just return the error response
    console.error("[function-name] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  });
});

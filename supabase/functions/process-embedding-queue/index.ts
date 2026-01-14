import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Process Embedding Queue Worker
 * 
 * Polls the embedding_queue table and calls generate-event-embeddings
 * for batches of pending events. Can be triggered:
 * 1. Via cron job (scheduled)
 * 2. Via direct API call
 * 3. Chain calls itself for continuous processing
 * 
 * Usage:
 * POST /functions/v1/process-embedding-queue
 * Body: { "batch_size": 10, "chain": true }
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { batch_size = 10, chain = false } = body;

    // Get pending jobs
    const { data: jobs, error: jobsError } = await supabase
      .rpc("get_pending_embedding_jobs", { batch_size });

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending embedding jobs",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${jobs.length} embedding jobs`);

    // Get event details for the jobs
    const eventIds = jobs.map((job: any) => job.event_id);
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, description, category, venue_name")
      .in("id", eventIds);

    if (eventsError) throw eventsError;

    // Call generate-event-embeddings for each event
    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const event = events?.find((e: any) => e.id === job.event_id);
        if (!event) {
          console.warn(`Event ${job.event_id} not found, marking job as failed`);
          await supabase.rpc("fail_embedding_job", {
            job_id: job.job_id,
            error_msg: "Event not found",
          });
          failed++;
          continue;
        }

        // Call the embedding generation function
        const embedResponse = await fetch(
          `${supabaseUrl}/functions/v1/generate-event-embeddings`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ event_id: job.event_id }),
          }
        );

        const embedResult = await embedResponse.json();

        if (embedResult.success && embedResult.processed > 0) {
          // Mark job as completed
          await supabase.rpc("complete_embedding_job", {
            job_id: job.job_id,
          });
          processed++;
        } else {
          // Mark job as failed
          await supabase.rpc("fail_embedding_job", {
            job_id: job.job_id,
            error_msg: embedResult.error || "Embedding generation failed",
          });
          failed++;
        }

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing job ${job.job_id}:`, error);
        await supabase.rpc("fail_embedding_job", {
          job_id: job.job_id,
          error_msg: error instanceof Error ? error.message : "Unknown error",
        });
        failed++;
      }
    }

    // If chain mode and more jobs pending, trigger another run
    if (chain && processed > 0) {
      try {
        // Fire and forget - don't await
        fetch(`${supabaseUrl}/functions/v1/process-embedding-queue`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ batch_size, chain: true }),
        }).catch((e) => console.warn("Chain trigger failed:", e));
      } catch (e) {
        console.warn("Failed to chain next batch:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: jobs.length,
        chained: chain && processed > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing embedding queue:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

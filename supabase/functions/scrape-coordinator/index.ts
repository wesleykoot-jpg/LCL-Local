import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scrape Coordinator
 * 
 * This lightweight function enqueues scrape jobs for all enabled sources.
 * It does minimal CPU work - just database queries to create jobs.
 * 
 * Usage:
 * POST /functions/v1/scrape-coordinator
 * Body (optional): { "priority": 0, "sourceIds": ["uuid1", "uuid2"] }
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

    // Parse optional request body
    let options: { priority?: number; sourceIds?: string[]; triggerWorker?: boolean } = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        options = body ? JSON.parse(body) : {};
      } catch {
        options = {};
      }
    }

    const { priority = 0, sourceIds, triggerWorker = true } = options;

    // Get enabled sources (optionally filter by specific IDs)
    let query = supabase
      .from("scraper_sources")
      .select("id, name")
      .eq("enabled", true)
      .eq("auto_disabled", false);
    
    if (sourceIds && sourceIds.length > 0) {
      query = query.in("id", sourceIds);
    }

    const { data: sources, error: sourcesError } = await query;
    if (sourcesError) throw new Error(sourcesError.message);

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No enabled sources to queue", jobsCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear any stale pending jobs for these sources (from previous failed runs)
    const sourceIdList = sources.map((s) => s.id);
    await supabase
      .from("scrape_jobs")
      .delete()
      .in("source_id", sourceIdList)
      .eq("status", "pending");

    // Create new pending jobs for each source
    const jobs = sources.map((source) => ({
      source_id: source.id,
      status: "pending",
      priority,
      attempts: 0,
      max_attempts: 3,
    }));

    const { data: insertedJobs, error: insertError } = await supabase
      .from("scrape_jobs")
      .insert(jobs)
      .select("id");

    if (insertError) throw new Error(insertError.message);

    const jobsCreated = insertedJobs?.length || 0;
    console.log(`Coordinator: Enqueued ${jobsCreated} jobs for sources: ${sources.map((s) => s.name).join(", ")}`);

    // Optionally trigger the first worker to start processing
    if (triggerWorker && jobsCreated > 0) {
      try {
        const workerUrl = `${supabaseUrl}/functions/v1/scrape-worker`;
        // Fire and forget - don't await
        fetch(workerUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chain: true }),
        }).catch((e) => console.warn("Worker trigger failed:", e));
      } catch (e) {
        console.warn("Failed to trigger worker:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobsCreated,
        sources: sources.map((s) => ({ id: s.id, name: s.name })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Coordinator error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendSlackNotification } from "../_shared/slack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_WORKERS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse options
    let options: {
      limit?: number;
      triggerWorkers?: boolean;
      batchId?: string;
    } = {};

    try {
      const body = await req.json();
      options = body || {};
    } catch { }

    const {
      limit = 10,
      triggerWorkers = true,
      batchId = crypto.randomUUID(),
    } = options;

    console.log(`[Coordinator] Starting batch ${batchId} (Limit: ${limit})`);

    // 1. SELECT Cities pending discovery
    // Priority: 'pilot_pending' -> 'pending' (ordered by priority_tier)

    // First try Pilot
    let { data: cities, error } = await supabase
      .from("cities")
      .select("*")
      .in("discovery_status", ["pilot_pending"])
      .limit(limit);

    if (error) throw error;

    // If no pilot, try general pending
    if (!cities || cities.length === 0) {
      const { data: general, error: genError } = await supabase
        .from("cities")
        .select("*")
        .eq("discovery_status", "pending")
        .order("priority_tier", { ascending: true }) // 1=High
        .order("population", { ascending: false })
        .limit(limit);

      if (genError) throw genError;
      cities = general || [];
    }

    if (cities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending cities found", jobsCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Coordinator] Processing ${cities.length} cities: ${cities.map(c => c.name).join(", ")}`);

    // 2. Create Discovery Jobs
    const jobsToInsert = cities.map(c => ({
      municipality: c.name,
      population: c.population,
      province: c.admin1_code,
      coordinates: { lat: c.latitude, lng: c.longitude },
      status: "pending",
      priority: c.priority_tier, // 1 for Pilot
      batch_id: batchId,
      // We could add city_id if schema supported it, but sticking to existing schema for now
    }));

    const { data: insertedJobs, error: insertError } = await supabase
      .from("discovery_jobs")
      .insert(jobsToInsert)
      .select();

    if (insertError) throw insertError;

    // 3. Mark Cities as Processing (to avoid re-queueing)
    const cityIds = cities.map(c => c.id);
    await supabase
      .from("cities")
      .update({
        discovery_status: "processing",
        last_discovery_at: new Date().toISOString()
      })
      .in("id", cityIds);

    const jobsCreated = insertedJobs?.length || 0;

    // 4. Trigger Workers
    let workersTriggered = 0;
    if (triggerWorkers && jobsCreated > 0) {
      const numWorkers = Math.min(MAX_WORKERS, jobsCreated);
      const workerPromises = [];
      for (let i = 0; i < numWorkers; i++) {
        workerPromises.push(
          fetch(`${supabaseUrl}/functions/v1/source-discovery-worker`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ batchId }),
          }).catch(err => console.error(`Worker trigger failed:`, err))
        );
      }
      const results = await Promise.all(workerPromises);
      workersTriggered = results.length;
    }

    // Notification
    const cityNames = cities.map(c => c.name).join(", ");
    await sendSlackNotification(`🔍 Discovery Coordinator: Queued ${jobsCreated} cities (${cityNames})`, false);

    return new Response(
      JSON.stringify({
        success: true,
        batchId,
        jobsCreated,
        workersTriggered,
        cities: cities.map(c => c.name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Coordinator Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

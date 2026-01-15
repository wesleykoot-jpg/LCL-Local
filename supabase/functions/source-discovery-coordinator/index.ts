import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { 
  type Municipality,
  selectMunicipalitiesForDiscovery,
} from "../_shared/dutchMunicipalities.ts";
import { sendSlackNotification } from "../_shared/slack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Source Discovery Coordinator
 * 
 * This function queues discovery jobs for municipalities and optionally triggers workers.
 * Unlike the original source-discovery function that processes everything in one go,
 * this splits the work into individual jobs that can be processed by workers without timing out.
 * 
 * Usage:
 * - POST with { minPopulation: 100000 } to discover sources for cities > 100k
 * - POST with { municipalities: ["Amsterdam", "Rotterdam"] } for specific cities
 * - POST with { triggerWorkers: true } to immediately spawn worker functions
 */

const MAX_WORKERS = 5;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request options
    let options: {
      minPopulation?: number;
      maxMunicipalities?: number;
      municipalities?: string[];
      triggerWorkers?: boolean;
      batchId?: string;
    } = {};

    try {
      const body = await req.json();
      options = body || {};
    } catch {
      // No body or invalid JSON, use defaults
    }

    const {
      minPopulation = 100000,
      maxMunicipalities,
      municipalities: specificMunicipalities,
      triggerWorkers = true,
      batchId = crypto.randomUUID(),
    } = options;

    console.log(`[Coordinator] Starting discovery coordination for batch ${batchId}`);
    console.log(`[Coordinator] Options: minPopulation=${minPopulation}, maxMunicipalities=${maxMunicipalities || 'unlimited'}`);

    // Get municipalities to process
    const municipalitiesToProcess = selectMunicipalitiesForDiscovery({
      minPopulation,
      maxMunicipalities,
      municipalities: specificMunicipalities,
    });

    if (municipalitiesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No municipalities match the criteria",
          jobsCreated: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Coordinator] Found ${municipalitiesToProcess.length} municipalities to process`);

    // Get existing pending/processing jobs to avoid duplicates
    const { data: existingJobs } = await supabase
      .from("discovery_jobs")
      .select("municipality")
      .in("status", ["pending", "processing"]);

    const existingMunicipalities = new Set(
      (existingJobs || []).map((j: { municipality: string }) => j.municipality.toLowerCase())
    );

    // Filter out municipalities that already have pending jobs
    const newMunicipalities = municipalitiesToProcess.filter(
      m => !existingMunicipalities.has(m.name.toLowerCase())
    );

    if (newMunicipalities.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All municipalities already have pending jobs",
          jobsCreated: 0,
          skipped: municipalitiesToProcess.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create discovery jobs
    const jobsToInsert = newMunicipalities.map((m, index) => ({
      municipality: m.name,
      population: m.population,
      province: m.province,
      coordinates: { lat: m.lat, lng: m.lng },
      status: "pending",
      priority: Math.floor(m.population / 10000), // Higher population = higher priority
      batch_id: batchId,
    }));

    const { data: insertedJobs, error: insertError } = await supabase
      .from("discovery_jobs")
      .insert(jobsToInsert)
      .select();

    if (insertError) {
      console.error(`[Coordinator] Error inserting jobs:`, insertError);
      throw insertError;
    }

    const jobsCreated = insertedJobs?.length || 0;
    console.log(`[Coordinator] Created ${jobsCreated} discovery jobs`);

    // Trigger workers if requested
    let workersTriggered = 0;
    if (triggerWorkers && jobsCreated > 0) {
      const numWorkers = Math.min(MAX_WORKERS, jobsCreated);
      console.log(`[Coordinator] Triggering ${numWorkers} worker(s)`);

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
          }).catch(err => {
            console.error(`[Coordinator] Error triggering worker ${i}:`, err);
            return null;
          })
        );
      }

      const results = await Promise.all(workerPromises);
      workersTriggered = results.filter(r => r !== null).length;
      console.log(`[Coordinator] Successfully triggered ${workersTriggered} worker(s)`);
    }

    // Send Slack notification
    const municipalityNames = newMunicipalities.slice(0, 10).map(m => m.name).join(", ");
    const andMore = newMunicipalities.length > 10 ? ` and ${newMunicipalities.length - 10} more` : "";
    
    await sendSlackNotification({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔍 Source Discovery Coordinator",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Jobs Created:*\n${jobsCreated}`,
            },
            {
              type: "mrkdwn",
              text: `*Workers Triggered:*\n${workersTriggered}`,
            },
            {
              type: "mrkdwn",
              text: `*Min Population:*\n${minPopulation.toLocaleString()}`,
            },
            {
              type: "mrkdwn",
              text: `*Batch ID:*\n\`${batchId.slice(0, 8)}...\``,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Municipalities:*\n${municipalityNames}${andMore}`,
          },
        },
      ],
    });

    return new Response(
      JSON.stringify({
        success: true,
        batchId,
        jobsCreated,
        workersTriggered,
        municipalities: newMunicipalities.map(m => ({
          name: m.name,
          population: m.population,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[Coordinator] Error:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendSlackNotification } from "../_shared/slack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scrape Coordinator
 * 
 * This lightweight function enqueues scrape jobs for all enabled sources.
 * It does minimal CPU work - just database queries to create jobs.
 * Sends comprehensive Slack notifications with Block Kit formatting.
 * 
 * Usage:
 * POST /functions/v1/scrape-coordinator
 * Body (optional): { "priority": 0, "sourceIds": ["uuid1", "uuid2"], "triggerWorker": true }
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

    // Fetch comprehensive statistics for Slack notification
    // Get recent events inserted (last 24 hours) and persona breakdown
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count: recentEventsCount } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgo);

    // Get persona breakdown (Family vs Social/Culture)
    const { data: familyEvents } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("category", "family")
      .gte("created_at", twentyFourHoursAgo);

    const { data: socialEvents } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .in("category", ["culture", "nightlife", "food"])
      .gte("created_at", twentyFourHoursAgo);

    const familyCount = familyEvents?.length || 0;
    const socialCount = socialEvents?.length || 0;

    // Get error/failure stats from scraper_sources (sources with recent failures)
    const { data: failedSources } = await supabase
      .from("scraper_sources")
      .select("name, url, last_scrape_at, last_error")
      .eq("enabled", true)
      .not("last_error", "is", null)
      .gte("last_scrape_at", twentyFourHoursAgo)
      .limit(10);

    // Get sources with coordinates for geofencing verification
    const { data: sourcesWithCoords } = await supabase
      .from("scraper_sources")
      .select("name, location_name, default_coordinates")
      .in("id", sourceIdList)
      .not("default_coordinates", "is", null)
      .limit(5);

    // Send comprehensive Slack notification using Block Kit
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚀 Scrape Coordinator: Jobs Enqueued",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Total Municipalities Checked:*\n${sources.length}`,
          },
          {
            type: "mrkdwn",
            text: `*Jobs Created:*\n${jobsCreated}`,
          },
          {
            type: "mrkdwn",
            text: `*New Events (24h):*\n${recentEventsCount || 0}`,
          },
          {
            type: "mrkdwn",
            text: `*Worker Triggered:*\n${triggerWorker ? "✅ Yes" : "❌ No"}`,
          },
        ],
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*📊 Persona Impact (24h)*",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Family Events:*\n👨‍👩‍👧‍👦 ${familyCount}`,
          },
          {
            type: "mrkdwn",
            text: `*Social Events:*\n🍷 ${socialCount}`,
          },
        ],
      },
    ];

    // Add error section if there are failed sources
    if (failedSources && failedSources.length > 0) {
      blocks.push(
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*⚠️ Recent Errors (24h)*",
          },
        }
      );

      const errorList = failedSources
        .map((src) => `• *${src.name}*: ${src.last_error || "Unknown error"}\n  _URL:_ ${src.url}`)
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: errorList.slice(0, 2000), // Slack limit
        },
      });
    }

    // Add geofencing preview section
    if (sourcesWithCoords && sourcesWithCoords.length > 0) {
      blocks.push(
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*📍 Geofencing Sample*",
          },
        }
      );

      const coordsList = sourcesWithCoords
        .map((src) => {
          const coords = src.default_coordinates as { lat: number; lng: number } | null;
          if (coords) {
            return `• *${src.name}* (${src.location_name || "N/A"}): \`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}\``;
          }
          return `• *${src.name}*: No coordinates`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: coordsList,
        },
      });
    }

    // Send the Slack notification
    await sendSlackNotification({ blocks }, false);

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

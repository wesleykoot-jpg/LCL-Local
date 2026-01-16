import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendSlackNotification } from "../_shared/slack.ts";
import { withErrorLogging, logSupabaseError } from "../_shared/errorLogging.ts";
import type { ScrapeJobPayload } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_INTERVAL_MINUTES = 15;
const MAX_INTERVAL_MINUTES = 24 * 60;
const CIRCUIT_BREAKER_THRESHOLD = 3;

/**
 * Scrape Coordinator
 * 
 * This lightweight function enqueues scrape jobs for all available sources.
 * It does minimal CPU work - just database queries to create jobs.
 * Sends comprehensive Slack notifications with Block Kit formatting.
 * 
 * Scaling Improvements:
 * - Uses next_scrape_at scheduling with volatility-based intervals
 * - Respects circuit breaker logic for consecutive errors
 * 
 * Usage:
 * POST /functions/v1/scrape-coordinator
 * Body (optional): { "sourceIds": ["uuid1", "uuid2"] }
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return withErrorLogging(
    'scrape-coordinator',
    'handler',
    'Process coordinator request',
    async () => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase env vars");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const nowIso = now.toISOString();
    const cooldownCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const calculateNextScrapeAt = (volatilityScore: number): string => {
      const score = Math.min(1, Math.max(0, volatilityScore));
      const intervalMinutes = Math.round(
        MAX_INTERVAL_MINUTES - score * (MAX_INTERVAL_MINUTES - MIN_INTERVAL_MINUTES)
      );
      return new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();
    };

    // Parse optional request body
    let options: { sourceIds?: string[] } = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        options = body ? JSON.parse(body) : {};
      } catch {
        options = {};
      }
    }

    const { sourceIds } = options;

    // Get available sources - filter for enabled, not auto-disabled sources
    let query = supabase
      .from("scraper_sources")
      .select("id, name, volatility_score, next_scrape_at, last_scraped_at, consecutive_errors")
      .eq("enabled", true)
      .or("auto_disabled.is.null,auto_disabled.eq.false");
    
    if (sourceIds && sourceIds.length > 0) {
      query = query.in("id", sourceIds);
    }

    const { data: sources, error: sourcesError } = await query;
    if (sourcesError) throw new Error(sourcesError.message);

    const eligibleSources = (sources || []).filter((source) => {
      const nextScrapeAt = source.next_scrape_at ?? null;
      if (nextScrapeAt && new Date(nextScrapeAt) > now) {
        return false;
      }
      const lastScrapedAt = source.last_scraped_at ?? null;
      const consecutiveErrors = source.consecutive_errors ?? 0;
      if (consecutiveErrors < CIRCUIT_BREAKER_THRESHOLD) {
        return true;
      }
      if (!lastScrapedAt) {
        return false;
      }
      return new Date(lastScrapedAt) <= new Date(cooldownCutoff);
    });

    if (eligibleSources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No enabled sources to queue", jobsCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobs = eligibleSources.map((source) => ({
      source_id: source.id,
      payload: {
        sourceId: source.id,
        scheduledAt: nowIso,
      } satisfies ScrapeJobPayload,
      next_scrape_at: calculateNextScrapeAt(source.volatility_score ?? 0.5),
    }));

    const { data: insertedJobs, error: insertError } = await supabase
      .rpc("enqueue_scrape_jobs", { p_jobs: jobs });

    if (insertError) {
      await logSupabaseError(
        'scrape-coordinator',
        'handler',
        'Insert scrape jobs',
        insertError,
        { job_count: jobs.length }
      );
      throw new Error(insertError.message);
    }

    const jobsCreated = insertedJobs?.length || 0;
    console.log(`Coordinator: Enqueued ${jobsCreated} jobs for sources: ${eligibleSources.map((s) => s.name).join(", ")}`);

    await sendSlackNotification(
      `🚀 Scrape Coordinator: queued ${jobsCreated} jobs for ${eligibleSources.length} sources`,
      false
    );

    return new Response(
      JSON.stringify({
        success: true,
        jobsCreated,
        sources: eligibleSources.map((s) => ({ id: s.id, name: s.name })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    },
    {
      method: req.method,
      url: req.url,
    }
  ).catch((error) => {
    console.error("Coordinator error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  });
});

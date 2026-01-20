
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

import type { ScrapeJobPayload, ScraperSource } from "../_shared/types.ts";
import { createFetcherForSource, resolveStrategy } from "../_shared/strategies.ts";
import { sendSlackNotification } from "../_shared/slack.ts";
import { logError, logWarning } from "../_shared/errorLogging.ts";
import { jitteredDelay } from "../_shared/rateLimiting.ts";

// Data-First Pipeline imports
import { fingerprintCMS, getTierConfig } from "../_shared/cmsFingerprinter.ts";
import { runExtractionWaterfall, type ExtractionStrategy } from "../_shared/dataExtractors.ts";
import { type RawEventCard } from "../_shared/types.ts";
import { logScraperInsight } from "../_shared/scraperInsights.ts";
import { hashPayload } from "../_shared/scraperUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;

// ============ Helper Functions ============

async function insertStagingRows(supabase: SupabaseClient, rows: Record<string, any>[]) {
  if (rows.length === 0) return true;
  const { error } = await supabase.from("raw_event_staging").insert(rows);
  if (error) {
    if (error.code === '42P01') { // Undefined table
       console.error("Missing table 'raw_event_staging'. Did you run the migration?");
       // Fallback to schema-qualified name if simple name fails (though supabase client usually handles search_path)
       const { error: retryError } = await supabase.from("scraper.raw_event_staging").insert(rows);
       if (retryError) {
         console.error("Staging insert failed (retry):", retryError.message);
         return false;
       }
       return true;
    }
    console.error("Staging insert failed:", error.message);
    return false;
  }
  return true;
}

// ============ Worker Logic ============

interface ScrapeJobRecord {
  id: string;
  source_id: string;
  payload: ScrapeJobPayload | null;
  attempts: number;
  max_attempts: number;
}

async function claimScrapeJobs(supabase: SupabaseClient, batchSize: number): Promise<ScrapeJobRecord[]> {
  const { data, error } = await supabase.rpc("claim_scrape_jobs", { p_batch_size: batchSize });
  if (error) {
    console.error("Failed to claim jobs:", error.message);
    return [];
  }
  // Map RPC output to interface (same as before)
  return (data ?? []).map((row: any) => ({
    id: row.out_id,
    source_id: row.out_source_id,
    payload: row.out_payload,
    attempts: row.out_attempts,
    max_attempts: row.out_max_attempts,
  }));
}

async function updateSourceStats(supabase: SupabaseClient, sourceId: string, scraped: number, success: boolean, lastError?: string) {
  try {
    await supabase.rpc("update_scraper_source_stats", {
      p_source_id: sourceId,
      p_events_scraped: scraped,
      p_success: success,
      p_last_error: lastError ?? null,
    });
  } catch (err) {
    console.warn("Stats update failed", err);
  }
}

async function completeJob(supabase: SupabaseClient, jobId: string, eventsScraped: number) {
  // synced events = 0 because they are pending processing
  await supabase.from("scrape_jobs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    events_scraped: eventsScraped,
    events_inserted: 0, 
  }).eq("id", jobId);
}

async function failJob(supabase: SupabaseClient, jobId: string, payload: any, errorMessage: string) {
  await supabase.from("scrape_jobs").update({
    status: "failed",
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
    payload,
  }).eq("id", jobId);
}

async function processSingleSource(
  supabase: SupabaseClient,
  source: ScraperSource,
  enableDeepScraping: boolean,
  useProxy: boolean = false
): Promise<{ scraped: number; staged: number; failed: number }> {
  const stats = { scraped: 0, staged: 0, failed: 0 };
  const startTime = Date.now();

  const strategy = resolveStrategy((source as any).strategy, source);
  const fetcher = createFetcherForSource(source, { useProxy });
  const rateLimit = source.config.rate_limit_ms ?? 200;
  
  // Get tier-specific configuration
  const tier = source.tier || 'general';
  const tierConfig = getTierConfig(tier);
  const shouldDeepScrape = source.deep_scrape_enabled ?? tierConfig.deepScrapeEnabled ?? enableDeepScraping;
  const feedDiscovery = source.config.feed_discovery ?? tierConfig.feedGuessing ?? false;

  // 1. Discover and fetch listing
  const candidates = await strategy.discoverListingUrls(fetcher);
  let listingHtml = "";
  let listingUrl = source.url;
  let fetchTimeMs = 0;

  const fetchStart = Date.now();
  for (const candidate of candidates) {
    const resp = await strategy.fetchListing(candidate, fetcher);
    // ... proxy retry logic could go here ...
    if (resp.status === 200 && resp.html) {
      listingHtml = resp.html;
      listingUrl = resp.finalUrl || candidate;
      break;
    }
  }
  fetchTimeMs = Date.now() - fetchStart;

  if (!listingHtml) throw new Error("No valid listing found");

  // 2. Data-First Waterfall
  const cmsFingerprint = fingerprintCMS(listingHtml);
  console.log(`[${source.name}] CMS: ${cmsFingerprint.cms}`);
  
  const preferredMethod = source.preferred_method || 'auto';
  // Note: ExtractionMethod includes 'auto'
  const validStrategies: ExtractionStrategy[] = ['hydration', 'json_ld', 'feed', 'dom'];
  const mappedMethod = preferredMethod === 'auto' ? 'auto' : 
    validStrategies.includes(preferredMethod as ExtractionStrategy) ? preferredMethod as ExtractionStrategy : 'auto';

  const parseStart = Date.now();
  const waterfallResult = await runExtractionWaterfall(listingHtml, {
    baseUrl: listingUrl,
    sourceName: source.name,
    preferredMethod: mappedMethod,
    feedDiscovery: feedDiscovery,
    domSelectors: source.config.selectors,
    fetcher: { // Adapter for feed extraction active fetching
       fetch: async (url) => {
         const r = await fetcher.fetchPage(url);
         return { html: r.html, status: r.statusCode };
       }
    }
  });
  const parseTimeMs = Date.now() - parseStart;
  
  console.log(`[${source.name}] Waterfall: ${waterfallResult.winningStrategy} found ${waterfallResult.totalEvents}`);
  stats.scraped = waterfallResult.events.length;

  // 3. Log Insights
  await logScraperInsight(supabase, {
    sourceId: source.id,
    waterfallResult,
    cmsFingerprint,
    executionTimeMs: Date.now() - startTime,
    fetchTimeMs,
    parseTimeMs,
    htmlSizeBytes: listingHtml.length,
  }).catch(e => console.warn("Insight log failed", e));

  // 4. Transform and Stage
  const stagingBatch: any[] = [];
  
  for (const raw of waterfallResult.events) {
    let detailHtml: string | null = null;
    
    // Deep Scrape (Fetch Only)
    if (shouldDeepScrape && raw.detailUrl) {
      try {
        const detailUrl = raw.detailUrl.startsWith('http') ? raw.detailUrl : new URL(raw.detailUrl, listingUrl).href;
        const res = await fetcher.fetchPage(detailUrl);
        if (res.statusCode === 200) {
           detailHtml = res.html;
        }
        await jitteredDelay(rateLimit, 10);
      } catch (e) {
        console.warn(`Deep fetch failed for ${raw.detailUrl}`, e);
      }
    }

    // Delta Detection: Compute hash and check against source's last hash
    const payloadHash = await hashPayload(raw);
    const isUnchanged = source.last_payload_hash === payloadHash;

    stagingBatch.push({
      source_id: source.id,
      url: raw.detailUrl || listingUrl,
      raw_payload: raw,
      detail_html: detailHtml,
      status: isUnchanged ? 'skipped_no_change' : 'pending',
      parsing_method: null, // Will be set by processor
      fetch_metadata: {
        fetched_at: new Date().toISOString(),
        strategy: waterfallResult.winningStrategy,
        listing_url: listingUrl,
        payload_hash: payloadHash,
        delta_skipped: isUnchanged
      }
    });

    if (stagingBatch.length >= 10) {
      if (await insertStagingRows(supabase, stagingBatch)) {
        stats.staged += stagingBatch.length;
      } else {
        stats.failed += stagingBatch.length;
      }
      stagingBatch.length = 0;
    }
  }

  if (stagingBatch.length > 0) {
     if (await insertStagingRows(supabase, stagingBatch)) {
        stats.staged += stagingBatch.length;
     } else {
        stats.failed += stagingBatch.length;
     }
  }

  return stats;
}

// Main logic
if (import.meta.main) {
  serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Simple body parse
      let options: { enableDeepScraping?: boolean } = {};
      try { options = await req.json(); } catch {}
      
      const jobs = await claimScrapeJobs(supabase, BATCH_SIZE);
      if (jobs.length === 0) {
        return new Response(JSON.stringify({ message: "No jobs" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`Worker: Processing ${jobs.length} jobs (ELT Mode)`);

      const results = await Promise.allSettled(jobs.map(async job => {
        const payload = job.payload || {};
        try {
          const { data: source } = await supabase.from("scraper_sources").select("*").eq("id", job.source_id).single();
          if (!source) throw new Error("Source not found");

          const stats = await processSingleSource(supabase, source as ScraperSource, options.enableDeepScraping || false, !!payload.proxyRetry);
          
          await updateSourceStats(supabase, source.id, stats.scraped, stats.staged > 0);
          await completeJob(supabase, job.id, stats.scraped);
          
          return { jobId: job.id, status: "completed", stats };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`Job ${job.id} failed:`, msg);
          await failJob(supabase, job.id, payload, msg);
          await updateSourceStats(supabase, job.source_id, 0, false, msg);
          await logError({
             level: 'error', 
             source: 'scrape-worker', 
             message: `ELT Job Failed: ${msg}`, 
             context: { jobId: job.id, sourceId: job.source_id } 
          });
          return { jobId: job.id, status: "failed", error: msg };
        }
      }));

      // Summarize
      const completed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'completed').length;
      return new Response(JSON.stringify({ 
         success: true, 
         processed: jobs.length, 
         completed 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err) {
      console.error("Worker Critical Failure:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  });
}

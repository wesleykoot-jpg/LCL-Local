import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";


import type { ScrapeJobPayload, ScraperSource, NormalizedEvent } from "../_shared/types.ts";
import { createFetcherForSource, resolveStrategy } from "../_shared/strategies.ts";
import { sendSlackNotification } from "../_shared/slack.ts";
import { logError, logWarning, logSupabaseError } from "../_shared/errorLogging.ts";
import { 
  extractTimeFromHtml,
  normalizeEventDateForStorage,
  createContentHash,
  createEventFingerprint,
  cheapNormalizeEvent,
  eventToText
} from "../_shared/scraperUtils.ts";

import { jitteredDelay } from "../_shared/rateLimiting.ts";
import { parseEventWithAI, healSelectors, generateEmbedding } from "../_shared/aiParsing.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dynamically calculate target year (current year, or configurable via env)
function getTargetYear(): number {
  const envYear = Deno.env.get("TARGET_EVENT_YEAR");
  if (envYear) {
    const parsed = parseInt(envYear, 10);
    if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) {
      return parsed;
    }
  }
  return new Date().getFullYear();
}

const TARGET_YEAR = getTargetYear();
const DEFAULT_EVENT_TYPE = "anchor";
const BATCH_SIZE = 20;

class ProxyRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProxyRetryError";
  }
}

// ============ Helper Functions (copied from scrape-events for isolation) ============





async function contentHashExists(supabase: SupabaseClient, contentHash: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("content_hash", contentHash)
    .limit(1);
  if (error) {
    console.warn("Content hash lookup failed", error.message);
    return false;
  }
  return (data && data.length > 0) || false;
}

async function fingerprintExists(supabase: SupabaseClient, sourceId: string, fingerprint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("source_id", sourceId)
    .eq("event_fingerprint", fingerprint)
    .limit(1);
  if (error) {
    console.warn("Fingerprint lookup failed", error.message);
    return false;
  }
  return (data && data.length > 0) || false;
}

async function insertEvent(supabase: SupabaseClient, event: Record<string, unknown>, sourceId: string): Promise<boolean> {
  const { error } = await supabase.from("events").insert(event);
  if (error) {
    console.error("Insert failed", error.message);
    // Log to centralized error_logs table
    await logSupabaseError('scrape-worker', 'insertEvent', 'Event insert', error, {
      source_id: sourceId,
      event_title: event.title,
      event_date: event.event_date,
      fingerprint: event.event_fingerprint,
    });
    return false;
  }
  return true;
}

async function updateSourceStats(
  supabase: SupabaseClient,
  sourceId: string,
  scraped: number,
  success: boolean,
  lastError?: string
) {
  try {
    await supabase.rpc("update_scraper_source_stats", {
      p_source_id: sourceId,
      p_events_scraped: scraped,
      p_success: success,
      p_last_error: lastError ?? null,
    });
  } catch (error) {
    console.warn("update_scraper_source_stats failed", error);
    await logWarning('scrape-worker', 'updateSourceStats', `Stats update failed for source ${sourceId}`, {
      source_id: sourceId,
      scraped,
      success,
      error: String(error),
    });
  }
}

/**
 * Self-healing fetcher logic: Check if source needs fetcher_type change
 */
async function checkAndHealFetcher(
  supabase: SupabaseClient,
  sourceId: string,
  eventsFound: number,
  httpStatus: number
): Promise<{ healed: boolean; newFetcher?: string }> {
  try {
    const { data, error } = await supabase.rpc("check_and_heal_fetcher", {
      p_source_id: sourceId,
      p_events_found: eventsFound,
      p_http_status: httpStatus,
    });

    if (error) {
      console.warn("check_and_heal_fetcher failed:", error.message);
      return { healed: false };
    }

    if (data?.healed) {
      console.log(
        `Self-healing: Switched ${data.source_name} from ${data.old_fetcher} to ${data.new_fetcher}`
      );
    }

    return {
      healed: data?.healed || false,
      newFetcher: data?.new_fetcher,
    };
  } catch (error) {
    console.warn("checkAndHealFetcher error:", error);
    return { healed: false };
  }
}

// ============ Worker Logic ============

interface ScrapeJobRecord {
  id: string;
  source_id: string;
  payload: ScrapeJobPayload | null;
  attempts: number;
  max_attempts: number;
}

export async function claimScrapeJobs(
  supabase: SupabaseClient,
  batchSize: number
): Promise<ScrapeJobRecord[]> {
  const { data, error } = await supabase.rpc("claim_scrape_jobs", {
    p_batch_size: batchSize,
  });

  if (error) {
    console.error("Failed to claim jobs:", error.message);
    return [];
  }

  // Map RPC output (out_*) to ScrapeJobRecord interface
  interface ClaimedJob {
    out_id: string;
    out_source_id: string;
    // deno-lint-ignore no-explicit-any
    out_payload: any;
    out_attempts: number;
    out_max_attempts: number;
  }
  return (data ?? []).map((row: ClaimedJob) => ({
    id: row.out_id,
    source_id: row.out_source_id,
    payload: row.out_payload,
    attempts: row.out_attempts,
    max_attempts: row.out_max_attempts,
  }));
}

async function completeJob(
  supabase: SupabaseClient,
  jobId: string,
  eventsScraped: number,
  eventsInserted: number
) {
  await supabase
    .from("scrape_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      events_scraped: eventsScraped,
      events_inserted: eventsInserted,
    })
    .eq("id", jobId);
}

async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  payload: ScrapeJobPayload,
  errorMessage: string
) {
  await supabase
    .from("scrape_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      payload,
    })
    .eq("id", jobId);
}

async function processSingleSource(
  supabase: SupabaseClient,
  source: ScraperSource,
  geminiApiKey: string | undefined,
  enableDeepScraping: boolean,
  useProxy: boolean = false
): Promise<{ scraped: number; inserted: number; duplicates: number; failed: number }> {
  const stats = { scraped: 0, inserted: 0, duplicates: 0, failed: 0 };

  const strategy = resolveStrategy((source as { strategy?: string }).strategy, source);
  const fetcher = createFetcherForSource(source, { useProxy });
  const rateLimit = source.config.rate_limit_ms ?? 200;

  // Discover and fetch listing
  const candidates = await strategy.discoverListingUrls(fetcher);
  let listingHtml = "";
  let listingUrl = source.url;

  for (const candidate of candidates) {
    const resp = await strategy.fetchListing(candidate, fetcher);
    if (resp.status === 403 || resp.status === 429) {
      const message = `Source ${source.name} returned ${resp.status} for ${candidate}`;
      console.warn(message);
      // If we aren't already using a proxy, throw to trigger a retry with proxy
      if (!useProxy) {
        throw new ProxyRetryError(message);
      } else {
        console.error(`Source ${source.name} still blocked despite proxy use.`);
      }
    }
    if (resp.status === 404 || !resp.html) continue;
    listingHtml = resp.html;
    listingUrl = resp.finalUrl || candidate;
    break;
  }

  if (!listingHtml) {
    throw new Error("No valid listing found");
  }

  const rawEvents = await strategy.parseListing(listingHtml, listingUrl, { enableDebug: false, fetcher });
  stats.scraped = rawEvents.length;

  // Auto-Healing Logic
  if (stats.scraped === 0 && listingHtml.length > 2000 && geminiApiKey) {
      console.log(`Zero events found for ${source.name}. Attempting to heal...`);
      
      // 1. Check if we need to switch fetcher
      const { healed } = await checkAndHealFetcher(supabase, source.id, 0, 200);
      if (healed) {
          console.log("Fetcher switched. Stopping current run to allow retry with new fetcher.");
          return stats; 
      }

      // 2. If fetcher is fine, check selectors
      console.log("Fetcher seems fine. Attempting to heal selectors...");
      const suggestedSelectors = await healSelectors(geminiApiKey, listingHtml, fetch);
      
      if (suggestedSelectors && suggestedSelectors.length > 0) {
        console.log(`Healed selectors for ${source.name}:`, suggestedSelectors);
        
        // Update DB
        const newConfig = { ...(source.config || {}), selectors: suggestedSelectors };
        const { error } = await supabase
            .from("scraper_sources")
            .update({ config: newConfig })
            .eq("id", source.id);
            
        if (!error) {
            console.log("Source config updated with new selectors.");
            await sendSlackNotification(`🩹 Auto-healed selectors for ${source.name}: \`${JSON.stringify(suggestedSelectors)}\``, false);
            
            // Re-parse with new selectors
            source.config = newConfig; 
            const healedEvents = await strategy.parseListing(listingHtml, listingUrl, { enableDebug: false, fetcher });
            if (healedEvents.length > 0) {
                console.log(`Re-scraped ${healedEvents.length} events with new selectors!`);
                rawEvents.push(...healedEvents);
                stats.scraped = rawEvents.length;
            }
        }
      }
  }

  // Deep scraping for detail page times
  if (enableDeepScraping) {
    for (const raw of rawEvents) {
      if (!raw.detailUrl || raw.detailPageTime) continue;
      // Re-use fetchEventDetailTime from shared utils if we move it, or keep using the one in scrape-events/shared.ts import
      // But we are in scrape-worker. We need to import it properly.
      // Since we haven't promoted fetchEventDetailTime to _shared/scraperUtils fully (it needs cheerio),
      // we will use the one we imported or duplicated.
      // Ideally, we should have moved fetchEventDetailTime to _shared/scraperUtils but it depends on cheerio and fetcher.
      // For now, we utilize the local helper loop which we should have replaced.
      // Wait, we removed the local helper in the 'Remove डुplication' step? No, we need to import it.
      // Actually, let's use the one we defined in _shared or define a simple one here using the updated fetcher.
      // Since checking detail time is complex, let's skip re-implementing it inline if possible or keep strict logic.
      
      // We will assume for this Refactor that we want to use the ROBUST fetcher.
      // Let's implement a simplified robust version here or call a shared one.
      // We'll skip deep scraping logic optimization for this specific chunk to focus on structure,
      // but we MUST use the 'fetcher' we created with proxy support.
      
      try {
          // Temporary inline logic - ideally this moves to a shared 'ScraperService' class
          const { html } = await fetcher.fetchPage(raw.detailUrl.startsWith('http') ? raw.detailUrl : new URL(raw.detailUrl, listingUrl).href);
          const extractedTime = extractTimeFromHtml(html); // from _shared/scraperUtils
          if (extractedTime) raw.detailPageTime = extractedTime;
      } catch (e) {
          console.warn(`Failed to deep scrape ${raw.detailUrl}:`, e);
      }
      
      // Use shared jitteredDelay
      await jitteredDelay(rateLimit, 20);
    }
  }

  // Process each event
  for (const raw of rawEvents) {
    let normalized = cheapNormalizeEvent(raw, source);

    // Use AI if needed (this is Wall Clock time, not CPU time!)
    if ((!normalized || normalized.event_time === "TBD" || !normalized.description) && geminiApiKey) {
      const aiResult = await parseEventWithAI(geminiApiKey, raw, fetch, { 
        targetYear: TARGET_YEAR, 
        language: source.language || "nl" 
      });
      if (aiResult) normalized = aiResult as NormalizedEvent; // Type cast as NormalizedEvent to match local interface
    }

    if (!normalized) {
      stats.failed++;
      continue;
    }

    const contentHash = await createContentHash(normalized.title, normalized.event_date); // _shared
    const contentExists = await contentHashExists(supabase, contentHash);
    if (contentExists) {
      stats.duplicates++;
      continue;
    }

    const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, source.id); // _shared
    const exists = await fingerprintExists(supabase, source.id, fingerprint);
    if (exists) {
      stats.duplicates++;
      continue;
    }

    const normalizedDate = normalizeEventDateForStorage(
      normalized.event_date,
      normalized.event_time === "TBD" ? "12:00" : normalized.event_time
    ); // _shared

    // Semantic De-Duplication
    // Only strictly if we have an API key and the event passed basic deduplication
    // This catches "Jazz in Park" vs "Jazz @ Park" variations on same day
    let semanticDuplicate = false;
    let embedding: number[] | null = null;
    
    if (geminiApiKey) {
        const textToEmbed = eventToText(normalized);
        const embedResult = await generateEmbedding(geminiApiKey, textToEmbed, fetch);
        if (embedResult) {
            embedding = embedResult.embedding;
            // Check for existing similar events
            if (embedding) {
               const { data: matches } = await supabase.rpc("match_events", {
                   query_embedding: embedding,
                   match_threshold: 0.95, // Very strict
                   match_count: 1
               });
               
               if (matches && matches.length > 0) {
                   const match = matches[0];
                   // Check date proximity (within 24h)
                   const matchDate = new Date(match.event_date).getTime();
                   const currentDate = new Date(normalizedDate.timestamp).getTime();
                   const diffHours = Math.abs(matchDate - currentDate) / (1000 * 60 * 60);
                   
                   if (diffHours < 24) {
                       console.log(`Semantic duplicate found: "${normalized.title}" ~= "${match.title}" (${match.similarity.toFixed(4)})`);
                       semanticDuplicate = true;
                   }
               }
            }
        }
    }

    if (semanticDuplicate) {
        stats.duplicates++;
        continue;
    }

    const defaultCoords = source.default_coordinates || source.config.default_coordinates;
    const point = defaultCoords ? `POINT(${defaultCoords.lng} ${defaultCoords.lat})` : "POINT(0 0)";

    // Log warning if coordinates are missing
    if (!defaultCoords) {
      console.warn(`No coordinates found for source: ${source.name} (${source.id}). Using fallback POINT(0 0)`);
    }

    const eventInsert = {
      title: normalized.title,
      description: normalized.description || "",
      category: normalized.internal_category,
      event_type: DEFAULT_EVENT_TYPE,
      venue_name: normalized.venue_name || source.name,
      location: point,
      event_date: normalizedDate.timestamp,
      event_time: normalized.event_time,
      image_url: normalized.image_url,
      created_by: null,
      status: "published",
      source_id: source.id,
      event_fingerprint: fingerprint,
      content_hash: contentHash,
      embedding: embedding, // Store the embedding we generated!
      embedding_generated_at: embedding ? new Date().toISOString() : null,
      embedding_model: embedding ? 'gemini-text-embedding-004' : null,
    };

    const inserted = await insertEvent(supabase, eventInsert, source.id);
    if (inserted) {
      stats.inserted++;
    } else {
      stats.failed++;
    }

    await jitteredDelay(rateLimit, 20);
  }

  return stats;
}

export async function processJob(
  supabase: SupabaseClient,
  job: ScrapeJobRecord,
  geminiApiKey: string | undefined,
  enableDeepScraping: boolean
): Promise<{
  jobId: string;
  sourceId: string;
  status: "completed" | "failed";
  stats?: { scraped: number; inserted: number; duplicates: number; failed: number };
  error?: string;
}> {
  const payload: ScrapeJobPayload = {
    sourceId: job.payload?.sourceId ?? job.source_id,
    scheduledAt: job.payload?.scheduledAt ?? new Date().toISOString(),
    proxyRetry: job.payload?.proxyRetry,
  };

  const { data: sourceData, error: sourceError } = await supabase
    .from("scraper_sources")
    .select("*")
    .eq("id", job.source_id)
    .single();

  if (sourceError || !sourceData) {
    const errorMessage = `Source not found: ${sourceError?.message || "Unknown"}`;
    await failJob(supabase, job.id, payload, errorMessage);
    await updateSourceStats(supabase, job.source_id, 0, false, errorMessage);
    return { jobId: job.id, sourceId: job.source_id, status: "failed", error: errorMessage };
  }



  const source = sourceData as ScraperSource;


  try {
    const stats = await processSingleSource(
      supabase, 
      source, 
      geminiApiKey, 
      enableDeepScraping,
      !!payload.proxyRetry // Pass the proxy flag from the specific job payload
    );

    await updateSourceStats(supabase, source.id, stats.scraped, stats.scraped > 0);

    // checkAndHealFetcher moved to processSingleSource

    await completeJob(supabase, job.id, stats.scraped, stats.inserted);

    const defaultCoords = source.default_coordinates || source.config?.default_coordinates;
    const coordsInfo = defaultCoords
      ? `📍 ${defaultCoords.lat.toFixed(4)}, ${defaultCoords.lng.toFixed(4)}`
      : "📍 No coordinates";

    const message = `✅ Job ${job.id} completed\n` +
      `Source: ${source.name}\n` +
      `Scraped: ${stats.scraped} | Inserted: ${stats.inserted} | Duplicates: ${stats.duplicates}\n` +
      `${coordsInfo}`;
    await sendSlackNotification(message, false);

    return { jobId: job.id, sourceId: source.id, status: "completed", stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const proxyRetry = error instanceof ProxyRetryError;
    
    // Special handling for ProxyRetryError: Reschedule instead of failing
    if (proxyRetry && !payload.proxyRetry) {
      console.log(`Rescheduling job ${job.id} for proxy retry due to error: ${errorMessage}`);
      payload.proxyRetry = true;
      
      // Reset job to pending with updated payload to trigger retry with proxy
      await supabase
        .from("scrape_jobs")
        .update({
          status: "pending",
          payload: payload,
          error_message: `Rescheduling for proxy retry: ${errorMessage}`,
          // Note: We leave attempts as is, or claim_scrape_jobs will increment it next time
        })
        .eq("id", job.id);

      const message = `🔄 Job ${job.id} rescheduling with PROXY for source "${source.name}"`;
      await sendSlackNotification(message, false);

      // Return completed status for this run so the worker considers it "handled"
      // But we log it as a reschedule
      return { 
        jobId: job.id, 
        sourceId: source.id, 
        status: "completed", 
        error: "Rescheduled for proxy retry" 
      };
    }

    // Standard Failure Handling
    await logError({
      level: 'error',
      source: 'scrape-worker',
      function_name: 'processSingleSource',
      message: `Job ${job.id} failed for source "${source.name}": ${errorMessage}`,
      error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
      stack_trace: error instanceof Error ? error.stack : undefined,
      context: {
        job_id: job.id,
        source_id: source.id,
        source_name: source.name,
        source_url: source.url,
        attempts: job.attempts,
        proxy_retry: proxyRetry,
      },
    });

    await failJob(supabase, job.id, payload, errorMessage);
    await updateSourceStats(supabase, source.id, 0, false, errorMessage);

    const message = `❌ Job ${job.id} failed\n` +
      `Source: ${source.name}\n` +
      `Error: ${errorMessage}\n` +
      `Proxy retry: ${proxyRetry ? "already attempted" : "no"}`;
    await sendSlackNotification(message, true);

    return { jobId: job.id, sourceId: source.id, status: "failed", error: errorMessage };
  }
}

/**
 * Scrape Worker
 *
 * Processes a batch of sources per invocation using concurrent execution.
 *
 * Usage:
 * POST /functions/v1/scrape-worker
 * Body (optional): { "enableDeepScraping": true }
 */
if (import.meta.main) {
  serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase env vars");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Parse options
      let options: { enableDeepScraping?: boolean } = {};
      if (req.method === "POST") {
        try {
          const body = await req.text();
          options = body ? JSON.parse(body) : {};
        } catch {
          options = {};
        }
      }

      const { enableDeepScraping = true } = options;

      const jobs = await claimScrapeJobs(supabase, BATCH_SIZE);

      if (jobs.length === 0) {
        console.log("Worker: No pending jobs to process");
        return new Response(
          JSON.stringify({ success: true, message: "No pending jobs", processed: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Worker: Processing ${jobs.length} jobs`);

      const results = await Promise.allSettled(
        jobs.map((job) => processJob(supabase, job, geminiApiKey, enableDeepScraping))
      );

      const summary = results.reduce(
        (acc, result) => {
          if (result.status === "fulfilled") {
            acc.processed += 1;
            if (result.value.status === "completed") {
              acc.completed += 1;
            } else {
              acc.failed += 1;
            }
            acc.results.push(result.value);
          } else {
            acc.processed += 1;
            acc.failed += 1;
            acc.results.push({
              jobId: "unknown",
              sourceId: "unknown",
              status: "failed",
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
          }
          return acc;
        },
        {
          processed: 0,
          completed: 0,
          failed: 0,
          results: [] as Array<{
            jobId: string;
            sourceId: string;
            status: "completed" | "failed";
            stats?: { scraped: number; inserted: number; duplicates: number; failed: number };
            error?: string;
          }>,
        }
      );

      const allJobsSucceeded = summary.failed === 0;

      // Chain-triggering: if we processed a full batch, check for more jobs
      if (jobs.length === BATCH_SIZE) {
        const { count } = await supabase
          .from("scrape_jobs")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        if (count && count > 0) {
          console.log(`Worker: ${count} more jobs pending, chain-triggering...`);
          fetch(`${supabaseUrl}/functions/v1/scrape-worker`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(options),
          }).catch((err) => console.error("Failed to chain-trigger worker:", err));
        }
      }

      return new Response(
        JSON.stringify({
          success: allJobsSucceeded,
          allJobsSucceeded,
          processed: true,
          batchSize: jobs.length,
          summary,
        }),
        { status: allJobsSucceeded ? 200 : 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Worker error:", error);
      // Log top-level errors
      await logError({
        level: 'fatal',
        source: 'scrape-worker',
        function_name: 'serve',
        message: `Worker fatal error: ${error instanceof Error ? error.message : String(error)}`,
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
        stack_trace: error instanceof Error ? error.stack : undefined,
      });
      return new Response(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  });
}

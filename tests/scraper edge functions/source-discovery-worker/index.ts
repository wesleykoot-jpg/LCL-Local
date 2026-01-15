import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendSlackNotification } from "../_shared/slack.ts";
import { 
  CATEGORIES, 
  classifyTextToCategory 
} from "../_shared/categoryMapping.ts";
import { logError, logWarning, logInfo, logSupabaseError } from "../_shared/errorLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Source Discovery Worker
 * 
 * Processes ONE municipality discovery job at a time.
 * Self-chains to process the next pending job until queue is empty.
 * 
 * This avoids edge function timeouts by handling one city per invocation.
 */

const CONFIG = {
  MAX_HTML_CHARS_FOR_LLM: 5000,
  URL_FETCH_TIMEOUT_MS: 10000,
  SERPER_API_TIMEOUT_MS: 15000,
  AUTO_ENABLE_CONFIDENCE_THRESHOLD: 90,
  MIN_VALIDATION_CONFIDENCE: 60,
  SELF_CHAIN_DELAY_MS: 500,
};

const NOISE_DOMAINS = [
  "tripadvisor.", "facebook.com", "booking.com", "instagram.com",
  "twitter.com", "x.com", "linkedin.com", "pinterest.com",
  "youtube.com", "tiktok.com", "yelp.", "groupon.", "expedia.",
  "hotels.", "airbnb.", "marktplaats.nl", "wikipedia.org",
];

const DUTCH_MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december"
];

interface DiscoveryJob {
  id: string;
  municipality: string;
  population: number;
  province: string;
  coordinates: { lat: number; lng: number };
  status: string;
  attempts: number;
  batch_id: string;
}

interface DiscoveredSource {
  url: string;
  name: string;
  municipality: string;
  confidence: number;
  coordinates: { lat: number; lng: number };
  enabled?: boolean;
}

function isNoiseDomain(url: string): boolean {
  const lower = url.toLowerCase();
  return NOISE_DOMAINS.some(domain => lower.includes(domain));
}

function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let path = parsed.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return url;
  }
}

function generateSearchQueries(municipalityName: string): string[] {
  const name = municipalityName.toLowerCase();
  return [
    `uitagenda ${name}`,
    `evenementen ${name}`,
    `agenda activiteiten ${name}`,
    `wat te doen in ${name}`,
    `festivals ${name} 2026`,
  ];
}

async function callSerperWithRetry(
  query: string,
  apiKey: string,
  maxRetries: number = 3
): Promise<Array<{ link: string; title: string; snippet: string }>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          gl: "nl",
          hl: "nl",
          num: 10,
        }),
        signal: AbortSignal.timeout(CONFIG.SERPER_API_TIMEOUT_MS),
      });

      if (response.ok) {
        const data = await response.json();
        return (data.organic || []).map((r: { link: string; title: string; snippet: string }) => ({
          link: r.link,
          title: r.title || "",
          snippet: r.snippet || "",
        }));
      }

      if (response.status === 401 || response.status === 403) {
        console.error(`Serper auth error - not retrying`);
        return [];
      }

      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Serper failed after ${maxRetries} attempts:`, error);
      }
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  return [];
}

async function validateSourceWithLLM(
  url: string,
  municipality: string,
  geminiApiKey: string
): Promise<{ isValid: boolean; confidence: number; suggestedName: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LCL-SourceDiscovery/1.0 (Event aggregator)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(CONFIG.URL_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { isValid: false, confidence: 0, suggestedName: "" };
    }

    const html = await response.text();
    const hasAgendaContent = /agenda|evenement|activiteit|programma|kalender/i.test(html);
    const dutchMonthsPattern = DUTCH_MONTHS.join("|");
    const hasDateContent = new RegExp(`\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}|${dutchMonthsPattern}`, "i").test(html);

    if (!hasAgendaContent || !hasDateContent) {
      return { isValid: false, confidence: 0, suggestedName: "" };
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{
                text: `Je bent een expert in het analyseren van websites. Bepaal of deze pagina een evenementenagenda is voor ${municipality}.
Antwoord in JSON formaat: {"isEventAgenda": boolean, "confidence": 0-100, "suggestedName": "string"}

URL: ${url}
HTML (first ${CONFIG.MAX_HTML_CHARS_FOR_LLM} chars):
${html.slice(0, CONFIG.MAX_HTML_CHARS_FOR_LLM)}`
              }]
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      return { isValid: hasAgendaContent && hasDateContent, confidence: 50, suggestedName: `Agenda ${municipality}` };
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isValid: parsed.isEventAgenda === true,
        confidence: parsed.confidence || 50,
        suggestedName: parsed.suggestedName || `Agenda ${municipality}`,
      };
    }

    return { isValid: false, confidence: 0, suggestedName: "" };
  } catch (error) {
    console.warn(`Validation failed for ${url}:`, error);
    return { isValid: false, confidence: 0, suggestedName: "" };
  }
}

async function insertDiscoveredSource(
  supabase: any,
  source: DiscoveredSource
): Promise<boolean> {
  try {
    const shouldEnable = source.confidence > CONFIG.AUTO_ENABLE_CONFIDENCE_THRESHOLD;
    
    const { error } = await supabase
      .from("scraper_sources")
      .insert({
        name: source.name,
        description: `Auto-discovered event source for ${source.municipality}`,
        url: source.url,
        enabled: shouldEnable,
        config: {
          selectors: [
            "article.event", ".event-item", ".event-card",
            "[itemtype*='Event']", ".agenda-item", ".calendar-event",
            "[class*='event']", "[class*='agenda']",
          ],
          headers: {
            "User-Agent": "LCL-EventScraper/1.0",
            "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
          },
          rate_limit_ms: 200,
        },
        requires_render: false,
        language: "nl-NL",
        country: "NL",
        default_coordinates: source.coordinates,
        auto_discovered: true,
        location_name: source.municipality,
        auto_disabled: false,
        consecutive_failures: 0,
        last_discovery_at: new Date().toISOString(),
      });

    if (error) {
      if (error.code === "23505") {
        console.log(`Source already exists: ${source.url}`);
        return false;
      }
      console.error(`Insert failed for ${source.url}:`, error.message);
      return false;
    }

    source.enabled = shouldEnable;
    return true;
  } catch (error) {
    console.error(`Insert error for ${source.url}:`, error);
    return false;
  }
}

async function processMunicipalityJob(
  supabase: any,
  job: DiscoveryJob,
  serperApiKey: string,
  geminiApiKey: string
): Promise<{ sourcesFound: number; sourcesAdded: number }> {
  console.log(`[Worker] Processing ${job.municipality} (pop: ${job.population})`);
  
  let sourcesFound = 0;
  let sourcesAdded = 0;

  // Get existing sources for this municipality
  const { data: existingSources } = await supabase
    .from("scraper_sources")
    .select("url")
    .eq("location_name", job.municipality);

  const existingUrls = new Set<string>(
    (existingSources || []).map((s: any) => canonicalizeUrl(String(s.url)))
  );

  // Search for sources
  const queries = generateSearchQueries(job.municipality);
  const seenUrls = new Set<string>();

  for (const query of queries) {
    const results = await callSerperWithRetry(query, serperApiKey);
    
    for (const result of results) {
      if (!result.link || isNoiseDomain(result.link)) continue;
      
      const canonicalUrl = canonicalizeUrl(result.link);
      if (seenUrls.has(canonicalUrl) || existingUrls.has(canonicalUrl)) continue;
      
      seenUrls.add(canonicalUrl);
      sourcesFound++;

      // Validate with LLM
      const validation = await validateSourceWithLLM(canonicalUrl, job.municipality, geminiApiKey);
      
      if (validation.isValid && validation.confidence >= CONFIG.MIN_VALIDATION_CONFIDENCE) {
        const source: DiscoveredSource = {
          url: canonicalUrl,
          name: validation.suggestedName,
          municipality: job.municipality,
          confidence: validation.confidence,
          coordinates: job.coordinates,
        };

        const inserted = await insertDiscoveredSource(supabase, source);
        if (inserted) {
          sourcesAdded++;
          const enabledLabel = source.enabled ? " [AUTO-ENABLED]" : "";
          console.log(`[Worker] Discovered: ${source.name} (${canonicalUrl}) - confidence: ${validation.confidence}%${enabledLabel}`);
        }
      }

      // Small delay between validations
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Delay between queries
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { sourcesFound, sourcesAdded };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serperApiKey = Deno.env.get("SERPER_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!serperApiKey || !geminiApiKey) {
      console.error("[Worker] Missing SERPER_API_KEY or GEMINI/GOOGLE_AI API key");
      return new Response(
        JSON.stringify({ success: false, error: "Missing API keys" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse optional batch filter
    let batchId: string | undefined;
    try {
      const body = await req.json();
      batchId = body?.batchId;
    } catch {
      // No body
    }

    // Claim a pending job (atomic update)
    let query = supabase
      .from("discovery_jobs")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (batchId) {
      query = query.eq("batch_id", batchId);
    }

    const { data: pendingJobs } = await query;

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log("[Worker] No pending jobs found, exiting");
      return new Response(
        JSON.stringify({ success: true, message: "No pending jobs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const job = pendingJobs[0] as DiscoveryJob;

    // Mark as processing
    const { error: updateError } = await supabase
      .from("discovery_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq("id", job.id)
      .eq("status", "pending"); // Optimistic lock

    if (updateError) {
      console.error("[Worker] Failed to claim job:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to claim job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process the job
    let result: { sourcesFound: number; sourcesAdded: number };
    let error: string | null = null;

    try {
      result = await processMunicipalityJob(supabase, job, serperApiKey, geminiApiKey);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      result = { sourcesFound: 0, sourcesAdded: 0 };
      console.error(`[Worker] Error processing ${job.municipality}:`, error);
    }

    // Update job status
    const finalStatus = error ? "failed" : "completed";
    await supabase
      .from("discovery_jobs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        sources_found: result.sourcesFound,
        sources_added: result.sourcesAdded,
        error_message: error,
      })
      .eq("id", job.id);

    console.log(`[Worker] Completed ${job.municipality}: ${result.sourcesAdded} sources added`);

    // Self-chain to process next job
    const { count } = await supabase
      .from("discovery_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (count && count > 0) {
      console.log(`[Worker] ${count} pending jobs remaining, self-chaining...`);
      
      // Small delay before self-chain
      await new Promise(resolve => setTimeout(resolve, CONFIG.SELF_CHAIN_DELAY_MS));
      
      fetch(`${supabaseUrl}/functions/v1/source-discovery-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ batchId }),
      }).catch(err => console.error("[Worker] Self-chain failed:", err));
    } else {
      console.log("[Worker] All jobs completed!");
      
      // Send final summary
      await sendSlackNotification({
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Source Discovery Batch Complete",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Last processed:* ${job.municipality}\n*Sources added:* ${result.sourcesAdded}`,
            },
          },
        ],
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        job: {
          id: job.id,
          municipality: job.municipality,
          status: finalStatus,
          sourcesFound: result.sourcesFound,
          sourcesAdded: result.sourcesAdded,
        },
        pendingJobsRemaining: count || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Worker] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { 
  type Municipality,
  selectMunicipalitiesForDiscovery,
} from "../_shared/dutchMunicipalities.ts";
import { 
  CATEGORIES, 
  classifyTextToCategory 
} from "../_shared/categoryMapping.ts";
import { sendSlackNotification } from "../_shared/slack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Noise domains to filter out from Serper search results.
 * These sites don't provide high-quality event agenda pages.
 */
const NOISE_DOMAINS = [
  "tripadvisor.",
  "facebook.com",
  "booking.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "pinterest.com",
  "youtube.com",
  "tiktok.com",
  "yelp.",
  "groupon.",
  "expedia.",
  "hotels.",
  "airbnb.",
  "marktplaats.nl",
  "wikipedia.org",
];

/**
 * Configuration constants for rate limiting and processing
 */
const CONFIG = {
  /** Maximum characters of HTML to send to LLM for validation */
  MAX_HTML_CHARS_FOR_LLM: 5000,
  /** Delay between Serper API queries (ms) */
  SERPER_QUERY_DELAY_MS: 200,
  /** Delay between URL validation requests (ms) */
  VALIDATION_DELAY_MS: 300,
  /** Delay between processing municipalities (ms) */
  MUNICIPALITY_DELAY_MS: 500,
  /** Timeout for fetching URLs (ms) */
  URL_FETCH_TIMEOUT_MS: 10000,
  /** Timeout for Serper API requests (ms) */
  SERPER_API_TIMEOUT_MS: 15000,
  /** Maximum retries for Serper API */
  SERPER_MAX_RETRIES: 3,
  /** Confidence threshold for auto-enabling sources */
  AUTO_ENABLE_CONFIDENCE_THRESHOLD: 90,
  /** Minimum confidence to validate a source */
  MIN_VALIDATION_CONFIDENCE: 60,
};

/**
 * Dutch month names for date pattern detection
 */
const DUTCH_MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december"
];

/**
 * Serper.dev search result interface
 */
interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface SerperResponse {
  organic?: SerperSearchResult[];
  searchParameters?: {
    q: string;
    gl?: string;
    hl?: string;
  };
}

interface DiscoveredSource {
  url: string;
  name: string;
  municipality: string;
  categoryHint: string;
  confidence: number;
  coordinates: { lat: number; lng: number };
  enabled?: boolean;
}

interface DiscoveryStats {
  municipalitiesProcessed: number;
  categoriesProcessed: number;
  searchesPerformed: number;
  candidatesFound: number;
  sourcesValidated: number;
  sourcesInserted: number;
  serperQueriesUsed: number;
  noiseDomainsFiltered: number;
  autoEnabledSources: number;
  errors: string[];
}

/**
 * Known working Dutch event source patterns by city
 * These are real, verified URLs that work
 */
const KNOWN_EVENT_SOURCES: Record<string, string[]> = {
  // Major cities with verified event sites
  amsterdam: [
    "https://www.iamsterdam.com/nl/zien-en-doen/agenda",
    "https://www.uitagendaamsterdam.nl",
    "https://www.amsterdam.nl/uit/agenda",
  ],
  rotterdam: [
    "https://www.uitagendarotterdam.nl",
    "https://www.rotterdamfestivals.nl/festivals",
    "https://www.rotterdam.nl/agenda",
  ],
  "den haag": [
    "https://www.denhaag.nl/nl/agenda",
    "https://www.denhaag.com/nl/agenda",
  ],
  "'s-gravenhage": [
    "https://www.denhaag.nl/nl/agenda",
    "https://www.denhaag.com/nl/agenda",
  ],
  utrecht: [
    "https://www.utrechtverwelkomt.nl/agenda",
    "https://www.visit-utrecht.com/nl/agenda",
    "https://www.utrecht.nl/evenementen",
  ],
  eindhoven: [
    "https://www.thisiseindhoven.com/nl/agenda",
    "https://www.eindhoven.nl/agenda",
  ],
  groningen: [
    "https://uit.groningen.nl/agenda",
    "https://www.visitgroningen.nl/agenda",
  ],
  tilburg: [
    "https://www.tilburg.com/ontdekken/agenda",
  ],
  almere: [
    "https://www.visitalmere.nl/agenda",
  ],
  breda: [
    "https://www.bredamarketing.nl/agenda",
    "https://www.bredauitagenda.nl",
  ],
  nijmegen: [
    "https://www.nijmegen.nl/evenementen",
    "https://www.visitnijmegen.com/agenda",
  ],
  arnhem: [
    "https://www.bezoekarnhem.com/agenda",
  ],
  enschede: [
    "https://www.uitinenschede.nl",
  ],
  haarlem: [
    "https://www.visithaarlem.com/nl/agenda",
  ],
  leiden: [
    "https://www.visitleiden.nl/nl/agenda",
    "https://www.visitleiden.nl/en/event-calendar",
  ],
  delft: [
    "https://www.indelft.nl/agenda",
  ],
  maastricht: [
    "https://www.visitmaastricht.com/agenda",
  ],
  dordrecht: [
    "https://www.vvvdordrecht.nl/agenda",
  ],
  zwolle: [
    "https://www.inzwolle.nl/agenda",
  ],
  amersfoort: [
    "https://www.amersfoort.nl/evenementen",
    "https://www.visitamersfoort.nl/agenda",
  ],
  "s-hertogenbosch": [
    "https://www.bezoekdenbosch.nl/agenda",
  ],
  denbosch: [
    "https://www.bezoekdenbosch.nl/agenda",
  ],
  leeuwarden: [
    "https://www.visitleeuwarden.nl/agenda",
  ],
  apeldoorn: [
    "https://www.visitapeldoorn.nl/agenda",
  ],
  deventer: [
    "https://www.deventer.nl/uit",
    "https://www.deventeruitagenda.nl",
  ],
};

/**
 * Canonicalize URL by stripping UTM params and trailing slashes.
 * This prevents duplicate entries in scraper_sources.
 */
function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove UTM and tracking parameters
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "msclkid", "ref", "source", "mc_cid", "mc_eid",
    ];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    
    // Remove trailing slash from pathname (except for root)
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    
    // Normalize to lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Check if a URL belongs to a noise domain that should be filtered out.
 */
function isNoiseDomain(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return NOISE_DOMAINS.some(domain => lowerUrl.includes(domain));
}

/**
 * Generate 5 diverse queries for a municipality to maximize recall.
 * Query Multiplexing strategy for high-authority ANCHOR agenda pages.
 */
function generateSearchQueries(municipalityName: string): string[] {
  return [
    `${municipalityName} agenda evenementen`,
    `${municipalityName} uitagenda`,
    `${municipalityName} evenementenkalender`,
    `wat te doen ${municipalityName}`,
    `${municipalityName} activiteiten programma`,
  ];
}

/**
 * Call Serper.dev API with retry-backoff strategy.
 * Returns search results or empty array on failure.
 */
async function callSerperWithRetry(
  query: string,
  serperApiKey: string,
  maxRetries: number = 3
): Promise<SerperSearchResult[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          gl: "nl", // Geolocation: Netherlands
          hl: "nl", // Language: Dutch
          num: 10,  // Number of results
        }),
        signal: AbortSignal.timeout(CONFIG.SERPER_API_TIMEOUT_MS),
      });

      if (response.ok) {
        const data: SerperResponse = await response.json();
        return data.organic || [];
      }

      // Handle 4xx/5xx errors with backoff
      if (response.status >= 400) {
        const errorText = await response.text();
        lastError = new Error(`Serper API error ${response.status}: ${errorText}`);
        
        // Don't retry on 401/403 (auth errors) or 429 (rate limit exceeded)
        if (response.status === 401 || response.status === 403) {
          console.error(`Serper auth error - not retrying: ${lastError.message}`);
          return [];
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Serper attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Serper attempt ${attempt} failed with ${lastError.message}, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  if (lastError) {
    console.error(`Serper API failed after ${maxRetries} attempts:`, lastError.message);
  }
  return [];
}

/**
 * Perform a web search for event agenda sources using Serper.dev.
 * Implements Query Multiplexing with 5 diverse queries per city.
 * Returns candidate URLs for validation.
 */
async function searchForEventSources(
  municipality: Municipality,
  stats: DiscoveryStats,
  dryRun: boolean = false
): Promise<Array<{ url: string; title: string; snippet: string; fromSerper: boolean }>> {
  const candidates: Array<{ url: string; title: string; snippet: string; fromSerper: boolean }> = [];
  const seenUrls = new Set<string>();
  
  const municipalityName = municipality.name.toLowerCase();
  const normalizedName = municipalityName.replace(/['']/g, "'").replace(/\s+/g, " ");
  
  // First, add known sources (these are pre-verified)
  const knownUrls = KNOWN_EVENT_SOURCES[normalizedName] || [];
  for (const url of knownUrls) {
    const canonicalUrl = canonicalizeUrl(url);
    if (!seenUrls.has(canonicalUrl)) {
      seenUrls.add(canonicalUrl);
      candidates.push({
        url: canonicalUrl,
        title: `Agenda ${municipality.name}`,
        snippet: `Verified event source for ${municipality.name}`,
        fromSerper: false,
      });
    }
  }
  
  // Then, use Serper.dev for real web search
  const serperApiKey = Deno.env.get("SERPER_API_KEY");
  
  if (serperApiKey) {
    const queries = generateSearchQueries(municipality.name);
    
    for (const query of queries) {
      stats.serperQueriesUsed++;
      const results = await callSerperWithRetry(query, serperApiKey);
      
      if (dryRun && results.length > 0) {
        console.log(`[DRY RUN] Serper query "${query}" returned ${results.length} results`);
      }
      
      for (const result of results) {
        if (!result.link) continue;
        // Filter out noise domains
        if (isNoiseDomain(result.link)) {
          stats.noiseDomainsFiltered++;
          if (dryRun) {
            console.log(`[DRY RUN] Filtered noise domain: ${result.link}`);
          }
          continue;
        }
        
        const canonicalUrl = canonicalizeUrl(result.link);
        if (!seenUrls.has(canonicalUrl)) {
          seenUrls.add(canonicalUrl);
          candidates.push({
            url: canonicalUrl,
            title: result.title,
            snippet: result.snippet,
            fromSerper: true,
          });
        }
      }
      
      // Rate limiting between Serper queries
      await new Promise(resolve => setTimeout(resolve, CONFIG.SERPER_QUERY_DELAY_MS));
    }
  } else {
    // Fallback to pattern-based discovery when Serper API key is not available
    console.warn("SERPER_API_KEY not configured, falling back to pattern-based discovery");
    
    const cleanName = normalizedName.replace(/['']/g, "").replace(/-/g, "").replace(/\s+/g, "");
    const patterns = [
      `https://www.visit${cleanName}.nl/agenda`,
      `https://www.visit${cleanName}.com/agenda`,
      `https://www.uitagenda${cleanName}.nl`,
      `https://www.${cleanName}.nl/agenda`,
      `https://www.${cleanName}.nl/evenementen`,
      `https://www.ontdek${cleanName}.nl/agenda`,
      `https://agenda.${cleanName}.nl`,
    ];
    
    for (const pattern of patterns) {
      const canonicalUrl = canonicalizeUrl(pattern);
      if (!seenUrls.has(canonicalUrl)) {
        seenUrls.add(canonicalUrl);
        candidates.push({
          url: canonicalUrl,
          title: `Agenda ${municipality.name}`,
          snippet: `Pattern-based discovery for ${municipality.name}`,
          fromSerper: false,
        });
      }
    }
  }
  
  return candidates;
}

/**
 * Validate a URL using LLM to check if it's a valid event source
 */
async function validateSourceWithLLM(
  url: string,
  municipality: string,
  geminiApiKey: string
): Promise<{ isValid: boolean; confidence: number; suggestedName: string }> {
  try {
    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LCL-SourceDiscovery/1.0 (Event aggregator for local social app)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(CONFIG.URL_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { isValid: false, confidence: 0, suggestedName: "" };
    }

    const html = await response.text();
    
    // Check for basic event-related content
    const hasAgendaContent = /agenda|evenement|activiteit|programma|kalender/i.test(html);
    const dutchMonthsPattern = DUTCH_MONTHS.join("|");
    const hasDateContent = new RegExp(`\\d{1,2}[-/]\\d{1,2}[-/]\\d{2,4}|${dutchMonthsPattern}`, "i").test(html);
    
    if (!hasAgendaContent || !hasDateContent) {
      return { isValid: false, confidence: 0, suggestedName: "" };
    }

    // Use Gemini to validate more thoroughly
    const systemPrompt = `Je bent een expert in het analyseren van websites. 
    Bepaal of deze pagina een evenementenagenda is voor ${municipality}.
    Antwoord in JSON formaat: {"isEventAgenda": boolean, "confidence": 0-100, "suggestedName": "string"}`;

    const userPrompt = `URL: ${url}
    HTML (first ${CONFIG.MAX_HTML_CHARS_FOR_LLM} chars):
    ${html.slice(0, CONFIG.MAX_HTML_CHARS_FOR_LLM)}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "user", parts: [{ text: userPrompt }] },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      // Fall back to basic validation
      return { 
        isValid: hasAgendaContent && hasDateContent, 
        confidence: 50, 
        suggestedName: `Agenda ${municipality}` 
      };
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Parse JSON from response
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

/**
 * Insert a discovered source into the database
 * Auto-enables sources with confidence >90% (0.90) for high-authority bypass
 */
async function insertDiscoveredSource(
  supabase: ReturnType<typeof createClient>,
  source: DiscoveredSource,
  stats: DiscoveryStats
): Promise<boolean> {
  try {
    // Auto-enable sources with confidence > threshold (bypass manual review)
    const shouldEnable = source.confidence > CONFIG.AUTO_ENABLE_CONFIDENCE_THRESHOLD;
    if (shouldEnable) {
      stats.autoEnabledSources++;
    }
    
    // Remove .single() to prevent errors when insert doesn't return data
    const { error } = await supabase
      .from("scraper_sources")
      .insert({
        name: source.name,
        description: `Auto-discovered event source for ${source.municipality}`,
        url: source.url,
        enabled: shouldEnable, // Auto-enable high-confidence sources (>90%)
        config: {
          selectors: [
            "article.event",
            ".event-item",
            ".event-card",
            "[itemtype*='Event']",
            ".agenda-item",
            ".calendar-event",
            "[class*='event']",
            "[class*='agenda']",
          ],
          headers: {
            "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
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
        // Reset auto_disabled to false for new sources to ensure they can be processed
        auto_disabled: false,
        consecutive_failures: 0,
      });

    if (error) {
      if (error.code === "23505") {
        // Duplicate URL, skip
        console.log(`Source already exists: ${source.url}`);
        return false;
      }
      console.error(`Insert failed for ${source.url}:`, error.message);
      return false;
    }

    // Store enabled status in source for later use
    source.enabled = shouldEnable;
    
    return true;
  } catch (error) {
    console.error(`Insert error for ${source.url}:`, error);
    return false;
  }
}

/**
 * Process a single municipality for source discovery.
 * Uses Serper.dev for real web search with Query Multiplexing.
 */
async function processMunicipality(
  supabase: ReturnType<typeof createClient>,
  municipality: Municipality,
  categories: typeof CATEGORIES,
  geminiApiKey: string,
  stats: DiscoveryStats,
  dryRun: boolean = false
): Promise<DiscoveredSource[]> {
  const discovered: DiscoveredSource[] = [];

  // Search for candidates using Serper.dev (Query Multiplexing: 5 queries per city)
  stats.searchesPerformed++;
  
  try {
    const candidates = await searchForEventSources(municipality, stats, dryRun);
    stats.candidatesFound += candidates.length;
    
    if (dryRun) {
      console.log(`[DRY RUN] Municipality ${municipality.name}: Found ${candidates.length} candidates`);
    }

    // Validate each candidate
    for (const candidate of candidates) {
      try {
        const validation = await validateSourceWithLLM(
          candidate.url,
          municipality.name,
          geminiApiKey
        );

        if (dryRun) {
          console.log(`[DRY RUN] LLM Score for ${candidate.url}: isValid=${validation.isValid}, confidence=${validation.confidence}`);
        }

        if (validation.isValid && validation.confidence >= CONFIG.MIN_VALIDATION_CONFIDENCE) {
          stats.sourcesValidated++;

          // Determine category from snippet or use default
          const categoryHint = classifyTextToCategory(candidate.snippet || candidate.title || "");

          const source: DiscoveredSource = {
            url: candidate.url,
            name: validation.suggestedName || `${municipality.name} Agenda`,
            municipality: municipality.name,
            categoryHint: categoryHint,
            confidence: validation.confidence,
            coordinates: { lat: municipality.lat, lng: municipality.lng },
          };

          // Skip DB write in dry run mode
          if (dryRun) {
            console.log(`[DRY RUN] Would insert source: ${source.name} (${source.url}) - confidence: ${source.confidence}%`);
            const wouldAutoEnable = source.confidence > CONFIG.AUTO_ENABLE_CONFIDENCE_THRESHOLD;
            console.log(`[DRY RUN] Auto-enable: ${wouldAutoEnable ? `YES (>${CONFIG.AUTO_ENABLE_CONFIDENCE_THRESHOLD}%)` : `NO (≤${CONFIG.AUTO_ENABLE_CONFIDENCE_THRESHOLD}%)`}`);
            discovered.push(source);
            continue;
          }

          // Insert into database
          const inserted = await insertDiscoveredSource(supabase, source, stats);
          if (inserted) {
            stats.sourcesInserted++;
            discovered.push(source);
            console.log(`Discovered source: ${source.name} (${source.url}) - confidence: ${source.confidence}%${source.enabled ? " [AUTO-ENABLED]" : ""}`);
            
            // Send Slack alert for high-value "Anchor Source" discoveries
            // Criteria: Major municipality (population > 100k) AND high confidence (>= 80)
            const isMajorMunicipality = municipality.population >= 100000;
            const isHighConfidence = validation.confidence >= 80;
            const isAutoEnabled = source.enabled === true;
            
            if (isMajorMunicipality && isHighConfidence) {
              const blocks = [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: isAutoEnabled 
                      ? "🎯 High-Value Anchor Source Discovered & Auto-Enabled!"
                      : "🎯 High-Value Anchor Source Discovered!",
                    emoji: true,
                  },
                },
                {
                  type: "section",
                  fields: [
                    {
                      type: "mrkdwn",
                      text: `*Source Name:*\n${source.name}`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Municipality:*\n${source.municipality} (${municipality.population.toLocaleString()} pop.)`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Confidence Score:*\n${validation.confidence}%`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Category:*\n${source.categoryHint}`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Status:*\n${isAutoEnabled ? "✅ Auto-Enabled (>90%)" : "⏸️ Pending Review"}`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Coordinates:*\n\`${source.coordinates.lat.toFixed(4)}, ${source.coordinates.lng.toFixed(4)}\``,
                    },
                    {
                      type: "mrkdwn",
                      text: `*URL:*\n${source.url}`,
                    },
                  ],
                },
                {
                  type: "context",
                  elements: [
                    {
                      type: "mrkdwn",
                      text: isAutoEnabled
                        ? "✨ This source has been auto-discovered and *auto-enabled* (confidence >90%). It will be included in the next scraper run."
                        : "💡 This source has been auto-discovered and added as _disabled_ (confidence ≤90%). Review and enable it in the admin panel.",
                    },
                  ],
                },
              ];
              
              await sendSlackNotification({ blocks }, false);
            }
          }
        }
      } catch (error) {
        const msg = `Validation error for ${candidate.url}: ${error instanceof Error ? error.message : "Unknown"}`;
        console.warn(msg);
        stats.errors.push(msg);
      }

      // Rate limiting between validations
      await new Promise(resolve => setTimeout(resolve, CONFIG.VALIDATION_DELAY_MS));
    }
  } catch (error) {
    const msg = `Search error for ${municipality.name}: ${error instanceof Error ? error.message : "Unknown"}`;
    console.warn(msg);
    stats.errors.push(msg);
  }

  stats.municipalitiesProcessed++;
  return discovered;
}

interface DiscoveryOptions {
  /** Minimum population for municipalities to process (default: 15000 for Long Tail) */
  minPopulation?: number;
  /** Maximum municipalities to process in one run (default: 30 for scaling) */
  maxMunicipalities?: number;
  /** Specific municipality names to process */
  municipalities?: string[];
  /** Specific category IDs to search (legacy - now uses Query Multiplexing) */
  categories?: string[];
  /** Dry run - logs Serper results and LLM scores without writing to DB */
  dryRun?: boolean;
}

/**
 * Source Discovery Edge Function
 * 
 * Proactively discovers event sources across Dutch municipalities.
 * Uses Serper.dev for real web search with Query Multiplexing (5 queries per city).
 * Implements URL canonicalization and noise domain filtering.
 * Auto-enables sources with confidence >90%.
 * 
 * Usage:
 * POST /functions/v1/source-discovery
 * Body (optional): {
 *   "minPopulation": 15000,
 *   "maxMunicipalities": 30,
 *   "dryRun": true
 * }
 * 
 * Defaults:
 * - minPopulation: 15000 (Long Tail - captures smaller municipalities)
 * - maxMunicipalities: 30 (scaled up from 5)
 * - Auto-enables sources with confidence >90% (high-authority bypass)
 * 
 * Environment Variables Required:
 * - SERPER_API_KEY: API key for Serper.dev search
 * - GEMINI_API_KEY or GOOGLE_AI_API_KEY: API key for LLM validation
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: Supabase credentials
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase env vars");
    }

    if (!geminiApiKey) {
      throw new Error("Missing Gemini API key (GEMINI_API_KEY or GOOGLE_AI_API_KEY)");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse options
    let options: DiscoveryOptions = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        options = body ? JSON.parse(body) : {};
      } catch {
        options = {};
      }
    }

    // Scaled defaults:
    // - Population floor: 15,000 (Long Tail of Dutch municipalities)
    // - Max municipalities: 30 (up from 5)
    const {
      minPopulation = 15000,
      maxMunicipalities = 30,
      municipalities: municipalityFilter,
      categories: categoryFilter,
      dryRun = false,
    } = options;

    if (dryRun) {
      console.log("[DRY RUN MODE] No database writes will be performed");
    }

    // Select municipalities to process
    const municipalitiesToProcess = selectMunicipalitiesForDiscovery({
      minPopulation,
      maxMunicipalities,
      municipalities: municipalityFilter,
    });

    if (municipalitiesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No municipalities match the criteria",
          stats: { municipalitiesProcessed: 0 }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Select categories (legacy, kept for compatibility)
    let categoriesToSearch = CATEGORIES;
    if (categoryFilter && categoryFilter.length > 0) {
      categoriesToSearch = CATEGORIES.filter(c =>
        categoryFilter.includes(c.id)
      );
    }

    // Initialize stats with new Serper-related fields
    const stats: DiscoveryStats = {
      municipalitiesProcessed: 0,
      categoriesProcessed: 0,
      searchesPerformed: 0,
      candidatesFound: 0,
      sourcesValidated: 0,
      sourcesInserted: 0,
      serperQueriesUsed: 0,
      noiseDomainsFiltered: 0,
      autoEnabledSources: 0,
      errors: [],
    };

    const allDiscovered: DiscoveredSource[] = [];

    console.log(`Starting source discovery: ${municipalitiesToProcess.length} municipalities (pop >= ${minPopulation})`);
    console.log(`Using Serper.dev: ${Deno.env.get("SERPER_API_KEY") ? "YES" : "NO (fallback to patterns)"}`);

    // Process each municipality
    for (const municipality of municipalitiesToProcess) {
      console.log(`Processing ${municipality.name} (pop: ${municipality.population})`);
      
      const discovered = await processMunicipality(
        supabase as Parameters<typeof processMunicipality>[0],
        municipality,
        categoriesToSearch,
        geminiApiKey,
        stats,
        dryRun
      );

      allDiscovered.push(...discovered);

      // Rate limiting between municipalities
      await new Promise(resolve => setTimeout(resolve, CONFIG.MUNICIPALITY_DELAY_MS));
    }

    const duration = Date.now() - startTime;

    console.log(`Source discovery complete: ${stats.sourcesInserted} sources inserted, ${stats.autoEnabledSources} auto-enabled in ${duration}ms`);

    // Calculate discovery velocity (sources per 1000 queries)
    const discoveryVelocity = stats.serperQueriesUsed > 0 
      ? Math.round((stats.sourcesValidated / stats.serperQueriesUsed) * 1000) 
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        duration: `${duration}ms`,
        stats: {
          ...stats,
          discoveryVelocity: `${discoveryVelocity} sources per 1000 queries`,
        },
        discovered: allDiscovered.map(s => ({
          url: s.url,
          name: s.name,
          municipality: s.municipality,
          confidence: s.confidence,
          autoEnabled: s.enabled || false,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Source discovery error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

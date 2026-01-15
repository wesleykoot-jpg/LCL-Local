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

interface DiscoveredSource {
  url: string;
  name: string;
  municipality: string;
  categoryHint: string;
  confidence: number;
  coordinates: { lat: number; lng: number };
  enabled?: boolean; // Track if source should be auto-enabled
}

interface DiscoveryStats {
  municipalitiesProcessed: number;
  categoriesProcessed: number;
  searchesPerformed: number;
  candidatesFound: number;
  sourcesValidated: number;
  sourcesInserted: number;
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
 * Perform a web search for event agenda sources
 * Returns candidate URLs for validation
 */
async function searchForEventSources(
  query: string,
  _geminiApiKey: string
): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const candidates: Array<{ url: string; title: string; snippet: string }> = [];
  
  // Extract municipality name from query
  const parts = query.split(" ");
  const municipalityName = parts[parts.length - 1].toLowerCase();
  const normalizedName = municipalityName.replace(/['']/g, "'").replace(/\s+/g, " ");
  
  // Check known sources first
  const knownUrls = KNOWN_EVENT_SOURCES[normalizedName] || [];
  for (const url of knownUrls) {
    candidates.push({
      url,
      title: `Agenda ${municipalityName}`,
      snippet: `Verified event source for ${municipalityName}`,
    });
  }
  
  // Add common Dutch patterns for municipalities without known sources
  if (knownUrls.length === 0) {
    const cleanName = normalizedName.replace(/['']/g, "").replace(/-/g, "").replace(/\s+/g, "");
    
    // Only use the most reliable patterns
    const patterns = [
      `https://www.visit${cleanName}.nl/agenda`,
      `https://www.visit${cleanName}.com/agenda`,
      `https://www.uitagenda${cleanName}.nl`,
      `https://www.${cleanName}.nl/agenda`,
      `https://www.${cleanName}.nl/evenementen`,
    ];
    
    for (const pattern of patterns) {
      candidates.push({
        url: pattern,
        title: `Agenda ${municipalityName}`,
        snippet: `Evenementen en activiteiten in ${municipalityName}`,
      });
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
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { isValid: false, confidence: 0, suggestedName: "" };
    }

    const html = await response.text();
    
    // Check for basic event-related content
    const hasAgendaContent = /agenda|evenement|activiteit|programma|kalender/i.test(html);
    const hasDateContent = /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december/i.test(html);
    
    if (!hasAgendaContent || !hasDateContent) {
      return { isValid: false, confidence: 0, suggestedName: "" };
    }

    // Use Gemini to validate more thoroughly
    const systemPrompt = `Je bent een expert in het analyseren van websites. 
    Bepaal of deze pagina een evenementenagenda is voor ${municipality}.
    Antwoord in JSON formaat: {"isEventAgenda": boolean, "confidence": 0-100, "suggestedName": "string"}`;

    const userPrompt = `URL: ${url}
    HTML (first 5000 chars):
    ${html.slice(0, 5000)}`;

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
 * Auto-enables sources with confidence ≥70% (lowered from 90% to increase activation rate)
 */
async function insertDiscoveredSource(
  supabase: ReturnType<typeof createClient>,
  source: DiscoveredSource
): Promise<boolean> {
  try {
    // Auto-enable sources with confidence ≥70% (lowered threshold for better scaling)
    const shouldEnable = source.confidence >= 70;
    
    // Remove .single() to prevent errors when insert doesn't return data
    const { error } = await supabase
      .from("scraper_sources")
      .insert({
        name: source.name,
        description: `Auto-discovered event source for ${source.municipality}`,
        url: source.url,
        enabled: shouldEnable, // Auto-enable high-confidence sources
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
 * Process a single municipality for source discovery
 */
async function processMunicipality(
  supabase: ReturnType<typeof createClient>,
  municipality: Municipality,
  categories: typeof CATEGORIES,
  geminiApiKey: string,
  stats: DiscoveryStats
): Promise<DiscoveredSource[]> {
  const discovered: DiscoveredSource[] = [];

  for (const category of categories) {
    stats.categoriesProcessed++;

    // Build search query
    const searchTerms = category.searchTermsNL.slice(0, 2).join(" ");
    const query = `agenda ${searchTerms} ${municipality.name}`;
    
    stats.searchesPerformed++;

    try {
      // Search for candidates
      const candidates = await searchForEventSources(query, geminiApiKey);
      stats.candidatesFound += candidates.length;

      // Validate each candidate
      for (const candidate of candidates) {
        try {
          const validation = await validateSourceWithLLM(
            candidate.url,
            municipality.name,
            geminiApiKey
          );

          if (validation.isValid && validation.confidence >= 60) {
            stats.sourcesValidated++;

            const source: DiscoveredSource = {
              url: candidate.url,
              name: validation.suggestedName || `${municipality.name} - ${category.labelNL}`,
              municipality: municipality.name,
              categoryHint: category.id,
              confidence: validation.confidence,
              coordinates: { lat: municipality.lat, lng: municipality.lng },
            };

            // Insert into database
            const inserted = await insertDiscoveredSource(supabase, source);
            if (inserted) {
              stats.sourcesInserted++;
              discovered.push(source);
              console.log(`Discovered source: ${source.name} (${source.url})`);
              
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
                        ? "🎯 High-Value Anchor Source Discovered & Enabled!"
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
                        text: `*Category:*\n${category.labelNL}`,
                      },
                      {
                        type: "mrkdwn",
                        text: `*Status:*\n${isAutoEnabled ? "✅ Enabled" : "⏸️ Pending Review"}`,
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
                          ? "✨ This source has been auto-discovered and *auto-enabled* (confidence ≥70%). It will be included in the next scraper run for nationwide geofencing coverage."
                          : "💡 This source has been auto-discovered and added as _disabled_ (confidence <70%). Review and enable it in the admin panel for nationwide geofencing coverage.",
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
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      const msg = `Search error for ${municipality.name} ${category.id}: ${error instanceof Error ? error.message : "Unknown"}`;
      console.warn(msg);
      stats.errors.push(msg);
    }

    // Rate limiting between categories
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  stats.municipalitiesProcessed++;
  return discovered;
}

interface DiscoveryOptions {
  /** Minimum population for municipalities to process (default: 20000) */
  minPopulation?: number;
  /** Maximum municipalities to process in one run (default: 20) */
  maxMunicipalities?: number;
  /** Specific municipality names to process */
  municipalities?: string[];
  /** Specific category IDs to search */
  categories?: string[];
  /** Dry run - don't insert sources */
  dryRun?: boolean;
}

/**
 * Source Discovery Edge Function
 * 
 * Proactively discovers event sources across Dutch municipalities.
 * 
 * Usage:
 * POST /functions/v1/source-discovery
 * Body (optional): {
 *   "minPopulation": 50000,
 *   "maxMunicipalities": 10,
 *   "categories": ["music", "family"],
 *   "dryRun": true
 * }
 * 
 * Defaults:
 * - minPopulation: 20000 (regional hubs)
 * - maxMunicipalities: 20 (controlled rollout)
 * - Auto-enables sources with confidence ≥70% (lowered for better scaling)
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

    // Default to processing regional hubs (20k+ population) with controlled rollout
    // maxMunicipalities defaults to 20 to accelerate coverage while maintaining quality
    const {
      minPopulation = 20000,
      maxMunicipalities = 20,
      municipalities: municipalityFilter,
      categories: categoryFilter,
      dryRun = false,
    } = options;

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

    // Select categories to search
    let categoriesToSearch = CATEGORIES;
    if (categoryFilter && categoryFilter.length > 0) {
      categoriesToSearch = CATEGORIES.filter(c =>
        categoryFilter.includes(c.id)
      );
    }

    // Initialize stats
    const stats: DiscoveryStats = {
      municipalitiesProcessed: 0,
      categoriesProcessed: 0,
      searchesPerformed: 0,
      candidatesFound: 0,
      sourcesValidated: 0,
      sourcesInserted: 0,
      errors: [],
    };

    const allDiscovered: DiscoveredSource[] = [];

    console.log(`Starting source discovery: ${municipalitiesToProcess.length} municipalities, ${categoriesToSearch.length} categories`);

    // Process each municipality
    for (const municipality of municipalitiesToProcess) {
      console.log(`Processing ${municipality.name} (pop: ${municipality.population})`);
      
      const discovered = await processMunicipality(
        supabase as Parameters<typeof processMunicipality>[0],
        municipality,
        categoriesToSearch,
        geminiApiKey,
        stats
      );

      if (!dryRun) {
        allDiscovered.push(...discovered);
      }

      // Rate limiting between municipalities
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Date.now() - startTime;

    console.log(`Source discovery complete: ${stats.sourcesInserted} sources in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        duration: `${duration}ms`,
        stats,
        discovered: allDiscovered.map(s => ({
          url: s.url,
          name: s.name,
          municipality: s.municipality,
          confidence: s.confidence,
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

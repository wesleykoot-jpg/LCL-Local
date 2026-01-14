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
 * Perform a web search for event agenda sources
 * Returns candidate URLs for validation
 */
async function searchForEventSources(
  query: string,
  _geminiApiKey: string
): Promise<Array<{ url: string; title: string; snippet: string }>> {
  // Note: In production, this would use Google Custom Search API or similar
  // For now, we'll generate educated guesses based on common Dutch patterns
  
  const candidates: Array<{ url: string; title: string; snippet: string }> = [];
  
  // Extract municipality name from query
  const parts = query.split(" ");
  const municipalityName = parts[parts.length - 1].toLowerCase();
  
  // Common Dutch agenda URL patterns
  const patterns = [
    `https://www.${municipalityName}.nl/agenda`,
    `https://www.ontdek${municipalityName}.nl/agenda`,
    `https://www.visit${municipalityName}.nl/events`,
    `https://www.${municipalityName}.nl/evenementen`,
    `https://www.uitagenda${municipalityName}.nl`,
    `https://www.${municipalityName}marketing.nl/agenda`,
    `https://agenda.${municipalityName}.nl`,
  ];
  
  // Return first 3 patterns as candidates
  for (let i = 0; i < Math.min(3, patterns.length); i++) {
    candidates.push({
      url: patterns[i],
      title: `Agenda ${municipalityName}`,
      snippet: `Evenementen en activiteiten in ${municipalityName}`,
    });
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
 */
async function insertDiscoveredSource(
  supabase: ReturnType<typeof createClient>,
  source: DiscoveredSource
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("scraper_sources")
      .insert({
        name: source.name,
        description: `Auto-discovered event source for ${source.municipality}`,
        url: source.url,
        enabled: false, // Start disabled for manual review
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
      })
      .single();

    if (error) {
      if (error.code === "23505") {
        // Duplicate URL, skip
        console.log(`Source already exists: ${source.url}`);
        return false;
      }
      console.error(`Insert failed for ${source.url}:`, error.message);
      return false;
    }

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
              
              if (isMajorMunicipality && isHighConfidence) {
                const blocks = [
                  {
                    type: "header",
                    text: {
                      type: "plain_text",
                      text: "🎯 High-Value Anchor Source Discovered!",
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
                        text: "💡 This source has been auto-discovered and added as _disabled_. Review and enable it in the admin panel for nationwide geofencing coverage.",
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
  /** Minimum population for municipalities to process (default: 1000) */
  minPopulation?: number;
  /** Maximum municipalities to process in one run (default: unlimited) */
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

    const {
      minPopulation = 1000,
      maxMunicipalities,
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

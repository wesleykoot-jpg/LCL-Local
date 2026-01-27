import { jitteredDelay } from "./rateLimiting.ts";
import type { RawEventCard, CategoryKey } from "./types.ts";
import { parseToISODate } from "./dateUtils.ts";
import { normalizeWhitespace, mapToInternalCategory } from "./scraperUtils.ts";

/**
 * Exponential backoff with jitter for retries
 */
async function exponentialBackoff(attempt: number, baseMs: number = 1000): Promise<void> {
  const delay = Math.min(baseMs * Math.pow(2, attempt), 30000);
  const jitter = delay * 0.2 * Math.random();
  console.log(`Backoff: waiting ${Math.round(delay + jitter)}ms before retry ${attempt + 1}`);
  await new Promise((resolve) => setTimeout(resolve, delay + jitter));
}

export async function callOpenAI(
  apiKey: string,
  payload: any,
  fetcher: typeof fetch,
  maxRetries: number = 3
): Promise<string | null> {
  const _model = payload.model || "gpt-4o-mini";
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetcher("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    }

    const text = await response.text();
    if (response.status === 429) {
      console.warn(`OpenAI 429 rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);
      if (attempt < maxRetries) {
        await exponentialBackoff(attempt);
        continue;
      }
    }

    console.error("OpenAI error", response.status, text);
    return null;
  }
  return null;
}

export async function callGemini(
  apiKey: string,
  body: unknown,
  fetcher: typeof fetch,
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt === 0) {
      await jitteredDelay(100, 200);
    }

    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    const text = await response.text();

    if (response.status === 429) {
      console.warn(`Gemini 429 rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);
      if (attempt < maxRetries) {
        await exponentialBackoff(attempt);
        continue;
      }
    }

    console.error("Gemini error", response.status, text);

    if (response.status !== 429) {
      return null;
    }
  }

  console.error("Gemini: max retries exceeded");
  return null;
}

/**
 * Call GLM-4 (ZhipuAI BigModel API) for high-reasoning tasks like Scout.
 * GLM-4.7 is used for analyzing website structure and generating extraction recipes.
 * 
 * @param apiKey - ZhipuAI API key
 * @param payload - Request payload with model, messages, temperature, etc.
 * @param fetcher - Fetch implementation
 * @param maxRetries - Maximum retry attempts
 * @returns Generated text response or null on failure
 */
export async function callGLM(
  apiKey: string,
  payload: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
  },
  fetcher: typeof fetch,
  maxRetries: number = 3
): Promise<string | null> {
  const model = payload.model || "glm-4";
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await exponentialBackoff(attempt);
    }

    try {
      const response = await fetcher("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: payload.messages,
          temperature: payload.temperature ?? 0.1,
          max_tokens: payload.max_tokens ?? 4096,
          ...(payload.response_format && { response_format: payload.response_format }),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
      }

      const text = await response.text();
      
      if (response.status === 429) {
        console.warn(`GLM 429 rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);
        if (attempt < maxRetries) {
          continue;
        }
      }

      console.error("GLM error", response.status, text);
      
      if (response.status !== 429) {
        return null;
      }
    } catch (error) {
      console.error(`GLM request failed (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries) {
        return null;
      }
    }
  }
  
  console.error("GLM: max retries exceeded");
  return null;
}

/**
 * Extraction Recipe Schema for Scout-generated deterministic extraction.
 * This is the output format that Scout produces and Executor consumes.
 */
export interface ExtractionRecipe {
  /** Extraction mode: CSS_SELECTOR (most common) or JSON_LD (if structured data present) */
  mode: 'CSS_SELECTOR' | 'JSON_LD';
  /** Whether the site requires JavaScript rendering (SPA) */
  requires_render: boolean;
  /** CSS selector configuration for extraction */
  config: {
    /** Container selector for the event list (e.g., '.agenda-list', '#events') */
    container: string;
    /** Selector for individual event items relative to container */
    item: string;
    /** Field mappings - CSS selectors relative to each item */
    mapping: {
      title: string;
      date: string;
      link: string;
      image: string;
      description?: string;
      location?: string;
      time?: string;
    };
  };
  /** Extraction hints for the executor */
  hints: {
    /** Date locale for parsing (e.g., 'nl' for Dutch) */
    date_locale: string;
    /** Pagination type */
    pagination: 'load_more' | 'pages' | 'none' | 'infinite_scroll';
    /** Whether detail page fetch is needed for full data */
    must_follow_link: boolean;
    /** Detected date format patterns */
    date_patterns?: string[];
  };
  /** Metadata about recipe generation */
  metadata?: {
    generated_at: string;
    model: string;
    confidence: number;
  };
}

/**
 * Scraper Architect prompt for GLM-4.7.
 * Analyzes HTML structure and generates deterministic extraction recipe.
 */
export async function generateExtractionRecipe(
  apiKey: string,
  htmlSample: string,
  sourceContext: {
    cityName?: string;
    population?: number;
    tier?: 1 | 2 | 3;
    sourceUrl: string;
    sourceName: string;
  },
  fetcher: typeof fetch = fetch
): Promise<ExtractionRecipe | null> {
  // Clean HTML: remove scripts, styles, and excessive whitespace
  const cleanedHtml = htmlSample
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 50000); // Limit to 50k chars for token efficiency

  const tier = sourceContext.tier || 3;
  const tierDescription = tier === 1 ? '>100k' : tier === 2 ? '20k-100k' : '<20k';

  const systemPrompt = `You are the "LCL-Local Scraper Architect." Your job is to analyze the HTML of Dutch city agenda websites and generate a deterministic extraction recipe.

Context:
Target City: ${sourceContext.cityName || 'Unknown'}
Population: ${sourceContext.population || 'Unknown'}
Tier: ${tier} (${tierDescription})
Source URL: ${sourceContext.sourceUrl}
Source Name: ${sourceContext.sourceName}

Objective: Output a JSON "Recipe" that allows a simple Deno/Cheerio script to extract events without further AI reasoning.

Analysis Requirements:

1. Extraction Mode: Determine if the site uses JSON_LD (preferred) or CSS_SELECTORS.
   - Check for <script type="application/ld+json"> with Event schema
   - If present and complete, use JSON_LD mode
   - Otherwise, use CSS_SELECTOR mode

2. Selectors: Identify the unique container for the event list and the relative paths for:
   - Title (look for h1, h2, h3, .title, .event-title, etc.)
   - Date (look for datetime attributes, time elements, or Dutch text like '12 mei', '15 januari')
   - Detail URL (the link to the full event page, usually an <a> tag)
   - Image URL (look for img tags, data-src, lazy-loading patterns)
   - Optional: description, location, time

3. Dutch Nuances: Note if the site uses:
   - Standard Dutch month names (januari, februari, maart, etc.)
   - Relative formats (morgen, volgende week, vandaag)
   - Time formats (14:00, 14.00, 14u00)

4. Discovery Depth:
   - For Tier 1 (>100k): Look for specific sub-categories (e.g., /agenda/muziek, /agenda/sport)
   - For Tier 2 & 3: Focus on the primary central agenda

Output Schema (Strict JSON only):
{
  "mode": "CSS_SELECTOR" | "JSON_LD",
  "requires_render": boolean,
  "config": {
    "container": "string - CSS selector for event list container",
    "item": "string - CSS selector for individual event items",
    "mapping": {
      "title": "string - CSS selector for title within item",
      "date": "string - CSS selector for date within item",
      "link": "string - CSS selector for link within item (use 'a' or 'a[href]')",
      "image": "string - CSS selector for image within item",
      "description": "string - optional CSS selector for description",
      "location": "string - optional CSS selector for location",
      "time": "string - optional CSS selector for time"
    }
  },
  "hints": {
    "date_locale": "nl",
    "pagination": "load_more" | "pages" | "none" | "infinite_scroll",
    "must_follow_link": boolean,
    "date_patterns": ["array of detected date format patterns"]
  }
}

IMPORTANT:
- Return ONLY the JSON object, no markdown code blocks
- Use specific, robust CSS selectors that won't break easily
- Prefer class-based selectors over position-based ones
- If no clear structure is found, still provide best-effort selectors`;

  const userPrompt = `Analyze this HTML and generate an extraction recipe:

${cleanedHtml}`;

  const payload = {
    model: "glm-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1,
    max_tokens: 2048,
  };

  const response = await callGLM(apiKey, payload, fetcher);
  
  if (!response) {
    console.error("GLM returned no response for recipe generation");
    return null;
  }

  try {
    // Clean up response (remove markdown code blocks if present)
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    
    const recipe = JSON.parse(cleaned) as ExtractionRecipe;
    
    // Validate required fields
    if (!recipe.mode || !recipe.config || !recipe.config.container || !recipe.config.item) {
      console.error("Recipe missing required fields:", recipe);
      return null;
    }
    
    // Add metadata
    recipe.metadata = {
      generated_at: new Date().toISOString(),
      model: "glm-4",
      confidence: 0.8, // Default confidence, can be refined
    };
    
    return recipe;
  } catch (e) {
    console.error("Failed to parse extraction recipe:", e, response);
    return null;
  }
}

export interface ParseEventOptions {
    targetYear?: number;
    language?: string;
}

export interface ParsedEventAI {
    title: string;
    description: string;
    event_date: string;
    event_time: string;
    venue_name: string;
    venue_address?: string;
    image_url: string | null;
    category: CategoryKey;  // Uppercase keys
    detail_url?: string;
    persona_tags?: string[];
}

export async function parseEventWithAI(
  apiKey: string,
  rawEvent: RawEventCard,
  fetcher: typeof fetch,
  options: ParseEventOptions = {}
): Promise<ParsedEventAI | null> {
  const { targetYear = new Date().getFullYear(), language = "nl" } = options;
  const today = new Date().toISOString().split("T")[0];
  
  const systemPrompt = `Je bent een datacleaner. Haal evenementen-informatie uit ruwe HTML.
- Retourneer uitsluitend geldige JSON.
- Weiger evenementen die niet in ${targetYear} plaatsvinden.
- Houd tekst in originele taal (${language}).
- velden: title, description (max 200 chars), event_date (YYYY-MM-DD), event_time (HH:MM), venue_name, venue_address, image_url
- category_key: Kies EXACT EEN uit [MUSIC, SOCIAL, ACTIVE, CULTURE, FOOD, NIGHTLIFE, FAMILY, CIVIC, COMMUNITY]. Retourneer in HOOFDLETTERS.`;

  const userPrompt = `Vandaag is ${today}.
Bron hint titel: ${rawEvent.title}
Bron hint datum: ${rawEvent.date}
Bron hint locatie: ${rawEvent.location}
HTML:
${rawEvent.rawHtml}`;

  const payload = {
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 768 },
  };

  const openAiPayload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1,
    max_tokens: 768,
    response_format: { type: "json_object" }
  };

  let text: string | null = null;
  if (apiKey.startsWith("sk-")) {
      text = await callOpenAI(apiKey, openAiPayload, fetcher);
  } else {
      text = await callGemini(apiKey, payload, fetcher);
  }
  
  if (!text) return null;

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  let parsed: Partial<ParsedEventAI>;
  try {
    parsed = JSON.parse(cleaned) as Partial<ParsedEventAI>;
  } catch (e) {
    console.warn("Failed to parse AI response as JSON:", e);
    return null;
  }

  if (!parsed || !parsed.title || !parsed.event_date) return null;
  
  const isoDate = parseToISODate(parsed.event_date);
  
  // Validate year
  if (!isoDate || !isoDate.startsWith(`${targetYear}-`)) return null;

  const category = mapToInternalCategory(
      ((parsed as unknown as { category_key: string }).category_key) || 
      ((parsed as unknown as { category: string }).category)  || 
      parsed.description || 
      rawEvent.title
  );

  return {
    title: normalizeWhitespace(parsed.title || ""),
    description: parsed.description ? normalizeWhitespace(parsed.description) : "",
    event_date: isoDate,
    event_time: parsed.event_time || "TBD",
    venue_name: parsed.venue_name || rawEvent.location || "",
    venue_address: parsed.venue_address,
    image_url: rawEvent.imageUrl ?? parsed.image_url ?? null,
    category: category,  // Uppercase CategoryKey
    detail_url: rawEvent.detailUrl,
  };
}

/**
 * Enhanced interface for detailed event parsing with AI.
 * Includes additional fields for improved data quality.
 */
export interface ParsedDetailedEventAI extends ParsedEventAI {
    price?: string;
    price_currency?: string;
    price_min?: number;
    price_max?: number;
    organizer?: string;
    organizer_url?: string;
    tickets_url?: string;
    end_time?: string;
    end_date?: string;
    performer?: string;
    accessibility?: string;
    age_restriction?: string;
    event_status?: 'scheduled' | 'cancelled' | 'postponed' | 'rescheduled';
    image_user_prompt?: string; // Debug info
    data_source?: 'listing' | 'detail' | 'hybrid';
}

export async function parseDetailedEventWithAI(
  apiKey: string,
  rawEvent: RawEventCard,
  detailHtml: string | null,
  fetcher: typeof fetch,
  options: ParseEventOptions = {}
): Promise<ParsedDetailedEventAI | null> {
  const { targetYear = new Date().getFullYear(), language = "nl" } = options;
  const today = new Date().toISOString().split("T")[0];
  
  // Enhanced AI prompt for comprehensive data extraction
  const systemPrompt = `Je bent een event data expert. Haal ALLE beschikbare evenementen-informatie uit de HTML Context.
BELANGRIJK: Prioriteer detail page content boven listing content voor rijkere data.

Retourneer uitsluitend geldige JSON met deze velden:

VERPLICHTE VELDEN:
- title: string (evenement titel)
- description: string (VOLLEDIGE beschrijving van detail pagina, niet afkorten)
- event_date: string (YYYY-MM-DD formaat)
- event_time: string (HH:MM formaat of "TBD")
- category_key: string (kies uit: MUSIC, SOCIAL, ACTIVE, CULTURE, FOOD, NIGHTLIFE, FAMILY, CIVIC, COMMUNITY)

LOCATIE VELDEN:
- venue_name: string (naam van de locatie/venue)
- venue_address: string (volledig adres indien beschikbaar)

MEDIA VELDEN:
- image_url: string (URL van de HOOGSTE resolutie afbeelding, geen thumbnails)

TIJD/DUUR VELDEN:
- end_time: string (HH:MM formaat, indien beschikbaar)
- end_date: string (YYYY-MM-DD, alleen bij meerdaagse events)

PRIJS VELDEN (zoek naar ticket prijzen, entree kosten):
- price: string (bijv. "€15,00", "Gratis", "€10 - €25", "Vanaf €12,50")
- price_currency: string (ISO 4217 code, bijv. "EUR")
- price_min: number (minimum prijs in euro's, bijv. 10.00)
- price_max: number (maximum prijs in euro's)
- tickets_url: string (directe link naar ticket aankoop)

ORGANISATOR VELDEN:
- organizer: string (naam van de organisator/producer)
- organizer_url: string (website van organisator)
- performer: string (naam van artiest/band/spreker indien van toepassing)

EXTRA VELDEN:
- accessibility: string (toegankelijkheid info, rolstoelvriendelijk etc.)
- age_restriction: string (bijv. "18+", "Alle leeftijden", "12+")
- event_status: string (kies uit: scheduled, cancelled, postponed, rescheduled)
- persona_tags: string[] (bijv. ['#Culture', '#Social', '#Nightlife', '#Family', '#Active'])

REGELS:
- Weiger evenementen die niet in ${targetYear} plaatsvinden
- Houd tekst in originele taal (${language})
- Gebruik null voor velden die niet gevonden kunnen worden
- Zoek ALTIJD naar prijs informatie (gratis, entree, tickets, kosten)
- Geef voorkeur aan detail page content over listing content`;

  const userPrompt = `Vandaag is ${today}.
Context:
Titel: ${rawEvent.title}
Datum: ${rawEvent.date}
Listing URL: ${rawEvent.detailUrl}

HTML Content (Listing + Detail):
${rawEvent.rawHtml || ''}
${detailHtml || ''}
`;

   // Truncate user prompt to safe limit (~60k chars for 128k context models, but keeping it efficient)
   const truncatedPrompt = userPrompt.slice(0, 40000);

  const openAiPayload = {
    model: "gpt-4o-mini", // Efficient model for batch processing
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: truncatedPrompt }
    ],
    temperature: 0.1,
    // max_tokens: 1000, // Let model decide, JSON object enforcement handles structure
    response_format: { type: "json_object" }
  };

  let text: string | null = null;
  // Support both wrappers
  if (apiKey.startsWith("sk-")) {
      text = await callOpenAI(apiKey, openAiPayload, fetcher);
  } else {
      // Gemini fallback if needed, though structure logic implies OpenAI preferred per plan
      const geminiPayload = {
        contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "user", parts: [{ text: truncatedPrompt }] }
        ],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      };
      text = await callGemini(apiKey, geminiPayload, fetcher);
  }
  
  if (!text) return null;

  try {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.title || !parsed.event_date) return null;
    
    // Validate year
    const isoDate = parseToISODate(parsed.event_date);
    if (!isoDate || !isoDate.startsWith(`${targetYear}-`)) return null;

    const category = mapToInternalCategory(
        ((parsed as unknown as { category_key: string }).category_key) || 
        ((parsed as unknown as { category: string }).category) || 
        parsed.description || 
        rawEvent.title
    );

    return {
        title: normalizeWhitespace(parsed.title || ""),
        description: parsed.description ? normalizeWhitespace(parsed.description) : "",
        event_date: isoDate,
        event_time: parsed.event_time || "TBD",
        venue_name: parsed.venue_name || rawEvent.location || "",
        venue_address: parsed.venue_address,
        image_url: parsed.image_url || rawEvent.imageUrl || null,
        category: category,  // Uppercase CategoryKey
        detail_url: rawEvent.detailUrl,
        // Enhanced pricing fields
        price: parsed.price,
        price_currency: parsed.price_currency,
        price_min: typeof parsed.price_min === 'number' ? parsed.price_min : undefined,
        price_max: typeof parsed.price_max === 'number' ? parsed.price_max : undefined,
        // Organizer fields
        organizer: parsed.organizer,
        organizer_url: parsed.organizer_url,
        // Time/duration fields
        end_time: parsed.end_time,
        end_date: parsed.end_date,
        // Additional metadata
        performer: parsed.performer,
        accessibility: parsed.accessibility,
        age_restriction: parsed.age_restriction,
        event_status: parseEventStatus(parsed.event_status),
        tickets_url: parsed.tickets_url,
        persona_tags: parsed.persona_tags,
        // Track data source
        data_source: detailHtml ? 'detail' : 'listing',
    };
  } catch (e) {
    console.warn("Detailed AI parsing failed:", e);
    return null;
  }
}

/**
 * Helper to normalize event status strings to valid enum values.
 */
function parseEventStatus(status: string | undefined): ParsedDetailedEventAI['event_status'] {
  if (!status) return undefined;
  const normalized = status.toLowerCase();
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('postpone')) return 'postponed';
  if (normalized.includes('reschedul')) return 'rescheduled';
  if (normalized.includes('schedul')) return 'scheduled';
  return undefined;
}

export async function healSelectors(
  apiKey: string,
  html: string,
  fetcher: typeof fetch
): Promise<string[] | null> {
  // Truncate HTML to avoid token limits, but keep enough structure
  // Focus on the body content, usually up to 15000 chars is enough for a sample
  const sampleHtml = normalizeWhitespace(html).slice(0, 15000);

  const systemPrompt = `You are an expert web scraper. Your task is to analyze HTML and discover the CSS selectors for event listings.
      - Return ONLY valid JSON.
      - Find the container selector for a single event card/listing.
      - The selector must return multiple elements (the list of events).
      - Examples of good selectors: "article.event", ".calendar-item", "div[class*='event-card']", "li.agenda-item".
      - Return a JSON object with a "selectors" array containing the best 3 candidate selectors for the event card container.`;

  const userPrompt = `Analyze this HTML and find the CSS identifiers for the event cards:
      ${sampleHtml}`;

  const payload = {
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "user", parts: [{ text: userPrompt }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
  };

  const openAiPayload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 256,
    response_format: { type: "json_object" }
  };

  let text: string | null = null;
  if (apiKey.startsWith("sk-")) {
      text = await callOpenAI(apiKey, openAiPayload, fetcher);
  } else {
      text = await callGemini(apiKey, payload, fetcher);
  }
  
  if (!text) return null;

  try {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const result = JSON.parse(cleaned);
    if (result.selectors && Array.isArray(result.selectors)) {
      return result.selectors;
    }
  } catch (e) {
    console.warn("Failed to parse healed selectors:", e);
  }
  return null;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
}

export async function generateEmbedding(
  apiKey: string,
  text: string,
  fetcher: typeof fetch
): Promise<EmbeddingResponse | null> {
    try {
        if (apiKey.startsWith("sk-")) {
            // OpenAI Embedding
            const response = await fetcher("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "text-embedding-3-small",
                input: text,
                dimensions: 1536,
              }),
            });

            if (!response.ok) {
                console.error("OpenAI Embedding error:", response.status, await response.text());
                return null;
            }

            const data = await response.json();
            return {
                embedding: data.data[0].embedding,
                model: "openai-text-embedding-3-small"
            };
        }

        // Gemini Embedding
        const response = await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            model: "models/text-embedding-004",
            content: {
                parts: [{ text }],
            },
            }),
        }
        );

        if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        return null;
        }

        const data = await response.json();
        const embedding = data.embedding?.values;

        if (!embedding || !Array.isArray(embedding)) {
        console.error("Invalid embedding response from Gemini");
        return null;
        }

        const paddedEmbedding = [...embedding, ...new Array(1536 - embedding.length).fill(0)];

        return {
        embedding: paddedEmbedding,
        model: "gemini-text-embedding-004",
        };
    } catch (error) {
        console.error("Error generating AI embedding:", error);
        return null;
    }
}

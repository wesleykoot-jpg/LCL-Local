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

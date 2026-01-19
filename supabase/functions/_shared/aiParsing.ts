import { jitteredDelay } from "./rateLimiting.ts";
import { RawEventCard } from "./types.ts";
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
    internal_category: string; // We return string, caller should cast/validate
    detail_url?: string;
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
- category: Kies de BEST PASSENDE uit: [active, gaming, entertainment, social, family, outdoors, music, workshops, foodie, community]. Indien onzeker of geen match, kies 'community'.`;

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

  const text = await callGemini(apiKey, payload, fetcher);
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
      ((parsed as unknown as { category: string }).category) || parsed.description || rawEvent.title
  );

  return {
    title: normalizeWhitespace(parsed.title || ""),
    description: parsed.description ? normalizeWhitespace(parsed.description) : "",
    event_date: isoDate,
    event_time: parsed.event_time || "TBD",
    venue_name: parsed.venue_name || rawEvent.location || "",
    venue_address: parsed.venue_address,
    image_url: rawEvent.imageUrl ?? parsed.image_url ?? null,
    internal_category: category,
    detail_url: rawEvent.detailUrl,
  };
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

  const text = await callGemini(apiKey, payload, fetcher);
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
        console.error("Error generating Gemini embedding:", error);
        return null;
    }
}

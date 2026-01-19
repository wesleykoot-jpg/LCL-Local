
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { classifyTextToCategory } from "../supabase/functions/_shared/categoryMapping.ts";

// Config
const CONFIG = {
    MAX_HTML_CHARS_FOR_LLM: 5000,
    URL_FETCH_TIMEOUT_MS: 15000,
    SERPER_API_TIMEOUT_MS: 15000,
    AUTO_ENABLE_CONFIDENCE_THRESHOLD: 90,
    MIN_VALIDATION_CONFIDENCE: 60,
    DELAY_BETWEEN_CITIES_MS: 2000,
    DELAY_BETWEEN_QUERIES_MS: 1000,
};

// Keys (From User)
const SERPER_API_KEY = "7e33f011dce62fce0320136c09803dd9e5ed150d";
const GEMINI_API_KEY = "AIzaSyDarh-b-mvntf3SKSERK0Ree0vIQr9w_2g";

// Supabase (From Environment/Known context)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase Env Vars!");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DUTCH_MONTHS = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december"
];

const NOISE_DOMAINS = [
    "tripadvisor.", "facebook.com", "booking.com", "instagram.com",
    "twitter.com", "x.com", "linkedin.com", "pinterest.com",
    "youtube.com", "tiktok.com", "yelp.", "groupon.", "expedia.",
    "hotels.", "airbnb.", "marktplaats.nl", "wikipedia.org", "buienradar.nl", "weeronline.nl"
];

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
        `uitagenda ${name} 2026`,
        `evenementen kalender ${name}`,
        `wat te doen in ${name} vandaag`,
        `agenda ${name} uitgaan`,
    ];
}

async function callSerper(query: string) {
    console.log(`Searching: ${query}`);
    const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "nl", hl: "nl", num: 10 }),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.organic || []).map((i: any) => ({ link: i.link, title: i.title, snippet: i.snippet }));
}

async function validateSourceWithLLM(url: string, municipality: string) {
    try {
        console.log(`Validating: ${url}`);
        const r = await fetch(url, {
            headers: { "User-Agent": "LCL-Pilot/1.0" },
            signal: AbortSignal.timeout(CONFIG.URL_FETCH_TIMEOUT_MS)
        });
        if (!r.ok) return { isValid: false };
        const html = await r.text();

        // Basic heuristics first
        const hasAgendaContent = /agenda|evenement|activiteit|programma|kalender/i.test(html);
        if (!hasAgendaContent) return { isValid: false };

        // LLM Logic
        const payload = {
            contents: [{
                role: "user",
                parts: [{
                    text: `Analyze this HTML. Is it an event calendar/agenda for ${municipality}? 
              JSON response: {"isEventAgenda": boolean, "confidence": number, "suggestedName": string}.
              URL: ${url}
              HTML Snippet: ${html.slice(0, 3000)}`
                }]
            }]
        };

        const llmR = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!llmR.ok) return { isValid: false };
        const llmData = await llmR.json();
        const txt = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = txt.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                isValid: parsed.isEventAgenda,
                confidence: parsed.confidence,
                suggestedName: parsed.suggestedName || `Agenda ${municipality}`
            };
        }
    } catch (e) {
        console.error(`Validation error for ${url}:`, e.message);
    }
    return { isValid: false };
}

async function main() {
    console.log("Starting Local Pilot Driver...");

    // 1. Get Pilot Cities
    const { data: cities } = await supabase
        .from('cities')
        .select('*')
        .eq('discovery_status', 'pilot_pending')
        .limit(15);

    if (!cities || cities.length === 0) {
        console.log("No pilot_pending cities found. Run 'setup_dutch_pilot.ts' first?");
        return;
    }

    console.log(`Processing ${cities.length} cities...`);

    for (const city of cities) {
        console.log(`\n=== CITY: ${city.name} ===`);
        const queries = generateSearchQueries(city.name);
        const seen = new Set<string>();

        for (const q of queries) {
            const results = await callSerper(q);
            for (const res of results) {
                if (isNoiseDomain(res.link)) continue;
                const canonical = canonicalizeUrl(res.link);
                if (seen.has(canonical)) continue;
                seen.add(canonical);

                // Validate
                const val = await validateSourceWithLLM(canonical, city.name);
                if (val.isValid && val.confidence > 60) {
                    console.log(`✅ FOUND: ${canonical} (${val.confidence}%)`);

                    // Insert
                    const { error } = await supabase.from('scraper_sources').insert({
                        name: val.suggestedName,
                        url: canonical,
                        location_name: city.name,
                        auto_discovered: true,
                        enabled: val.confidence > CONFIG.AUTO_ENABLE_CONFIDENCE_THRESHOLD,
                        default_coordinates: { lat: city.latitude, lng: city.longitude },
                        country: 'NL',
                        language: 'nl-NL',
                        config: {
                            selectors: [".event", ".agenda-item"],
                            headers: { "User-Agent": "LCL-Pilot/1.0" }
                        }
                    });
                    if (error && error.code !== '23505') console.error("Insert error:", error.message);
                }
                await new Promise(r => setTimeout(r, 500));
            }
            await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_QUERIES_MS));
        }

        // Update Status
        await supabase.from('cities').update({
            discovery_status: 'completed',
            last_discovery_at: new Date().toISOString()
        }).eq('id', city.id);

        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_CITIES_MS));
    }

    console.log("\nPilot Run Complete!");
}

main();

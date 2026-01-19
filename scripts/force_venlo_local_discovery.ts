
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Keys
const SERPER_API_KEY = "7e33f011dce62fce0320136c09803dd9e5ed150d";
const GEMINI_API_KEY = "AIzaSyDeJTcgc_o3OFjJKI9WQcfPIh1ORH-7PH4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT_REF = "mlpefjsbriqgxcaqxhic";
const FUNCTIONS_URL = `https://${PROJECT_REF}.supabase.co/functions/v1`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function callSerper(query: string) {
    console.log(`Searching: ${query}`);
    const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "nl", hl: "nl", num: 5 }),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.organic || []).map((i: any) => ({ link: i.link, title: i.title, snippet: i.snippet }));
}

async function validateSourceWithLLM(url: string, municipality: string) {
    try {
        console.log(`Validating: ${url}`);
        const r = await fetch(url, { headers: { "User-Agent": "LCL-Pilot/1.0" }, signal: AbortSignal.timeout(10000) });
        if (!r.ok) { console.log(`Fetch Failed: ${r.status}`); return { isValid: false }; }
        const html = await r.text();
        console.log(`Fetched ${html.length} chars.`);

        // LLM
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

        if (!llmR.ok) { console.log(`LLM Failed: ${llmR.status}`); return { isValid: false }; }
        const llmData = await llmR.json();
        // console.log("LLM Raw:", JSON.stringify(llmData)); 
        const txt = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log(`LLM Text: ${txt}`);

        const jsonMatch = txt.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`Parsed: ${JSON.stringify(parsed)}`);
            return {
                isValid: parsed.isEventAgenda,
                confidence: parsed.confidence,
                suggestedName: parsed.suggestedName || `Agenda ${municipality}`
            };
        } else {
            console.log("No JSON found in LLM response");
        }
    } catch (e) { console.error(`Validation error: ${e.message}`); }
    return { isValid: false };
}

async function main() {
    console.log("🚀 FORCE LOCAL DISCOVERY: VENLO");
    const city = "Venlo";
    const query = `uitagenda ${city}`;

    // 1. Serper
    const results = await callSerper(query);
    console.log(`Found ${results.length} Google Results.`);

    if (results.length === 0) return;

    // 2. Validate Best Candidate
    let bestSource = null;
    for (const res of results) {
        if (res.link.includes("facebook") || res.link.includes("tripadvisor")) continue;
        const val = await validateSourceWithLLM(res.link, city);
        if (val.isValid && val.confidence > 60) {
            bestSource = { ...res, ...val };
            break; // Found one good one
        }
    }

    if (!bestSource) {
        console.log("No valid agenda found by AI. Falling back to Top Result (Validation Bypass).");
        if (results.length > 0) {
            bestSource = { ...results[0], suggestedName: results[0].title || "Venlo Agenda", isValid: true };
        } else {
            return;
        }
    }

    console.log(`✅ Selected Source: ${bestSource.suggestedName} (${bestSource.link})`);

    // 3. Insert into DB
    const { data: inserted, error } = await supabase.from('scraper_sources').insert({
        name: bestSource.suggestedName,
        url: bestSource.link,
        location_name: city,
        auto_discovered: true,
        enabled: true,
        country: 'NL',
        language: 'nl-NL',
        config: { selectors: [".event"], headers: { "User-Agent": "LCL-Pilot/1.0" } }
    }).select().single();

    if (error && error.code !== '23505') { console.error("Insert Error", error); return; }
    if (!inserted) { console.log("Source likely already exists."); }

    const sourceId = inserted ? inserted.id : (await supabase.from('scraper_sources').select('id').eq('url', bestSource.link).single()).data.id;

    // 4. Trigger Cloud Scraper
    console.log(`4. Triggering Cloud Scraper Job for Source: ${sourceId}`);

    // Create Job first
    const { data: job } = await supabase.from("scrape_jobs").insert({ source_id: sourceId, status: 'pending', priority: 1 }).select().single();

    // Call Worker
    const scrapeRes = await fetch(`${FUNCTIONS_URL}/scrape-worker`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id })
    });

    console.log(`Scraper Response Status: ${scrapeRes.status}`);
    if (scrapeRes.ok) {
        const json = await scrapeRes.json();
        console.log("Scrape Result:", json);
    } else {
        console.log("Scrape Failed Body:", await scrapeRes.text());
    }
}

main();

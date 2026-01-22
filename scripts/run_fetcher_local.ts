import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Mock Deno.env for local run if needed, but we rely on .env loading
try {
  const text = await Deno.readTextFile(".env");
  for (const line of text.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.slice(1, -1);
      Deno.env.set(match[1], value);
    }
  }
} catch (_e) {
  console.log("⚠️ .env load failed");
}

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE env vars");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Simple hashing
async function sha256Hex(text: string) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  console.log("🚀 Starting Local Fetcher...");

  // 1. Get enabled sources (Limit to 50 for speed/test)
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("id, url, name, config")
    .eq("enabled", true)
    .limit(50);

  if (error) {
    console.error(error);
    Deno.exit(1);
  }
  if (!sources?.length) {
    console.log("No sources found");
    Deno.exit(0);
  }

  console.log(`Found ${sources.length} sources to scrape.`);

  let totalStaged = 0;

  for (const src of sources) {
    console.log(`\n🕷️ Force Fetching: ${src.name} (${src.url})`);
    try {
      const resp = await fetch(src.url);
      if (!resp.ok) {
        console.warn(`  ❌ Status ${resp.status}`);
        continue;
      }
      const html = await resp.text();

      // Basic extraction simulation (since we don't have all shared libs locally easily)
      // Actually, we just want to stage the HTML for the processor to handle.
      // The processor does the heavy lifting (AI/JSON-LD).
      // We just need to create "cards" or just one big payload?
      // The `scrape-events` logic splits into cards.
      // FOR UAT: If we can't easily replicate strategies locally,
      // let's try to just create ONE staging row per source with the FULL HTML
      // and let the processor's "Fast Path / AI" handle it?
      // Wait, processor usually expects "Cards".
      // If I verify `process-worker`, it handles `raw_payload`.
      // If I dump the whole HTML into `rawHtml`, AI might parse it.

      // Let's do a simple split if possible, or just 1 big item.
      // Better: Mock a "Single Card" that contains the whole page HTML.

      const cardUrl = `${src.url}#full-page-${Date.now()}`;

      const { error: insErr } = await supabase.from("raw_event_staging").upsert(
        {
          source_url: cardUrl,
          raw_html: html,
          source_id: src.id,
          status: "pending",
          parsing_method: "ai_fallback", // Force AI or fallback
        },
        { onConflict: "source_url" },
      );

      if (insErr) console.error("  ❌ Staging Error:", insErr.message);
      else {
        console.log("  ✅ Staged full page for processing");
        totalStaged++;
      }
    } catch (e) {
      console.error("  ❌ Network Error:", e.message);
    }
  }

  console.log(`\n🎉 Finished. Staged ${totalStaged} items.`);
}

main();

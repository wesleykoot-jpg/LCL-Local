import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Helper to load .env manually
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
} catch (e) {
  console.log("⚠️ .env load failed or not found");
}

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase Keys");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyProxyFix() {
  console.log("Fetching sources to check for blocking...");

  // Check all enabled sources
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("id, name, url, fetcher_type")
    .eq("enabled", true);

  if (error || !sources) {
    console.error("Failed to fetch sources:", error);
    Deno.exit(1);
  }

  console.log(`Checking ${sources.length} sources...`);

  let fixedCount = 0;
  let alreadyProxy = 0;

  // Process in chunks
  const CHUNK_SIZE = 10;
  for (let i = 0; i < sources.length; i += CHUNK_SIZE) {
    const chunk = sources.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (source) => {
        if (source.fetcher_type === "scrapingbee") {
          alreadyProxy++;
          return;
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          // Try HEAD first (faster), fallback to GET
          let status = 0;
          try {
            const head = await fetch(source.url, {
              method: "HEAD",
              signal: controller.signal,
              headers: { "User-Agent": "Mozilla/5.0 (BlockCheck)" },
            });
            status = head.status;
          } catch {
            // HEAD failed, try GET
            const get = await fetch(source.url, {
              signal: controller.signal,
              headers: { "User-Agent": "Mozilla/5.0 (BlockCheck)" },
            });
            status = get.status;
          }
          clearTimeout(timeout);

          if (status === 403 || status === 401) {
            console.log(
              `🔒 BLOCK DETECTED: ${source.name} (${status}). Enabling Proxy...`,
            );

            await supabase
              .from("scraper_sources")
              .update({ fetcher_type: "scrapingbee" })
              .eq("id", source.id);

            fixedCount++;
          }
        } catch (e) {
          // Network failures might also be blocks, but we'll stick to explicit 403/401 for safety
          // console.warn(`Error checking ${source.name}: ${e.message}`);
        }
      }),
    );
  }

  console.log(`\n--- PROXY FIX REPORT ---`);
  console.log(`Checked: ${sources.length}`);
  console.log(`Already Proxy: ${alreadyProxy}`);
  console.log(`Newly Fixed: ${fixedCount}`);
}

applyProxyFix();

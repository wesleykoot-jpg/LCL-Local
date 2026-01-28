import { createClient } from "npm:@supabase/supabase-js@2.49.1";

async function loadEnv() {
  const envText = await Deno.readTextFile(".env");
  const env: Record<string, string> = {};
  envText.split("\n").forEach((line) => {
    const [key, ...val] = line.split("=");
    if (key && val.length > 0) {
      env[key.trim()] = val
        .join("=")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  });
  return env;
}

async function main() {
  const env = await loadEnv();
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  Deno.env.set("SUPABASE_URL", SUPABASE_URL);
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  Deno.env.set("OPENAI_API_KEY", env.OPENAI_API_KEY);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Use dynamic imports to load handlers after env is set
  const { handler: fetcherHandler } =
    await import("../supabase/functions/scrape-events/index.ts");
  const { handler: enrichmentHandler } =
    await import("../supabase/functions/enrichment-worker/index.ts");

  console.log("Fetching Zwolle and Meppel source IDs...");
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("id, name")
    .or(
      "location_name.ilike.%Zwolle%,location_name.ilike.%Meppel%,name.ilike.%Zwolle%,name.ilike.%Meppel%",
    )
    .eq("enabled", true);

  if (error) {
    console.error("Error fetching sources:", error);
    return;
  }

  console.log(`Processing ${sources.length} sources...`);

  for (const source of sources) {
    console.log(`\n--- [FETCH] ${source.name} (${source.id}) ---`);
    const req = new Request("http://localhost/fetcher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sourceId: source.id }),
    });

    try {
      const res = await fetcherHandler(req);
      const result = await res.json();
      console.log(`Result:`, JSON.stringify(result, null, 2));
    } catch (e) {
      console.error(`Error fetching source ${source.name}:`, e.message);
    }
  }

  console.log("\n--- [ENRICH] Starting Enrichment Loop ---");
  // Run enrichment per row using webhook payloads
  let hasMore = true;
  let blocksProcessed = 0;
  while (hasMore && blocksProcessed < 200) {
    const { data: rows, error: rowsError } = await supabase
      .from("raw_event_staging")
      .select(
        "id, source_id, source_url, detail_url, title, raw_html, pipeline_status, created_at",
      )
      .eq("pipeline_status", "awaiting_enrichment")
      .order("created_at", { ascending: true })
      .limit(5);

    if (rowsError) {
      console.error("Error fetching staging rows:", rowsError);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log("No more awaiting_enrichment rows.");
      break;
    }

    for (const row of rows) {
      const payload = {
        type: "INSERT",
        table: "raw_event_staging",
        schema: "public",
        record: {
          id: row.id,
          source_id: row.source_id,
          source_url: row.source_url,
          detail_url: row.detail_url,
          title: row.title,
          raw_html: row.raw_html,
          pipeline_status: row.pipeline_status,
          created_at: row.created_at,
        },
        old_record: null,
      };

      const req = new Request("http://localhost/enrichment-worker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const res = await enrichmentHandler(req);
      const result = await res.json();
      console.log(
        `Enriched ${row.id}:`,
        JSON.stringify(result, null, 2),
      );
    }

    const { count, error: countErr } = await supabase
      .from("raw_event_staging")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_status", "awaiting_enrichment");

    if (countErr) {
      console.error("Error checking staging count:", countErr);
      break;
    }

    console.log(`Awaiting enrichment remaining: ${count || 0}`);
    hasMore = (count || 0) > 0;
    blocksProcessed++;
  }

  console.log("\nPipeline run complete!");
}

main().catch(console.error);

// run_pipeline.ts
// Simple script to invoke the Data-First fetcher and enrichment Edge Functions locally

import { createClient } from "@supabase/supabase-js";

// Global variables for handlers and client
let supabase: any;
let fetcherHandler: any;
let enrichmentHandler: any;

// 1. Load env internally to avoid hoisting issues
const loadEnv = async () => {
    try {
        const envText = await Deno.readTextFile(".env");
        envText.split("\n").forEach((line) => {
            const [key, ...val] = line.split("=");
            if (key && val.length > 0) {
                const v = val.join("=").trim().replace(/^["']|["']$/g, "");
                Deno.env.set(key.trim(), v);
            }
        });
        console.log("Environment variables loaded from .env");
    } catch (e) {
        console.warn(".env file not found, relying on system env", e.message);
    }
};

async function invokeFetcher(sourceId: string) {
  const { supabaseServiceRoleKey } = await import("./supabase/functions/_shared/env.ts");
  const req = new Request("http://localhost/fetcher", { 
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceRoleKey}`
    },
    body: JSON.stringify({ sourceId })
  });
  const res = await fetcherHandler(req);
  const txt = await res.text();
  console.log("Fetcher response:", txt);
  return txt;
}

async function invokeEnrichmentBatch(limit = 5) {
  const { supabaseServiceRoleKey } = await import("./supabase/functions/_shared/env.ts");
  const { data: rows, error } = await supabase
    .from("raw_event_staging")
    .select(
      "id, source_id, source_url, detail_url, title, raw_html, pipeline_status, created_at",
    )
    .eq("pipeline_status", "awaiting_enrichment")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching rows for enrichment:", error);
    return;
  }

  if (!rows || rows.length === 0) {
    console.log("No awaiting_enrichment rows found.");
    return;
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
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const res = await enrichmentHandler(req);
    const txt = await res.text();
    console.log("Enrichment response:", txt);
  }
}

async function reportCounts() {
  const { count: stagingCount, error: err2 } = await supabase
    .from("raw_event_staging")
    .select("id", { count: "exact", head: true });
  if (err2) console.error("Staging count error", err2);
  else console.log("Total staging rows:", stagingCount);

  const { count: eventsCount, error: err3 } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true });
  if (err3) console.error("Events count error", err3);
  else console.log("Total events rows:", eventsCount);
}

async function main() {
  await loadEnv();

  // 2. Dynamically import modules AFTER env is loaded
  const { supabaseUrl, supabaseServiceRoleKey } = await import("./supabase/functions/_shared/env.ts");
  const { handler: fHandler } = await import("./supabase/functions/scrape-events/index.ts");
  const { handler: eHandler } = await import("./supabase/functions/enrichment-worker/index.ts");

  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  fetcherHandler = fHandler;
  enrichmentHandler = eHandler;

  // Get the first enabled source
  const { data: sources } = await supabase
    .from("scraper_sources")
    .select("id, name, url")
    .eq("enabled", true)
    .limit(1);

  if (!sources || sources.length === 0) {
    console.error("No enabled scraper sources found!");
    return;
  }

  const source = sources[0];
  console.log(`Using source: ${source.name} (${source.url})`);
  console.log(`Source ID: ${source.id}`);

  console.log("\n--- Running Data-First fetcher ---");
  const fetcherResult = await invokeFetcher(source.id);
  
  console.log("\n--- Running Enrichment Worker (local webhook payloads) ---");
  await invokeEnrichmentBatch();
  
  console.log("\n--- Reporting DB counts ---");
  await reportCounts();
}

main().catch((e) => console.error("Pipeline error", e));

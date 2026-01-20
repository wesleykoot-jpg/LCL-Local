// run_pipeline.ts
// Simple script to invoke the Data‑First fetcher and processor Edge Functions locally
// and then report the number of rows in staging and events tables.

import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey, openAiApiKey } from "./supabase/functions/_shared/env.ts";
import { handler as fetcherHandler } from "./supabase/functions/scrape-events/index.ts";
import { handler as processorHandler } from "./supabase/functions/process-events/index.ts";

// Load env (Deno automatically loads .env if --allow-env is set)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function invokeFetcher() {
  const req = new Request("http://localhost/fetcher", { method: "POST" });
  const res = await fetcherHandler(req);
  const txt = await res.text();
  console.log("Fetcher response:", txt);
}

async function invokeProcessor() {
  const req = new Request("http://localhost/processor", { method: "POST" });
  const res = await processorHandler(req);
  const txt = await res.text();
  console.log("Processor response:", txt);
}

async function reportCounts() {
  const { data: staging, error: err1 } = await supabase
    .from("raw_event_staging")
    .select("id, status, parsing_method")
    .order("created_at", { ascending: false })
    .limit(10);
  if (err1) console.error("Staging fetch error", err1);
  else console.log("Recent staging rows (up to 10):", staging);

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
  console.log("--- Running Data‑First fetcher ---");
  await invokeFetcher();
  console.log("--- Running Data‑First processor ---");
  await invokeProcessor();
  console.log("--- Reporting DB counts ---");
  await reportCounts();
}

main().catch((e) => console.error("Pipeline error", e));

// run_pipeline.ts
// Simple script to invoke the Data-First fetcher and processor Edge Functions locally

import { createClient } from "@supabase/supabase-js";

// Global variables for handlers and client
let supabase: any;
let fetcherHandler: any;
let processorHandler: any;

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
  const req = new Request("http://localhost/fetcher", { 
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId })
  });
  const res = await fetcherHandler(req);
  const txt = await res.text();
  console.log("Fetcher response:", txt);
  return txt;
}

async function invokeProcessor() {
  const req = new Request("http://localhost/processor", { method: "POST" });
  const res = await processorHandler(req);
  const txt = await res.text();
  console.log("Processor response:", txt);
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
  const { handler: pHandler } = await import("./supabase/functions/process-worker/index.ts");

  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  fetcherHandler = fHandler;
  processorHandler = pHandler;

  console.log("--- Running Data-First fetcher ---");
  await invokeFetcher();
  
  console.log("--- Running Process Worker ---");
  await invokeProcessor();
  
  console.log("--- Reporting DB counts ---");
  await reportCounts();
}

main().catch((e) => console.error("Pipeline error", e));

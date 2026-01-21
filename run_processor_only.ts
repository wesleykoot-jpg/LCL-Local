import { resolve } from "https://deno.land/std@0.168.0/path/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

async function loadEnv() {
  try {
    const envPath = resolve(Deno.cwd(), ".env");
    const envText = await Deno.readTextFile(envPath);
    console.log("Loading .env from:", envPath);
    
    for (const line of envText.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...values] = trimmed.split("=");
        if (key && values.length > 0) {
          const val = values.join("=").replace(/^["']|["']$/g, "").trim();
          Deno.env.set(key, val);
        }
      }
    }
  } catch (e) {
    console.error("Error loading .env:", e.message);
  }
}

async function main() {
  await loadEnv();

  // Dynamic import to ensure env is set BEFORE the handler is imported
  const { handler: processorHandler } = await import("./supabase/functions/process-events/index.ts");
  const { supabaseUrl, supabaseServiceRoleKey } = await import("./supabase/functions/_shared/env.ts");

  console.log("--- Running Data‑First processor only ---");
  const req = new Request("http://localhost/processor", { method: "POST" });
  const res = await processorHandler(req);
  const txt = await res.text();
  console.log("Processor response:", txt);

  // Check results
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: staging } = await supabase.from("raw_event_staging").select("id, status, parsing_method, source_url").limit(5).order("updated_at", { ascending: false });
  console.log("Recent Stage Rows:", staging);
  
  const { count } = await supabase.from("events").select("*", { count: "exact", head: true });
  console.log("Total Events:", count);
}

main().catch((e) => console.error("Processor error", e));

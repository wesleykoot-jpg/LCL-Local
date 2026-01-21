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
  const { handler: processorHandler } = await import("./supabase/functions/process-worker/index.ts");
  const { supabaseUrl, supabaseServiceRoleKey } = await import("./supabase/functions/_shared/env.ts");

  // Check results
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  let totalProcessed = 0;
  let hasPending = true;

  while (hasPending) {
    console.log(`--- Running Batch (Total so far: ${totalProcessed}) ---`);
    const req = new Request("http://localhost/processor", { method: "POST" });
    const res = await processorHandler(req);
    const txt = await res.text();
    console.log("Processor response:", txt);

    try {
      const json = JSON.parse(txt);
      if (json.message === "No pending rows") {
        console.log("No more pending rows. Finishing.");
        hasPending = false;
      } else if (json.message === "Processed batch") {
        totalProcessed += 10; // Approx batch size
        // Add a small delay to be nice to CPUs/Rate limits
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.warn("Unexpected response, stopping loop:", txt);
        hasPending = false;
      }
    } catch (e) {
      console.error("Failed to parse response, stopping:", e);
      hasPending = false;
    }
  }
  
  const { count } = await supabase.from("events").select("*", { count: "exact", head: true });
  console.log("Final Total Events in DB:", count);
}

main().catch((e) => console.error("Processor error", e));

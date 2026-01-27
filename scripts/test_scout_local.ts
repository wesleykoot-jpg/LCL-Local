import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";
import { handler } from "../supabase/functions/scout-worker/index.ts";

const supabaseUrl =
  Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Target: Visit Zwolle Agenda (Tier 2 city, likely to have events)
const TARGET_SOURCE_ID = "5a4ba9ea-c84e-4b94-b4c7-1a295a196f1c";

async function main() {
  const args = Deno.args;
  const isBatch = args.includes("--batch");
  const batchSizeStr = args.find((a) => a.startsWith("--size="))?.split("=")[1];
  const batchSize = batchSizeStr ? parseInt(batchSizeStr) : 5;

  console.log("--- Starting Scout Worker Test ---");

  if (!isBatch) {
    console.log(`Target Source: ${TARGET_SOURCE_ID}`);
    // 1. Reset source to pending_scout to force the worker to act
    console.log("Resetting source status to 'pending_scout'...");
    await supabase
      .from("scraper_sources")
      .update({
        scout_status: "pending_scout",
        extraction_recipe: null,
      })
      .eq("id", TARGET_SOURCE_ID);
    console.log("Source reset successfully.");
  } else {
    console.log(`Batch Mode: Processing up to ${batchSize} sources`);
  }

  // 2. Invoke the handler directly (mocking a request)
  console.log("Invoking Scout Worker handler...");

  // payload for the request
  const payload = isBatch ? { batchSize } : { sourceId: TARGET_SOURCE_ID };

  const req = new Request("http://localhost:54321/functions/v1/scout-worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  try {
    const response = await handler(req);
    const result = await response.json();

    console.log("--- Worker Result ---");
    console.log(JSON.stringify(result, null, 2));

    if (response.status === 200 && !isBatch) {
      console.log("\n✅ Scout Worker ran successfully!");

      const { data: source } = await supabase
        .from("scraper_sources")
        .select("extraction_recipe, scout_status")
        .eq("id", TARGET_SOURCE_ID)
        .single();

      console.log("\n--- Database State ---");
      console.log("Status:", source?.scout_status);
      console.log("Recipe Present:", !!source?.extraction_recipe);
    } else if (response.status === 200) {
      console.log(
        `\n✅ Batch Scout completed: ${result.succeeded} succeeded, ${result.failed} failed.`,
      );
    } else {
      console.error(
        "\n❌ Scout Worker returned error status:",
        response.status,
      );
    }
  } catch (err) {
    console.error("\n❌ Validating execution failed:", err);
  }
}

main();

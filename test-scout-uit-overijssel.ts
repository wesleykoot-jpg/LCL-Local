import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";
import { handler } from "./supabase/functions/scout-worker/index.ts";

const supabaseUrl =
  Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Target: Uit in Overijssel
const TARGET_SOURCE_ID = "37430f02-c3c5-4d32-a5ee-23b41749d9bf";

async function main() {
  console.log("--- Starting Scout Worker Test for Uit in Overijssel ---");
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
  console.log("");

  // 2. Invoke the handler directly (mocking a request)
  console.log("Invoking Scout Worker handler...");

  const req = new Request("http://localhost:54321/functions/v1/scout-worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: TARGET_SOURCE_ID }),
  });

  try {
    const response = await handler(req);
    const result = await response.json();

    console.log("--- Worker Result ---");
    console.log(JSON.stringify(result, null, 2));

    if (response.status === 200) {
      console.log("\n✅ Scout Worker ran successfully!");

      const { data: source } = await supabase
        .from("scraper_sources")
        .select("extraction_recipe, scout_status")
        .eq("id", TARGET_SOURCE_ID)
        .single();

      console.log("\n--- Database State ---");
      console.log("Status:", source?.scout_status);
      console.log("Recipe Present:", !!source?.extraction_recipe);
      
      if (source?.extraction_recipe) {
        const recipe = JSON.parse(source.extraction_recipe);
        console.log("\n--- Extraction Recipe ---");
        console.log("Mode:", recipe.mode);
        console.log("Container:", recipe.container);
        console.log("Item:", recipe.item);
        console.log("Requires Render:", recipe.requiresRender);
      }
    } else {
      console.error(
        "\n❌ Scout Worker returned error status:",
        response.status,
      );
    }
  } catch (err) {
    console.error("\n❌ Scout Worker execution failed:", err);
  }
}

main();

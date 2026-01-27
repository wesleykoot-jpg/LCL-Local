import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function trigger() {
  console.log("Fetching Zwolle and Meppel source IDs...");
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("id")
    .or(
      "location_name.ilike.%Zwolle%,location_name.ilike.%Meppel%,name.ilike.%Zwolle%,name.ilike.%Meppel%",
    )
    .eq("enabled", true);

  if (error) {
    console.error("Error fetching sources:", error);
    return;
  }

  const sourceIds = (sources || []).map((s) => s.id);
  console.log(`Triggering coordinator for ${sourceIds.length} sources...`);

  if (sourceIds.length === 0) {
    console.log("No sources found to trigger.");
    return;
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/scrape-coordinator`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceIds,
        triggerWorker: true,
      }),
    },
  );

  const result = await response.json();
  console.log("Coordinator response:", JSON.stringify(result, null, 2));
}

trigger();

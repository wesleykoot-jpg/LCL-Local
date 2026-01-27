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
  const { handler: processorHandler } =
    await import("../supabase/functions/process-worker/index.ts");

  console.log("Fetching Zwolle and Meppel source IDs...");
  const targetSourceId = Deno.args[0];

  let query = supabase
    .from("scraper_sources")
    .select("id, name")
    .eq("enabled", true);

  if (targetSourceId) {
    console.log(`Targeting single source: ${targetSourceId}`);
    query = query.eq("id", targetSourceId);
  } else {
    query = query.or(
      "location_name.ilike.%Zwolle%,location_name.ilike.%Meppel%,name.ilike.%Zwolle%,name.ilike.%Meppel%",
    );
  }

  const { data: sources, error } = await query;

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

  console.log("\n--- [PROCESS] Starting Process Worker Loop ---");
  // Run processor in blocks until no more pending rows
  let hasMore = true;
  let blocksProcessed = 0;
  while (hasMore && blocksProcessed < 200) {
    // Safety limit
    const req = new Request("http://localhost/processor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const res = await processorHandler(req);
    const result = await res.json();
    console.log(
      `Block ${blocksProcessed + 1} processed:`,
      JSON.stringify(result, null, 2),
    );

    // Check staging count
    const { count, error: countErr } = await supabase
      .from("raw_event_staging")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (countErr) {
      console.error("Error checking staging count:", countErr);
      break;
    }

    console.log(`Pending rows remaining: ${count || 0}`);
    hasMore = (count || 0) > 0;
    blocksProcessed++;
  }

  console.log("\nPipeline run complete!");
}

main().catch(console.error);

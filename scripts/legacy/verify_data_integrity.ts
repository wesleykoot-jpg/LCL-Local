// verify_data_integrity.ts
// This script checks the health of the events data in Supabase.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Total events
  const { count: totalEvents, error: cntErr } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true });
  if (cntErr) throw cntErr;
  console.log("Total events:", totalEvents);

  // Missing description count
  const { data: missingDesc, error: mdErr } = await supabase
    .from("events")
    .select("id")
    .is("description", null);
  if (mdErr) throw mdErr;
  console.log("Events with missing description:", missingDesc?.length ?? 0);

  // Placeholder description patterns
  const placeholders = [
    "Controleer ticketprijs bij evenement",
    "Geen evenement gevonden",
    "no description available"
  ];
  const placeholderQueries = placeholders.map(p => `description.ilike.%${p}%`).join(",");
  // Supabase doesn't support OR in a single filter easily; we'll query individually.
  let placeholderCount = 0;
  for (const pat of placeholders) {
    const { data, error } = await supabase
      .from("events")
      .select("id")
      .ilike("description", `%${pat}%`);
    if (error) throw error;
    placeholderCount += data?.length ?? 0;
  }
  console.log("Placeholder description count:", placeholderCount);

  // Duplicate titles (simple check)
  const { data: dupTitles, error: dupErr } = await supabase.rpc("find_duplicate_titles");
  // Assuming a RPC exists; if not, skip.
  if (dupErr) {
    console.warn("Duplicate title RPC not available, skipping duplicate title check.");
  } else {
    console.log("Duplicate title groups:", dupTitles?.length ?? 0);
  }

  // Content hash and fingerprint null checks
  const { data: missingHash, error: mhErr } = await supabase
    .from("events")
    .select("id")
    .or("content_hash.is.null,event_fingerprint.is.null");
  if (mhErr) throw mhErr;
  console.log("Events missing content_hash or fingerprint:", missingHash?.length ?? 0);

  // Orphaned raw_event_staging rows (no corresponding event)
  const { data: orphaned, error: orErr } = await supabase.rpc("find_orphaned_raw_events");
  if (orErr) {
    console.warn("Orphaned raw events RPC not available, skipping.");
  } else {
    console.log("Orphaned raw_event_staging rows:", orphaned?.length ?? 0);
  }
}

main().catch(e => {
  console.error("Integrity check failed:", e);
  Deno.exit(1);
});

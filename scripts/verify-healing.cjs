/**
 * Verification Script: Test Event Self-Healing
 *
 * This script inserts a "low quality" event into raw_event_staging
 * and provides instructions on how to trigger the process-worker to test healing.
 */

const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function runVerification() {
  console.log("--- Event Self-Healing Verification ---");

  // 1. Create a dummy low-quality event card
  const lowQualityCard = {
    title: "Prison Tour Blokhuispoort",
    date: "2026-11-21", // Valid future date to pass score check
    location: "Leeuwarden",
    description: "Short description.", // Too short for full score
    detailUrl:
      "https://www.visitleeuwarden.com/nl/agenda/770895e5a407/prison-tour-blokhuispoort",
    imageUrl: null, // Missing image
    rawHtml: "<div>Prison Tour summary</div>",
  };

  const sourceId = "8c52aa0e-07bf-4a20-a174-d4e6478b0e2a"; // Visit Leeuwarden Agenda ID

  console.log("Inserting low-quality staging row...");
  const { data, error } = await supabase
    .from("raw_event_staging")
    .insert({
      source_id: sourceId,
      source_url: lowQualityCard.detailUrl,
      raw_html: JSON.stringify(lowQualityCard),
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting row:", error);
    return;
  }

  console.log("Successfully inserted row ID:", data.id);
  console.log("\n--- NEXT STEPS ---");
  console.log("1. Run the process-worker Edge Function manually:");
  console.log(
    `   curl -X POST "${process.env.VITE_SUPABASE_URL}/functions/v1/process-worker" \\`,
  );
  console.log(
    `   -H "Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}" \\`,
  );
  console.log(`   -H "Content-Type: application/json"`);
  console.log(
    '\n2. Check the logs and verify the event in the "events" table:',
  );
  console.log(
    `   SELECT id, title, quality_score, last_healed_at, description, image_url `,
  );
  console.log(
    `   FROM events WHERE title = 'Prison Tour Blokhuispoort' ORDER BY created_at DESC LIMIT 1;`,
  );
}

runVerification();

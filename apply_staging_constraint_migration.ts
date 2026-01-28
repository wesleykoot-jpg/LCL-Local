import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const envText = await Deno.readTextFile(".env");
const env: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length > 0) {
    env[key.trim()] = val.join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log("Applying migration: Add UNIQUE constraint to raw_event_staging.source_url\n");

// Step 1: Remove duplicates
console.log("Step 1: Removing duplicate source_urls...");
const { error: deleteError } = await supabase.rpc("exec_sql", {
  query: `
    DELETE FROM public.raw_event_staging a
    USING public.raw_event_staging b
    WHERE a.id > b.id 
      AND a.source_url = b.source_url;
  `
});

if (deleteError) {
  console.error("Failed to remove duplicates:", deleteError);
} else {
  console.log("✓ Duplicates removed");
}

// Step 2: Add UNIQUE constraint
console.log("\nStep 2: Adding UNIQUE constraint...");
const { error: constraintError } = await supabase.rpc("exec_sql", {
  query: `
    ALTER TABLE public.raw_event_staging
    ADD CONSTRAINT raw_event_staging_source_url_unique 
    UNIQUE (source_url);
  `
});

if (constraintError) {
  console.error("Failed to add constraint:", constraintError);
  Deno.exit(1);
} else {
  console.log("✓ UNIQUE constraint added");
}

// Step 3: Verify with a test upsert
console.log("\nStep 3: Verifying upsert works...");
const testUrl = `https://test.example.com/verify-${Date.now()}`;
const { data, error: upsertError } = await supabase
  .from("raw_event_staging")
  .upsert({
    source_url: testUrl,
    raw_html: "<html>test</html>",
    status: "pending"
  }, { onConflict: "source_url" })
  .select();

if (upsertError) {
  console.error("❌ Upsert still failing:", upsertError);
  Deno.exit(1);
} else {
  console.log("✓ Upsert works correctly!");
  
  // Clean up
  await supabase.from("raw_event_staging").delete().eq("source_url", testUrl);
  console.log("✓ Test row cleaned up");
}

console.log("\n✅ Migration completed successfully!");
console.log("You can now run the scraper pipeline.");


import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

async function main() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl!, supabaseKey!);

  const { data, error } = await supabase
    .from("scraper_insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

main();

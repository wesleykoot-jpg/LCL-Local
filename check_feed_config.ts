
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkFeeds() {
  const { data, error } = await supabase.from('scraper_sources').select('name, config');
  if (error) {
    console.error(error);
    return;
  }
  const feedSources = data.filter(x => x.config?.feed_discovery);
  console.log(`Found ${feedSources.length} sources with feed discovery enabled.`);
  if (feedSources.length > 0) {
    console.log(JSON.stringify(feedSources, null, 2));
  }
}

checkFeeds();

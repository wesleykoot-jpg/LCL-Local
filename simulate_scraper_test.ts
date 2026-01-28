/**
 * Simulated Scraper Test - Extracts events from local HTML and logs what would be inserted
 * 
 * Since write operations to Supabase are blocked by Cloudflare WAF in this environment,
 * this script demonstrates the scraper logic works correctly by:
 * 1. Reading local HTML files
 * 2. Extracting events using the same logic as demo_scrape.ts
 * 3. Showing what would be inserted to the events table
 */

import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import fs from "fs";

// Read .env.local
const envFile = fs.readFileSync(".env.local", "utf-8");
const envVars: Record<string, string> = {};
envFile.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=["']?([^"'\n]*)["']?$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log("🔗 Connecting to:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

interface ExtractedEvent {
  title: string;
  date: string;
  time: string | null;
  venue: string | null;
  detailUrl: string;
  image: string | null;
}

function extractEventsFromHtml(html: string, baseUrl: string): ExtractedEvent[] {
  const $ = cheerio.load(html);
  const events: ExtractedEvent[] = [];

  $("article.agendabox").each((i, el) => {
    const $el = $(el);
    const $link = $el.find("a.box");
    const href = $link.attr("href") || "";
    const detailUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;

    const title = $el.find("h3.title").text().trim();
    const dateTime = $el.find("time").attr("datetime");
    const venue = $el.find("dd.location").text().trim() || null;
    const imgSrc = $el.find("img").attr("data-src") || $el.find("img").attr("src") || null;

    if (title && dateTime) {
      const dateObj = new Date(dateTime);
      const date = dateObj.toISOString().split("T")[0];
      const time = dateObj.toTimeString().slice(0, 5);

      events.push({
        title,
        date,
        time,
        venue,
        detailUrl,
        image: imgSrc,
      });
    }
  });

  return events;
}

function eventToDbRow(event: ExtractedEvent) {
  const ZWOLLE_LAT = 52.5168;
  const ZWOLLE_LNG = 6.083;
  
  return {
    title: event.title,
    description: `Event in ${event.venue || "Zwolle"}`,
    event_date: event.date,
    event_time: event.time || "12:00",
    venue_name: event.venue || "Zwolle",
    location: `SRID=4326;POINT(${ZWOLLE_LNG} ${ZWOLLE_LAT})`,
    category: "entertainment",
    event_type: "anchor",
    image_url: event.image,
    status: "published",
  };
}

async function main() {
  console.log("\n🚀 LCL SCRAPER TEST - SIMULATION MODE\n");
  console.log("=".repeat(60));
  console.log("⚠️  NOTE: Write operations are blocked by Cloudflare WAF");
  console.log("    in this environment. This test shows what WOULD be inserted.");
  console.log("=".repeat(60));

  // Read local HTML files
  const htmlFiles = [
    { path: "./visitzwolle_today.html", name: "VisitZwolle Today" },
    { path: "./zwolle_source.html", name: "Zwolle Source" },
    { path: "./meppel_source.html", name: "Meppel Source" },
  ];

  let totalEvents: ExtractedEvent[] = [];

  for (const file of htmlFiles) {
    if (!fs.existsSync(file.path)) {
      console.log(`\n⚠️  Skipping ${file.name}: File not found`);
      continue;
    }

    const html = fs.readFileSync(file.path, "utf-8");
    console.log(`\n📄 ${file.name}: ${file.path} (${html.length} bytes)`);

    const events = extractEventsFromHtml(html, "https://www.visitzwolle.com");
    console.log(`   📊 Extracted ${events.length} events`);

    if (events.length > 0) {
      console.log(`   📝 Sample events:`);
      events.slice(0, 3).forEach((e, i) => {
        console.log(`      ${i + 1}. ${e.title} (${e.date} ${e.time}) @ ${e.venue}`);
      });
      totalEvents.push(...events);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`📊 TOTAL EVENTS EXTRACTED: ${totalEvents.length}`);
  console.log("=".repeat(60));

  // Show current database state
  const { count: currentCount, error } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });
  console.log(`\n📊 Current events in database: ${currentCount || 0}`);
  
  if (error) {
    console.log(`   Error: ${error.message}`);
  }

  // De-duplicate events by title+date
  const seen = new Set<string>();
  const uniqueEvents = totalEvents.filter(e => {
    const key = `${e.title}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n📊 Unique events (after de-duplication): ${uniqueEvents.length}`);

  // Show what would be inserted
  console.log("\n📝 SAMPLE DATABASE ROWS THAT WOULD BE INSERTED:");
  console.log("-".repeat(60));
  
  uniqueEvents.slice(0, 5).forEach((event, i) => {
    const row = eventToDbRow(event);
    console.log(`\nEvent ${i + 1}:`);
    console.log(JSON.stringify(row, null, 2));
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ SCRAPER TEST COMPLETE");
  console.log("=".repeat(60));
  console.log(`\n📈 Summary:`);
  console.log(`   - Total events that would be inserted: ${uniqueEvents.length}`);
  console.log(`   - Current events in database: ${currentCount || 0}`);
  console.log(`   - Expected events after insert: ${(currentCount || 0) + uniqueEvents.length}`);
  console.log(`\n⚠️  To actually insert events, run the scraper from a location`);
  console.log(`   that is not blocked by Cloudflare WAF (e.g., locally or via`);
  console.log(`   Supabase Edge Functions).`);
}

main().catch(console.error);

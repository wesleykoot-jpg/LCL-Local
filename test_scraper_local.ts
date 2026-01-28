/**
 * Test Scraper Script - Uses local HTML files to test scraper logic
 * and insert events into the events table.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
      // Parse date and time from datetime attribute
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

async function insertEventToDb(supabase: SupabaseClient, event: ExtractedEvent, sourceId: string) {
  // Default Zwolle coordinates
  const ZWOLLE_LAT = 52.5168;
  const ZWOLLE_LNG = 6.083;

  const { data, error } = await supabase
    .from("events")
    .insert({
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
    })
    .select("id, title");

  if (error) {
    if (error.message?.includes("duplicate")) {
      return { status: "duplicate", id: null };
    }
    return { status: "error", error: error.message };
  }

  return { status: "success", id: data?.[0]?.id };
}

async function main() {
  console.log("\n🚀 LCL SCRAPER TEST - LOCAL HTML FILES\n");
  console.log("=".repeat(60));

  // Read local HTML file
  const htmlPath = "./visitzwolle_today.html";
  if (!fs.existsSync(htmlPath)) {
    console.error("❌ HTML file not found:", htmlPath);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, "utf-8");
  console.log(`📄 Loaded HTML file: ${htmlPath} (${html.length} bytes)`);

  // Extract events
  const events = extractEventsFromHtml(html, "https://www.visitzwolle.com");
  console.log(`\n📊 Extracted ${events.length} events from HTML\n`);

  if (events.length === 0) {
    console.log("❌ No events found!");
    return;
  }

  // Print first 5 events for preview
  console.log("📝 Sample events:");
  events.slice(0, 5).forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.title} (${e.date} ${e.time}) @ ${e.venue}`);
  });
  console.log();

  // Check current event count
  const { count: beforeCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });
  console.log(`📊 Events in database BEFORE: ${beforeCount || 0}`);

  // Insert events
  console.log("\n🔄 Inserting events...\n");
  let successCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const event of events) {
    const result = await insertEventToDb(supabase, event, "local-test");
    if (result.status === "success") {
      successCount++;
      console.log(`  ✅ Inserted: ${event.title}`);
    } else if (result.status === "duplicate") {
      duplicateCount++;
      console.log(`  ⏭️  Skipped (duplicate): ${event.title}`);
    } else {
      errorCount++;
      console.log(`  ❌ Error: ${event.title} - ${result.error}`);
    }
  }

  // Check final event count
  const { count: afterCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });

  console.log("\n" + "=".repeat(60));
  console.log("📊 RESULTS:");
  console.log(`  ✅ Successfully inserted: ${successCount}`);
  console.log(`  ⏭️  Skipped (duplicates): ${duplicateCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`\n  📊 Events in database AFTER: ${afterCount || 0}`);
  console.log(`  📈 Net new events: ${(afterCount || 0) - (beforeCount || 0)}`);
  console.log("=".repeat(60));

  // Show sample of inserted events
  const { data: recentEvents } = await supabase
    .from("events")
    .select("id, title, event_date, venue_name")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\n📋 Recent events in database:");
  recentEvents?.forEach(e => {
    console.log(`  - ${e.title} (${e.event_date}) @ ${e.venue_name}`);
  });
}

main().catch(console.error);

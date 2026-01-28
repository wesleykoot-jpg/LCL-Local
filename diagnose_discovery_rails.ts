/**
 * Diagnose why events aren't showing on Discovery page rails
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("🔍 Diagnosing Discovery Rails Issues\n");

  // 1. Check total events count
  console.log("1️⃣  Total Events Count:");
  const { data: allEvents, error: allError } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, event_type, status", {
      count: "exact",
    });

  if (allError) {
    console.error("   ❌ Error fetching events:", allError);
    return;
  }

  console.log(`   ✅ Total: ${allEvents?.length || 0} events\n`);

  // 2. Check published events
  console.log("2️⃣  Published Events:");
  const { data: published } = await supabase
    .from("events")
    .select("id, title, event_date, status")
    .eq("status", "published");

  console.log(`   ✅ Published: ${published?.length || 0} events\n`);

  // 3. Check events with valid dates in the future
  console.log("3️⃣  Events with Future Dates:");
  const now = new Date().toISOString().split("T")[0];
  const { data: futureEvents } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, attendee_count:event_attendees(count)")
    .eq("status", "published")
    .gte("event_date", now);

  console.log(`   ✅ Future events: ${futureEvents?.length || 0}\n`);

  // 4. Check weekend events (for This Weekend rail)
  console.log("4️⃣  Weekend Events (Sat-Sun):");
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSaturday = dayOfWeek <= 6 ? 6 - dayOfWeek : 0;
  const weekendStart = new Date(today);
  weekendStart.setDate(today.getDate() + daysUntilSaturday);
  const weekendStartStr = weekendStart.toISOString().split("T")[0];
  const weekendEnd = new Date(weekendStart);
  weekendEnd.setDate(weekendStart.getDate() + 2);
  const weekendEndStr = weekendEnd.toISOString().split("T")[0];

  console.log(
    `   📅 Weekend range: ${weekendStartStr} to ${weekendEndStr}`
  );

  const { data: weekendEvents } = await supabase
    .from("events")
    .select("id, title, event_date")
    .eq("status", "published")
    .gte("event_date", weekendStartStr)
    .lte("event_date", weekendEndStr);

  console.log(`   ✅ Weekend events: ${weekendEvents?.length || 0}\n`);

  // 5. Check events with attendees (for Pulse rail)
  console.log("5️⃣  Events with Attendees (2+ for Pulse rail):");
  const { data: allEventsWithAttendees } = await supabase
    .from("events")
    .select(
      "id, title, event_date, attendee_count:event_attendees(count)"
    )
    .eq("status", "published")
    .gte("event_date", now);

  let withAttendees = 0;
  let withoutAttendees = 0;

  allEventsWithAttendees?.forEach((e: any) => {
    const count = Array.isArray(e.attendee_count) ? e.attendee_count[0]?.count || 0 : 0;
    if (count >= 2) withAttendees++;
    else withoutAttendees++;
  });

  console.log(`   ✅ With 2+ attendees: ${withAttendees}`);
  console.log(`   ✅ With <2 attendees: ${withoutAttendees}\n`);

  // 6. Check date formats
  console.log("6️⃣  Sample Events (First 5):");
  const { data: sample } = await supabase
    .from("events")
    .select(
      "id, title, event_date, event_time, event_type, status, category"
    )
    .eq("status", "published")
    .limit(5);

  sample?.forEach((e, i) => {
    console.log(`   ${i + 1}. "${e.title}"`);
    console.log(`      Date: ${e.event_date} | Time: ${e.event_time}`);
    console.log(`      Category: ${e.category} | Type: ${e.event_type}`);
  });

  console.log("\n7️⃣  Issues to Check:");
  console.log("   ❓ Events showing on /now but not on / (Discovery)?");
  console.log("   ❓ Check if events have null event_date (required for filtering)");
  console.log("   ❓ Check if events are status='draft' (rails filter for 'published')");
  console.log("   ❓ Check browser console for [Discovery] logs\n");

  // 8. Show event status distribution
  console.log("8️⃣  Event Status Distribution:");
  const { data: statusData } = await supabase
    .from("events")
    .select("status", { count: "exact" });

  const statuses = new Map<string, number>();
  statusData?.forEach((e: any) => {
    statuses.set(
      e.status || "null",
      (statuses.get(e.status || "null") || 0) + 1
    );
  });

  statuses.forEach((count, status) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log("\n✨ Diagnosis Complete");
}

await diagnose();

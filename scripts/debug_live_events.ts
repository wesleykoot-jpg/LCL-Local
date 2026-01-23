import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function testLiveEvents() {
  const now = new Date();
  const timeOffsetMinutes = 120;
  const endTime = new Date(now.getTime() + timeOffsetMinutes * 60 * 1000);

  const todayStr = now.toISOString().split("T")[0];
  const endDateStr = endTime.toISOString().split("T")[0];
  const endTimeStr = endTime.toTimeString().slice(0, 5);

  console.log("Testing window:", { todayStr, endDateStr, endTimeStr });

  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, location")
    .gte("event_date", todayStr)
    .lte("event_date", endDateStr);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Raw count from DB:", data?.length || 0);

  const filtered = (data || []).filter((event) => {
    const eventDate = event.event_date.split("T")[0];
    const eventTime = event.event_time || "00:00";
    if (eventDate === todayStr) {
      return eventTime <= endTimeStr;
    }
    return eventDate <= endDateStr;
  });

  console.log("Filtered count (Now):", filtered.length);
  if (filtered.length > 0) {
    console.log("Sample Filtered Event:", filtered[0]);
  } else {
    // Check if there are ANY upcoming events
    const { count } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gte("event_date", todayStr);
    console.log("Total upcoming events in DB:", count);
  }
}

testLiveEvents();

const postgres = require("postgres");
require("dotenv").config();

async function verifyUat() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    console.log("🧪 Verifying UAT Requirements...");

    // 1. Check Events Count
    const [events] =
      await sql`SELECT count(*) FROM events WHERE event_type IN ('anchor', 'signal')`;
    console.log(`Events Found: ${events.count}`);
    if (parseInt(events.count) === 0) {
      console.error("❌ Fail: No events found");
      process.exit(1);
    }

    // 2. Check Images
    const [images] =
      await sql`SELECT count(*) FROM events WHERE image_url IS NOT NULL AND image_url != ''`;
    console.log(`Events with Images: ${images.count}`);

    // 3. Check Coordinates
    const [coords] =
      await sql`SELECT count(*) FROM events WHERE location IS NOT NULL`;
    console.log(`Events with Coords: ${coords.count}`);

    console.log("✅ Basic verification passed (Events exist).");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyUat();

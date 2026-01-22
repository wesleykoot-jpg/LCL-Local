const postgres = require("postgres");
require("dotenv").config();

async function monitorScraping() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  console.log("👀 Monitoring scraping progress for 60 seconds...");
  console.log("Time | Staging | Events | With Image | With Location");

  const start = Date.now();

  try {
    while (Date.now() - start < 60000) {
      const [staging] =
        await sql`SELECT COUNT(*) as count FROM raw_event_staging`;
      const [events] =
        await sql`SELECT COUNT(*) as count FROM events WHERE event_type IN ('anchor', 'signal')`; // Exclude forks
      const [eventsWithImage] =
        await sql`SELECT COUNT(*) as count FROM events WHERE image_url IS NOT NULL AND image_url != ''`;
      const [eventsWithLoc] =
        await sql`SELECT COUNT(*) as count FROM events WHERE location IS NOT NULL`;

      console.log(
        `${new Date().toISOString().split("T")[1].split(".")[0]} | ` +
          `${String(staging.count).padStart(7)} | ` +
          `${String(events.count).padStart(6)} | ` +
          `${String(eventsWithImage.count).padStart(10)} | ` +
          `${String(eventsWithLoc.count).padStart(13)}`,
      );

      await new Promise((r) => setTimeout(r, 5000));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

monitorScraping();

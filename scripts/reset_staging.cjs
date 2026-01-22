const postgres = require("postgres");
require("dotenv").config();

async function resetStaging() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    await sql`
      UPDATE raw_event_staging 
      SET status = 'pending', retry_count = 0, error_message = NULL
      WHERE status = 'failed'
    `;
    console.log("✅ Reset all failed staging rows to pending.");

    const [count] =
      await sql`SELECT count(*) FROM raw_event_staging WHERE status = 'pending'`;
    console.log(`Pending rows: ${count.count}`);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

resetStaging();

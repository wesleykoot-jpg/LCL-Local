const postgres = require("postgres");
require("dotenv").config();

async function checkStagingStatus() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    const counts = await sql`
      SELECT status, count(*) 
      FROM raw_event_staging 
      GROUP BY status
    `;
    console.log("Staging Status Counts:", counts);

    // Check one row
    const [row] = await sql`SELECT * FROM raw_event_staging LIMIT 1`;
    console.log("Sample Row:", row);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkStagingStatus();

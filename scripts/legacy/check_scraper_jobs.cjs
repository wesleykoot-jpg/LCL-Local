const postgres = require("postgres");
require("dotenv").config();

async function checkJobs() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    const [jobs] = await sql`SELECT COUNT(*) as count FROM scrape_jobs`;
    const [pending] =
      await sql`SELECT COUNT(*) as count FROM scrape_jobs WHERE status = 'pending'`;
    const [processing] =
      await sql`SELECT COUNT(*) as count FROM scrape_jobs WHERE status = 'processing'`;
    const [failed] =
      await sql`SELECT COUNT(*) as count FROM scrape_jobs WHERE status = 'failed'`;

    console.log(`Jobs Total: ${jobs.count}`);
    console.log(`Pending: ${pending.count}`);
    console.log(`Processing: ${processing.count}`);
    console.log(`Failed: ${failed.count}`);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkJobs();

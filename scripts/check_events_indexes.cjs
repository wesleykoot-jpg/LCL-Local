const postgres = require("postgres");
require("dotenv").config();

async function checkIndexes() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    const indexes = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'events'
    `;
    console.log("Indexes on events:", indexes);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkIndexes();

const postgres = require("postgres");
require("dotenv").config();

async function checkColumns() {
  const sql = postgres({
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT_SESSION || "6543"),
    database: process.env.SUPABASE_DB_NAME,
    username: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: "require",
  });

  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events'
    `;
    console.log("Columns:", columns.map((c) => c.column_name).sort());
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

checkColumns();

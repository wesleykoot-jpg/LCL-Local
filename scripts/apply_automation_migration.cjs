const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration matching apply_scraper_migration.js
const config = {
    user: 'postgres',
    password: 'Meppelwaro7&', // Hardcoded from user's script
    host: 'db.mlpefjsbriqgxcaqxhic.supabase.co',
    port: 5432,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const client = new Client(config);

async function run() {
    console.log("Connecting to Supabase (via pg)...");
    
    try {
        await client.connect();
        console.log("Connected successfully.");

        const migrationFile = process.argv[2];
        if (!migrationFile) {
            throw new Error("Please provide a migration file path as an argument");
        }
        const sqlPath = path.resolve(process.cwd(), migrationFile);

        if (!fs.existsSync(sqlPath)) {
            throw new Error(`Migration file not found at: ${sqlPath}`);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Read migration file (${sql.length} bytes). Executing...`);

        await client.query(sql);
        console.log("✅ Migration applied successfully!");

    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();

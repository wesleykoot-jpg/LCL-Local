const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration via connection string (safest for special characters)
const client = new Client({
    connectionString: 'postgresql://postgres.mlpefjsbriqgxcaqxhic:haznuq-jusmu2-fogvAb@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    console.log("Connecting to Supabase Pooler...");

    try {
        await client.connect();
        console.log("Connected successfully.");

        // Path to migration file from command line arg or default
        const migrationFile = process.argv[2];
        if (!migrationFile) {
            throw new Error("Please provide a migration file path as an argument");
        }
        const sqlPath = path.resolve(__dirname, migrationFile);

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

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration from user-provided connection string
const config = {
    user: 'postgres',
    password: 'Meppelwaro7&',
    host: 'db.mlpefjsbriqgxcaqxhic.supabase.co',
    port: 5432,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const client = new Client(config);

async function run() {
    console.log("Connecting to Supabase...");
    console.log(`Host: ${config.host}`);

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

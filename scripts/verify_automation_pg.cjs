const { Client } = require('pg');

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
    console.log("🧪 Verifying Self-Healing Automation (via pg)...");
    
    try {
        await client.connect();
        
        // 1. Get a source ID
        const sourceRes = await client.query('SELECT id FROM scraper_sources LIMIT 1');
        if (sourceRes.rows.length === 0) {
            console.error("No sources found.");
            return;
        }
        const sourceId = sourceRes.rows[0].id;

        // 2. Insert stuck job
        const insertRes = await client.query(`
            INSERT INTO scrape_jobs (source_id, status, started_at, attempts, max_attempts, payload)
            VALUES ($1, 'processing', NOW() - INTERVAL '2 hours', 0, 3, '{"test": "verify_automation"}')
            RETURNING id, started_at
        `, [sourceId]);
        const job = insertRes.rows[0];
        console.log(`✅ Inserted stuck job ${job.id}`);

        // 3. Invoke cleanup
        console.log("🔄 Invoking reset_stuck_scrape_jobs()...");
        await client.query('SELECT reset_stuck_scrape_jobs()');

        // 4. Verify
        const checkRes = await client.query('SELECT status, started_at FROM scrape_jobs WHERE id = $1', [job.id]);
        const refreshed = checkRes.rows[0];

        if (refreshed.status === 'pending' && refreshed.started_at === null) {
            console.log("✅ SUCCESS: Job was reset to 'pending' and started_at cleared.");
        } else {
            console.error("❌ FAILURE: Job status is", refreshed.status);
        }

        // Cleanup
        await client.query('DELETE FROM scrape_jobs WHERE id = $1', [job.id]);
        console.log("🧹 Cleanup complete.");

    } catch (err) {
        console.error("❌ Verification failed:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();

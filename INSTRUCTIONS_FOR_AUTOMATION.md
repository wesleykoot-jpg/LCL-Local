# Enabling Automated Scraping

The scraping logic (Worker and Coordinator) has been deployed to Supabase Edge
Functions. To ensure they run automatically on a schedule, you must apply the
database migration that enables `pg_cron`.

## Option 1: Supabase Dashboard (Recommended)

1. Go to your
   [Supabase Dashboard](https://supabase.com/dashboard/project/mlpefjsbriqgxcaqxhic/sql).
2. Open the **SQL Editor**.
3. Create a new query.
4. Copy the contents of
   `supabase/migrations/20260120120000_automate_pipeline.sql`.
5. Run the query.

## Option 2: Supabase CLI

If you have your database password and CLI configured:

```bash
supabase db push
```

## Option 3: Local Daemon (Temporary)

If you cannot apply the migration right now, you can run the scraper locally in
"Daemon Mode". This script runs continuously, claiming jobs and processing them.

```bash
# Start the daemon
./scripts/start_daemon.sh
```

I have created `scripts/start_daemon.sh` for your convenience.

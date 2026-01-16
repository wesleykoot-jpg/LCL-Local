-- Clean up pending jobs for disabled sources
DELETE FROM scrape_jobs
WHERE status = 'pending'
AND source_id IN (SELECT id FROM scraper_sources WHERE enabled = false);

-- Reset stale processing jobs (stuck for more than 10 minutes)
UPDATE scrape_jobs
SET status = 'failed', 
    error_message = 'Stale job - reset by cleanup migration', 
    completed_at = now()
WHERE status = 'processing'
AND started_at < now() - interval '10 minutes';
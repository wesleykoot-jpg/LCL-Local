# Set env vars for the demo
# Note: Using Connection Pooler and User Credentials from manual test
$env:SUPABASE_URL = "https://mlpefjsbriqgxcaqxhic.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_zd_7FrK__ehBWQWbyWA0dQ_uPUT5BgS"
$env:TARGET_EVENT_YEAR = "2026"

# URLs separated by newline
# Meppel: Standard HTML Scrape
# Zwolle: RSS Feed (contains ALL future events + Lat/Lng)
$env:RUN_SOURCES = "https://ontdekmeppel.nl/ontdek-meppel/agenda/`nhttps://www.visitzwolle.com/rss.xml/"

Write-Host "Starting Discovery Blast Test (Meppel + Zwolle RSS)..." -ForegroundColor Cyan
Write-Host "Sources: $env:RUN_SOURCES" -ForegroundColor Gray

# Run the demo scraper
deno run --allow-net --allow-env demo_scrape.ts

Write-Host ""
Write-Host "---------------------------------------------------" -ForegroundColor Cyan
Write-Host "Discovery blast test complete!" -ForegroundColor Green

# Discovery Blast Test Script for Meppel and Zwolle
# Tests scraper with new category mappings

$ErrorActionPreference = "Stop"

# Set environment variables
$env:SUPABASE_URL = "https://mlpefjsbriqgxcaqxhic.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_zd_7FrK__ehBWQWbyWA0dQ_uPUT5BgS"
$env:TARGET_EVENT_YEAR = "2026"

Write-Host "🚀 LCL Discovery Blast Test" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Test sources
$sources = @(
    "https://ontdekmeppel.nl/ontdek-meppel/agenda/",
    "https://visitzwolle.com/agenda/vandaag/"
)

Write-Host "📋 Testing Sources:" -ForegroundColor Yellow
foreach ($source in $sources) {
    Write-Host "   - $source" -ForegroundColor White
}
Write-Host ""

# Set sources for demo_scrape
$env:RUN_SOURCES = $sources -join "`n"

Write-Host "⏳ Running scraper..." -ForegroundColor Yellow
Write-Host ""

# Refresh PATH to include Deno
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Run the demo scraper
& deno run --allow-net --allow-env demo_scrape.ts

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Discovery blast test complete!" -ForegroundColor Green

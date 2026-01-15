#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# E2E Scraper Test Script
# ==============================================================================
# This script runs a full end-to-end test of the event scraping pipeline.
#
# Prerequisites:
#   - SUPABASE_URL: Your Supabase project URL
#   - SUPABASE_SERVICE_ROLE_KEY: Service role key (NOT anon key)
#   - GEMINI_API_KEY or GOOGLE_AI_API_KEY: For AI event parsing
#
# Optional:
#   - SERPER_API_KEY: For web search discovery (source-discovery only)
#   - SLACK_WEBHOOK_URL: For Slack notifications
#
# Usage:
#   export SUPABASE_URL="https://your-project.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
#   export GEMINI_API_KEY="your-gemini-api-key"
#   
#   ./scripts/run-e2e-scraper-test.sh [mode]
#
# Modes:
#   check       - Check database state only
#   dry-run     - Run scraper without writing to database
#   scrape      - Run scraper with database writes (default)
#   discover    - Run source discovery to find new sources
#   full        - Run source discovery + scraper
# ==============================================================================

MODE="${1:-scrape}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/../logs/scraper-tests"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Validate environment
if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "❌ Error: SUPABASE_URL is not set"
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set"
  exit 1
fi

echo "🚀 LCL Event Scraper E2E Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mode: $MODE"
echo "Supabase URL: $SUPABASE_URL"
echo "Timestamp: $TIMESTAMP"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Function to call Supabase edge function
call_edge_function() {
  local function_name="$1"
  local payload="${2:-{}}"
  local output_file="$3"
  
  echo "📡 Calling edge function: $function_name"
  echo "   Payload: $payload"
  
  curl -s -X POST "${SUPABASE_URL}/functions/v1/${function_name}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -d "$payload" | tee "${output_file}"
  
  echo ""
}

# Function to query Supabase REST API
query_supabase() {
  local table="$1"
  local params="${2:-}"
  
  curl -s "${SUPABASE_URL}/rest/v1/${table}${params}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
}

# Check database state
check_database() {
  echo "📊 Checking database state..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  echo ""
  echo "1️⃣ Scraper Sources:"
  local sources=$(query_supabase "scraper_sources" "?select=id,name,url,enabled,total_events_scraped,consecutive_failures,auto_disabled,last_scraped_at&order=name.asc")
  echo "$sources" | jq -r '.[] | "   \(.enabled | if . then "✅" else "❌" end) \(.name)\n      URL: \(.url)\n      Events: \(.total_events_scraped // 0) | Failures: \(.consecutive_failures // 0) | Auto-disabled: \(.auto_disabled // false)\n      Last scraped: \(.last_scraped_at // "Never")"'
  
  local source_count=$(echo "$sources" | jq 'length')
  local enabled_count=$(echo "$sources" | jq '[.[] | select(.enabled == true)] | length')
  echo ""
  echo "   Total sources: $source_count (${enabled_count} enabled)"
  
  echo ""
  echo "2️⃣ Events:"
  local events=$(query_supabase "events" "?select=id")
  local total_events=$(echo "$events" | jq 'length')
  echo "   Total events: $total_events"
  
  echo ""
  echo "3️⃣ Events by Category:"
  local categories=$(query_supabase "events" "?select=category")
  echo "$categories" | jq -r 'group_by(.category) | .[] | "   \(.[0].category): \(length) events"' | sort
  
  echo ""
  echo "4️⃣ Events by Source:"
  local events_with_source=$(query_supabase "events" "?select=source_id")
  echo "$events_with_source" | jq -r 'group_by(.source_id) | .[] | "   \(.[0].source_id // "no-source"): \(length) events"'
  
  echo ""
  echo "5️⃣ Upcoming Events (next 7 days):"
  local today=$(date -u +%Y-%m-%dT00:00:00Z)
  local week_later=$(date -u -d "+7 days" +%Y-%m-%dT23:59:59Z 2>/dev/null || date -u -v+7d +%Y-%m-%dT23:59:59Z 2>/dev/null || echo "")
  if [[ -n "$week_later" ]]; then
    local upcoming=$(query_supabase "events" "?select=id,title,category,event_date,venue_name&event_date=gte.${today}&event_date=lte.${week_later}&order=event_date.asc&limit=10")
    echo "$upcoming" | jq -r '.[] | "   📅 \(.event_date[:10]) - \(.title) (\(.category)) @ \(.venue_name)"'
    local upcoming_count=$(echo "$upcoming" | jq 'length')
    echo "   ... showing $upcoming_count of upcoming events"
  else
    echo "   (Date calculation not available on this system)"
  fi
}

# Run source discovery
run_discovery() {
  echo "🔍 Running Source Discovery..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [[ -z "${GEMINI_API_KEY:-}${GOOGLE_AI_API_KEY:-}" ]]; then
    echo "⚠️ Warning: No GEMINI_API_KEY or GOOGLE_AI_API_KEY set"
    echo "   Source validation will use basic heuristics only"
  fi
  
  if [[ -z "${SERPER_API_KEY:-}" ]]; then
    echo "⚠️ Warning: SERPER_API_KEY not set"
    echo "   Using pattern-based discovery (less effective)"
  fi
  
  local payload='{"minPopulation": 15000, "maxMunicipalities": 50, "dryRun": false}'
  
  call_edge_function "source-discovery" "$payload" "${OUTPUT_DIR}/discovery-${TIMESTAMP}.json"
  
  echo ""
  echo "📋 Discovery Results:"
  cat "${OUTPUT_DIR}/discovery-${TIMESTAMP}.json" | jq '.'
}

# Run scraper
run_scraper() {
  local dry_run="${1:-false}"
  
  if [[ "$dry_run" == "true" ]]; then
    echo "🧪 Running Scraper (DRY RUN - no database writes)..."
  else
    echo "🚀 Running Scraper (LIVE - writing to database)..."
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [[ -z "${GEMINI_API_KEY:-}${GOOGLE_AI_API_KEY:-}" ]]; then
    echo "⚠️ Warning: No GEMINI_API_KEY or GOOGLE_AI_API_KEY set"
    echo "   AI event parsing will be disabled"
  fi
  
  local payload="{\"dryRun\": ${dry_run}, \"enableDeepScraping\": true}"
  
  # Use run-scraper which has better error handling
  call_edge_function "run-scraper" "$payload" "${OUTPUT_DIR}/scrape-${TIMESTAMP}.json"
  
  echo ""
  echo "📋 Scrape Results:"
  cat "${OUTPUT_DIR}/scrape-${TIMESTAMP}.json" | jq '.'
  
  # Also try scrape-events if run-scraper fails
  if ! jq -e '.success' "${OUTPUT_DIR}/scrape-${TIMESTAMP}.json" > /dev/null 2>&1; then
    echo ""
    echo "⚠️ run-scraper failed, trying scrape-events..."
    call_edge_function "scrape-events" "$payload" "${OUTPUT_DIR}/scrape-events-${TIMESTAMP}.json"
    cat "${OUTPUT_DIR}/scrape-events-${TIMESTAMP}.json" | jq '.'
  fi
}

# Main execution
case "$MODE" in
  check)
    check_database
    ;;
  
  dry-run)
    check_database
    echo ""
    run_scraper "true"
    ;;
  
  scrape)
    check_database
    echo ""
    run_scraper "false"
    echo ""
    echo "📊 Post-scrape database state:"
    check_database
    ;;
  
  discover)
    check_database
    echo ""
    run_discovery
    echo ""
    echo "📊 Post-discovery database state:"
    check_database
    ;;
  
  full)
    check_database
    echo ""
    run_discovery
    echo ""
    echo "⏳ Waiting 5 seconds before scraping..."
    sleep 5
    run_scraper "false"
    echo ""
    echo "📊 Final database state:"
    check_database
    ;;
  
  *)
    echo "❌ Unknown mode: $MODE"
    echo "Available modes: check, dry-run, scrape, discover, full"
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ E2E test complete!"
echo "📁 Logs saved to: $OUTPUT_DIR"
echo ""

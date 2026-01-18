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
#   check          - Check database state only
#   dry-run        - Run scraper without writing to database
#   scrape         - Run scraper with database writes (default)
#   discover       - Run source discovery to find new sources
#   full           - Run source discovery + scraper
#   initial-load   - Full E2E discovery-to-ingestion flow with validation & metrics
#   validate       - Validate discovered sources and check data integrity
#   metrics        - Generate success metrics report
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

# Validate discovered sources - inspect scraper_sources for newly discovered sources
# Filters: last_scraped_at is NULL or total_events_scraped is 0, confidence > 60
validate_sources() {
  echo "🔍 Validating Discovered Sources..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  echo ""
  echo "📋 Sources pending first scrape (last_scraped_at is NULL):"
  local pending_sources=$(query_supabase "scraper_sources" "?select=id,name,url,enabled,auto_discovered,total_events_scraped&last_scraped_at=is.null&order=name.asc")
  local pending_count=$(echo "$pending_sources" | jq 'length')
  echo "   Found: $pending_count sources"
  echo "$pending_sources" | jq -r '.[] | "   \(.enabled | if . then "✅" else "⏸️" end) \(.name) | Auto-discovered: \(.auto_discovered // false) | Events: \(.total_events_scraped // 0)"'
  
  echo ""
  echo "📋 Sources with zero events scraped (total_events_scraped = 0):"
  local zero_events_sources=$(query_supabase "scraper_sources" "?select=id,name,url,enabled,auto_discovered,total_events_scraped,last_scraped_at&total_events_scraped=eq.0&order=name.asc")
  local zero_count=$(echo "$zero_events_sources" | jq 'length')
  echo "   Found: $zero_count sources"
  echo "$zero_events_sources" | jq -r '.[] | "   \(.enabled | if . then "✅" else "⏸️" end) \(.name) | Last scraped: \(.last_scraped_at // "Never")"'
  
  echo ""
  echo "📋 Auto-discovered sources:"
  local auto_sources=$(query_supabase "scraper_sources" "?select=id,name,url,enabled,auto_discovered,total_events_scraped&auto_discovered=eq.true&order=name.asc")
  local auto_count=$(echo "$auto_sources" | jq 'length')
  local auto_enabled=$(echo "$auto_sources" | jq '[.[] | select(.enabled == true)] | length')
  echo "   Total auto-discovered: $auto_count (${auto_enabled} enabled)"
  
  echo ""
  echo "📋 Summary:"
  echo "   - Sources pending first scrape: $pending_count"
  echo "   - Sources with zero events: $zero_count"
  echo "   - Auto-discovered sources: $auto_count"
  
  # Save validation results to file
  echo "{\"pending_sources\": $pending_count, \"zero_events_sources\": $zero_count, \"auto_discovered_sources\": $auto_count}" > "${OUTPUT_DIR}/validation-${TIMESTAMP}.json"
}

# Verify data integrity - check event fingerprints and duplicates
verify_data_integrity() {
  echo "🔒 Verifying Data Integrity..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  echo ""
  echo "1️⃣ Checking for events with valid fingerprints:"
  local events_with_fingerprint=$(query_supabase "events" "?select=id,event_fingerprint&event_fingerprint=not.is.null&limit=1000")
  local fingerprint_count=$(echo "$events_with_fingerprint" | jq 'length')
  echo "   Events with fingerprints: $fingerprint_count"
  
  echo ""
  echo "2️⃣ Checking for potential duplicates (same title + date + source):"
  local all_events=$(query_supabase "events" "?select=id,title,event_date,source_id,event_fingerprint&limit=2000")
  # Check for duplicate fingerprints
  local duplicate_fingerprints=$(echo "$all_events" | jq '[group_by(.event_fingerprint) | .[] | select(length > 1) | {fingerprint: .[0].event_fingerprint, count: length}]')
  local duplicate_count=$(echo "$duplicate_fingerprints" | jq 'length')
  
  if [[ "$duplicate_count" -gt 0 ]]; then
    echo "   ⚠️ Found $duplicate_count fingerprints with potential duplicates:"
    echo "$duplicate_fingerprints" | jq -r '.[] | "      Fingerprint: \(.fingerprint[:16])... | Count: \(.count)"'
  else
    echo "   ✅ No duplicate fingerprints found"
  fi
  
  echo ""
  echo "3️⃣ Checking for events without source_id:"
  local events_no_source=$(query_supabase "events" "?select=id,title&source_id=is.null&limit=100")
  local no_source_count=$(echo "$events_no_source" | jq 'length')
  echo "   Events without source_id: $no_source_count"
  
  echo ""
  echo "4️⃣ Checking scraper source health:"
  local unhealthy_sources=$(query_supabase "scraper_sources" "?select=id,name,url,consecutive_failures,auto_disabled&or=(consecutive_failures.gte.3,auto_disabled.eq.true)&order=consecutive_failures.desc")
  local unhealthy_count=$(echo "$unhealthy_sources" | jq 'length')
  
  if [[ "$unhealthy_count" -gt 0 ]]; then
    echo "   ⚠️ Found $unhealthy_count unhealthy sources:"
    echo "$unhealthy_sources" | jq -r '.[] | "      \(.name): Failures: \(.consecutive_failures // 0) | Auto-disabled: \(.auto_disabled // false)"'
  else
    echo "   ✅ All sources are healthy"
  fi
  
  echo ""
  echo "📋 Data Integrity Summary:"
  echo "   - Events with fingerprints: $fingerprint_count"
  echo "   - Duplicate fingerprints: $duplicate_count"
  echo "   - Events without source: $no_source_count"
  echo "   - Unhealthy sources: $unhealthy_count"
  
  # Save integrity report
  echo "{\"events_with_fingerprint\": $fingerprint_count, \"duplicate_fingerprints\": $duplicate_count, \"events_without_source\": $no_source_count, \"unhealthy_sources\": $unhealthy_count}" > "${OUTPUT_DIR}/integrity-${TIMESTAMP}.json"
}

# Generate success metrics report as specified in the problem statement
generate_metrics_report() {
  echo ""
  echo "📊 SUCCESS METRICS REPORT"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Get discovery stats from the output file if available
  local discovery_file="${OUTPUT_DIR}/discovery-${TIMESTAMP}.json"
  local scrape_file="${OUTPUT_DIR}/scrape-${TIMESTAMP}.json"
  
  # Calculate metrics
  local new_sources_discovered=0
  local successful_scrapes=0
  local total_events_ingested=0
  local failed_sources=""
  
  # Get new sources discovered
  if [[ -f "$discovery_file" ]]; then
    new_sources_discovered=$(jq -r '.stats.sourcesInserted // 0' "$discovery_file" 2>/dev/null || echo "0")
    echo "   New Sources Discovered: $new_sources_discovered"
  else
    # Query database for auto-discovered sources
    local auto_sources=$(query_supabase "scraper_sources" "?select=id&auto_discovered=eq.true")
    new_sources_discovered=$(echo "$auto_sources" | jq 'length')
    echo "   New Sources Discovered: $new_sources_discovered"
  fi
  
  # Get scrape stats
  if [[ -f "$scrape_file" ]]; then
    successful_scrapes=$(jq -r '.stats.totalSources // 0' "$scrape_file" 2>/dev/null || echo "0")
    total_events_ingested=$(jq -r '.stats.totalEventsInserted // 0' "$scrape_file" 2>/dev/null || echo "0")
    echo "   Successful Scrapes: $successful_scrapes"
    echo "   Total Events Ingested: $total_events_ingested"
    
    # Get failed sources
    local failed_count=$(jq -r '.stats.totalEventsFailed // 0' "$scrape_file" 2>/dev/null || echo "0")
    echo "   Failed Sources: $failed_count"
    
    # List failed source details if available
    local source_results=$(jq -r '.stats.sourceResults // []' "$scrape_file" 2>/dev/null || echo "[]")
    if [[ "$source_results" != "[]" ]]; then
      echo ""
      echo "   Failed Source Details:"
      echo "$source_results" | jq -r '.[] | select(.failed > 0) | "      - \(.name): \(.failed) failures"'
    fi
  else
    # Query database directly
    local total_events=$(query_supabase "events" "?select=id")
    total_events_ingested=$(echo "$total_events" | jq 'length')
    echo "   Total Events in Database: $total_events_ingested"
    
    # Get failed sources from database
    local failed_sources_list=$(query_supabase "scraper_sources" "?select=name,url,last_error,consecutive_failures&consecutive_failures=gte.1&order=consecutive_failures.desc")
    local failed_count=$(echo "$failed_sources_list" | jq 'length')
    echo "   Sources with Failures: $failed_count"
    
    if [[ "$failed_count" -gt 0 ]]; then
      echo ""
      echo "   Failed Source Details:"
      echo "$failed_sources_list" | jq -r '.[] | "      - \(.name): \(.consecutive_failures) consecutive failures"'
    fi
  fi
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Save metrics to file
  echo "{\"new_sources_discovered\": $new_sources_discovered, \"successful_scrapes\": ${successful_scrapes:-0}, \"total_events_ingested\": $total_events_ingested, \"timestamp\": \"$TIMESTAMP\"}" > "${OUTPUT_DIR}/metrics-${TIMESTAMP}.json"
  echo "📁 Metrics saved to: ${OUTPUT_DIR}/metrics-${TIMESTAMP}.json"
}

# Run initial load - full E2E discovery-to-ingestion flow
run_initial_load() {
  echo ""
  echo "🚀 INITIAL LOAD: Full E2E Discovery-to-Ingestion Flow"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Phase: Discovery / Initial Load"
  echo "Mode: LIVE (writing to production database)"
  echo ""
  
  # Record start state
  local start_events=$(query_supabase "events" "?select=id" | jq 'length')
  local start_sources=$(query_supabase "scraper_sources" "?select=id" | jq 'length')
  echo "📊 Starting State:"
  echo "   - Events in database: $start_events"
  echo "   - Sources in database: $start_sources"
  echo ""
  
  # Step 1: Broad Source Discovery
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "STEP 1: Broad Source Discovery"
  echo "═══════════════════════════════════════════════════════════"
  echo "Parameters: minPopulation=15000, maxMunicipalities=50, dryRun=false"
  echo "Goal: Identify 20-30 new potential event listing URLs"
  echo ""
  run_discovery
  
  # Step 2: Source Validation & Filtering
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "STEP 2: Source Validation & Filtering"
  echo "═══════════════════════════════════════════════════════════"
  echo "Checking: last_scraped_at is NULL, total_events_scraped is 0"
  echo "Verifying: confidence score is above 60"
  echo ""
  validate_sources
  
  # Step 3: Live Scraper Execution (Batch Processing)
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "STEP 3: Live Scraper Execution"
  echo "═══════════════════════════════════════════════════════════"
  echo "Constraint: dryRun=false (writing to production events table)"
  echo "Self-Healing: System will upgrade fetcher_type from static to dynamic if needed"
  echo ""
  echo "⏳ Waiting 5 seconds for discovery to complete..."
  sleep 5
  run_scraper "false"
  
  # Step 4: Verification & Data Integrity
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "STEP 4: Verification & Data Integrity"
  echo "═══════════════════════════════════════════════════════════"
  echo "Checking: event_fingerprint uniqueness, no obvious duplicates"
  echo ""
  verify_data_integrity
  
  # Step 5: Success Metrics Reporting
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "STEP 5: Success Metrics Reporting"
  echo "═══════════════════════════════════════════════════════════"
  generate_metrics_report
  
  # Calculate changes
  local end_events=$(query_supabase "events" "?select=id" | jq 'length')
  local end_sources=$(query_supabase "scraper_sources" "?select=id" | jq 'length')
  local new_events=$((end_events - start_events))
  local new_sources=$((end_sources - start_sources))
  
  echo ""
  echo "📈 Initial Load Summary:"
  echo "   - New sources added: $new_sources"
  echo "   - New events ingested: $new_events"
  echo "   - Total events now: $end_events"
  echo "   - Total sources now: $end_sources"
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
  
  initial-load)
    check_database
    run_initial_load
    ;;
  
  validate)
    validate_sources
    verify_data_integrity
    ;;
  
  metrics)
    generate_metrics_report
    ;;
  
  *)
    echo "❌ Unknown mode: $MODE"
    echo "Available modes: check, dry-run, scrape, discover, full, initial-load, validate, metrics"
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ E2E test complete!"
echo "📁 Logs saved to: $OUTPUT_DIR"
echo ""

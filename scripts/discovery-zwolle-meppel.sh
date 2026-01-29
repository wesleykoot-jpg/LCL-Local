#!/bin/bash
# Automated Discovery Pipeline for Zwolle & Meppel
# Runs continuously at a sustainable rate for initial event discovery
#
# Usage: ./scripts/discovery-zwolle-meppel.sh [max_events]
#        max_events: Stop after this many events indexed (default: 500)

set -e

# Load environment
cd "$(dirname "$0")/.."
export $(grep -E '^SUPABASE_' .env | xargs)

MAX_EVENTS=${1:-500}
CURATOR_BATCH=10
CURATOR_DELAY=5  # Slower for discovery phase
VECTORIZER_BATCH=20
STRATEGIST_BATCH=100

echo ""
echo "🔍 Zwolle & Meppel Discovery Pipeline"
echo "   Target: $MAX_EVENTS events"
echo "   Rate: Discovery mode (slower, sustainable)"
echo ""

# Function to make API calls
api_call() {
  local endpoint=$1
  local payload=$2
  curl -s -X POST "$SUPABASE_URL/functions/v1/$endpoint" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

# Function to count events by city
count_events_by_city() {
  local city=$1
  curl -s "$SUPABASE_URL/rest/v1/events?select=id&or=(venue_name.ilike.*${city}*,description.ilike.*${city}*)" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep -i content-range | sed 's/.*\///' | tr -d '\r'
}

# Function to get queue status
get_queue_count() {
  local stage=$1
  curl -s "$SUPABASE_URL/rest/v1/sg_pipeline_queue?stage=eq.$stage&select=id" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep -i content-range | sed 's/.*\///' | tr -d '\r'
}

# Function to get total events
get_total_events() {
  curl -s "$SUPABASE_URL/rest/v1/events?select=id" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep -i content-range | sed 's/.*\///' | tr -d '\r'
}

# Initial status
echo "📊 Initial Status:"
echo "   Zwolle events: $(count_events_by_city 'zwolle')"
echo "   Meppel events: $(count_events_by_city 'meppel')"
echo "   Total events: $(get_total_events)"
echo ""

CYCLE=0
START_EVENTS=$(get_total_events)

while true; do
  CYCLE=$((CYCLE + 1))
  CURRENT_EVENTS=$(get_total_events)
  NEW_EVENTS=$((CURRENT_EVENTS - START_EVENTS))
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔄 Cycle $CYCLE | Events: $CURRENT_EVENTS (+$NEW_EVENTS new)"
  
  # Check if we've reached target
  if [ "$NEW_EVENTS" -ge "$MAX_EVENTS" ]; then
    echo ""
    echo "✅ Target reached! $NEW_EVENTS new events discovered."
    break
  fi
  
  # Get queue status
  DISCOVERED=$(get_queue_count "discovered")
  AWAITING=$(get_queue_count "awaiting_fetch")
  READY=$(get_queue_count "ready_to_persist")
  
  echo "   Queue: discovered=$DISCOVERED, awaiting=$AWAITING, ready=$READY"
  
  # Step 1: If we have discovered URLs, run strategist
  if [ "$DISCOVERED" -gt 0 ]; then
    echo "📋 Running Strategist..."
    RESULT=$(api_call "sg-strategist" "{\"limit\": $STRATEGIST_BATCH}")
    ANALYZED=$(echo "$RESULT" | grep -o '"items_analyzed":[0-9]*' | cut -d: -f2)
    echo "   ✓ Analyzed: ${ANALYZED:-0}"
    sleep 2
  fi
  
  # Step 2: Run curator to process awaiting_fetch
  if [ "$AWAITING" -gt 0 ]; then
    echo "🎭 Running Curator..."
    RESULT=$(api_call "sg-curator" "{\"limit\": $CURATOR_BATCH}")
    ENRICHED=$(echo "$RESULT" | grep -o '"items_enriched":[0-9]*' | cut -d: -f2)
    FAILED=$(echo "$RESULT" | grep -o '"items_failed":[0-9]*' | cut -d: -f2)
    echo "   ✓ Enriched: ${ENRICHED:-0}, Failed: ${FAILED:-0}"
    echo "   ⏱️ Waiting ${CURATOR_DELAY}s..."
    sleep $CURATOR_DELAY
  fi
  
  # Step 3: Run vectorizer to persist ready events
  READY=$(get_queue_count "ready_to_persist")
  if [ "$READY" -gt 0 ]; then
    echo "📦 Running Vectorizer..."
    RESULT=$(api_call "sg-vectorizer" "{\"limit\": $VECTORIZER_BATCH}")
    PERSISTED=$(echo "$RESULT" | grep -o '"items_persisted":[0-9]*' | cut -d: -f2)
    echo "   ✓ Persisted: ${PERSISTED:-0}"
  fi
  
  # Progress update every 10 cycles
  if [ $((CYCLE % 10)) -eq 0 ]; then
    echo ""
    echo "📈 Progress Report (Cycle $CYCLE):"
    echo "   Zwolle events: $(count_events_by_city 'zwolle')"
    echo "   Meppel events: $(count_events_by_city 'meppel')"
    echo "   Total new: $NEW_EVENTS / $MAX_EVENTS"
    echo ""
  fi
  
  # If nothing to process, check if we need to discover more
  if [ "$DISCOVERED" -eq 0 ] && [ "$AWAITING" -eq 0 ] && [ "$READY" -eq 0 ]; then
    echo "⚠️ Queue empty - running Scout to discover more URLs..."
    RESULT=$(api_call "sg-scout" "{\"mode\": \"crawl_existing\", \"maxSourcesToCrawl\": 20, \"maxUrlsPerSource\": 50}")
    URLS=$(echo "$RESULT" | grep -o '"urls_discovered":[0-9]*' | cut -d: -f2)
    echo "   ✓ Discovered: ${URLS:-0} URLs"
    sleep 5
    
    # If still nothing, we're done
    if [ "${URLS:-0}" -eq 0 ]; then
      echo ""
      echo "✅ All sources processed! No more URLs to discover."
      break
    fi
  fi
  
  sleep 1
done

# Final report
echo ""
echo "═══════════════════════════════════════════════════════"
echo "📊 DISCOVERY COMPLETE"
echo ""
echo "   Zwolle events: $(count_events_by_city 'zwolle')"
echo "   Meppel events: $(count_events_by_city 'meppel')"
echo "   Total events: $(get_total_events)"
echo "   New events: $(($(get_total_events) - START_EVENTS))"
echo ""
echo "📍 Queue Status:"
echo "   Awaiting fetch: $(get_queue_count 'awaiting_fetch')"
echo "   Ready to persist: $(get_queue_count 'ready_to_persist')"
echo "   Failed: $(get_queue_count 'failed')"
echo "   Geo incomplete: $(get_queue_count 'geo_incomplete')"
echo "═══════════════════════════════════════════════════════"

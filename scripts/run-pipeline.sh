#!/bin/bash
#
# Waterfall Intelligence Pipeline Runner
# 
# Runs the SG pipeline at 80% of rate limits.
# 
# Usage:
#   ./scripts/run-pipeline.sh           # Default: 10 cycles
#   ./scripts/run-pipeline.sh 20        # Custom cycles
#   ./scripts/run-pipeline.sh 10 true   # With discovery
#

set -e
cd "$(dirname "$0")/.."

# Load environment
export $(grep -E '^SUPABASE_' .env | xargs)

CYCLES=${1:-10}
DISCOVERY=${2:-false}

# Rate limit settings (at 80%)
CURATOR_BATCH=5
CURATOR_DELAY=6  # seconds between curator calls
STRATEGIST_BATCH=30
VECTORIZER_BATCH=20

echo ""
echo "🚀 Waterfall Intelligence Pipeline Runner"
echo "   Cycles: $CYCLES"
echo "   Discovery: $DISCOVERY"
echo "   Rate: 80% of limits"
echo ""

TOTAL_INDEXED=0

for ((cycle=1; cycle<=CYCLES; cycle++)); do
    echo "--- Cycle $cycle/$CYCLES ---"
    
    # Get stats
    STATS=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sg-orchestrator" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d '{"mode":"status"}')
    
    DISCOVERED=$(echo "$STATS" | jq '.pipeline_stats[] | select(.stage=="discovered") | .count // 0')
    AWAITING=$(echo "$STATS" | jq '.pipeline_stats[] | select(.stage=="awaiting_fetch") | .count // 0')
    READY=$(echo "$STATS" | jq '.pipeline_stats[] | select(.stage=="ready_to_persist") | .count // 0')
    
    echo "📊 Queue: discovered=${DISCOVERED:-0}, awaiting=${AWAITING:-0}, ready=${READY:-0}"
    
    # Stop if empty
    if [[ "${DISCOVERED:-0}" -eq 0 && "${AWAITING:-0}" -eq 0 && "${READY:-0}" -eq 0 ]]; then
        echo "✅ Pipeline empty, stopping"
        break
    fi
    
    # Discovery (first cycle only, if enabled)
    if [[ "$DISCOVERY" == "true" && $cycle -eq 1 ]]; then
        echo "🔍 Running Scout..."
        curl -s -X POST "$SUPABASE_URL/functions/v1/sg-scout" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d '{"mode":"crawl_existing","maxUrlsPerSource":50}' > /dev/null
        echo "   ✓ Scout complete"
    fi
    
    # Strategist (fast)
    if [[ "${DISCOVERED:-0}" -gt 0 ]]; then
        echo "📋 Running Strategist..."
        RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sg-strategist" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"limit\":$STRATEGIST_BATCH}")
        PROCESSED=$(echo "$RESULT" | jq '.processed // 0')
        echo "   ✓ Processed: $PROCESSED"
    fi
    
    # Curator (rate limited)
    if [[ "${AWAITING:-0}" -gt 0 ]]; then
        echo "🎭 Running Curator..."
        RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sg-curator" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"limit\":$CURATOR_BATCH}")
        ENRICHED=$(echo "$RESULT" | jq '.items_enriched // 0')
        FAILED=$(echo "$RESULT" | jq '.items_failed // 0')
        echo "   ✓ Enriched: $ENRICHED, Failed: $FAILED"
        
        # Rate limit delay
        if [[ $cycle -lt $CYCLES ]]; then
            echo "   ⏱️ Waiting ${CURATOR_DELAY}s for rate limit..."
            sleep $CURATOR_DELAY
        fi
    fi
    
    # Vectorizer (persist)
    if [[ "${READY:-0}" -gt 0 ]]; then
        echo "📊 Running Vectorizer..."
        RESULT=$(curl -s -X POST "$SUPABASE_URL/functions/v1/sg-vectorizer" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"limit\":$VECTORIZER_BATCH}")
        INDEXED=$(echo "$RESULT" | jq '.items_persisted // 0')
        TOTAL_INDEXED=$((TOTAL_INDEXED + INDEXED))
        echo "   ✓ Indexed: $INDEXED"
    fi
    
    # Healer (every 5 cycles)
    if [[ $((cycle % 5)) -eq 0 ]]; then
        echo "🩺 Running Healer..."
        curl -s -X POST "$SUPABASE_URL/functions/v1/sg-healer" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d '{"mode":"repair","limit":2}' > /dev/null
        echo "   ✓ Healer complete"
    fi
    
    echo ""
done

# Final stats
echo "═══════════════════════════════════════"
echo "📈 PIPELINE RUN COMPLETE"
echo "   Total indexed: $TOTAL_INDEXED"
echo ""

# Event count
EVENT_COUNT=$(curl -s "$SUPABASE_URL/rest/v1/events?select=id" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -I 2>/dev/null \
    | grep -i content-range | cut -d'/' -f2 | tr -d '\r')
    
echo "🎉 Total events in database: $EVENT_COUNT"

# Final queue status
echo ""
echo "📊 Final Queue Status:"
curl -s -X POST "$SUPABASE_URL/functions/v1/sg-orchestrator" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"mode":"status"}' | jq -r '.pipeline_stats[] | "   \(.stage): \(.count)"'

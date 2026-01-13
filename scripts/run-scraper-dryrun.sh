#!/usr/bin/env bash
set -euo pipefail

# Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/run-scraper-dryrun.sh <source-id>
# Optionally set GEMINI_API_KEY when the deployed function requires it.
# Example to find source ids: SELECT id,name,url FROM scraper_sources WHERE name ILIKE '%Meppel%';

SOURCE_ID="${1:-}"
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables." >&2
  exit 1
fi

if [[ -z "$SOURCE_ID" ]]; then
  echo "Usage: ./scripts/run-scraper-dryrun.sh <source-id>" >&2
  exit 1
fi

PAYLOAD="{\"sourceId\":\"$SOURCE_ID\",\"dryRun\":true,\"enableDeepScraping\":true}"

curl -s -X POST "${SUPABASE_URL}/functions/v1/scrape-events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -d "$PAYLOAD" | tee "scripts/dryrun-${SOURCE_ID}.json"

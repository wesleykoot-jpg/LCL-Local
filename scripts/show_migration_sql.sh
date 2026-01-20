#!/bin/bash

# Helper script to display migration SQL for easy copying

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          DATA FIRST PIPELINE MIGRATION SQL                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Copy the SQL below and paste it into Supabase SQL Editor:"
echo "https://mlpefjsbriqgxcaqxhic.supabase.co/project/_/sql"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat supabase/migrations/20260121000000_data_first_pipeline.sql

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ After running the SQL above, verify with:"
echo "   node check_tables.cjs"
echo ""
echo "🚀 Then run the full test:"
echo "   node scripts/run_full_waterfall_test.mjs"
echo ""

# Deployment Checklist - Supabase Improvements

## ✅ Pre-Deployment Verification

### 1. Verify Environment Variables
```bash
# Check .env file has required variables
grep -E "(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY)" .env
```

**Required variables:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for scripts only)

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations
```bash
# Apply the new migrations to Supabase
supabase db push
```

**Expected migrations:**
- `20260128001000_waterfall_pipeline_architecture.sql` - Pipeline status + stage RPCs
- `20260128002000_push_based_enrichment_trigger.sql` - DB trigger for enrichment-worker

**Verify:**
```sql
-- In Supabase SQL Editor, verify functions exist:
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('claim_for_enrichment', 'complete_enrichment', 'claim_for_indexing', 'complete_indexing');
```

---

### Step 2: Deploy Updated Edge Functions
```bash
# Deploy enrichment + indexing workers
supabase functions deploy enrichment-worker
supabase functions deploy indexing-worker
```

**Verify:**
- Check Supabase Dashboard → Edge Functions
- Ensure `enrichment-worker` shows recent deployment timestamp
- Ensure `indexing-worker` shows recent deployment timestamp
- Check logs for any deployment errors

---

### Step 3: Test Atomic RPC Functions

#### Test join_event_atomic
```sql
-- In Supabase SQL Editor
SELECT join_event_atomic(
  '<test-event-id>'::uuid,
  '<test-profile-id>'::uuid,
  'going'
);
```

**Expected response:**
```json
{
  "status": "ok",
  "message": "Successfully joined event",
  "event_id": "...",
  "profile_id": "..."
}
```

#### Test enrichment claim
```sql
-- In Supabase SQL Editor
SELECT * FROM claim_for_enrichment();
```

**Expected:** Returns up to 1 row with pipeline_status changed to 'enriching'

---

### Step 4: Test Frontend Changes

#### Test Event Join Flow
1. Open your app in browser
2. Try to join an event
3. Open browser console
4. Look for:
   - No `[SLOW QUERY]` warnings (unless query actually slow)
   - No errors from new utilities
   - Successful event join

#### Test Error Handling
1. Disconnect internet
2. Try to fetch data
3. Should see retry attempts in console (if DEV mode)
4. Should eventually fail gracefully

#### Test Performance Monitoring
```javascript
// In browser console
import { logQueryStats } from '@/lib/queryMonitor';
logQueryStats();
```

**Expected output:**
```
=== Query Performance Statistics ===
Total Queries: X
Successful: X
Failed: X
Average Duration: XXXms
Slow Queries (>1s): X
Slowest Query: fetchDiscoveryRails (XXXms)
====================================
```

---

### Step 5: Test Worker Processing

#### Trigger Indexing Worker Manually
```bash
# Call the indexing-worker Edge Function
curl -X POST \
  https://<your-project>.supabase.co/functions/v1/indexing-worker \
  -H "Authorization: Bearer <service-role-key>"
```

**Expected response:**
```json
{
  "message": "Indexing complete",
  "processed": 10,
  "successful": 9,
  "failed": 1
}
```

#### Check for Race Conditions
1. Trigger worker multiple times simultaneously
2. Check `raw_event_staging` table
3. Verify no rows are processed twice (check `processing_log`)

---

### Step 6: Test Script Connection Pooling

```bash
# Run a diagnostic script
node check_db_direct.cjs
```

**Expected:**
- Should connect successfully
- Should show pool statistics
- Should close cleanly

---

## 🔍 Post-Deployment Monitoring

### Monitor for 24 Hours

#### Check Error Logs
```bash
# Supabase Dashboard → Logs → Edge Functions
# Look for errors from enrichment-worker or indexing-worker
```

#### Check Slow Queries
```javascript
// In browser console (after using app)
import { getQueryStats } from '@/lib/queryMonitor';
console.log(getQueryStats());
```

**Watch for:**
- Queries consistently over 2s
- High failure rates
- Timeout errors

#### Check Database Performance
```sql
-- In Supabase SQL Editor
-- Check for stuck processing rows
SELECT COUNT(*) 
FROM raw_event_staging 
WHERE status = 'processing' 
AND processing_started_at < NOW() - INTERVAL '10 minutes';
```

**Expected:** 0 (or very few)

---

## 🚨 Rollback Plan (If Needed)

### If Migrations Cause Issues

```bash
# Rollback migrations (manual)
# In Supabase SQL Editor, run:

-- Remove enrichment/indexing functions and trigger
DROP TRIGGER IF EXISTS tr_enrichment_webhook ON public.raw_event_staging;
DROP FUNCTION IF EXISTS public.trigger_enrichment_worker();
DROP FUNCTION IF EXISTS public.claim_for_enrichment(UUID);
DROP FUNCTION IF EXISTS public.claim_for_indexing(INTEGER);
DROP FUNCTION IF EXISTS public.complete_enrichment(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_indexing(UUID[]);

-- Revert join_event_atomic to previous version
-- (You'll need to restore from backup or previous migration)
```

### If Edge Function Fails

```bash
# Redeploy previous version
git checkout <previous-commit>
supabase functions deploy enrichment-worker
supabase functions deploy indexing-worker
git checkout main
```

### If Frontend Issues

```bash
# Revert frontend changes
git revert 7c0fcb5
git push
```

---

## ✅ Success Criteria

### All Green When:
- [ ] Migrations applied successfully
- [ ] Edge Functions deployed without errors
- [ ] Event joins work without race conditions
- [ ] Worker processes rows without duplicates
- [ ] No increase in error rates
- [ ] Query performance is acceptable (<2s for complex queries)
- [ ] Scripts use connection pooling correctly
- [ ] Error handling provides useful messages

---

## 📊 Metrics to Track

### Before vs After

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Event join errors | ? | ? | <1% |
| Worker duplicate processing | ? | ? | 0 |
| Average query time | ? | ? | <1s |
| Slow queries (>2s) | ? | ? | <5% |
| Retry success rate | N/A | ? | >80% |

---

## 🆘 Troubleshooting

### "Function claim_staging_rows does not exist"
**Solution:** Run `supabase db push` to apply migrations

### "Query timeout" errors
**Solution:** Increase timeout in `QUERY_TIMEOUTS` or optimize query

### "Too many retries"
**Solution:** Check network connectivity and Supabase status

### Worker processing duplicates
**Solution:** Verify `claim_staging_rows` is using `FOR UPDATE SKIP LOCKED`

### Connection pool exhausted
**Solution:** Ensure scripts call `closePool()` in finally blocks

---

## 📞 Support

If issues persist:
1. Check Supabase status page
2. Review error logs in Supabase Dashboard
3. Check browser console for frontend errors
4. Review implementation summary: `implementation_summary.md`
5. Check quick reference: `docs/SUPABASE_QUICK_REFERENCE.md`

---

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Rollback Tested:** [ ] Yes [ ] No  
**Monitoring Setup:** [ ] Yes [ ] No

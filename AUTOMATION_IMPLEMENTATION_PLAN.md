# Pipeline Automation Implementation Plan

**Status**: Ready to implement  
**Target**: Activate continuous event discovery and ingestion from 74 sources  
**Expected Outcome**: 100+ events per source (7,400 total) within 2 weeks

---

## Executive Summary

Your pipeline currently has **0 automation**. The orchestrator exists but isn't triggered. We'll implement **Cloud Scheduler** (GCP) → **Edge Functions** (Supabase) → **Pipeline Workers** (Deno) automation.

**Current**: 26 events from 74 sources (0.35/source) = **0.35% yield**  
**Target**: 100+ events/source (7,400+ total) = **100%+ yield**

---

## Architecture Decision: Cloud Scheduler + Edge Functions

### Why Cloud Scheduler?
✅ Works with Supabase HTTP endpoints  
✅ Serverless (no additional infrastructure)  
✅ Timezone-aware scheduling  
✅ Monitoring & error alerts  
✅ Handles retries automatically  

### How It Works
```
Cloud Scheduler (GCP)
    ↓ (HTTP POST at scheduled time)
sg-orchestrator Edge Function
    ↓ (calls workers sequentially)
sg-strategist → sg-curator → sg-vectorizer
    ↓ (populate pipeline queues)
Events published to database
```

---

## Implementation Steps

### Phase 1: Set Up Cloud Scheduler (45 min)

#### 1.1 Create GCP Project Link
- [ ] Log into Google Cloud Console
- [ ] Create/select project (or use existing)
- [ ] Enable Cloud Scheduler API
- [ ] Create service account with "Cloud Scheduler Job Runner" role
- [ ] Generate JSON key for service account

#### 1.2 Configure Three Scheduler Jobs

**Job 1: Strategist Discovery (6am every day)**
```
Schedule: 0 6 * * * (UTC)
URL: https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/sg-orchestrator
Method: POST
Body: {
  "mode": "run_stage",
  "stage": "strategist",
  "limit": 50
}
Headers: 
  Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
  Content-Type: application/json
```

**Job 2: Curator Extraction (every 2 hours, 24/7)**
```
Schedule: 0 */2 * * * (every 2 hours)
URL: https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/sg-orchestrator
Method: POST
Body: {
  "mode": "run_stage",
  "stage": "curator",
  "limit": 30
}
```

**Job 3: Vectorizer Persistence (every 1 hour, 24/7)**
```
Schedule: 0 * * * * (every hour)
URL: https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/sg-orchestrator
Method: POST
Body: {
  "mode": "run_stage",
  "stage": "vectorizer",
  "limit": 50
}
```

**Why these schedules?**
- **Strategist at 6am**: Once/day discovery is enough (generates 1000s of URLs per run)
- **Curator every 2h**: Fetch/extract HTML is slow, spread load
- **Vectorizer every 1h**: Fast persistence, keeps queue empty

---

### Phase 2: Deploy Orchestrator Helper Function (30 min)

Create wrapper function to handle Cloud Scheduler authentication more gracefully:

#### 2.1 Create `sg-scheduler-webhook.ts`
- [ ] Accept Cloud Scheduler HTTP POST
- [ ] Validate request headers
- [ ] Route to sg-orchestrator
- [ ] Return structured response
- [ ] Log execution for monitoring

**File location**: `supabase/functions/sg-scheduler-webhook/index.ts`

```typescript
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

interface ScheduledJob {
  mode: string;
  stage?: string;
  limit?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload: ScheduledJob = await req.json();
    
    console.log(`[Scheduler Webhook] Executing job: ${payload.mode}`);
    
    // Call sg-orchestrator
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/sg-orchestrator`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    
    return new Response(JSON.stringify({
      success: response.ok,
      data: result,
      timestamp: new Date().toISOString(),
    }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Scheduler Webhook] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

### Phase 3: Update Orchestrator for Scheduler (15 min)

#### 3.1 Add Logging & Monitoring
- [ ] Add execution metrics to orchestrator
- [ ] Log to `sg_scheduler_execution_log` table
- [ ] Track timing and worker performance

#### 3.2 Create Monitoring Table
```sql
CREATE TABLE IF NOT EXISTS sg_scheduler_execution_log (
  id BIGSERIAL PRIMARY KEY,
  mode TEXT,
  stage TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  items_processed INTEGER,
  items_failed INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scheduler_log_created ON sg_scheduler_execution_log(created_at DESC);
```

#### 3.3 Update sg-orchestrator to log execution

Add at end of orchestrator:
```typescript
// Log execution
const { error: logError } = await supabase
  .from('sg_scheduler_execution_log')
  .insert({
    mode: response.mode,
    stage: stage || null,
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: response.duration_ms,
    items_processed: itemsProcessed, // Track from worker responses
    success: response.success,
    error_message: response.errors.length > 0 ? response.errors[0] : null,
  });
```

---

### Phase 4: Test & Deploy (1 hour)

#### 4.1 Manual Testing
- [ ] Call orchestrator directly with `curl` to verify modes work
- [ ] Test each stage individually (strategist, curator, vectorizer)
- [ ] Verify pipeline queues update correctly
- [ ] Monitor logs in Supabase Dashboard

#### 4.2 Dry-Run Cloud Scheduler
- [ ] Create jobs in Cloud Scheduler with "Execute now" button
- [ ] Check Supabase logs for function execution
- [ ] Verify scheduler_execution_log entries appear
- [ ] Check sg_pipeline_queue for new items

#### 4.3 Enable Production Scheduling
- [ ] Set real CRON schedules:
  - Strategist: 6am UTC daily
  - Curator: every 2 hours
  - Vectorizer: every 1 hour
- [ ] Set up Slack alerts for failures
- [ ] Monitor first 24 hours closely

---

## Expected Data Flow Timeline

### Hour 1-2
- Strategist discovers sources & generates URLs
- sg_pipeline_queue gets 100s of "awaiting_fetch" items
- Curator starts fetching pages

### Hour 3-6
- Curator extracts events, curator gets 100s of "extracted" items
- Vectorizer starts embedding & persisting
- First events appear in database

### Day 1
- ~200-500 new events published
- Pipeline runs 12 cycles (curator + vectorizer)
- Most sources touched at least once

### Week 1
- ~2,000-5,000 events
- All 74 sources discovered
- Pipeline stabilizes at steady state

### Week 2
- 5,000-7,400 events (100+ per source)
- Full steady-state operation
- Can optimize schedules based on data

---

## Critical Configuration Points

### 1. Supabase Service Role Key
- Store in Cloud Scheduler as secret
- Grant only to scheduler service account
- Rotate quarterly

### 2. Pipeline Limits
```
Strategist: process 50 sources per run
Curator: fetch 30 pages per run (slow - network I/O)
Vectorizer: embed 50 events per run
```
Tune these based on observed latency.

### 3. Rate Limiting
- Curator respects per-domain rate limits (2s between requests)
- Strategist can run fast (local processing)
- Vectorizer batches embeddings (parallel)

### 4. Error Handling
- Failed items stay in queue, retry next cycle
- Max 3 retries before moving to failure_log
- Slack notifications for repeated failures

---

## Monitoring & Observability

### Dashboards to Create

**1. Pipeline Health**
```sql
SELECT 
  stage,
  COUNT(*) as queue_size,
  MAX(created_at) as oldest_item_age
FROM sg_pipeline_queue
GROUP BY stage;
```

**2. Event Production Rate**
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as events_created
FROM events
WHERE status = 'published'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;
```

**3. Scheduler Success Rate**
```sql
SELECT 
  mode,
  COUNT(CASE WHEN success THEN 1 END) as successful_runs,
  COUNT(*) as total_runs,
  AVG(duration_ms) as avg_duration_ms
FROM sg_scheduler_execution_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY mode;
```

### Alerts to Set Up
- [ ] Orchestrator fails 3x in a row → Slack alert
- [ ] Queue size > 1000 items → warning
- [ ] No events in 24h → critical
- [ ] Curator error rate > 10% → investigate

---

## Rollback Plan

If something breaks:
1. Disable all Cloud Scheduler jobs
2. Check sg_scheduler_execution_log for error patterns
3. Fix root cause in orchestrator/worker
4. Test manually with curl
5. Re-enable jobs one at a time

Maintain ability to run pipeline manually:
```bash
curl -X POST https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/sg-orchestrator \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "run_stage", "stage": "strategist", "limit": 50}'
```

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Published Events | 26 | 7,400 | 2 weeks |
| Events/Source | 0.35 | 100+ | 2 weeks |
| Sources Discovered | 0 | 74 | 1 week |
| Pipeline Queue Size | 21 | <100 | continuous |
| Avg Discovery Latency | N/A | < 24h | continuous |
| Error Rate | N/A | < 2% | continuous |

---

## Implementation Order

1. **Deploy monitoring table** (sg_scheduler_execution_log)
2. **Create scheduler webhook function** (optional but recommended)
3. **Test orchestrator manually** (verify all modes work)
4. **Set up Cloud Scheduler jobs** (start with dry-run)
5. **Monitor execution** (first 24 hours intensive)
6. **Optimize schedules** (adjust limits/timing based on data)

---

## Dependencies

- Google Cloud Project with Cloud Scheduler enabled
- Service account with Cloud Scheduler permissions
- Supabase service role key (already have)
- Access to Supabase Edge Functions (already configured)

---

## Estimated Timeline

- **Setup**: 2 hours
- **Testing**: 1 hour
- **Production deployment**: 30 min
- **Monitoring & optimization**: ongoing

**Total to first events**: ~4 hours  
**Total to 100+ per source**: ~2 weeks

---

## Questions to Answer Before Starting

1. **Timezone preference**: Schedule times in which timezone? (currently UTC)
2. **Rate limits**: Any external API rate limits on sources? (already configured in curator)
3. **Budget**: GCP Cloud Scheduler is $0.10/job/month (cheap)
4. **Alerting**: Slack workspace for error notifications?
5. **Working hours**: Run 24/7 or only business hours?

---

Would you like me to proceed with implementation? I can:
1. Deploy the monitoring table
2. Create the scheduler webhook function
3. Set up Cloud Scheduler jobs (GCP side - you'll need to do this)
4. Add comprehensive logging to orchestrator
5. Create dashboard SQL queries

**Which phase should we start with?**

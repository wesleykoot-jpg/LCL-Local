# Production-Grade Architecture Implementation Guide

This document provides an overview of the newly implemented production-grade features in LCL-Local.

## 🚀 Overview

The application has been upgraded from a "Functional MVP" to a "Production-Grade Scalable Architecture" across three major phases:

1. **Performance & Caching (Frontend)** - TanStack Query integration
2. **Self-Healing Scraper Pipeline** - Adaptive throttling and observability
3. **Semantic Discovery** - pgvector-powered "vibe search"

## Phase 1: Performance & Caching

### TanStack Query Integration

The frontend now uses TanStack Query for intelligent data fetching and caching:

#### Key Features
- **Automatic caching** with configurable stale time (2 minutes)
- **Background refetching** every 5 minutes
- **Window-focus refetching** for fresh data when users return to the app
- **Stale-while-revalidate** pattern for instant UI updates
- **Integration with `get_personalized_feed` RPC** for server-side ranking

#### Usage Example

```typescript
import { useEventsQuery } from '@/features/events/hooks';

function MyComponent() {
  const { events, loading, refetch } = useEventsQuery({
    currentUserProfileId: user?.id,
    userLocation: { lat: 52.7, lng: 6.2 },
    radiusKm: 25,
    usePersonalizedFeed: true,
  });

  // Events are automatically cached and refetched
  // Manual refetch available via refetch()
}
```

### Virtualization

The event feed uses `@tanstack/react-virtual` to handle 1,000+ events without performance degradation:

- **Estimated item size**: 400px
- **Overscan**: 3 items outside visible area
- **Mobile-optimized** for smooth scrolling

## Phase 2: Self-Healing Scraper Pipeline

### Observability

The scraper now logs all failures to a dedicated `scraper_failures` table for offline debugging:

#### Tracked Information
- Error type (no_events_found, selector_failed, parse_error, fetch_error, rate_limited)
- Raw HTML (first 50KB) for selector debugging
- Selector context (which selectors were tried)
- Historical event counts (expected vs. found)

#### Database Functions

```sql
-- Log a scraper failure
SELECT log_scraper_failure(
  source_id := 'uuid',
  url := 'https://example.com',
  error_type := 'no_events_found',
  raw_html := '<html>...</html>',
  events_expected := 10,
  events_found := 0
);

-- Get historical average for a source
SELECT get_source_historical_event_count('source_uuid');
```

### Adaptive Rate Limiting

The scraper automatically adjusts rate limits based on server responses:

#### Features
- **±20% jitter** on all delays to avoid fingerprinting
- **Auto-throttling**: Doubles rate limit on 403/429 responses
- **24-hour expiration**: Rate limits reset automatically
- **Per-source tracking**: Each source has independent rate limits

#### Database Functions

```sql
-- Increase rate limit after 403/429
SELECT increase_source_rate_limit('source_uuid', 429);

-- Get effective rate limit (dynamic or base)
SELECT get_effective_rate_limit('source_uuid');

-- Reset expired rate limits (called by cron)
SELECT reset_expired_rate_limits();
```

#### TypeScript Utilities

```typescript
import { jitteredDelay, isRateLimited } from '../_shared/rateLimiting';

// Use jittered delay instead of fixed setTimeout
await jitteredDelay(1000, 20); // 800-1200ms random delay

// Check if status code indicates rate limiting
if (isRateLimited(response.status)) {
  await increaseRateLimit(supabaseUrl, supabaseKey, sourceId, response.status);
}
```

### Automatic Failover

The scraper implements a 3-strike rule for automatic failover:

#### FailoverPageFetcher
- **Primary**: Static HTTP requests (fast, lightweight)
- **Fallback**: ScrapingBee (JavaScript rendering, anti-bot)
- **Trigger**: After 3 consecutive static fetch failures
- **Session-based**: Failover persists for the entire scraping session

#### Usage

```typescript
import { createFetcherForSource } from './strategies';

// Automatically uses FailoverPageFetcher for static sources
const fetcher = createFetcherForSource(source);

// Will auto-pivot to ScrapingBee after 3 failures
const result = await fetcher.fetchPage(url);
```

## Phase 3: Semantic Discovery (pgvector)

### Vector Embeddings

Events are automatically converted to semantic embeddings for similarity search:

#### Architecture
- **Extension**: pgvector
- **Dimensions**: 1536 (OpenAI native / Gemini padded)
- **Index**: HNSW (m=16, ef_construction=64) for O(log n) lookup
- **Similarity Metric**: Cosine distance

#### Embedding Generation

Embeddings are generated automatically via database triggers:

```typescript
// Manual generation
POST /functions/v1/generate-event-embeddings
{
  "event_id": "uuid"
}

// Batch processing
POST /functions/v1/generate-event-embeddings
{
  "batch": true,
  "limit": 100
}
```

#### Queue Processing

A worker function processes the embedding queue:

```typescript
POST /functions/v1/process-embedding-queue
{
  "batch_size": 10,
  "chain": true  // Auto-trigger next batch
}
```

### Semantic Search RPCs

Three powerful search functions are available:

#### 1. Find Similar Events

Find events similar to a specific event:

```sql
SELECT * FROM find_similar_events(
  event_id := 'event_uuid',
  match_threshold := 0.7,
  match_count := 10
);
```

Returns: Similar events with similarity scores

#### 2. Match Events by Embedding

Search events using a pre-computed embedding:

```sql
SELECT * FROM match_events(
  query_embedding := '[0.1, 0.2, ...]',
  match_threshold := 0.7,
  match_count := 10,
  filter_category := 'nightlife'
);
```

Returns: Events matching the embedding

#### 3. Vibe Search

Natural language search with location filtering:

```sql
SELECT * FROM search_events_by_vibe(
  vibe_embedding := '[0.1, 0.2, ...]',
  user_lat := 52.7,
  user_long := 6.2,
  radius_km := 25,
  match_threshold := 0.6,
  match_count := 20
);
```

Returns: Events matching the "vibe" with distance info

### Frontend Integration (Example)

```typescript
import { supabase } from '@/integrations/supabase/client';

// Find similar events
async function findSimilarEvents(eventId: string) {
  const { data, error } = await supabase.rpc('find_similar_events', {
    event_id: eventId,
    match_threshold: 0.7,
    match_count: 10,
  });

  return data;
}

// Search by vibe (requires embedding from LLM)
async function vibeSearch(query: string, userLocation: Location) {
  // Step 1: Generate embedding for user query
  const embedding = await generateEmbedding(query);
  
  // Step 2: Search events
  const { data, error } = await supabase.rpc('search_events_by_vibe', {
    vibe_embedding: embedding,
    user_lat: userLocation.lat,
    user_long: userLocation.lng,
    radius_km: 25,
    match_threshold: 0.6,
    match_count: 20,
  });

  return data;
}
```

## 🔒 Security & Best Practices

### Preserved Defensive Mechanisms

All existing scraping protections are preserved:

- ✅ User-agent spoofing
- ✅ Custom headers (DEFAULT_HEADERS)
- ✅ Exponential backoff
- ✅ Redirect handling
- ✅ Timeout protection

### Enhanced Protections

New anti-detection measures:

- ✅ Random jitter (±20%) on all delays
- ✅ Adaptive throttling (auto-doubles on rate limits)
- ✅ Automatic failover to ScrapingBee
- ✅ Session-based failure tracking

## 📊 Performance Metrics

### Frontend
- **Initial Load**: Cached data loads instantly
- **Stale Time**: 2 minutes (adjustable)
- **GC Time**: 10 minutes (adjustable)
- **Background Refetch**: Every 5 minutes
- **Virtualization**: Handles 1,000+ events smoothly

### Backend
- **Rate Limiting**: Base 150-200ms, up to 30s with adaptive throttling
- **Jitter Range**: ±20% of base delay
- **Failover Threshold**: 3 failures
- **Vector Search**: O(log n) with HNSW index

### Database
- **Embedding Dimensions**: 1536
- **Index Type**: HNSW (Hierarchical Navigable Small World)
- **Index Parameters**: m=16, ef_construction=64
- **Similarity Metric**: Cosine distance

## 🔧 Configuration

### Environment Variables

```bash
# Required for embeddings
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key  # Optional, falls back to Gemini

# Required for failover
SCRAPINGBEE_API_KEY=your_scrapingbee_key

# Supabase (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### TanStack Query Configuration

Adjust caching behavior in `useEventsQuery.ts`:

```typescript
staleTime: 1000 * 60 * 2,        // 2 minutes
gcTime: 1000 * 60 * 10,          // 10 minutes
refetchInterval: 1000 * 60 * 5,  // 5 minutes
```

## 🚀 Deployment

### Migration Order

Run migrations in sequence:

1. `20260114104000_scraper_failures_observability.sql`
2. `20260114104500_adaptive_rate_limiting.sql`
3. `20260114105000_enable_pgvector_semantic_search.sql`
4. `20260114105500_embedding_queue_trigger.sql`

### Edge Functions

Deploy the new functions:

```bash
supabase functions deploy generate-event-embeddings
supabase functions deploy process-embedding-queue
```

### Cron Jobs (Optional)

Set up scheduled tasks:

```bash
# Reset expired rate limits daily
0 0 * * * curl -X POST https://your-project.supabase.co/rest/v1/rpc/reset_expired_rate_limits

# Process embedding queue hourly
0 * * * * curl -X POST https://your-project.supabase.co/functions/v1/process-embedding-queue
```

## 📝 Testing

### Frontend Testing

```bash
npm run dev
# Navigate to /feed
# Open DevTools > Network tab
# Observe automatic caching and refetching
```

### Backend Testing

```bash
# Test embedding generation
curl -X POST https://your-project.supabase.co/functions/v1/generate-event-embeddings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_id": "event_uuid"}'

# Test similarity search
curl -X POST https://your-project.supabase.co/rest/v1/rpc/find_similar_events \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_id": "event_uuid", "match_threshold": 0.7, "match_count": 10}'
```

## 🎯 Next Steps

### Recommended Enhancements

1. **Frontend Vibe Search UI**: Add a natural language search bar
2. **Embedding Monitoring**: Dashboard for embedding coverage and quality
3. **A/B Testing**: Compare personalized feed vs. standard feed
4. **Cache Warming**: Pre-generate embeddings for high-traffic events
5. **Rate Limit Dashboard**: Visualize adaptive throttling in real-time

### Future Optimizations

- [ ] Implement embedding similarity pre-computation
- [ ] Add hybrid search (keyword + semantic)
- [ ] Implement user preference learning from clicks
- [ ] Add embedding version migration system
- [ ] Implement multi-modal embeddings (image + text)

## 🐛 Troubleshooting

### Common Issues

**Q: Events not showing up in feed?**
A: Check TanStack Query cache in DevTools > React Query

**Q: Embeddings not generating?**
A: Verify API keys in environment variables, check embedding_queue table

**Q: Rate limiting too aggressive?**
A: Adjust base rate_limit_ms in scraper_sources config

**Q: Vector search too slow?**
A: Verify HNSW index exists on events.embedding column

**Q: Scraper failing over too quickly?**
A: Increase maxFailuresBeforeFailover in FailoverPageFetcher

## 📚 Additional Resources

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Gemini Embeddings API](https://ai.google.dev/docs/embeddings_guide)

---

**Version**: 1.0.0  
**Last Updated**: January 14, 2026  
**Status**: Production Ready ✅

# Supabase Integration - Quick Reference

## 🚀 New Utilities Available

### Error Handling
```typescript
import { handleSupabaseError, getUserFriendlyErrorMessage } from '@/lib/errorHandler';

try {
  const { data, error } = await supabase.rpc('my_function', { ... });
  if (error) throw error;
} catch (error) {
  const wrappedError = handleSupabaseError(error, {
    operation: 'myOperation',
    component: 'MyComponent',
    metadata: { userId, eventId }
  });
  
  // Show user-friendly message
  const message = getUserFriendlyErrorMessage(wrappedError);
  toast.error(message);
}
```

### Query Timeout
```typescript
import { queryWithTimeout, QUERY_TIMEOUTS } from '@/lib/queryTimeout';

// With predefined timeout
const data = await queryWithTimeout(
  () => supabase.rpc('complex_query', { ... }),
  QUERY_TIMEOUTS.COMPLEX // 15s
);

// With custom timeout
const data = await queryWithTimeout(
  () => supabase.from('events').select('*'),
  5000 // 5s
);
```

### Retry Logic
```typescript
import { retrySupabaseQuery, retryWithBackoff } from '@/lib/retryWithBackoff';

// Simple retry (max 2 attempts)
const data = await retrySupabaseQuery(
  () => supabase.rpc('flaky_operation', { ... })
);

// Advanced retry with custom options
const data = await retryWithBackoff(
  () => supabase.from('events').insert({ ... }),
  {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    onRetry: (attempt, error) => {
      console.log(`Retry ${attempt}:`, error);
    }
  }
);
```

### Performance Monitoring
```typescript
import { monitorQuery, getQueryStats, logQueryStats } from '@/lib/queryMonitor';

// Monitor a query
const data = await monitorQuery(
  'fetchUserEvents',
  () => supabase.from('events').select('*').eq('user_id', userId),
  1000 // warn if >1s
);

// Get statistics
const stats = getQueryStats();
console.log('Average query time:', stats.averageDuration);

// Log summary
logQueryStats();
```

### Connection Pool (Scripts)
```javascript
const { query, transaction, closePool } = require('./scripts/lib/db.cjs');

async function main() {
  try {
    // Simple query
    const result = await query('SELECT COUNT(*) FROM events');
    console.log('Total events:', result.rows[0].count);
    
    // Transaction
    await transaction(async (client) => {
      await client.query('UPDATE events SET status = $1', ['active']);
      await client.query('INSERT INTO audit_log VALUES ($1)', ['Updated']);
    });
  } finally {
    await closePool(); // Always close pool
  }
}

main();
```

## 🔧 Combining Utilities

### Full Stack (Recommended Pattern)
```typescript
import { handleSupabaseError } from '@/lib/errorHandler';
import { queryWithTimeout, QUERY_TIMEOUTS } from '@/lib/queryTimeout';
import { retrySupabaseQuery } from '@/lib/retryWithBackoff';
import { monitorQuery } from '@/lib/queryMonitor';

export async function fetchDiscoveryRails(userId: string) {
  try {
    return await monitorQuery(
      'fetchDiscoveryRails',
      async () => {
        return await retrySupabaseQuery(async () => {
          return await queryWithTimeout(async () => {
            const { data, error } = await supabase.rpc('get_discovery_rails', {
              p_user_id: userId,
              // ...
            });
            if (error) throw error;
            return data;
          }, QUERY_TIMEOUTS.COMPLEX);
        });
      },
      2000 // slow query threshold
    );
  } catch (error) {
    handleSupabaseError(error, {
      operation: 'fetchDiscoveryRails',
      metadata: { userId }
    });
    return { sections: [] }; // fallback
  }
}
```

## 📋 Timeout Recommendations

| Query Type | Timeout | Constant |
|------------|---------|----------|
| Simple SELECT | 5s | `QUERY_TIMEOUTS.FAST` |
| JOIN queries | 10s | `QUERY_TIMEOUTS.STANDARD` |
| RPC functions | 15s | `QUERY_TIMEOUTS.COMPLEX` |
| Analytics/Reports | 30s | `QUERY_TIMEOUTS.HEAVY` |

## 🔄 Retry Recommendations

| Operation | Max Retries | Use Case |
|-----------|-------------|----------|
| Read queries | 2 | Safe to retry |
| Idempotent writes | 2 | Safe if idempotent |
| Non-idempotent writes | 0 | Don't retry |
| Critical operations | 3 | Important to succeed |

## 🚨 Error Codes

Common Supabase error codes:

| Code | Meaning | User Message |
|------|---------|--------------|
| `23505` | Unique violation | "This item already exists" |
| `23503` | Foreign key violation | "Cannot delete (in use)" |
| `42501` | Insufficient privilege | "Permission denied" |
| `PGRST116` | Not found | "No results found" |
| `08000` | Connection error | "Database connection failed" |

## 🎯 Best Practices

### DO ✅
- Use atomic RPC for operations with race conditions
- Add timeouts to all user-facing queries
- Retry read operations and idempotent writes
- Monitor slow queries in production
- Use connection pooling for scripts
- Handle errors with context

### DON'T ❌
- Don't retry non-idempotent operations
- Don't use hardcoded credentials
- Don't ignore slow query warnings
- Don't skip error handling
- Don't create new connections in loops
- Don't expose service role key to frontend

## 📊 Monitoring in Production

```typescript
// In your app initialization
import { logQueryStats } from '@/lib/queryMonitor';

// Log stats every 5 minutes
setInterval(() => {
  if (import.meta.env.DEV) {
    logQueryStats();
  }
}, 5 * 60 * 1000);
```

## 🔍 Debugging

### Check Query Performance
```typescript
import { getQueryMetrics } from '@/lib/queryMonitor';

// Get metrics for specific query
const metrics = getQueryMetrics('fetchDiscoveryRails');
console.log('Average:', metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length);
```

### Test RPC Functions
```sql
-- In Supabase SQL Editor
SELECT join_event_atomic(
  '<event-id>'::uuid,
  '<profile-id>'::uuid,
  'going'
);

SELECT * FROM claim_staging_rows(5);
```

### Check Connection Pool
```javascript
const { getPoolStats } = require('./scripts/lib/db.cjs');

console.log(getPoolStats());
// { totalCount: 5, idleCount: 3, waitingCount: 0 }
```

## 🆘 Troubleshooting

### "Query timeout" errors
- Increase timeout for complex queries
- Check database performance
- Optimize query (add indexes, reduce joins)

### "Too many retries" errors
- Check network connectivity
- Verify Supabase is operational
- Review error logs for root cause

### "Connection pool exhausted"
- Ensure `closePool()` is called
- Reduce concurrent script executions
- Increase pool size if needed

### Slow queries
- Check `[SLOW QUERY]` warnings in console
- Use `getQueryMetrics()` to identify bottlenecks
- Add database indexes
- Optimize RPC functions

## 📚 Further Reading

- [Error Handler](file:///Users/wesleykoot/Documents/Repo/LCL-Local/src/lib/errorHandler.ts)
- [Query Timeout](file:///Users/wesleykoot/Documents/Repo/LCL-Local/src/lib/queryTimeout.ts)
- [Retry Logic](file:///Users/wesleykoot/Documents/Repo/LCL-Local/src/lib/retryWithBackoff.ts)
- [Query Monitor](file:///Users/wesleykoot/Documents/Repo/LCL-Local/src/lib/queryMonitor.ts)
- [Connection Pool](file:///Users/wesleykoot/Documents/Repo/LCL-Local/scripts/lib/db.cjs)
- [Implementation Summary](file:///Users/wesleykoot/.gemini/antigravity/brain/ff39ce46-b89b-4080-93ed-5dde568cee48/implementation_summary.md)

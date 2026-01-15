# Edge Function Error Logging Checklist

This checklist ensures all edge functions have proper error logging and observability.

## Before Writing Code

- [ ] Review `supabase/functions/_shared/errorLogging.ts` to understand available utilities
- [ ] Start from the template: `supabase/functions/_templates/edge-function-template.ts`
- [ ] Import error logging utilities at the top of the file

```typescript
import { 
  withErrorLogging, 
  logSupabaseError, 
  logHttpError, 
  logFetchError,
  logWarning,
  logInfo 
} from "../_shared/errorLogging.ts";
```

## Handler Setup

- [ ] Wrap the main handler function with `withErrorLogging()`
- [ ] Use descriptive source, function_name, and operation parameters
- [ ] Include request context (method, url) in the wrapper
- [ ] Add a `.catch()` handler to return error responses

**Example:**
```typescript
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return withErrorLogging(
    'my-function',
    'handler',
    'Process request',
    async () => {
      // Handler logic here
    },
    { method: req.method, url: req.url }
  ).catch((error) => {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  });
});
```

## Supabase Database Calls

For **every** Supabase database call, check for errors and log them:

- [ ] Check for `{ error }` in the destructured response
- [ ] Call `logSupabaseError()` when error is present
- [ ] Include meaningful context (IDs, operation details)

**Example:**
```typescript
const { data, error } = await supabase
  .from("events")
  .select("*")
  .eq("id", eventId);

if (error) {
  await logSupabaseError(
    'my-function',
    'fetchEvent',
    'Fetch event by ID',
    error,
    { event_id: eventId }
  );
  throw new Error(`Failed to fetch event: ${error.message}`);
}
```

**Applies to:**
- [ ] `.from().select()` queries
- [ ] `.from().insert()` operations
- [ ] `.from().update()` operations
- [ ] `.from().delete()` operations
- [ ] `.rpc()` stored procedure calls
- [ ] Count queries (`.select(count: 'exact')`)

## External API/HTTP Calls

For **every** `fetch()` call to external APIs:

- [ ] Check response status with `response.ok`
- [ ] Call `logHttpError()` for failed requests
- [ ] Include response body and status code
- [ ] Add relevant context

**Example:**
```typescript
const response = await fetch('https://api.example.com/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const responseBody = await response.text();
  await logHttpError(
    'my-function',
    'callExternalAPI',
    'Call Example API',
    'https://api.example.com/endpoint',
    response.status,
    responseBody,
    Object.fromEntries(response.headers.entries()),
    { payload_size: payload.length }
  );
  throw new Error(`API call failed with status ${response.status}`);
}
```

**Applies to:**
- [ ] Google API calls (Calendar, OAuth, etc.)
- [ ] OpenAI/Gemini API calls
- [ ] Serper API calls
- [ ] Any other third-party API calls

## Special Cases

### Rate Limited Requests

- [ ] Use `logHttpError()` with appropriate context
- [ ] Include retry attempt number
- [ ] Log on final failure, not every retry

**Example:**
```typescript
if (response.status === 429 && attempt === maxRetries) {
  await logHttpError(
    'my-function',
    'callAPI',
    'API rate limit exceeded',
    url,
    429,
    await response.text(),
    undefined,
    { attempt: attempt + 1, max_retries: maxRetries }
  );
}
```

### Warnings (Non-Fatal Issues)

- [ ] Use `logWarning()` for issues that don't break functionality
- [ ] Include descriptive messages and context

**Example:**
```typescript
if (!coordinates) {
  await logWarning(
    'my-function',
    'processEvent',
    'Event missing coordinates, using fallback',
    { event_id: eventId, fallback: 'POINT(0 0)' }
  );
}
```

### Info Logging (Important Operations)

- [ ] Use `logInfo()` for tracking important successful operations
- [ ] Useful for debugging and monitoring

**Example:**
```typescript
await logInfo(
  'my-function',
  'processJob',
  `Job completed: ${jobId}`,
  { job_id: jobId, events_processed: count }
);
```

## Testing Your Changes

- [ ] Test happy path (successful operations)
- [ ] Test error paths (trigger database errors, API failures)
- [ ] Verify errors appear in `error_logs` table
- [ ] Check Slack notifications for critical errors
- [ ] Ensure no sensitive data (passwords, tokens) is logged

## Code Review Checklist

Reviewer should verify:

- [ ] All Supabase calls have error checking and logging
- [ ] All fetch() calls have error checking and logging  
- [ ] Handler is wrapped with `withErrorLogging()`
- [ ] Error context includes relevant IDs and operation details
- [ ] No sensitive data is logged
- [ ] Console.log/error statements are kept minimal

## Common Mistakes to Avoid

❌ **Don't do this:**
```typescript
const { data } = await supabase.from("events").select("*");
// Missing error check!
```

✅ **Do this:**
```typescript
const { data, error } = await supabase.from("events").select("*");
if (error) {
  await logSupabaseError('my-function', 'fetchEvents', 'Fetch all events', error);
  throw new Error(`Database query failed: ${error.message}`);
}
```

❌ **Don't do this:**
```typescript
const response = await fetch(url);
const data = await response.json();
// Missing status check!
```

✅ **Do this:**
```typescript
const response = await fetch(url);
if (!response.ok) {
  await logHttpError('my-function', 'callAPI', 'API call', url, response.status, await response.text());
  throw new Error(`API call failed: ${response.status}`);
}
const data = await response.json();
```

## Additional Resources

- **Error Logging Utilities**: `supabase/functions/_shared/errorLogging.ts`
- **Template**: `supabase/functions/_templates/edge-function-template.ts`
- **Examples**: See `run-scraper`, `scrape-coordinator`, `google-calendar-auth` for working examples
- **Database Schema**: `error_logs` table stores all logged errors
- **Monitoring**: Check Supabase Dashboard → Database → error_logs for logged errors

## Quick Reference

| Scenario | Function to Use |
|----------|----------------|
| Supabase query error | `logSupabaseError()` |
| External API error | `logHttpError()` |
| Network/fetch error | `logFetchError()` |
| Non-fatal issue | `logWarning()` |
| Important operation | `logInfo()` |
| Uncaught exception | `withErrorLogging()` wrapper |

---

**Remember**: Good error logging helps debug production issues, provides observability, and makes the system more maintainable. When in doubt, log more context rather than less!

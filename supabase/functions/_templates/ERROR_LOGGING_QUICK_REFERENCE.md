# Error Logging Quick Reference

## Import Statement

```typescript
import { 
  withErrorLogging,    // Wrap handlers to catch uncaught exceptions
  logSupabaseError,    // Log Supabase database errors
  logHttpError,        // Log HTTP/API errors with response details
  logFetchError,       // Log network/fetch errors
  logWarning,          // Log non-fatal warnings
  logInfo              // Log important operations
} from "../_shared/errorLogging.ts";
```

## Usage Examples

### 1. Wrap Handler (Required for all functions)

```typescript
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return withErrorLogging(
    'function-name',           // Source: function identifier
    'handler',                 // Function name: which function in source
    'Process request',         // Operation: what this does
    async () => {
      // Your handler logic here
      return new Response(JSON.stringify({ success: true }));
    },
    { method: req.method, url: req.url }  // Context: extra debugging info
  ).catch((error) => {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  });
});
```

### 2. Log Supabase Errors

```typescript
const { data, error } = await supabase
  .from("events")
  .select("*")
  .eq("id", eventId);

if (error) {
  await logSupabaseError(
    'function-name',         // Source
    'fetchEvent',            // Function name
    'Fetch event by ID',     // Operation description
    error,                   // The Supabase error object
    { event_id: eventId }    // Context (optional but recommended)
  );
  throw new Error(`Database query failed: ${error.message}`);
}
```

### 3. Log HTTP/API Errors

```typescript
const response = await fetch('https://api.example.com/data', {
  method: 'POST',
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const responseBody = await response.text();
  await logHttpError(
    'function-name',              // Source
    'callExampleAPI',             // Function name
    'Fetch data from API',        // Operation description
    'https://api.example.com/data', // URL
    response.status,              // HTTP status code
    responseBody,                 // Response body (truncated automatically)
    Object.fromEntries(response.headers.entries()), // Headers (optional)
    { payload_size: payload.length }  // Context (optional)
  );
  throw new Error(`API returned ${response.status}`);
}
```

### 4. Log Network/Fetch Errors

```typescript
try {
  const response = await fetch(url);
  // ... handle response
} catch (error) {
  await logFetchError(
    'function-name',       // Source
    'fetchData',           // Function name
    url,                   // URL
    error,                 // Error object
    { retry_attempt: 1 }   // Context (optional)
  );
  throw error;
}
```

### 5. Log Warnings (Non-Fatal)

```typescript
if (!source.coordinates) {
  await logWarning(
    'function-name',                      // Source
    'processSource',                      // Function name
    'Source missing coordinates',         // Warning message
    { source_id: source.id, fallback_used: true }  // Context
  );
  // Continue with fallback coordinates
}
```

### 6. Log Info (Important Operations)

```typescript
await logInfo(
  'function-name',                        // Source
  'processJob',                           // Function name
  `Successfully processed job ${jobId}`,  // Info message
  { job_id: jobId, items_processed: 42 }  // Context
);
```

## Function Signatures

```typescript
// Wrap async operations with automatic error logging
withErrorLogging<T>(
  source: string,
  functionName: string,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T>

// Log Supabase/Postgrest errors
logSupabaseError(
  source: string,
  functionName: string,
  operation: string,
  error: { message?: string; code?: string; details?: string; hint?: string } | null,
  context?: Record<string, unknown>
): Promise<void>

// Log HTTP/API errors with response details
logHttpError(
  source: string,
  functionName: string,
  operation: string,
  url: string,
  statusCode: number,
  responseBody?: string,
  responseHeaders?: Record<string, string>,
  context?: Record<string, unknown>
): Promise<void>

// Log network/fetch errors
logFetchError(
  source: string,
  functionName: string,
  url: string,
  error: Error | { message?: string; status?: number },
  context?: Record<string, unknown>
): Promise<void>

// Log warnings (non-fatal issues)
logWarning(
  source: string,
  functionName: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void>

// Log info (important operations)
logInfo(
  source: string,
  functionName: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void>
```

## Where Logs Go

All logs are stored in the `error_logs` table with:
- **level**: debug, info, warn, error, fatal
- **source**: edge function name
- **function_name**: specific function within the source
- **message**: error/info message
- **error_code**: HTTP status or database error code
- **error_type**: PostgrestError, FetchError, HttpError, etc.
- **stack_trace**: JavaScript stack trace (for errors)
- **context**: JSON object with additional debug info
- **created_at**: timestamp

Critical errors (level: error or fatal) are also sent to Slack if configured.

## Common Patterns

### Pattern 1: Database Query
```typescript
const { data, error } = await supabase.from("table").select("*");
if (error) {
  await logSupabaseError('source', 'function', 'operation', error, { context });
  throw new Error(error.message);
}
```

### Pattern 2: API Call
```typescript
const response = await fetch(url, options);
if (!response.ok) {
  await logHttpError('source', 'function', 'operation', url, response.status, await response.text());
  throw new Error(`API error: ${response.status}`);
}
```

### Pattern 3: Retry Logic
```typescript
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    // ... operation
    break; // Success
  } catch (error) {
    if (attempt === maxRetries) {
      await logFetchError('source', 'function', url, error, { attempts: attempt + 1 });
      throw error;
    }
    // Retry
  }
}
```

## Best Practices

1. ✅ **Always check for errors** from Supabase and fetch calls
2. ✅ **Include relevant context** (IDs, counts, attempt numbers)
3. ✅ **Use descriptive operation names** ("Fetch user profile" not "Query")
4. ✅ **Log before throwing** to capture context before the stack unwinds
5. ✅ **Use appropriate log levels** (error for failures, warn for issues, info for milestones)
6. ❌ **Never log sensitive data** (passwords, tokens, PII)
7. ❌ **Don't log in hot loops** (rate-limited, high-frequency operations)
8. ❌ **Don't silence errors** - log then rethrow or handle appropriately

## Testing

To verify your logging works:

1. Trigger an error scenario (invalid input, missing data, etc.)
2. Check Supabase Dashboard → Database → `error_logs` table
3. Verify the error was logged with correct details
4. Check Slack for critical error notifications
5. Test happy path to ensure no false alarms

## Need Help?

- **Template**: `supabase/functions/_templates/edge-function-template.ts`
- **Full Checklist**: `supabase/functions/_templates/ERROR_LOGGING_CHECKLIST.md`
- **Examples**: See `run-scraper`, `scrape-coordinator`, `google-calendar-auth`
- **Source Code**: `supabase/functions/_shared/errorLogging.ts`

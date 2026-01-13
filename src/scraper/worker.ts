/**
 * Scraper worker that orchestrates per-source fetches.
 * Handles rate limiting, retries, state management, and alerting.
 */

import Bottleneck from 'bottleneck';
import { DEFAULTS, getConfig } from '../config/defaults';
import { Source, getScrapeState, upsertScrapeState, insertScrapeEvent, ScrapeEvent, ScrapeState } from '../lib/supabase';
import { fetchUrl, FetchResult, isTransientError } from './fetcher';
import { getRetryDelay, sleep } from '../lib/backoff';
import { isAllowed, getMinDelay } from '../lib/robots';
import { handleAlert } from '../lib/alert/slack';

export interface WorkerOptions {
  runId: string;
  dryRun?: boolean;
}

export interface ScrapeSummary {
  source_id: string;
  url: string;
  success: boolean;
  http_status: number | null;
  attempts: number;
  error?: string;
}

/**
 * Create a rate limiter for a domain
 */
function createRateLimiter(
  domain: string,
  requestsPerMinute: number = DEFAULTS.RATE_PER_DOMAIN_RPM,
  concurrency: number = DEFAULTS.PER_DOMAIN_CONCURRENCY
): Bottleneck {
  const minTime = Math.ceil(60000 / requestsPerMinute); // ms between requests
  
  return new Bottleneck({
    maxConcurrent: concurrency,
    minTime,
    reservoir: requestsPerMinute, // initial tokens
    reservoirRefreshAmount: requestsPerMinute,
    reservoirRefreshInterval: 60000, // refill every minute
  });
}

/**
 * Scrape a single source with retries
 */
async function scrapeSource(
  source: Source,
  options: WorkerOptions,
  limiter: Bottleneck
): Promise<ScrapeSummary> {
  const { runId, dryRun = false } = options;
  const config = getConfig();
  const userAgent = config.userAgent;
  
  console.log(`\n📍 Scraping source: ${source.source_id}`);
  console.log(`   URL: ${source.url}`);
  
  // Check robots.txt
  const allowed = await isAllowed(source.domain, source.url, userAgent);
  if (!allowed) {
    const error = 'Disallowed by robots.txt';
    console.log(`   ⊘ ${error}`);
    
    if (!dryRun) {
      await insertScrapeEvent({
        run_id: runId,
        source_id: source.source_id,
        url: source.url,
        http_status: null,
        success: false,
        error,
      });
    }
    
    return {
      source_id: source.source_id,
      url: source.url,
      success: false,
      http_status: null,
      attempts: 0,
      error,
    };
  }
  
  // Get minimum delay from robots.txt
  const minDelay = await getMinDelay(source.domain, userAgent);
  console.log(`   ⏱️  Min delay: ${minDelay}ms (from robots.txt or default)`);
  
  // Get previous state
  const previousState = dryRun ? null : await getScrapeState(source.source_id);
  
  let lastResult: FetchResult | null = null;
  let attempts = 0;
  const maxAttempts = DEFAULTS.MAX_RETRY_ATTEMPTS;
  
  // Retry loop
  while (attempts < maxAttempts) {
    attempts++;
    
    // Use rate limiter to respect concurrency and rate limits
    await limiter.schedule(async () => {
      // Add jitter to base delay
      const jitter = Math.floor(Math.random() * DEFAULTS.REQUEST_JITTER_MS);
      const delay = Math.max(minDelay + jitter, DEFAULTS.BASE_REQUEST_DELAY_MS);
      
      if (attempts > 1) {
        console.log(`   🔄 Retry attempt ${attempts}/${maxAttempts}`);
      }
      
      // Apply delay (except for first attempt)
      if (attempts > 1 && lastResult) {
        const retryDelay = getRetryDelay(
          attempts - 2, // 0-indexed for backoff calculation
          lastResult.retry_after?.toString()
        );
        console.log(`   ⏳ Waiting ${retryDelay}ms before retry...`);
        await sleep(retryDelay);
      }
      
      // Perform fetch
      lastResult = await fetchUrl({
        url: source.url,
        userAgent,
        etag: previousState?.last_etag || undefined,
        lastModified: previousState?.last_last_modified || undefined,
      });
    });
    
    // Log event
    if (!dryRun && lastResult) {
      await insertScrapeEvent({
        run_id: runId,
        source_id: source.source_id,
        url: source.url,
        http_status: lastResult.http_status,
        success: lastResult.success,
        etag: lastResult.etag,
        last_modified: lastResult.last_modified,
        body: lastResult.body,
        error: lastResult.error,
        headers: lastResult.headers,
        raw_response_summary: lastResult.raw_response_summary,
      });
    }
    
    // Check result
    if (lastResult && lastResult.success) {
      console.log(`   ✓ Success: ${lastResult.http_status} ${lastResult.status_text || ''}`);
      break;
    }
    
    if (lastResult && !isTransientError(lastResult)) {
      console.log(`   ✗ Non-transient error: ${lastResult.error}`);
      break;
    }
    
    console.log(`   ⚠️  Transient error: ${lastResult?.error || 'unknown'}`);
  }
  
  // Update state
  const now = new Date().toISOString();
  const success = lastResult?.success || false;
  const consecutiveFailures = success ? 0 : (previousState?.consecutive_failures || 0) + 1;
  
  if (!dryRun) {
    const newState: ScrapeState = {
      source_id: source.source_id,
      last_run_at: now,
      last_http_status: lastResult?.http_status || null,
      consecutive_failures: consecutiveFailures,
    };
    
    if (success) {
      newState.last_success_at = now;
      newState.last_etag = lastResult?.etag || null;
      newState.last_last_modified = lastResult?.last_modified || null;
    }
    
    await upsertScrapeState(newState);
  }
  
  // Handle alerting
  if (!success && consecutiveFailures >= config.maxConsecutiveFailures) {
    const alerted = await handleAlert(
      source.source_id,
      source.url,
      runId,
      consecutiveFailures,
      config.maxConsecutiveFailures,
      config.alertSuppressionMs,
      dryRun
    );
    
    if (alerted && !dryRun) {
      // Update last_alert_at
      await upsertScrapeState({
        source_id: source.source_id,
        last_alert_at: now,
      });
    }
  }
  
  return {
    source_id: source.source_id,
    url: source.url,
    success,
    http_status: lastResult?.http_status || null,
    attempts,
    error: lastResult?.error,
  };
}

/**
 * Run scraper for all sources
 */
export async function runScraper(
  sources: Source[],
  options: WorkerOptions
): Promise<ScrapeSummary[]> {
  console.log(`\n🚀 Starting scraper run: ${options.runId}`);
  console.log(`   Sources: ${sources.length}`);
  console.log(`   Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
  
  // Group sources by domain
  const domainGroups = new Map<string, Source[]>();
  for (const source of sources) {
    const domain = source.domain;
    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain)!.push(source);
  }
  
  console.log(`   Domains: ${domainGroups.size}`);
  
  // Create rate limiters per domain
  const limiters = new Map<string, Bottleneck>();
  for (const [domain, domainSources] of domainGroups) {
    const firstSource = domainSources[0];
    const rpm = firstSource.rate_limit?.requests_per_minute || DEFAULTS.RATE_PER_DOMAIN_RPM;
    const concurrency = firstSource.rate_limit?.concurrency || DEFAULTS.PER_DOMAIN_CONCURRENCY;
    
    limiters.set(domain, createRateLimiter(domain, rpm, concurrency));
  }
  
  // Process domains in parallel (up to global limit)
  const globalLimiter = new Bottleneck({
    maxConcurrent: DEFAULTS.GLOBAL_PARALLEL_DOMAINS,
  });
  
  const results: ScrapeSummary[] = [];
  
  await Promise.all(
    sources.map(source =>
      globalLimiter.schedule(async () => {
        const limiter = limiters.get(source.domain)!;
        const summary = await scrapeSource(source, options, limiter);
        results.push(summary);
      })
    )
  );
  
  // Print summary
  console.log(`\n📊 Scraper run complete`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Success: ${results.filter(r => r.success).length}`);
  console.log(`   Failed: ${results.filter(r => !r.success).length}`);
  
  return results;
}

/**
 * Default configuration values and environment variable names
 * for the defensive scheduled scraper.
 */

export const DEFAULTS = {
  // Rate limiting
  PER_DOMAIN_CONCURRENCY: 1,
  GLOBAL_PARALLEL_DOMAINS: 3,
  BASE_REQUEST_DELAY_MS: 2000,
  REQUEST_JITTER_MS: 2000,
  RATE_PER_DOMAIN_RPM: 12, // ~1 request every 5s

  // Retry & backoff
  MAX_RETRY_ATTEMPTS: 5,
  BACKOFF_BASE_MS: 1000,
  BACKOFF_CAP_MS: 300000, // 5 minutes

  // Alerting
  MAX_CONSECUTIVE_FAILURES: 3,
  ALERT_SUPPRESSION_MS: 1800000, // 30 minutes

  // Robots.txt
  ROBOTS_CACHE_TTL_MS: 86400000, // 24 hours
  
  // Body truncation (for storage)
  MAX_BODY_LENGTH: 50000, // 50KB
} as const;

export const ENV_VARS = {
  // Required
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_KEY: 'SUPABASE_KEY',
  SLACK_WEBHOOK_URL: 'SLACK_WEBHOOK_URL',
  
  // Optional with defaults
  SCRAPER_USER_AGENT: 'SCRAPER_USER_AGENT',
  MAX_CONSECUTIVE_FAILURES: 'MAX_CONSECUTIVE_FAILURES',
  ALERT_SUPPRESSION_MS: 'ALERT_SUPPRESSION_MS',
  ROBOTS_CACHE_TTL: 'ROBOTS_CACHE_TTL',
  DRY_RUN: 'DRY_RUN',
  SCRAPER_CRON: 'SCRAPER_CRON',
} as const;

export const DEFAULT_USER_AGENT = 'LCL-Local/1.0 (+https://github.com/wesleykoot-jpg/LCL-Local; contact@lcl-local.com)';

/**
 * Get configuration from environment with fallback to defaults
 */
export function getConfig() {
  return {
    supabaseUrl: process.env[ENV_VARS.SUPABASE_URL] || '',
    supabaseKey: process.env[ENV_VARS.SUPABASE_KEY] || '',
    slackWebhookUrl: process.env[ENV_VARS.SLACK_WEBHOOK_URL] || '',
    userAgent: process.env[ENV_VARS.SCRAPER_USER_AGENT] || DEFAULT_USER_AGENT,
    maxConsecutiveFailures: parseInt(process.env[ENV_VARS.MAX_CONSECUTIVE_FAILURES] || String(DEFAULTS.MAX_CONSECUTIVE_FAILURES)),
    alertSuppressionMs: parseInt(process.env[ENV_VARS.ALERT_SUPPRESSION_MS] || String(DEFAULTS.ALERT_SUPPRESSION_MS)),
    robotsCacheTtl: parseInt(process.env[ENV_VARS.ROBOTS_CACHE_TTL] || String(DEFAULTS.ROBOTS_CACHE_TTL_MS)),
    dryRun: process.env[ENV_VARS.DRY_RUN] === 'true' || process.env[ENV_VARS.DRY_RUN] === '1',
  };
}

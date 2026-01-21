/**
 * Canonical Type Definitions for LCL Scraper Pipeline v2.0
 * 
 * ALL edge functions MUST import types from this file.
 * DO NOT duplicate these types in other files.
 * 
 * @module _shared/types
 */

// ============================================================================
// RAW EVENT TYPES (from parsing stage)
// ============================================================================

export interface RawEventCard {
  title: string;
  date: string;
  location: string;
  description: string;
  detailUrl: string;
  imageUrl: string | null;
  rawHtml: string;
  categoryHint?: string;
  detailPageTime?: string;
}

// ============================================================================
// STRUCTURED DATA TYPES
// ============================================================================

/**
 * Structured date/time representation for events.
 * Stores dates in UTC for consistent handling across timezones.
 */
export interface StructuredDate {
  /** ISO 8601 string for the start time, in UTC */
  utc_start: string;
  /** ISO 8601 string for the end time (optional), in UTC */
  utc_end?: string;
  /** IANA timezone identifier (e.g., 'Europe/Amsterdam') */
  timezone?: string;
  /** Whether this is an all-day event */
  all_day?: boolean;
}

/**
 * Structured location representation for events.
 * Stores both human-readable name and machine-readable coordinates.
 */
export interface StructuredLocation {
  /** Human-readable location/venue name */
  name: string;
  /** Geographic coordinates */
  coordinates?: {
    lat: number;
    lng: number;
  };
  /** Full address if available */
  address?: string;
  /** Reference to a venue ID if stored separately */
  venue_id?: string;
}

// ============================================================================
// ENRICHED EVENT (ready for database)
// ============================================================================

/**
 * Enriched event ready for database insertion.
 * Contains both structured and legacy fields for backward compatibility.
 */
export interface EnrichedEvent {
  title: string;
  description: string;
  category_key: CategoryKey;  // Changed from category (string)
  event_type: string;
  venue_name: string;
  location: string; // Legacy: POINT(lng lat) format
  event_date: string; // Legacy: ISO timestamp
  event_time: string; // Legacy: HH:MM or descriptive string
  image_url: string | null;
  created_by: string | null;
  status: string;
  source_id: string;
  event_fingerprint: string;
  structured_date?: StructuredDate;
  structured_location?: StructuredLocation;
  organizer?: string;
}

// ============================================================================
// SCRAPER SOURCE TYPES
// ============================================================================

/** Fetcher type determines how pages are retrieved */
export type FetcherType = 'static' | 'puppeteer' | 'playwright' | 'scrapingbee';

/** Source tier for configuration purposes */
export type SourceTier = 'aggregator' | 'venue' | 'general';

/** Preferred extraction method for Data-First pipeline */
export type ExtractionMethod = 'hydration' | 'json_ld' | 'feed' | 'dom' | 'auto';

export interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  requires_render?: boolean;
  fetcher_type?: FetcherType;
  auto_disabled?: boolean;
  consecutive_failures?: number;
  consecutive_errors?: number;
  last_probe_urls?: Record<string, unknown>;
  language?: string;
  country?: string;
  default_coordinates?: { lat: number; lng: number };
  volatility_score?: number;
  last_scraped_at?: string | null;
  next_scrape_at?: string | null;
  /** Source tier: aggregator (Tier 1), venue (Tier 2), general (Tier 3) */
  tier?: SourceTier;
  /** Preferred extraction method: auto runs waterfall, specific values skip lower-priority methods */
  preferred_method?: ExtractionMethod;
  /** Whether to fetch detail pages for additional data */
  deep_scrape_enabled?: boolean;
  /** Auto-detected CMS platform */
  detected_cms?: string;
  /** Version of detected framework if available */
  detected_framework_version?: string;
  /** Delta-detection: hash of last payload */
  last_payload_hash?: string;
  /** Delta-detection: count of skipped runs */
  total_savings_prevented_runs?: number;
  config: {
    selectors?: string[];
    headers?: Record<string, string>;
    rate_limit_ms?: number;
    default_coordinates?: { lat: number; lng: number };
    language?: string;
    country?: string;
    dynamic_year?: boolean;
    discoveryAnchors?: string[];
    alternatePaths?: string[];
    requires_render?: boolean;
    dynamic_rate_limit_ms?: number;
    rate_limit_expires_at?: string;
    // ScrapingBee specific config
    scrapingbee_api_key?: string;
    // Puppeteer/Playwright specific config
    headless?: boolean;
    wait_for_selector?: string;
    wait_for_timeout?: number;
    feed_discovery?: boolean;
  };
}

// ============================================================================
// CIRCUIT BREAKER TYPES
// ============================================================================

/** Circuit breaker states */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerState {
  source_id: string;
  state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  opened_at: string | null;
  cooldown_until: string | null;
  consecutive_opens: number;
}

// ============================================================================
// PIPELINE JOB TYPES
// ============================================================================

/** Pipeline stages in order of execution */
export type PipelineStage = 'fetch' | 'parse' | 'normalize' | 'persist' | 'completed' | 'dead_letter';

/** Status of each stage */
export type StageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface PipelineJob {
  id: string;
  run_id: string;
  source_id: string;
  current_stage: PipelineStage;
  stage_status: Record<PipelineStage, StageStatus>;
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// ============================================================================
// SCRAPE JOB PAYLOAD TYPES
// ============================================================================

export interface ScrapeJobPayload {
  sourceId: string;
  scheduledAt: string;
  proxyRetry?: boolean;
}

// ============================================================================
// RAW PAGE TYPES (fetch stage output)
// ============================================================================

export interface RawPage {
  id: string;
  job_id: string;
  source_id: string;
  url: string;
  final_url?: string;
  html?: string;
  status_code?: number;
  fetcher_used?: FetcherType;
  fetch_duration_ms?: number;
  content_hash?: string;
  created_at: string;
}

// ============================================================================
// RAW EVENT TYPES (parse stage output)
// ============================================================================

export type RawEventStatus = 'pending' | 'normalized' | 'failed' | 'skipped';

export interface RawEvent {
  id: string;
  job_id: string;
  page_id: string;
  source_id: string;
  raw_title?: string;
  raw_date?: string;
  raw_time?: string;
  raw_location?: string;
  raw_description?: string;
  detail_url?: string;
  image_url?: string;
  raw_html?: string;
  parse_strategy?: string;
  confidence_score?: number;
  status: RawEventStatus;
  error_message?: string;
  created_at: string;
}

export interface NormalizedEvent {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  image_url: string | null;
  venue_name: string;
  venue_address?: string;
  category_key: CategoryKey;  // Changed from internal_category
  detail_url?: string | null;
  persona_tags?: string[];
}

// ============================================================================
// STAGED EVENT TYPES (normalize stage output)
// ============================================================================

export type StagedEventStatus = 'pending' | 'persisted' | 'duplicate' | 'failed';
export type NormalizationMethod = 'rules' | 'ai' | 'hybrid';

export interface StagedEvent {
  id: string;
  job_id: string;
  raw_event_id: string;
  source_id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  venue_name?: string;
  location?: string;  // PostGIS POINT format
  category?: string;
  image_url?: string;
  structured_date?: StructuredDate;
  structured_location?: StructuredLocation;
  event_fingerprint: string;
  confidence_score?: number;
  normalization_method?: NormalizationMethod;
  status: StagedEventStatus;
  error_message?: string;
  created_at: string;
}

// ============================================================================
// DEAD LETTER QUEUE TYPES
// ============================================================================

export type DLQStage = 'fetch' | 'parse' | 'normalize' | 'persist' | 'discovery';
export type DLQStatus = 'pending' | 'retrying' | 'resolved' | 'discarded';

export interface DeadLetterItem {
  id: string;
  original_job_id?: string;
  source_id?: string;
  stage: DLQStage;
  error_type?: string;
  error_message?: string;
  error_stack?: string;
  payload?: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  status: DLQStatus;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

// ============================================================================
// PAGE FETCHER TYPES (unified interface)
// ============================================================================

export interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  headers?: Record<string, string>;
  fetchDurationMs?: number;
}

export interface PageFetcher {
  /**
   * Fetches a page and returns its HTML content along with metadata.
   * Implementations MUST handle:
   * - Retry with exponential backoff
   * - Timeout (default 15s)
   * - Redirect following
   * - User-agent spoofing
   */
  fetchPage(url: string): Promise<FetchResult>;
}

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

// ============================================================================
// SOURCE HEALTH STATUS (view type)
// ============================================================================

export interface SourceHealthStatus extends ScraperSource {
  circuit_state: CircuitState;
  circuit_failure_count: number;
  circuit_success_count: number;
  cooldown_until?: string;
  circuit_last_failure?: string;
  circuit_last_success?: string;
  is_available: boolean;
  priority_score: number;
}

// ============================================================================
// INTERNAL CATEGORY TYPES
// ============================================================================

/**
 * Language-agnostic category keys (uppercase)
 * These map to the database enum scraper.event_category_key
 * Display labels are handled in the frontend localization layer
 */
export type CategoryKey = 
  | 'MUSIC' 
  | 'SOCIAL' 
  | 'ACTIVE' 
  | 'CULTURE' 
  | 'FOOD'
  | 'NIGHTLIFE' 
  | 'FAMILY' 
  | 'CIVIC' 
  | 'COMMUNITY';

export const CATEGORY_KEYS: CategoryKey[] = [
  'MUSIC',
  'SOCIAL',
  'ACTIVE',
  'CULTURE',
  'FOOD',
  'NIGHTLIFE',
  'FAMILY',
  'CIVIC',
  'COMMUNITY'
];

// Legacy type for backward compatibility during migration
/** @deprecated Use CategoryKey instead */
export type InternalCategory = CategoryKey | 'active' | 'gaming' | 'entertainment' | 'social' | 'family' | 'outdoors' | 'music' | 'workshops' | 'foodie' | 'community';

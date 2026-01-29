/**
 * Social Graph Intelligence Pipeline - Type Definitions
 * 
 * Comprehensive type definitions for the waterfall pipeline.
 * 
 * @module _shared/sgTypes
 */

// ============================================================================
// ENUMS (mirror database enums)
// ============================================================================

export type PipelineStage = 
  | 'discovered'
  | 'analyzing'
  | 'awaiting_fetch'
  | 'fetching'
  | 'cleaning'
  | 'extracting'
  | 'validating'
  | 'enriching'
  | 'deduplicating'
  | 'ready_to_persist'
  | 'vectorizing'
  | 'indexed'
  | 'geo_incomplete'
  | 'quarantined'
  | 'failed';

export type SourceTier = 
  | 'tier_1_metropolis'
  | 'tier_2_regional'
  | 'tier_3_hyperlocal';

export type DiscoveryMethod = 
  | 'serper_search'
  | 'api_webhook'
  | 'seed_list'
  | 'internal_link'
  | 'sitemap';

export type FailureLevel = 
  | 'transient'
  | 'source_drift'
  | 'repair_failure'
  | 'systemic';

// ============================================================================
// DATA CONTRACTS
// ============================================================================

/**
 * Target URL discovered by Scout
 */
export interface TargetURL {
  url: string;
  source_tier: SourceTier;
  discovered_at: string;
  discovery_method: DiscoveryMethod;
  priority: number; // 1-100, higher = process sooner
  city?: string;
  serper_query?: string;
}

/**
 * Fetch Strategy determined by Strategist
 */
export interface FetchStrategy {
  fetcher: 'static' | 'playwright' | 'browserless';
  wait_for?: string; // CSS selector to wait for
  timeout_ms?: number;
  anti_bot?: boolean;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

/**
 * Social Five + Location - Core event data model
 */
export interface SocialEvent {
  // The Social Five
  what: {
    title: string;
    description: string;
    category: string;
    tags: string[];
  };
  when: {
    start_datetime: string; // ISO 8601 with timezone
    end_datetime?: string;  // ISO 8601 with timezone
    is_all_day?: boolean;   // True for all-day events
    is_multi_day?: boolean; // True for multi-day festivals
    is_recurring: boolean;
    recurrence_pattern?: string;
    timezone: string;
  };
  where: {
    venue_name: string;
    address: string;
    city: string;
    country_code: string;
    postal_code?: string;
    lat?: number;
    lng?: number;
    google_maps_link?: string;
  };
  who: {
    organizer_name?: string;
    organizer_url?: string;
    expected_attendance?: number;
    target_audience?: string[];
  };
  vibe: {
    interaction_mode: 'active' | 'passive' | 'mixed';
    energy_level: 'chill' | 'moderate' | 'high';
    social_context: string[];
    expat_friendly: boolean;
    language: string;
  };

  // Additional metadata
  source_url: string;
  detail_url?: string;
  image_url?: string;
  ticket_url?: string;
  price_info?: string;
  is_free?: boolean;
  
  // Quality metrics
  extraction_confidence: number; // 0-1
  data_completeness: number; // 0-1
}

/**
 * Geocode result from Nominatim
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  place_type: string;
  importance: number;
  raw_response: Record<string, unknown>;
  cached: boolean;
}

/**
 * Serper search result
 */
export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

/**
 * Pipeline queue item
 */
export interface QueueItem {
  id: string;
  source_id: string;
  source_url: string;
  detail_url?: string;
  stage: PipelineStage;
  priority: number;
  raw_html?: string;
  cleaned_markdown?: string;
  extracted_data?: SocialEvent;
  lat?: number;
  lng?: number;
  failure_count: number;
  failure_level?: FailureLevel;
  discovered_at: string;
}

/**
 * Source configuration
 */
export interface SGSource {
  id: string;
  name: string;
  url: string;
  domain: string;
  tier: SourceTier;
  discovery_method: DiscoveryMethod;
  city?: string;
  country_code: string;
  fetch_strategy: FetchStrategy;
  extraction_config: Record<string, unknown>;
  reliability_score: number;
  consecutive_failures: number;
  enabled: boolean;
  quarantined: boolean;
}

// ============================================================================
// FUNCTION RESPONSES
// ============================================================================

export interface ScoutResponse {
  success: boolean;
  urls_discovered: number;
  sources_created: number;
  queries_used: number;
  errors: string[];
}

export interface StrategistResponse {
  success: boolean;
  items_analyzed: number;
  items_ready: number;
  errors: string[];
}

export interface CuratorResponse {
  success: boolean;
  items_processed: number;
  items_enriched: number;
  items_failed: number;
  geo_incomplete: number;
  errors: string[];
}

export interface VectorizerResponse {
  success: boolean;
  items_vectorized: number;
  items_persisted: number;
  errors: string[];
}

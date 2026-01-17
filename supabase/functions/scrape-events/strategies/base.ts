/**
 * Base Scraper Strategy - Abstract class and interfaces for the Aggregator Pattern
 * 
 * This module provides the foundation for all specialized scraper strategies.
 * Each strategy (sports, music, nightlife, culture, dining) extends this base
 * to implement domain-specific scraping logic.
 * 
 * @module strategies/base
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Time mode for events - determines how event timing is displayed/handled
 */
export type TimeMode = 'fixed' | 'window' | 'recurring';

/**
 * Configuration for a scraper source
 */
export interface ScraperConfig {
  /** Unique name for this scraper */
  name: string;
  /** Base URL to scrape */
  url: string;
  /** Cron expression for scheduling (e.g., "0 0 * * *" for daily at midnight) */
  schedule: string;
  /** Whether this scraper is active */
  enabled: boolean;
  /** Default category for events from this source */
  category: string;
  /** Default time mode for events (fixed, window, recurring) */
  defaultTimeMode: TimeMode;
  /** Optional rate limit in milliseconds between requests */
  rateLimitMs?: number;
  /** Optional custom headers for requests */
  headers?: Record<string, string>;
  /** Optional selectors for parsing */
  selectors?: string[];
}

/**
 * Raw scraped event data before database insertion
 */
export interface ScrapedEvent {
  /** Event title/name */
  name: string;
  /** Event description */
  description?: string;
  /** Start time in ISO 8601 format */
  start_time?: string;
  /** End time in ISO 8601 format */
  end_time?: string;
  /** Venue/location name */
  venue_name?: string;
  /** City where event takes place */
  city?: string;
  /** Full address */
  address?: string;
  /** URL to purchase tickets */
  ticket_url?: string;
  /** Event website URL */
  website_url?: string;
  /** Price range (e.g., "€", "€€", "€€€" or "€25 - €85") */
  price_range?: string;
  /** Image URL for the event */
  image_url?: string;
  /** Event category (music, sports, etc.) */
  category: string;
  /** Original source URL where event was scraped from */
  source_url: string;
  /** Time mode: fixed (specific time), window (opening hours), recurring */
  time_mode?: TimeMode;
  /** Coordinates for the venue */
  coordinates?: { lat: number; lng: number };
  /** Raw HTML for debugging/reprocessing */
  raw_html?: string;
}

/**
 * Result of running a scraper
 */
export interface ScraperRunResult {
  /** Number of events successfully processed */
  success: number;
  /** Number of events that failed to process */
  failed: number;
  /** Number of duplicate events skipped */
  skipped: number;
  /** Error message if scraper failed */
  error?: string;
}

/**
 * Deduplication result
 */
export interface DedupeResult {
  /** Existing event ID if found, null if new */
  existingId: string | null;
  /** Whether the existing event needs updating */
  needsUpdate: boolean;
}

// ============================================================================
// USER AGENT ROTATION
// ============================================================================

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ============================================================================
// BASE SCRAPER STRATEGY
// ============================================================================

/**
 * Abstract base class for all scraper strategies.
 * 
 * Each specialized strategy (sports, music, etc.) extends this class
 * and implements the abstract methods for domain-specific scraping.
 */
export abstract class BaseScraperStrategy {
  protected supabase: SupabaseClient;
  protected config: ScraperConfig;
  
  /** Maximum retries for fetch operations */
  protected maxRetries = 3;
  /** Base delay for exponential backoff in ms */
  protected baseDelayMs = 1000;
  /** Maximum delay cap in ms */
  protected maxDelayMs = 30000;

  constructor(supabase: SupabaseClient, config: ScraperConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Scrape events from the configured source
   * @returns Array of scraped events
   */
  abstract scrape(): Promise<ScrapedEvent[]>;

  /**
   * Parse event list from HTML content
   * @param html - Raw HTML content
   * @returns Array of scraped events
   */
  abstract parseEventList(html: string): ScrapedEvent[];

  // ============================================================================
  // SHARED UTILITIES
  // ============================================================================

  /**
   * Fetch URL with User-Agent rotation, rate limiting, and retry logic
   * @param url - URL to fetch
   * @returns HTML content as string
   */
  async fetch(url: string): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Rate limiting delay
        if (this.config.rateLimitMs) {
          await this.delay(this.config.rateLimitMs);
        }

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": getRandomUserAgent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en,nl;q=0.9,de;q=0.8",
            ...this.config.headers,
          },
          signal: AbortSignal.timeout(15000),
        });

        // Handle rate limiting (429) and server errors (5xx)
        if (response.status === 429 || response.status >= 500) {
          const delay = this.calculateBackoff(attempt);
          console.warn(`Received ${response.status} for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries + 1})`);
          await this.delay(delay);
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          console.warn(`Fetch error for ${url}, retrying in ${delay}ms: ${lastError.message}`);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${this.maxRetries + 1} attempts`);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  protected calculateBackoff(attempt: number): number {
    const delay = Math.min(this.baseDelayMs * Math.pow(2, attempt), this.maxDelayMs);
    const jitter = delay * 0.2 * Math.random();
    return Math.round(delay + jitter);
  }

  /**
   * Promise-based delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process scraped events: validate, deduplicate, and insert/update
   * @param scrapedEvents - Array of scraped events
   */
  async processEvents(scrapedEvents: ScrapedEvent[]): Promise<{ success: number; failed: number; skipped: number }> {
    const stats = { success: 0, failed: 0, skipped: 0 };

    for (const event of scrapedEvents) {
      try {
        // Validate event
        const validationError = this.validateEvent(event);
        if (validationError) {
          console.warn(`Validation failed for "${event.name}": ${validationError}`);
          stats.failed++;
          continue;
        }

        // Check for duplicates
        const dedupeResult = await this.deduplicateEvent(event);
        
        if (dedupeResult.existingId) {
          if (dedupeResult.needsUpdate) {
            // Update existing event
            await this.updateEvent(dedupeResult.existingId, event);
            stats.success++;
          } else {
            // Skip identical event
            stats.skipped++;
          }
        } else {
          // Insert new event
          await this.insertEvent(event);
          stats.success++;
        }
      } catch (error) {
        console.error(`Error processing event "${event.name}":`, error);
        stats.failed++;
        // Continue to next event - don't crash on single event failure
      }
    }

    return stats;
  }

  /**
   * Validate event data before insertion
   * @returns Error message if invalid, null if valid
   */
  protected validateEvent(event: ScrapedEvent): string | null {
    if (!event.name || event.name.trim().length < 3) {
      return "Event name is required and must be at least 3 characters";
    }
    if (!event.city) {
      return "City is required";
    }
    if (event.start_time && !this.isValidISODate(event.start_time)) {
      return "Invalid start_time format (expected ISO 8601)";
    }
    if (event.ticket_url && !this.isValidUrl(event.ticket_url)) {
      return "Invalid ticket_url format";
    }
    return null;
  }

  /**
   * Check if string is valid ISO 8601 date
   */
  protected isValidISODate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Check if string is valid URL
   */
  protected isValidUrl(urlStr: string): boolean {
    try {
      new URL(urlStr);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check database for existing event by source_url or fuzzy match
   * @returns Existing event ID if found, null if new; includes needsUpdate flag
   */
  async deduplicateEvent(event: ScrapedEvent): Promise<DedupeResult> {
    // First: exact match by source_url
    const { data: exactMatch, error: exactError } = await this.supabase
      .from("events")
      .select("id, event_date, description")
      .eq("source_url", event.source_url)
      .limit(1)
      .single();

    if (exactMatch && !exactError) {
      // Check if update is needed (start_time or description changed)
      const needsUpdate = this.hasEventChanged(exactMatch, event);
      return { existingId: exactMatch.id, needsUpdate };
    }

    // Second: fuzzy match by name + start_time (if available)
    if (event.start_time) {
      const startDate = new Date(event.start_time).toISOString().split("T")[0];
      
      const { data: fuzzyMatch, error: fuzzyError } = await this.supabase
        .from("events")
        .select("id, event_date, description")
        .ilike("title", event.name)
        .gte("event_date", `${startDate}T00:00:00`)
        .lte("event_date", `${startDate}T23:59:59`)
        .limit(1)
        .single();

      if (fuzzyMatch && !fuzzyError) {
        const needsUpdate = this.hasEventChanged(fuzzyMatch, event);
        return { existingId: fuzzyMatch.id, needsUpdate };
      }
    }

    return { existingId: null, needsUpdate: false };
  }

  /**
   * Check if event data has changed (for update detection)
   */
  protected hasEventChanged(existing: { event_date?: string; description?: string }, incoming: ScrapedEvent): boolean {
    // Check if start_time changed
    if (incoming.start_time && existing.event_date) {
      const existingDate = new Date(existing.event_date).toISOString();
      const incomingDate = new Date(incoming.start_time).toISOString();
      if (existingDate !== incomingDate) return true;
    }

    // Check if description changed significantly
    if (incoming.description && existing.description) {
      // Simple check: different length or first 100 chars differ
      if (incoming.description.slice(0, 100) !== existing.description.slice(0, 100)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Transform ScrapedEvent to database schema and insert
   */
  async insertEvent(event: ScrapedEvent): Promise<string> {
    const eventInsert = this.transformToDbSchema(event);

    const { data, error } = await this.supabase
      .from("events")
      .insert(eventInsert)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update existing event with new data
   */
  async updateEvent(id: string, event: ScrapedEvent): Promise<void> {
    const updateData = this.transformToDbSchema(event);
    delete (updateData as Record<string, unknown>).created_by;
    delete (updateData as Record<string, unknown>).status;

    const { error } = await this.supabase
      .from("events")
      .update(updateData)
      .eq("id", id);

    if (error) {
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  /**
   * Transform ScrapedEvent to database schema
   */
  protected transformToDbSchema(event: ScrapedEvent): Record<string, unknown> {
    // Build PostGIS POINT from coordinates
    let location = "POINT(0 0)";
    if (event.coordinates) {
      location = `POINT(${event.coordinates.lng} ${event.coordinates.lat})`;
    }

    return {
      title: event.name.trim(),
      description: event.description?.trim() || "",
      category: event.category,
      event_type: "anchor",
      venue_name: event.venue_name || "",
      location,
      event_date: event.start_time || new Date().toISOString(),
      event_time: event.start_time ? new Date(event.start_time).toTimeString().slice(0, 5) : "TBD",
      image_url: event.image_url || null,
      created_by: null,
      status: "published",
      source_url: event.source_url,
      time_mode: event.time_mode || this.config.defaultTimeMode,
      structured_date: event.start_time ? {
        utc_start: event.start_time,
        utc_end: event.end_time,
        timezone: "Europe/Amsterdam",
        all_day: false,
      } : null,
      structured_location: {
        name: event.venue_name || "",
        address: event.address,
        coordinates: event.coordinates,
      },
    };
  }

  /**
   * Standard run loop with logging
   * @returns Results of the scraper run
   */
  async run(): Promise<ScraperRunResult> {
    console.log(`[${this.config.name}] Starting scrape...`);
    const startTime = Date.now();

    try {
      // Scrape events
      const scrapedEvents = await this.scrape();
      console.log(`[${this.config.name}] Scraped ${scrapedEvents.length} events`);

      // Process events (validate, dedupe, insert)
      const stats = await this.processEvents(scrapedEvents);

      const duration = Date.now() - startTime;
      console.log(`[${this.config.name}] Completed in ${duration}ms: ${stats.success} inserted, ${stats.skipped} skipped, ${stats.failed} failed`);

      // Log to scraper_runs table
      await this.logRun("success", stats.success, stats.failed, stats.skipped);

      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${this.config.name}] Scrape failed:`, errorMessage);

      await this.logRun("error", 0, 0, 0, errorMessage);

      return { success: 0, failed: 0, skipped: 0, error: errorMessage };
    }
  }

  /**
   * Log scraper run to database
   */
  protected async logRun(
    status: "success" | "error",
    eventsScraped: number,
    eventsFailed: number,
    eventsSkipped: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabase.from("scraper_runs").insert({
        strategy: this.config.name,
        status,
        events_scraped: eventsScraped,
        events_failed: eventsFailed,
        events_skipped: eventsSkipped,
        error_message: errorMessage || null,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Failed to log scraper run:", error);
    }
  }
}

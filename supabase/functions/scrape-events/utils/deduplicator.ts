/**
 * Event Deduplicator - Prevent duplicate events in database
 * 
 * Uses multiple strategies:
 * 1. Exact match by source_url
 * 2. Fuzzy match by name + start_time + venue
 * 3. Fingerprint-based matching
 * 
 * @module utils/deduplicator
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import type { ScrapedEvent } from "../strategies/base.ts";

/**
 * Result of deduplication check
 */
export interface DeduplicationResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;
  /** Existing event ID if duplicate found */
  existingId: string | null;
  /** Match method used (source_url, fingerprint, fuzzy) */
  matchMethod: "source_url" | "fingerprint" | "fuzzy" | null;
  /** Confidence score for fuzzy matches (0-1) */
  confidence: number;
  /** Whether the existing event should be updated */
  shouldUpdate: boolean;
}

/**
 * Configuration for deduplication
 */
export interface DeduplicationConfig {
  /** Enable source_url exact matching */
  enableSourceUrlMatch: boolean;
  /** Enable fingerprint matching */
  enableFingerprintMatch: boolean;
  /** Enable fuzzy matching */
  enableFuzzyMatch: boolean;
  /** Minimum similarity threshold for fuzzy matching (0-1) */
  fuzzyThreshold: number;
  /** Time window in hours for fuzzy date matching */
  dateWindowHours: number;
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  enableSourceUrlMatch: true,
  enableFingerprintMatch: true,
  enableFuzzyMatch: true,
  fuzzyThreshold: 0.8,
  dateWindowHours: 2,
};

/**
 * Event Deduplicator Class
 * 
 * Provides multiple strategies for detecting duplicate events
 * before insertion into the database.
 */
export class EventDeduplicator {
  private supabase: SupabaseClient;
  private config: DeduplicationConfig;

  constructor(supabase: SupabaseClient, config: Partial<DeduplicationConfig> = {}) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an event is a duplicate
   * @param event - Scraped event to check
   * @param sourceId - Source ID for fingerprint generation
   * @returns Deduplication result
   */
  async checkDuplicate(event: ScrapedEvent, sourceId?: string): Promise<DeduplicationResult> {
    // Strategy 1: Exact source_url match
    if (this.config.enableSourceUrlMatch && event.source_url) {
      const sourceUrlResult = await this.checkBySourceUrl(event.source_url);
      if (sourceUrlResult.isDuplicate) {
        return sourceUrlResult;
      }
    }

    // Strategy 2: Fingerprint match
    if (this.config.enableFingerprintMatch && sourceId) {
      const fingerprint = await this.generateFingerprint(event, sourceId);
      const fingerprintResult = await this.checkByFingerprint(fingerprint, sourceId);
      if (fingerprintResult.isDuplicate) {
        return fingerprintResult;
      }
    }

    // Strategy 3: Fuzzy match by name + date + venue
    if (this.config.enableFuzzyMatch && event.name && event.start_time) {
      const fuzzyResult = await this.checkByFuzzyMatch(event);
      if (fuzzyResult.isDuplicate && fuzzyResult.confidence >= this.config.fuzzyThreshold) {
        return fuzzyResult;
      }
    }

    return {
      isDuplicate: false,
      existingId: null,
      matchMethod: null,
      confidence: 0,
      shouldUpdate: false,
    };
  }

  /**
   * Check for duplicate by exact source_url match
   */
  private async checkBySourceUrl(sourceUrl: string): Promise<DeduplicationResult> {
    const { data, error } = await this.supabase
      .from("events")
      .select("id, event_date, description, updated_at")
      .eq("source_url", sourceUrl)
      .limit(1)
      .single();

    if (error || !data) {
      return { isDuplicate: false, existingId: null, matchMethod: null, confidence: 0, shouldUpdate: false };
    }

    return {
      isDuplicate: true,
      existingId: data.id,
      matchMethod: "source_url",
      confidence: 1.0,
      shouldUpdate: this.shouldUpdate(data),
    };
  }

  /**
   * Check for duplicate by fingerprint
   */
  private async checkByFingerprint(fingerprint: string, sourceId: string): Promise<DeduplicationResult> {
    const { data, error } = await this.supabase
      .from("events")
      .select("id, event_date, description, updated_at")
      .eq("source_id", sourceId)
      .eq("event_fingerprint", fingerprint)
      .limit(1)
      .single();

    if (error || !data) {
      return { isDuplicate: false, existingId: null, matchMethod: null, confidence: 0, shouldUpdate: false };
    }

    return {
      isDuplicate: true,
      existingId: data.id,
      matchMethod: "fingerprint",
      confidence: 1.0,
      shouldUpdate: this.shouldUpdate(data),
    };
  }

  /**
   * Check for duplicate by fuzzy match (name similarity + date proximity + venue)
   */
  private async checkByFuzzyMatch(event: ScrapedEvent): Promise<DeduplicationResult> {
    if (!event.start_time) {
      return { isDuplicate: false, existingId: null, matchMethod: null, confidence: 0, shouldUpdate: false };
    }

    const eventDate = new Date(event.start_time);
    const windowMs = this.config.dateWindowHours * 60 * 60 * 1000;
    const minDate = new Date(eventDate.getTime() - windowMs).toISOString();
    const maxDate = new Date(eventDate.getTime() + windowMs).toISOString();

    // Query events within time window
    const { data, error } = await this.supabase
      .from("events")
      .select("id, title, event_date, venue_name, description, updated_at")
      .gte("event_date", minDate)
      .lte("event_date", maxDate)
      .limit(50);

    if (error || !data || data.length === 0) {
      return { isDuplicate: false, existingId: null, matchMethod: null, confidence: 0, shouldUpdate: false };
    }

    // Find best match by name similarity
    let bestMatch: { id: string; confidence: number; data: Record<string, unknown> } | null = null;

    for (const existing of data) {
      const titleSimilarity = this.calculateSimilarity(
        this.normalizeTitle(event.name),
        this.normalizeTitle(existing.title)
      );

      // Boost score if venue matches
      let venueBonus = 0;
      if (event.venue_name && existing.venue_name) {
        const venueSimilarity = this.calculateSimilarity(
          this.normalizeTitle(event.venue_name),
          this.normalizeTitle(existing.venue_name)
        );
        if (venueSimilarity > 0.8) venueBonus = 0.1;
      }

      const totalConfidence = Math.min(1.0, titleSimilarity + venueBonus);

      if (!bestMatch || totalConfidence > bestMatch.confidence) {
        bestMatch = { id: existing.id, confidence: totalConfidence, data: existing };
      }
    }

    if (bestMatch && bestMatch.confidence >= this.config.fuzzyThreshold) {
      return {
        isDuplicate: true,
        existingId: bestMatch.id,
        matchMethod: "fuzzy",
        confidence: bestMatch.confidence,
        shouldUpdate: this.shouldUpdate(bestMatch.data),
      };
    }

    return { isDuplicate: false, existingId: null, matchMethod: null, confidence: 0, shouldUpdate: false };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * @returns Similarity score between 0 and 1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[str1.length][str2.length];
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")  // Remove punctuation
      .replace(/\s+/g, " ")     // Normalize whitespace
      .trim();
  }

  /**
   * Generate fingerprint for event
   */
  async generateFingerprint(event: ScrapedEvent, sourceId: string): Promise<string> {
    const input = `${event.name}|${event.start_time?.split("T")[0] || ""}|${sourceId}`;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Determine if existing event should be updated
   * Based on staleness of data
   */
  private shouldUpdate(existing: Record<string, unknown>): boolean {
    const updatedAt = existing.updated_at as string | undefined;
    if (!updatedAt) return true;

    // Update if older than 7 days
    const lastUpdate = new Date(updatedAt);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7;
  }

  /**
   * Batch check multiple events for duplicates
   * @param events - Array of events to check
   * @param sourceId - Source ID
   * @returns Map of event index to deduplication result
   */
  async batchCheck(events: ScrapedEvent[], sourceId?: string): Promise<Map<number, DeduplicationResult>> {
    const results = new Map<number, DeduplicationResult>();

    // Collect all source_urls for batch query
    const sourceUrls = events
      .map((e, i) => ({ url: e.source_url, index: i }))
      .filter(e => e.url);

    if (sourceUrls.length > 0) {
      const { data: existingByUrl } = await this.supabase
        .from("events")
        .select("id, source_url")
        .in("source_url", sourceUrls.map(e => e.url));

      if (existingByUrl) {
        const urlMap = new Map(existingByUrl.map(e => [e.source_url, e.id]));
        
        for (const { url, index } of sourceUrls) {
          const existingId = urlMap.get(url);
          if (existingId) {
            results.set(index, {
              isDuplicate: true,
              existingId,
              matchMethod: "source_url",
              confidence: 1.0,
              shouldUpdate: false, // Simplified for batch
            });
          }
        }
      }
    }

    // Check remaining events individually
    for (let i = 0; i < events.length; i++) {
      if (!results.has(i)) {
        const result = await this.checkDuplicate(events[i], sourceId);
        results.set(i, result);
      }
    }

    return results;
  }

  /**
   * Calculate deduplication statistics
   */
  calculateStats(results: Map<number, DeduplicationResult>): {
    total: number;
    duplicates: number;
    unique: number;
    duplicateRate: number;
  } {
    const total = results.size;
    const duplicates = Array.from(results.values()).filter(r => r.isDuplicate).length;
    const unique = total - duplicates;
    const duplicateRate = total > 0 ? duplicates / total : 0;

    return { total, duplicates, unique, duplicateRate };
  }
}

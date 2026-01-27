/**
 * Sports Scraper Strategy
 * 
 * Targets: Eredivisie, Keuken Kampioen Divisie
 * 
 * Logic:
 * - Iterates through league targets
 * - Parses match tables, constructs names like "HomeTeam vs AwayTeam"
 * - Combines date and time columns into ISO start_time
 * - Calculates end_time (start + 105 mins for matches)
 * - Infers city from stadium/venue name using VenueRegistry
 * 
 * @module strategies/sports
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { BaseScraperStrategy, ScraperConfig, ScrapedEvent } from "./base.ts";
import { HTMLParser, parseDate, parseTime, combineDateTime, calculateEndTime } from "../utils/parser.ts";
import { SPORTS_TARGETS, lookupVenue, inferCityFromVenue } from "../config.ts";

// ============================================================================
// SPORTS-SPECIFIC INTERFACES
// ============================================================================

interface MatchData {
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue: string;
  league: string;
  status: "scheduled" | "postponed" | "cancelled";
}

// ============================================================================
// SPORTS STRATEGY
// ============================================================================

export class SportsStrategy extends BaseScraperStrategy {
  private targets: typeof SPORTS_TARGETS;

  constructor(supabase: SupabaseClient, config: ScraperConfig) {
    super(supabase, config);
    this.targets = SPORTS_TARGETS;
  }

  /**
   * Scrape events from all configured sports sources
   */
  async scrape(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];

    for (const [key, target] of Object.entries(this.targets)) {
      console.log(`[sports] Scraping ${target.name}...`);
      
      try {
        const html = await this.fetch(target.url);
        const matches = this.parseMatchList(html, target);
        
        const events = matches
          .filter(match => match.status === "scheduled")
          .map(match => this.transformMatchToEvent(match, target));
        
        console.log(`[sports] Found ${events.length} scheduled matches for ${target.name}`);
        allEvents.push(...events);
      } catch (error) {
        console.error(`[sports] Failed to scrape ${key}:`, error);
        // Continue to next target - don't fail entirely
      }
    }

    return allEvents;
  }

  /**
   * Parse match list from HTML
   */
  parseEventList(html: string): ScrapedEvent[] {
    // Default implementation for the abstract method
    const target = Object.values(this.targets)[0];
    const matches = this.parseMatchList(html, target);
    return matches.map(match => this.transformMatchToEvent(match, target));
  }

  /**
   * Parse match list with target-specific context
   */
  private parseMatchList(html: string, target: typeof SPORTS_TARGETS[keyof typeof SPORTS_TARGETS]): MatchData[] {
    const parser = new HTMLParser(html);
    const matches: MatchData[] = [];

    // Common selectors for Dutch football league websites
    const rowSelectors = [
      ".match-row",
      ".wedstrijd-row",
      "tr.match",
      "[class*='match-item']",
      "[class*='wedstrijd']",
      ".programma-item",
      "table tbody tr",
    ];

    for (const selector of rowSelectors) {
      const elements = parser.findAll(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = parser.findAll(selector).eq(elements.toArray().indexOf(el));
        const rowHtml = $el.html() || "";
        const rowParser = new HTMLParser(rowHtml);

        // Extract team names
        const homeTeam = this.extractTeamName(rowParser, "home");
        const awayTeam = this.extractTeamName(rowParser, "away");

        if (!homeTeam || !awayTeam) return;

        // Extract date and time
        const dateText = rowParser.extractText(".date, .datum, [class*='date'], time");
        const timeText = rowParser.extractText(".time, .tijd, [class*='time'], .aanvang");

        // Extract venue
        const venue = rowParser.extractText(".venue, .stadion, .location, [class*='venue'], [class*='stadium']");

        // Check for postponed/cancelled status
        const statusText = rowParser.extractText(".status, [class*='status']").toLowerCase();
        let status: MatchData["status"] = "scheduled";
        if (statusText.includes("uitgesteld") || statusText.includes("postponed")) {
          status = "postponed";
        } else if (statusText.includes("afgelast") || statusText.includes("cancelled")) {
          status = "cancelled";
        }

        matches.push({
          homeTeam,
          awayTeam,
          date: dateText,
          time: timeText,
          venue,
          league: target.league,
          status,
        });
      });

      if (matches.length > 0) break;
    }

    return matches;
  }

  /**
   * Extract team name from match row
   */
  private extractTeamName(parser: HTMLParser, position: "home" | "away"): string {
    const selectors = position === "home" 
      ? [".home-team", ".thuisclub", "[class*='home']", ".team:first-of-type"]
      : [".away-team", ".uitclub", "[class*='away']", ".team:last-of-type"];

    for (const selector of selectors) {
      const name = parser.extractText(selector);
      if (name && name.length >= 2) {
        return this.normalizeTeamName(name);
      }
    }

    return "";
  }

  /**
   * Normalize team name (remove common suffixes, fix casing)
   */
  private normalizeTeamName(name: string): string {
    return name
      .replace(/\s+(fc|sc|club|vereniging)$/i, "")
      .replace(/^\s+|\s+$/g, "")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Transform match data to ScrapedEvent
   */
  private transformMatchToEvent(
    match: MatchData, 
    target: typeof SPORTS_TARGETS[keyof typeof SPORTS_TARGETS]
  ): ScrapedEvent {
    const eventName = `${match.homeTeam} vs ${match.awayTeam}`;
    
    // Parse date and time
    const parsedDate = parseDate(match.date);
    const parsedTime = parseTime(match.time);
    
    let startTime: string | undefined;
    let endTime: string | undefined;
    
    if (parsedDate) {
      startTime = combineDateTime(parsedDate, parsedTime);
      endTime = calculateEndTime(startTime, target.matchDurationMinutes);
    }

    // Lookup venue in registry
    const venueInfo = lookupVenue(match.venue);
    const city = venueInfo?.city || inferCityFromVenue(match.venue) || "Nederland";
    const coordinates = venueInfo?.coordinates;

    return {
      name: eventName,
      description: `${target.league}: ${match.homeTeam} ontvangt ${match.awayTeam}`,
      start_time: startTime,
      end_time: endTime,
      venue_name: venueInfo?.name || match.venue,
      city,
      address: venueInfo?.address,
      category: this.config.category,
      source_url: target.url,
      time_mode: this.config.defaultTimeMode,
      coordinates,
    };
  }

  /**
   * Handle postponed/rescheduled matches gracefully
   * Returns true if the match should be skipped
   */
  private shouldSkipMatch(match: MatchData): boolean {
    // Skip postponed or cancelled matches
    if (match.status !== "scheduled") {
      console.log(`[sports] Skipping ${match.homeTeam} vs ${match.awayTeam}: ${match.status}`);
      return true;
    }

    // Skip matches without valid dates
    const parsedDate = parseDate(match.date);
    if (!parsedDate) {
      console.log(`[sports] Skipping ${match.homeTeam} vs ${match.awayTeam}: invalid date "${match.date}"`);
      return true;
    }

    return false;
  }
}

/**
 * Factory function to create Sports strategy
 */
export function createSportsStrategy(supabase: SupabaseClient, config: ScraperConfig): SportsStrategy {
  return new SportsStrategy(supabase, config);
}

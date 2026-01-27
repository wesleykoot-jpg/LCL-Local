/**
 * Nightlife Scraper Strategy
 * 
 * Targets: Resident Advisor (Amsterdam), De School, Shelter
 * 
 * Logic:
 * - Crucial: Handles late-night logic (events spanning midnight to next day)
 * - Extracts DJ lineups into the description
 * - Calculates end_time (default to +6 hours if missing)
 * - Scrapes both aggregators and individual venue sites
 * 
 * @module strategies/nightlife
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { BaseScraperStrategy, ScraperConfig, ScrapedEvent } from "./base.ts";
import { HTMLParser, parseDate, parseTime, combineDateTime, handleLateNightEvent } from "../utils/parser.ts";
import { NIGHTLIFE_TARGETS, VENUE_REGISTRY } from "../config.ts";

// ============================================================================
// NIGHTLIFE-SPECIFIC INTERFACES
// ============================================================================

interface ClubEventData {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  lineUp: string[];
  venue?: string;
  ticketUrl?: string;
  imageUrl?: string;
  description?: string;
  sourceUrl: string;
}

// ============================================================================
// NIGHTLIFE STRATEGY
// ============================================================================

export class NightlifeStrategy extends BaseScraperStrategy {
  private targets: typeof NIGHTLIFE_TARGETS;
  private defaultDurationHours = 6;

  constructor(supabase: SupabaseClient, config: ScraperConfig) {
    super(supabase, config);
    this.targets = NIGHTLIFE_TARGETS;
  }

  /**
   * Scrape events from all configured nightlife sources
   */
  async scrape(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];

    for (const [key, target] of Object.entries(this.targets)) {
      console.log(`[nightlife] Scraping ${target.name}...`);
      
      try {
        const html = await this.fetch(target.url);
        const clubEvents = this.parseClubEventList(html, target);
        
        const events = clubEvents.map(event => this.transformClubEventToEvent(event, target));
        
        console.log(`[nightlife] Found ${events.length} events for ${target.name}`);
        allEvents.push(...events);
      } catch (error) {
        console.error(`[nightlife] Failed to scrape ${key}:`, error);
        // Continue to next target
      }
    }

    return allEvents;
  }

  /**
   * Parse event list from HTML (abstract method implementation)
   */
  parseEventList(html: string): ScrapedEvent[] {
    const target = Object.values(this.targets)[0];
    const events = this.parseClubEventList(html, target);
    return events.map(event => this.transformClubEventToEvent(event, target));
  }

  /**
   * Parse club event list with source-specific context
   */
  private parseClubEventList(html: string, target: typeof NIGHTLIFE_TARGETS[keyof typeof NIGHTLIFE_TARGETS]): ClubEventData[] {
    const parser = new HTMLParser(html);
    const events: ClubEventData[] = [];

    // Selectors for club/RA event pages
    const eventSelectors = [
      "[class*='event']",
      ".event",
      ".listing",
      "article",
      "[class*='party']",
      ".programma-item",
    ];

    for (const selector of eventSelectors) {
      const elements = parser.findAll(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = parser.findAll(selector).eq(elements.toArray().indexOf(el));
        const itemHtml = $el.html() || "";
        const itemParser = new HTMLParser(itemHtml);

        // Extract title
        const title = this.extractTitle(itemParser);
        if (!title || title.length < 3) return;

        // Extract date
        const dateText = itemParser.extractText(".date, .datum, time, [datetime], [class*='date']");

        // Extract times
        const startTime = this.extractStartTime(itemParser);
        const endTime = this.extractEndTime(itemParser);

        // Extract lineup
        const lineUp = this.extractLineup(itemParser);

        // Extract venue (for aggregator sites like RA)
        const venue = this.extractVenue(itemParser);

        // Extract ticket URL
        const ticketUrl = this.extractTicketUrl(itemParser, target.url);

        // Extract image
        const imageUrl = itemParser.extractImage("", target.url);

        // Extract detail URL
        const detailUrl = itemParser.extractLink("", target.url);

        events.push({
          title,
          date: dateText,
          startTime,
          endTime,
          lineUp,
          venue,
          ticketUrl,
          imageUrl,
          sourceUrl: detailUrl || target.url,
        });
      });

      if (events.length > 0) break;
    }

    return events;
  }

  /**
   * Extract event title
   */
  private extractTitle(parser: HTMLParser): string {
    const selectors = [
      "h1", "h2", "h3",
      ".title", ".name", ".event-name",
      "[class*='title']", "[class*='name']",
    ];

    for (const selector of selectors) {
      const title = parser.extractText(selector);
      if (title && title.length >= 3) {
        return title.trim();
      }
    }

    return "";
  }

  /**
   * Extract start time
   */
  private extractStartTime(parser: HTMLParser): string | undefined {
    const timeSelectors = [
      ".start", ".start-time", ".begins",
      "[class*='start']", "[class*='begin']",
      ".time", ".tijd",
    ];

    for (const selector of timeSelectors) {
      const text = parser.extractText(selector);
      const parsed = parseTime(text);
      if (parsed) return parsed;
    }

    return undefined;
  }

  /**
   * Extract end time
   */
  private extractEndTime(parser: HTMLParser): string | undefined {
    const selectors = [
      ".end", ".end-time", ".closes",
      "[class*='end']", "[class*='close']",
    ];

    for (const selector of selectors) {
      const text = parser.extractText(selector);
      const parsed = parseTime(text);
      if (parsed) return parsed;
    }

    return undefined;
  }

  /**
   * Extract DJ lineup
   * Returns array of artist names
   */
  private extractLineup(parser: HTMLParser): string[] {
    const lineup: string[] = [];
    const lineupSelectors = [
      ".lineup", ".artists", ".djs", ".performers",
      "[class*='lineup']", "[class*='artist']", "[class*='dj']",
      ".line-up li", ".artists li",
    ];

    // First try to find lineup container
    for (const selector of lineupSelectors) {
      const elements = parser.findAll(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = parser.findAll(selector).eq(elements.toArray().indexOf(el));
        const text = $el.text().trim();
        
        // Split by common separators if it's a single string
        if (text.includes(",") || text.includes(" | ") || text.includes(" • ")) {
          const artists = text.split(/[,|•]/).map(a => a.trim()).filter(a => a.length > 0);
          lineup.push(...artists);
        } else if (text.length > 0 && text.length < 100) {
          lineup.push(text);
        }
      });

      if (lineup.length > 0) break;
    }

    // Deduplicate and limit
    return [...new Set(lineup)].slice(0, 20);
  }

  /**
   * Extract venue name (for aggregator sites)
   */
  private extractVenue(parser: HTMLParser): string | undefined {
    const selectors = [
      ".venue", ".location", ".club",
      "[class*='venue']", "[class*='location']",
    ];

    for (const selector of selectors) {
      const venue = parser.extractText(selector);
      if (venue && venue.length >= 2) {
        return venue.trim();
      }
    }

    return undefined;
  }

  /**
   * Extract ticket URL
   */
  private extractTicketUrl(parser: HTMLParser, baseUrl: string): string | undefined {
    const ticketSelectors = [
      "a[href*='ticket']",
      "a[href*='ra.co/tickets']",
      ".tickets a",
      ".buy a",
      "[class*='ticket'] a",
    ];

    for (const selector of ticketSelectors) {
      const href = parser.extractLink(selector, baseUrl);
      if (href) return href;
    }

    return undefined;
  }

  /**
   * Transform club event to ScrapedEvent
   * Handles late-night time logic
   */
  private transformClubEventToEvent(
    clubEvent: ClubEventData,
    target: typeof NIGHTLIFE_TARGETS[keyof typeof NIGHTLIFE_TARGETS]
  ): ScrapedEvent {
    // Determine venue info
    const venueKey = (target as { venueKey?: string }).venueKey;
    const venueInfo = venueKey ? VENUE_REGISTRY[venueKey] : null;
    
    // Parse date
    const parsedDate = parseDate(clubEvent.date);
    
    let startTime: string | undefined;
    let endTime: string | undefined;
    
    if (parsedDate) {
      // Combine date and start time
      startTime = combineDateTime(parsedDate, clubEvent.startTime || "23:00");
      
      // Handle late-night end time
      if (clubEvent.endTime) {
        endTime = handleLateNightEvent(startTime, clubEvent.endTime);
      } else {
        // Default to 6 hours or target-specific default end time
        const defaultEnd = (target as { defaultEndTime?: string }).defaultEndTime || "06:00";
        endTime = handleLateNightEvent(startTime, defaultEnd);
      }
    }

    // Build description with lineup
    let description = clubEvent.description || "";
    if (clubEvent.lineUp.length > 0) {
      const lineupText = clubEvent.lineUp.join(" • ");
      description = description 
        ? `${description}\n\nLineup: ${lineupText}`
        : `Lineup: ${lineupText}`;
    }

    // Determine city
    let city = venueInfo?.city;
    if (!city && clubEvent.venue) {
      // Try to extract city from venue name
      if (clubEvent.venue.toLowerCase().includes("amsterdam")) {
        city = "Amsterdam";
      } else if (clubEvent.venue.toLowerCase().includes("rotterdam")) {
        city = "Rotterdam";
      }
    }
    city = city || "Amsterdam";

    return {
      name: clubEvent.title,
      description: description.trim(),
      start_time: startTime,
      end_time: endTime,
      venue_name: venueInfo?.name || clubEvent.venue || target.name,
      city,
      address: venueInfo?.address,
      ticket_url: clubEvent.ticketUrl,
      image_url: clubEvent.imageUrl,
      category: this.config.category,
      source_url: clubEvent.sourceUrl,
      time_mode: this.config.defaultTimeMode,
      coordinates: venueInfo?.coordinates,
    };
  }
}

/**
 * Factory function to create Nightlife strategy
 */
export function createNightlifeStrategy(supabase: SupabaseClient, config: ScraperConfig): NightlifeStrategy {
  return new NightlifeStrategy(supabase, config);
}

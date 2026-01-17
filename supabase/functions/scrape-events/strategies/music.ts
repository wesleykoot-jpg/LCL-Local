/**
 * Music Scraper Strategy
 * 
 * Targets: Paradiso, Ziggo Dome, TivoliVredenburg, Melkweg, AFAS Live
 * 
 * Logic:
 * - Scrapes 5+ major venue calendars
 * - Parses "Doors Open" vs "Start Time" - prioritizes Start Time
 * - Pre-populates location from VenueRegistry to skip enrichment costs
 * - Extracts ticket URLs and genre tags (put tags in description)
 * 
 * @module strategies/music
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { BaseScraperStrategy, ScraperConfig, ScrapedEvent } from "./base.ts";
import { HTMLParser, parseDate, parseTime, combineDateTime } from "../utils/parser.ts";
import { MUSIC_TARGETS, VENUE_REGISTRY } from "../config.ts";

// ============================================================================
// MUSIC-SPECIFIC INTERFACES
// ============================================================================

interface ConcertData {
  title: string;
  artist?: string;
  date: string;
  doorsTime?: string;
  startTime?: string;
  genre?: string[];
  ticketUrl?: string;
  imageUrl?: string;
  description?: string;
  sourceUrl: string;
}

// ============================================================================
// MUSIC STRATEGY
// ============================================================================

export class MusicStrategy extends BaseScraperStrategy {
  private targets: typeof MUSIC_TARGETS;

  constructor(supabase: SupabaseClient, config: ScraperConfig) {
    super(supabase, config);
    this.targets = MUSIC_TARGETS;
  }

  /**
   * Scrape events from all configured music venues
   */
  async scrape(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];

    for (const [key, target] of Object.entries(this.targets)) {
      console.log(`[music] Scraping ${target.name}...`);
      
      try {
        const html = await this.fetch(target.url);
        const concerts = this.parseConcertList(html, target);
        
        const events = concerts.map(concert => this.transformConcertToEvent(concert, target));
        
        console.log(`[music] Found ${events.length} concerts for ${target.name}`);
        allEvents.push(...events);
      } catch (error) {
        console.error(`[music] Failed to scrape ${key}:`, error);
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
    const concerts = this.parseConcertList(html, target);
    return concerts.map(concert => this.transformConcertToEvent(concert, target));
  }

  /**
   * Parse concert list with venue-specific context
   */
  private parseConcertList(html: string, target: typeof MUSIC_TARGETS[keyof typeof MUSIC_TARGETS]): ConcertData[] {
    const parser = new HTMLParser(html);
    const concerts: ConcertData[] = [];

    // Common selectors for Dutch concert venue websites
    const eventSelectors = [
      ".event",
      ".agenda-item",
      ".concert",
      "[class*='event-card']",
      "[class*='program-item']",
      ".show",
      "article[class*='event']",
    ];

    for (const selector of eventSelectors) {
      const elements = parser.findAll(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = parser.findAll(selector).eq(elements.toArray().indexOf(el));
        const itemHtml = $el.html() || "";
        const itemParser = new HTMLParser(itemHtml);

        // Extract title/artist
        const title = this.extractTitle(itemParser);
        if (!title || title.length < 3) return;

        // Extract date
        const dateText = itemParser.extractText(".date, .datum, time, [datetime], [class*='date']");

        // Extract times - prioritize start time over doors
        const { doorsTime, startTime } = this.extractTimes(itemParser);

        // Extract genre tags
        const genre = this.extractGenres(itemParser);

        // Extract ticket URL
        const ticketUrl = this.extractTicketUrl(itemParser, target.url);

        // Extract image
        const imageUrl = itemParser.extractImage("", target.url);

        // Extract description
        const description = itemParser.extractText(".description, .excerpt, p, [class*='description']");

        // Extract detail URL for source_url
        const detailUrl = itemParser.extractLink("", target.url);

        concerts.push({
          title,
          date: dateText,
          doorsTime,
          startTime,
          genre,
          ticketUrl,
          imageUrl,
          description,
          sourceUrl: detailUrl || target.url,
        });
      });

      if (concerts.length > 0) break;
    }

    return concerts;
  }

  /**
   * Extract event title
   */
  private extractTitle(parser: HTMLParser): string {
    const selectors = [
      "h1", "h2", "h3",
      ".title", ".name", ".artist",
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
   * Extract doors and start times
   * Prioritizes start time over doors time
   */
  private extractTimes(parser: HTMLParser): { doorsTime?: string; startTime?: string } {
    let doorsTime: string | undefined;
    let startTime: string | undefined;

    // Look for explicit time labels
    const doorsSelectors = [
      ".doors", ".deuren", "[class*='doors']", "[class*='deuren']",
    ];
    const startSelectors = [
      ".start", ".aanvang", ".beginn", "[class*='start']", "[class*='aanvang']",
    ];

    // Extract doors time
    for (const selector of doorsSelectors) {
      const text = parser.extractText(selector);
      const parsed = parseTime(text);
      if (parsed) {
        doorsTime = parsed;
        break;
      }
    }

    // Extract start time
    for (const selector of startSelectors) {
      const text = parser.extractText(selector);
      const parsed = parseTime(text);
      if (parsed) {
        startTime = parsed;
        break;
      }
    }

    // If no explicit start, look for generic time
    if (!startTime && !doorsTime) {
      const timeText = parser.extractText(".time, .tijd, [class*='time'], [class*='tijd']");
      const parsed = parseTime(timeText);
      if (parsed) {
        startTime = parsed;
      }
    }

    return { doorsTime, startTime };
  }

  /**
   * Extract genre tags
   */
  private extractGenres(parser: HTMLParser): string[] {
    const genres: string[] = [];
    const genreSelectors = [
      ".genre", ".tag", ".category", ".label",
      "[class*='genre']", "[class*='tag']", "[class*='category']",
    ];

    for (const selector of genreSelectors) {
      const elements = parser.findAll(selector);
      elements.each((_, el) => {
        const $el = parser.findAll(selector).eq(elements.toArray().indexOf(el));
        const text = $el.text().trim();
        if (text && text.length < 50) {
          genres.push(text);
        }
      });

      if (genres.length > 0) break;
    }

    return genres;
  }

  /**
   * Extract ticket URL
   */
  private extractTicketUrl(parser: HTMLParser, baseUrl: string): string | undefined {
    const ticketSelectors = [
      "a[href*='ticket']",
      "a[href*='kaart']",
      ".tickets a",
      ".buy a",
      "[class*='ticket'] a",
      "a.ticket",
      "a.buy",
    ];

    for (const selector of ticketSelectors) {
      const href = parser.extractLink(selector, baseUrl);
      if (href) return href;
    }

    return undefined;
  }

  /**
   * Transform concert data to ScrapedEvent
   */
  private transformConcertToEvent(
    concert: ConcertData,
    target: typeof MUSIC_TARGETS[keyof typeof MUSIC_TARGETS]
  ): ScrapedEvent {
    // Get venue from registry
    const venueInfo = VENUE_REGISTRY[target.venueKey];

    // Parse date and time - prefer start time over doors
    const parsedDate = parseDate(concert.date);
    const effectiveTime = concert.startTime || concert.doorsTime;
    
    let startTime: string | undefined;
    if (parsedDate) {
      startTime = combineDateTime(parsedDate, effectiveTime || null);
    }

    // Build description with genre tags
    let description = concert.description || "";
    if (concert.genre && concert.genre.length > 0) {
      const genreTags = concert.genre.map(g => `#${g.replace(/\s+/g, "")}`).join(" ");
      description = description ? `${description}\n\nGenres: ${genreTags}` : `Genres: ${genreTags}`;
    }

    // Add doors info if different from start
    if (concert.doorsTime && concert.startTime && concert.doorsTime !== concert.startTime) {
      description = description ? `${description}\n\nDeuren: ${concert.doorsTime}` : `Deuren: ${concert.doorsTime}`;
    }

    return {
      name: concert.title,
      description: description.trim(),
      start_time: startTime,
      venue_name: venueInfo?.name || target.name,
      city: venueInfo?.city || "Amsterdam",
      address: venueInfo?.address,
      ticket_url: concert.ticketUrl,
      website_url: concert.sourceUrl,
      image_url: concert.imageUrl,
      category: this.config.category,
      source_url: concert.sourceUrl,
      time_mode: this.config.defaultTimeMode,
      coordinates: venueInfo?.coordinates,
    };
  }
}

/**
 * Factory function to create Music strategy
 */
export function createMusicStrategy(supabase: SupabaseClient, config: ScraperConfig): MusicStrategy {
  return new MusicStrategy(supabase, config);
}

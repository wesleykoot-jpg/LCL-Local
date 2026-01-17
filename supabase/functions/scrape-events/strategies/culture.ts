/**
 * Culture Scraper Strategy
 * 
 * Targets: Concertgebouw, Theater Carré, Pathé (Specials)
 * 
 * Logic:
 * - Scrapes theater/opera/special cinema events
 * - Parses duration strings (e.g., "2h 30min") to calculate end_time
 * - Normalizes price ranges to € symbols (e.g., "€€")
 * - Filters out regular movie showings (only "special" screenings)
 * 
 * @module strategies/culture
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { BaseScraperStrategy, ScraperConfig, ScrapedEvent } from "./base.ts";
import { HTMLParser, parseDate, parseTime, combineDateTime, calculateEndTime, parseDuration, normalizePriceRange } from "../utils/parser.ts";
import { CULTURE_TARGETS, VENUE_REGISTRY } from "../config.ts";

// ============================================================================
// CULTURE-SPECIFIC INTERFACES
// ============================================================================

interface CultureEventData {
  title: string;
  date: string;
  time?: string;
  duration?: string;
  price?: string;
  type?: string; // opera, ballet, theater, cinema-special
  ticketUrl?: string;
  imageUrl?: string;
  description?: string;
  sourceUrl: string;
}

// ============================================================================
// KEYWORDS FOR FILTERING
// ============================================================================

/** Keywords that indicate a "special" cinema screening */
const SPECIAL_SCREENING_KEYWORDS = [
  "première", "premiere", "preview",
  "special", "speciaal",
  "marathon", "filmfestival",
  "q&a", "q & a", "meet & greet",
  "live", "opera", "ballet", "theater",
  "concert", "musical",
  "remaster", "4k", "imax",
  "anniversary", "jubileum",
  "directors cut", "director's cut",
  "extended", "uncut",
  "met ondertiteling", "engels gesproken",
];

/** Keywords that indicate regular movie showings to skip */
const REGULAR_SCREENING_KEYWORDS = [
  "reguliere voorstelling",
  "normale voorstelling",
];

// ============================================================================
// CULTURE STRATEGY
// ============================================================================

export class CultureStrategy extends BaseScraperStrategy {
  private targets: typeof CULTURE_TARGETS;

  constructor(supabase: SupabaseClient, config: ScraperConfig) {
    super(supabase, config);
    this.targets = CULTURE_TARGETS;
  }

  /**
   * Scrape events from all configured culture sources
   */
  async scrape(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];

    for (const [key, target] of Object.entries(this.targets)) {
      console.log(`[culture] Scraping ${target.name}...`);
      
      try {
        const html = await this.fetch(target.url);
        let cultureEvents = this.parseCultureEventList(html, target);
        
        // Apply special screening filter for cinema
        if ((target as { filterMode?: string }).filterMode === "specials_only") {
          const beforeCount = cultureEvents.length;
          cultureEvents = cultureEvents.filter(e => this.isSpecialScreening(e));
          console.log(`[culture] Filtered ${beforeCount - cultureEvents.length} regular screenings from ${target.name}`);
        }
        
        const events = cultureEvents.map(event => this.transformCultureEventToEvent(event, target));
        
        console.log(`[culture] Found ${events.length} events for ${target.name}`);
        allEvents.push(...events);
      } catch (error) {
        console.error(`[culture] Failed to scrape ${key}:`, error);
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
    const events = this.parseCultureEventList(html, target);
    return events.map(event => this.transformCultureEventToEvent(event, target));
  }

  /**
   * Parse culture event list
   */
  private parseCultureEventList(html: string, target: typeof CULTURE_TARGETS[keyof typeof CULTURE_TARGETS]): CultureEventData[] {
    const parser = new HTMLParser(html);
    const events: CultureEventData[] = [];

    // Common selectors for theater/cultural venue websites
    const eventSelectors = [
      ".event", ".voorstelling", ".concert",
      "[class*='event']", "[class*='program']",
      ".agenda-item", ".calendar-event",
      "article",
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

        // Extract time
        const timeText = itemParser.extractText(".time, .tijd, .aanvang, [class*='time']");
        const time = parseTime(timeText);

        // Extract duration
        const duration = this.extractDuration(itemParser);

        // Extract price
        const price = this.extractPrice(itemParser);

        // Extract event type
        const eventType = this.extractEventType(itemParser);

        // Extract ticket URL
        const ticketUrl = this.extractTicketUrl(itemParser, target.url);

        // Extract image
        const imageUrl = itemParser.extractImage("", target.url);

        // Extract description
        const description = itemParser.extractText(".description, .excerpt, p, [class*='description']");

        // Extract detail URL
        const detailUrl = itemParser.extractLink("", target.url);

        events.push({
          title,
          date: dateText,
          time: time || undefined,
          duration,
          price,
          type: eventType,
          ticketUrl,
          imageUrl,
          description,
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
      ".title", ".name",
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
   * Extract duration string
   */
  private extractDuration(parser: HTMLParser): string | undefined {
    const selectors = [
      ".duration", ".duur", ".length",
      "[class*='duration']", "[class*='duur']",
    ];

    for (const selector of selectors) {
      const duration = parser.extractText(selector);
      if (duration) return duration;
    }

    // Try to find duration in text with pattern
    const allText = parser.extractText("body");
    const durationMatch = allText.match(/(\d+\s*(?:h|u(?:ur)?|hour)?\s*\d*\s*(?:m(?:in(?:uten)?)?)?)/i);
    if (durationMatch) return durationMatch[1];

    return undefined;
  }

  /**
   * Extract price information
   */
  private extractPrice(parser: HTMLParser): string | undefined {
    const selectors = [
      ".price", ".prijs", ".tarief",
      "[class*='price']", "[class*='prijs']",
    ];

    for (const selector of selectors) {
      const price = parser.extractText(selector);
      if (price && price.includes("€")) return price;
    }

    return undefined;
  }

  /**
   * Extract event type (opera, ballet, theater, etc.)
   */
  private extractEventType(parser: HTMLParser): string | undefined {
    const selectors = [
      ".category", ".type", ".genre",
      "[class*='category']", "[class*='type']",
    ];

    for (const selector of selectors) {
      const type = parser.extractText(selector);
      if (type && type.length < 50) return type.toLowerCase();
    }

    return undefined;
  }

  /**
   * Extract ticket URL
   */
  private extractTicketUrl(parser: HTMLParser, baseUrl: string): string | undefined {
    const selectors = [
      "a[href*='ticket']",
      "a[href*='kaart']",
      "a[href*='reserv']",
      ".tickets a",
      ".buy a",
    ];

    for (const selector of selectors) {
      const href = parser.extractLink(selector, baseUrl);
      if (href) return href;
    }

    return undefined;
  }

  /**
   * Check if event is a special screening (for cinema filtering)
   */
  private isSpecialScreening(event: CultureEventData): boolean {
    const searchText = `${event.title} ${event.description || ""} ${event.type || ""}`.toLowerCase();
    
    // Check for regular screening keywords (exclusion)
    for (const keyword of REGULAR_SCREENING_KEYWORDS) {
      if (searchText.includes(keyword.toLowerCase())) {
        return false;
      }
    }
    
    // Check for special screening keywords (inclusion)
    for (const keyword of SPECIAL_SCREENING_KEYWORDS) {
      if (searchText.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    // Default: include if it's from a non-cinema source
    return event.type !== "film" && event.type !== "movie";
  }

  /**
   * Transform culture event to ScrapedEvent
   */
  private transformCultureEventToEvent(
    cultureEvent: CultureEventData,
    target: typeof CULTURE_TARGETS[keyof typeof CULTURE_TARGETS]
  ): ScrapedEvent {
    // Get venue from registry
    const venueKey = (target as { venueKey?: string }).venueKey;
    const venueInfo = venueKey ? VENUE_REGISTRY[venueKey] : null;

    // Parse date and time
    const parsedDate = parseDate(cultureEvent.date);
    
    let startTime: string | undefined;
    let endTime: string | undefined;
    
    if (parsedDate) {
      startTime = combineDateTime(parsedDate, cultureEvent.time || null);
      
      // Calculate end time from duration if available
      if (cultureEvent.duration) {
        const durationMinutes = parseDuration(cultureEvent.duration);
        if (durationMinutes) {
          endTime = calculateEndTime(startTime, durationMinutes);
        }
      }
    }

    // Normalize price range
    const normalizedPrice = cultureEvent.price ? normalizePriceRange(cultureEvent.price) : undefined;

    // Build description
    let description = cultureEvent.description || "";
    if (cultureEvent.duration) {
      description = description ? `${description}\n\nDuur: ${cultureEvent.duration}` : `Duur: ${cultureEvent.duration}`;
    }
    if (normalizedPrice) {
      description = description ? `${description}\nPrijs: ${normalizedPrice}` : `Prijs: ${normalizedPrice}`;
    }

    // Determine category
    const category = (target as { category?: string }).category || this.config.category;

    return {
      name: cultureEvent.title,
      description: description.trim(),
      start_time: startTime,
      end_time: endTime,
      venue_name: venueInfo?.name || target.name,
      city: venueInfo?.city || "Amsterdam",
      address: venueInfo?.address,
      ticket_url: cultureEvent.ticketUrl,
      price_range: normalizedPrice,
      image_url: cultureEvent.imageUrl,
      category,
      source_url: cultureEvent.sourceUrl,
      time_mode: this.config.defaultTimeMode,
      coordinates: venueInfo?.coordinates,
    };
  }
}

/**
 * Factory function to create Culture strategy
 */
export function createCultureStrategy(supabase: SupabaseClient, config: ScraperConfig): CultureStrategy {
  return new CultureStrategy(supabase, config);
}

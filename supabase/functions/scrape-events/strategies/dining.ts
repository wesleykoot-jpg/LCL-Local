/**
 * Dining Scraper Strategy
 * 
 * Targets: "New Openings" lists (e.g., Misset Horeca, Iens Top Lists)
 * 
 * Logic:
 * - Extracts minimal data: name, city, category ('dining')
 * - Important: Sets time_mode to 'window' to trigger Phase 2 Enrichment Engine
 *   to fill in opening hours, phone, and location later
 * - Avoids duplicate inserts via place_id deduplication (if available)
 * 
 * @module strategies/dining
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { BaseScraperStrategy, ScraperConfig, ScrapedEvent, TimeMode } from "./base.ts";
import { HTMLParser } from "../utils/parser.ts";
import { DINING_TARGETS } from "../config.ts";

// ============================================================================
// DINING-SPECIFIC INTERFACES
// ============================================================================

interface RestaurantData {
  name: string;
  city?: string;
  address?: string;
  cuisine?: string;
  priceRange?: string;
  placeId?: string;
  websiteUrl?: string;
  imageUrl?: string;
  description?: string;
  sourceUrl: string;
}

// ============================================================================
// DINING STRATEGY
// ============================================================================

export class DiningStrategy extends BaseScraperStrategy {
  private targets: typeof DINING_TARGETS;

  constructor(supabase: SupabaseClient, config: ScraperConfig) {
    super(supabase, config);
    this.targets = DINING_TARGETS;
  }

  /**
   * Scrape restaurants from all configured dining sources
   */
  async scrape(): Promise<ScrapedEvent[]> {
    const allEvents: ScrapedEvent[] = [];

    for (const [key, target] of Object.entries(this.targets)) {
      console.log(`[dining] Scraping ${target.name}...`);
      
      try {
        const html = await this.fetch(target.url);
        const restaurants = this.parseRestaurantList(html, target);
        
        const events = restaurants.map(restaurant => this.transformRestaurantToEvent(restaurant, target));
        
        console.log(`[dining] Found ${events.length} restaurants for ${target.name}`);
        allEvents.push(...events);
      } catch (error) {
        console.error(`[dining] Failed to scrape ${key}:`, error);
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
    const restaurants = this.parseRestaurantList(html, target);
    return restaurants.map(restaurant => this.transformRestaurantToEvent(restaurant, target));
  }

  /**
   * Parse restaurant list from HTML
   */
  private parseRestaurantList(html: string, target: typeof DINING_TARGETS[keyof typeof DINING_TARGETS]): RestaurantData[] {
    const parser = new HTMLParser(html);
    const restaurants: RestaurantData[] = [];

    // Common selectors for restaurant listing pages
    const itemSelectors = [
      ".restaurant",
      "[class*='restaurant']",
      ".listing-item",
      ".card",
      "article",
      "[class*='venue']",
      ".result-item",
    ];

    for (const selector of itemSelectors) {
      const elements = parser.findAll(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = parser.findAll(selector).eq(elements.toArray().indexOf(el));
        const itemHtml = $el.html() || "";
        const itemParser = new HTMLParser(itemHtml);

        // Extract name
        const name = this.extractName(itemParser);
        if (!name || name.length < 2) return;

        // Extract city
        const city = this.extractCity(itemParser);

        // Extract address
        const address = this.extractAddress(itemParser);

        // Extract cuisine type
        const cuisine = this.extractCuisine(itemParser);

        // Extract price range
        const priceRange = this.extractPriceRange(itemParser);

        // Extract place ID (if available in data attributes)
        const placeId = this.extractPlaceId(itemParser);

        // Extract website URL
        const websiteUrl = itemParser.extractLink("", target.url);

        // Extract image
        const imageUrl = itemParser.extractImage("", target.url);

        // Extract description
        const description = itemParser.extractText(".description, .excerpt, p, [class*='description']");

        restaurants.push({
          name,
          city,
          address,
          cuisine,
          priceRange,
          placeId,
          websiteUrl,
          imageUrl,
          description,
          sourceUrl: websiteUrl || target.url,
        });
      });

      if (restaurants.length > 0) break;
    }

    return restaurants;
  }

  /**
   * Extract restaurant name
   */
  private extractName(parser: HTMLParser): string {
    const selectors = [
      "h1", "h2", "h3",
      ".name", ".title", ".restaurant-name",
      "[class*='name']", "[class*='title']",
    ];

    for (const selector of selectors) {
      const name = parser.extractText(selector);
      if (name && name.length >= 2) {
        return name.trim();
      }
    }

    return "";
  }

  /**
   * Extract city
   */
  private extractCity(parser: HTMLParser): string | undefined {
    const selectors = [
      ".city", ".location", ".plaats",
      "[class*='city']", "[class*='location']",
    ];

    for (const selector of selectors) {
      const city = parser.extractText(selector);
      if (city && city.length >= 2) {
        return this.normalizeCity(city);
      }
    }

    // Try to extract from address
    const address = parser.extractText(".address, [class*='address']");
    if (address) {
      return this.extractCityFromAddress(address);
    }

    return undefined;
  }

  /**
   * Extract address
   */
  private extractAddress(parser: HTMLParser): string | undefined {
    const selectors = [
      ".address", ".adres", ".street",
      "[class*='address']", "[class*='adres']",
      "[itemprop='address']",
    ];

    for (const selector of selectors) {
      const address = parser.extractText(selector);
      if (address && address.length >= 5) {
        return address.trim();
      }
    }

    return undefined;
  }

  /**
   * Extract cuisine type
   */
  private extractCuisine(parser: HTMLParser): string | undefined {
    const selectors = [
      ".cuisine", ".type", ".category",
      "[class*='cuisine']", "[class*='keuken']",
    ];

    for (const selector of selectors) {
      const cuisine = parser.extractText(selector);
      if (cuisine && cuisine.length >= 2) {
        return cuisine.trim().toLowerCase();
      }
    }

    return undefined;
  }

  /**
   * Extract price range
   */
  private extractPriceRange(parser: HTMLParser): string | undefined {
    const selectors = [
      ".price", ".prijs", ".price-range",
      "[class*='price']",
    ];

    for (const selector of selectors) {
      const priceText = parser.extractText(selector);
      if (priceText && priceText.includes("€")) {
        return priceText.trim();
      }
    }

    // Check for € symbols directly
    const symbols = parser.extractText("[class*='euro'], .euro");
    if (symbols && /^€{1,4}$/.test(symbols.trim())) {
      return symbols.trim();
    }

    return undefined;
  }

  /**
   * Extract place ID from data attributes
   */
  private extractPlaceId(parser: HTMLParser): string | undefined {
    const possibleAttributes = [
      "data-place-id",
      "data-google-place-id",
      "data-id",
    ];

    for (const attr of possibleAttributes) {
      const value = parser.extractAttribute("*", attr);
      if (value) return value;
    }

    return undefined;
  }

  /**
   * Normalize city name
   */
  private normalizeCity(city: string): string {
    return city
      .replace(/[0-9]/g, "")  // Remove postal codes
      .replace(/,.*$/, "")     // Remove everything after comma
      .trim()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Extract city from Dutch address format
   * e.g., "Kalverstraat 123, 1012 AB Amsterdam" -> "Amsterdam"
   */
  private extractCityFromAddress(address: string): string | undefined {
    // Dutch postal code pattern: 1234 AB
    const match = address.match(/\d{4}\s*[A-Z]{2}\s+([A-Za-z\s-]+)/);
    if (match) {
      return this.normalizeCity(match[1]);
    }
    
    // Try last part after comma
    const parts = address.split(",");
    if (parts.length > 1) {
      return this.normalizeCity(parts[parts.length - 1]);
    }

    return undefined;
  }

  /**
   * Check for duplicate by place_id
   */
  async checkPlaceIdDuplicate(placeId: string): Promise<string | null> {
    if (!placeId) return null;

    const { data, error } = await this.supabase
      .from("events")
      .select("id")
      .eq("google_place_id", placeId)
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.id;
  }

  /**
   * Transform restaurant data to ScrapedEvent
   * Note: Uses time_mode 'window' to flag for enrichment
   */
  private transformRestaurantToEvent(
    restaurant: RestaurantData,
    _target: typeof DINING_TARGETS[keyof typeof DINING_TARGETS]
  ): ScrapedEvent {
    // Build description with available info
    let description = restaurant.description || "";
    if (restaurant.cuisine) {
      description = description 
        ? `${description}\n\nKeuken: ${restaurant.cuisine}`
        : `Keuken: ${restaurant.cuisine}`;
    }
    if (restaurant.priceRange) {
      description = description
        ? `${description}\nPrijsklasse: ${restaurant.priceRange}`
        : `Prijsklasse: ${restaurant.priceRange}`;
    }

    return {
      name: restaurant.name,
      description: description.trim(),
      // No specific start_time for restaurants - they have opening hours
      start_time: undefined,
      venue_name: restaurant.name,
      city: restaurant.city || "Nederland",
      address: restaurant.address,
      website_url: restaurant.websiteUrl,
      price_range: restaurant.priceRange,
      image_url: restaurant.imageUrl,
      category: this.config.category, // 'foodie'
      source_url: restaurant.sourceUrl,
      // IMPORTANT: Set to 'window' to trigger enrichment engine
      time_mode: "window" as TimeMode,
    };
  }

  /**
   * Override processEvents to add place_id deduplication
   */
  async processEvents(scrapedEvents: ScrapedEvent[]): Promise<{ success: number; failed: number; skipped: number }> {
    const stats = { success: 0, failed: 0, skipped: 0 };

    for (const event of scrapedEvents) {
      try {
        // Check validation
        const validationError = this.validateEvent(event);
        if (validationError) {
          console.warn(`Validation failed for "${event.name}": ${validationError}`);
          stats.failed++;
          continue;
        }

        // Check for place_id duplicate (dining-specific)
        // Note: The placeId is set during parsing but stored in a separate field
        // We need to check if the event was parsed with a placeId attached
        const eventWithPlaceId = event as ScrapedEvent & { placeId?: string };
        if (eventWithPlaceId.placeId) {
          const existingId = await this.checkPlaceIdDuplicate(eventWithPlaceId.placeId);
          if (existingId) {
            console.log(`[dining] Skipping duplicate by place_id: ${event.name}`);
            stats.skipped++;
            continue;
          }
        }

        // Standard deduplication and insert
        const dedupeResult = await this.deduplicateEvent(event);
        
        if (dedupeResult.existingId) {
          if (dedupeResult.needsUpdate) {
            await this.updateEvent(dedupeResult.existingId, event);
            stats.success++;
          } else {
            stats.skipped++;
          }
        } else {
          await this.insertEvent(event);
          stats.success++;
        }
      } catch (error) {
        console.error(`Error processing restaurant "${event.name}":`, error);
        stats.failed++;
      }
    }

    return stats;
  }

  /**
   * Override validateEvent to allow missing start_time for restaurants
   */
  protected validateEvent(event: ScrapedEvent): string | null {
    if (!event.name || event.name.trim().length < 2) {
      return "Restaurant name is required and must be at least 2 characters";
    }
    if (!event.city) {
      return "City is required";
    }
    // Note: We don't require start_time for restaurants (they use opening hours)
    return null;
  }
}

/**
 * Factory function to create Dining strategy
 */
export function createDiningStrategy(supabase: SupabaseClient, config: ScraperConfig): DiningStrategy {
  return new DiningStrategy(supabase, config);
}

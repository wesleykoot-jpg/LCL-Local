/**
 * HTML/JSON Parsing Utilities for Event Scraping
 *
 * This module provides utilities for extracting and parsing event data
 * from HTML content, with special handling for Dutch date formats.
 *
 * @module utils/parser
 */

import * as cheerio from "npm:cheerio@1.0.0-rc.12";

// ============================================================================
// DUTCH MONTH MAPPING
// ============================================================================

const DUTCH_MONTHS: Record<string, number> = {
  // Full names
  januari: 0,
  februari: 1,
  maart: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  augustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
  // Abbreviations
  jan: 0,
  feb: 1,
  mrt: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  okt: 9,
  nov: 10,
  dec: 11,
};

const DUTCH_RELATIVE_DAYS: Record<string, number> = {
  vandaag: 0,
  today: 0,
  morgen: 1,
  tomorrow: 1,
  overmorgen: 2,
};

const DUTCH_WEEKDAYS: Record<string, number> = {
  maandag: 1,
  dinsdag: 2,
  woensdag: 3,
  donderdag: 4,
  vrijdag: 5,
  zaterdag: 6,
  zondag: 0,
  ma: 1,
  di: 2,
  wo: 3,
  do: 4,
  vr: 5,
  za: 6,
  zo: 0,
};

// ============================================================================
// HTML PARSER CLASS
// ============================================================================

export class HTMLParser {
  private $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  /**
   * Extract text content from element(s) matching selector
   * @param selector - CSS selector
   * @param defaultValue - Default value if not found
   * @returns Trimmed text content
   */
  extractText(selector: string, defaultValue = ""): string {
    const element = this.$(selector).first();
    return element.text().trim() || defaultValue;
  }

  /**
   * Extract attribute value from element matching selector
   * @param selector - CSS selector
   * @param attribute - Attribute name
   * @param defaultValue - Default value if not found
   * @returns Attribute value
   */
  extractAttribute(
    selector: string,
    attribute: string,
    defaultValue = "",
  ): string {
    const element = this.$(selector).first();
    return element.attr(attribute)?.trim() || defaultValue;
  }

  /**
   * Extract href from first link in element
   * @param selector - CSS selector for parent element
   * @param baseUrl - Base URL for relative links
   * @returns Full URL or empty string
   */
  extractLink(selector: string, baseUrl?: string): string {
    const href =
      this.$(selector).find("a").first().attr("href") ||
      this.$(selector).first().attr("href");

    if (!href) return "";

    if (href.startsWith("http")) return href;
    if (baseUrl && href.startsWith("/")) {
      const url = new URL(baseUrl);
      return `${url.protocol}//${url.host}${href}`;
    }
    return href;
  }

  /**
   * Extract image URL from element
   * @param selector - CSS selector
   * @param baseUrl - Base URL for relative images
   * @returns Image URL or null
   */
  extractImage(selector: string, baseUrl?: string): string | null {
    const img = this.$(selector).find("img").first();
    let src =
      img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src");

    // Check for background-image in style
    if (!src) {
      const style = this.$(selector).attr("style") || "";
      const bgMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
      src = bgMatch?.[1];
    }

    if (!src) return null;

    if (src.startsWith("http")) return src;
    if (baseUrl && src.startsWith("/")) {
      const url = new URL(baseUrl);
      return `${url.protocol}//${url.host}${src}`;
    }
    return src;
  }

  /**
   * Get raw HTML of element
   */
  getHtml(selector: string): string {
    return this.$.html(this.$(selector).first()) || "";
  }

  /**
   * Find all elements matching selector
   */
  findAll(selector: string): cheerio.Cheerio<cheerio.Element> {
    return this.$(selector);
  }

  /**
   * Create parser for specific element
   */
  scope(selector: string): HTMLParser | null {
    const html = this.getHtml(selector);
    if (!html) return null;
    return new HTMLParser(html);
  }
}

// ============================================================================
// DATE PARSING FUNCTIONS
// ============================================================================

/**
 * Parse Dutch date strings to ISO format
 * Handles formats like:
 * - "12 okt" -> "2026-10-12"
 * - "vandaag" -> current date
 * - "zaterdag 12 oktober" -> date of that Saturday
 * - "za 18 mei 2026" -> "2026-05-18"
 *
 * @param dateStr - Raw date string
 * @param referenceDate - Reference date for relative calculations (default: now)
 * @returns ISO date string (YYYY-MM-DD) or null if parsing fails
 */
export function parseDate(
  dateStr: string,
  referenceDate: Date = new Date(),
): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr
    .toLowerCase()
    .trim()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");

  // Check relative days first
  for (const [word, offset] of Object.entries(DUTCH_RELATIVE_DAYS)) {
    if (cleaned === word || cleaned.includes(word)) {
      const date = new Date(referenceDate);
      date.setDate(date.getDate() + offset);
      return formatISODate(date);
    }
  }

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Try European format (DD-MM-YYYY or DD/MM/YYYY)
  const euroMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (euroMatch) {
    const day = euroMatch[1].padStart(2, "0");
    const month = euroMatch[2].padStart(2, "0");
    let year = euroMatch[3];
    if (year.length === 2) {
      year = year.startsWith("9") ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Try Dutch textual format: "12 okt", "12 oktober", "za 12 okt", "zaterdag 12 oktober 2026"
  // Remove optional weekday prefix
  let remaining = cleaned;
  for (const weekday of Object.keys(DUTCH_WEEKDAYS)) {
    if (remaining.startsWith(weekday)) {
      remaining = remaining.slice(weekday.length).trim();
      break;
    }
  }

  // Match "12 okt" or "12 oktober" or "12 okt 2026"
  const textMatch = remaining.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthStr = textMatch[2].toLowerCase();
    const month = DUTCH_MONTHS[monthStr] ?? DUTCH_MONTHS[monthStr.slice(0, 3)];

    if (month !== undefined) {
      let year = textMatch[3]
        ? parseInt(textMatch[3], 10)
        : referenceDate.getFullYear();

      // If no year specified and month is in the past, assume next year
      if (!textMatch[3]) {
        const candidateDate = new Date(year, month, day);
        if (candidateDate < referenceDate) {
          year++;
        }
      }

      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Parse time string to HH:MM format
 * Handles formats like:
 * - "20:00" -> "20:00"
 * - "8.30" -> "08:30"
 * - "20h00" -> "20:00"
 * - "8 PM" -> "20:00"
 * - "aanvang 20:00" -> "20:00"
 * - "doors: 19:00, start: 20:00" -> "20:00" (prefers start over doors)
 *
 * @param timeStr - Raw time string
 * @returns Normalized time string (HH:MM) or null
 */
export function parseTime(timeStr: string): string | null {
  if (!timeStr) return null;

  const cleaned = timeStr.toLowerCase().trim();

  // Check for TBD / whole day
  if (cleaned === "tbd" || cleaned === "hele dag" || cleaned === "all day") {
    return null;
  }

  // Try to find start time specifically (prefer over doors)
  const startMatch = cleaned.match(
    /(?:start|aanvang|beginn?)[:\s]+(\d{1,2})[:.h](\d{2})/i,
  );
  if (startMatch) {
    return normalizeTime(startMatch[1], startMatch[2]);
  }

  // Generic time patterns
  const timePatterns = [
    /(\d{1,2})[:.](\d{2})(?:\s*(am|pm))?/i, // 20:00, 8.30, 8:30 PM
    /(\d{1,2})h(\d{2})/i, // 20h00
    /(\d{1,2})\s*uhr/i, // 20 uhr (German)
    /(\d{1,2})\s*u(?:ur)?(?:[^\d]|$)/i, // 20u, 20 uur (Dutch)
  ];

  for (const pattern of timePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const hours = match[1];
      const minutes = match[2] || "00";
      const ampm = match[3];
      return normalizeTime(hours, minutes, ampm);
    }
  }

  return null;
}

/**
 * Normalize hours and minutes to HH:MM format
 */
function normalizeTime(
  hours: string,
  minutes: string,
  ampm?: string,
): string | null {
  let hourNum = parseInt(hours, 10);
  const minuteNum = parseInt(minutes, 10);

  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "pm" && hourNum < 12) hourNum += 12;
    if (lower === "am" && hourNum === 12) hourNum = 0;
  }

  if (hourNum > 23 || minuteNum > 59) return null;

  return `${String(hourNum).padStart(2, "0")}:${String(minuteNum).padStart(2, "0")}`;
}

/**
 * Format Date to ISO date string (YYYY-MM-DD)
 */
function formatISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Combine date and time into ISO 8601 timestamp
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @param timeStr - Time string (HH:MM)
 * @param timezone - IANA timezone (default: Europe/Amsterdam)
 * @returns ISO 8601 timestamp
 */
export function combineDateTime(
  dateStr: string,
  timeStr: string | null,
  timezone = "Europe/Amsterdam",
): string {
  const time = timeStr || "12:00";
  const [hours, minutes] = time.split(":").map(Number);
  const [year, month, day] = dateStr.split("-").map(Number);

  // Create date in UTC (treating input as local timezone)
  // Note: In production, you'd use proper timezone handling
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  return date.toISOString();
}

/**
 * Calculate end time for events
 * @param startTime - ISO timestamp
 * @param durationMinutes - Duration in minutes
 * @returns ISO timestamp for end time
 */
export function calculateEndTime(
  startTime: string,
  durationMinutes: number,
): string {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
}

/**
 * Handle late-night event logic
 * If event starts late (after 22:00) and ends early (before 08:00),
 * the end date should be the next day.
 *
 * @param startTime - ISO timestamp
 * @param endTimeStr - Time string (HH:MM) for end time
 * @returns ISO timestamp for end time with correct date
 */
export function handleLateNightEvent(
  startTime: string,
  endTimeStr: string,
): string {
  const start = new Date(startTime);
  const startHours = start.getUTCHours();

  const [endHours, endMinutes] = endTimeStr.split(":").map(Number);

  const end = new Date(start);
  end.setUTCHours(endHours, endMinutes, 0, 0);

  // If start is late night (>=22) and end is early morning (<8), add a day
  if (startHours >= 22 && endHours < 8) {
    end.setUTCDate(end.getUTCDate() + 1);
  }
  // If start is early morning and end is early morning but before start
  else if (startHours < 8 && endHours < 8 && endHours < startHours) {
    end.setUTCDate(end.getUTCDate() + 1);
  }

  return end.toISOString();
}

/**
 * Parse duration string to minutes
 * Handles formats like:
 * - "2h 30min" -> 150
 * - "1 uur 45 minuten" -> 105
 * - "90 min" -> 90
 * - "2 hours" -> 120
 *
 * @param durationStr - Raw duration string
 * @returns Duration in minutes or null
 */
export function parseDuration(durationStr: string): number | null {
  if (!durationStr) return null;

  const cleaned = durationStr.toLowerCase().trim();
  let totalMinutes = 0;

  // Match hours
  const hoursMatch = cleaned.match(/(\d+)\s*(?:h|hour|hours|uur|uren)/);
  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }

  // Match minutes
  const minutesMatch = cleaned.match(/(\d+)\s*(?:m|min|mins|minutes|minuten)/);
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }

  // If no match found, try plain number (assume minutes)
  if (totalMinutes === 0) {
    const plainMatch = cleaned.match(/^(\d+)$/);
    if (plainMatch) {
      totalMinutes = parseInt(plainMatch[1], 10);
    }
  }

  return totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Normalize price range to € symbols
 * @param priceStr - Raw price string
 * @returns Normalized price range (€, €€, €€€, €€€€) or original string
 */
export function normalizePriceRange(priceStr: string): string {
  if (!priceStr) return "";

  const cleaned = priceStr.trim();

  // Already normalized
  if (/^€{1,4}$/.test(cleaned)) return cleaned;

  // Extract numeric values
  const prices = cleaned.match(/(\d+(?:[.,]\d+)?)/g);
  if (!prices || prices.length === 0) return cleaned;

  // Use the highest price for categorization
  const maxPrice = Math.max(
    ...prices.map((p) => parseFloat(p.replace(",", "."))),
  );

  if (maxPrice <= 15) return "€";
  if (maxPrice <= 40) return "€€";
  if (maxPrice <= 100) return "€€€";
  return "€€€€";
}

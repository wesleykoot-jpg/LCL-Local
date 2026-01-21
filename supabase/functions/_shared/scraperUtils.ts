import { parseToISODate } from "./dateUtils.ts";
import { classifyTextToCategory } from "./categoryMapping.ts";
import type { RawEventCard, ScraperSource, NormalizedEvent, CategoryKey } from "./types.ts";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes a time string (hours, minutes, ampm) into valid HH:MM 24h format
 */
export function normalizeMatchedTime(hours: string, minutes: string, ampm?: string): string | null {
  let hourNum = parseInt(hours, 10);
  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "pm" && hourNum < 12) hourNum += 12;
    if (lower === "am" && hourNum === 12) hourNum = 0;
  }
  if (hourNum > 23) return null;
  return `${String(hourNum).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

/**
 * Constructs a full ISO timestamp from date string and time string (HH:MM)
 * Note: Assumes local time input and stores as UTC representation of that local time
 */
export function constructEventDateTime(eventDate: string, eventTime: string): string {
  const timeMatch = eventTime.match(/^(\d{2}):(\d{2})$/);
  const hours = timeMatch ? timeMatch[1] : "12";
  const minutes = timeMatch ? timeMatch[2] : "00";
  const [year, month, day] = eventDate.split("-").map(Number);
  // Create date in UTC to preserve the "wall clock" time of the event
  const date = new Date(Date.UTC(year, month - 1, day, Number(hours), Number(minutes), 0));
  return date.toISOString();
}

export function normalizeEventDateForStorage(
  eventDate: string,
  eventTime: string
): { timestamp: string; dateOnly: string | null } {
  const isoDate = parseToISODate(eventDate);
  const dateForStorage = isoDate || eventDate;
  return {
    timestamp: constructEventDateTime(dateForStorage, eventTime),
    dateOnly: isoDate,
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function createEventFingerprint(title: string, eventDate: string, sourceId: string): Promise<string> {
  return sha256Hex(`${title}|${eventDate}|${sourceId}`);
}

export function createContentHash(title: string, eventDate: string): Promise<string> {
  return sha256Hex(`${title}|${eventDate}`);
}

/**
 * Creates a SHA-256 hash of a raw event payload for delta detection.
 */
export async function hashPayload(payload: RawEventCard): Promise<string> {
  // Hash key fields that would indicate content change
  const keyContent = JSON.stringify({
    title: payload.title,
    date: payload.date,
    location: payload.location,
    description: payload.description?.slice(0, 500), // Limit description for stability
    detailUrl: payload.detailUrl,
  });
  return await sha256Hex(keyContent);
}

/**
 * Extract time from a raw HTML string using regex patterns
 */
export function extractTimeFromHtml(html: string): string | null {
  const timePatterns = [
    /aanvang[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /vanaf\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /(\d{1,2})[.:h](\d{2})\s*uur/i,
    /beginn[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /ab\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /(\d{1,2})[.:h](\d{2})\s*uhr/i,
    /starts?\s*(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /from\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /doors?\s*(?:open\s*)?(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /start[:\s]*(?:om\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /time[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /om\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
    /(\d{1,2})[.:](\d{2})\s*[-–—]\s*\d{1,2}[.:]\d{2}(?:\s*(am|pm))?/i,
    /(\d{1,2})[.:h](\d{2})\s*(am|pm)?/i,
  ];

  for (const pattern of timePatterns) {
    const match = html.match(pattern);
    if (match) {
      // normalizeMatchedTime handles the structure of regex groups usually (H, M, AM/PM)
      // Some patterns above might have different group indices, but most align on 1=H, 2=M.
      // patterns like 'aanvang' are 1,2,3. 'uur' is 1,2.
      // We'll rely on normalizeMatchedTime handling undefined am/pm arg.
      const time = normalizeMatchedTime(match[1], match[2], match[3]);
      if (time) return time;
    }
  }
  return null;
}

export function mapToInternalCategory(input?: string): CategoryKey {
  const value = (input || "").toLowerCase();

  // Use the modern category classification system
  const category = classifyTextToCategory(value);

  // The classifyTextToCategory now returns CategoryKey (uppercase)
  return category;
}


interface EventLike {
  title?: string;
  description?: string;
  internal_category?: string;
  category?: string;
  venue_name?: string;
}

export function eventToText(event: EventLike): string {
  const parts = [
    event.title,
    event.description || "",
    event.internal_category || event.category || "",
    event.venue_name || "",
  ];

  return parts.filter(Boolean).join(" ").trim();
}

export function cheapNormalizeEvent(
  raw: RawEventCard, 
  source: ScraperSource,
  targetYear?: number
): NormalizedEvent | null {
  if (!raw.title) return null;
  
  const currentYear = targetYear || new Date().getFullYear();
  const cleanedDate = (raw.date || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  const isoDate = parseToISODate(cleanedDate);
  
  // Basic year validation
  if (!isoDate || !isoDate.startsWith(`${currentYear}-`)) return null;

  const time = raw.detailPageTime || extractTimeFromHtml(raw.rawHtml) || extractTimeFromHtml(raw.description) || "TBD";
  const doc = cheerio.load(raw.rawHtml || "");
  const description = normalizeWhitespace(raw.description || "") || normalizeWhitespace(doc.text()).slice(0, 240);

  return {
    title: normalizeWhitespace(raw.title),
    description,
    event_date: isoDate,
    event_time: time || "TBD",
    image_url: raw.imageUrl,
    venue_name: raw.location || source.name,
    category_key: mapToInternalCategory(raw.categoryHint || raw.description || raw.title),
  };
}

/**
 * Checks if an event already exists in the database based on content hash or fingerprint.
 */
export async function checkDuplicate(
  supabase: SupabaseClient, 
  contentHash: string, 
  fingerprint: string, 
  sourceId: string
): Promise<boolean> {
  // Check content hash first (title | date)
  const { data: hashData } = await supabase
    .from("events")
    .select("id")
    .eq("source_id", sourceId)
    .eq("content_hash", contentHash)
    .limit(1);
  if (hashData && hashData.length > 0) return true;

  // Check event fingerprint (title | date | sourceId)
  const { data: fpData } = await supabase
    .from("events")
    .select("id")
    .eq("source_id", sourceId)
    .eq("event_fingerprint", fingerprint)
    .limit(1);
  if (fpData && fpData.length > 0) return true;

  return false;
}

/**
 * Inserts a normalized event into the database.
 */
export async function insertEvent(
  supabase: SupabaseClient, 
  event: Record<string, any>
): Promise<boolean> {
  // Final defensive validation: ensure category is valid before insert
  if (!event.category) {
    event.category = "community";
  }

  const { error } = await supabase.from("events").insert(event);
  if (error) {
    console.error("Insert failed:", error.message);
    return false;
  }
  return true;
}

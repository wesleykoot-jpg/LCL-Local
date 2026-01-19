
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../supabase/functions/_shared/dateUtils.ts";
import { classifyTextToCategory, INTERNAL_CATEGORIES, type InternalCategory } from "../supabase/functions/_shared/categoryMapping.ts";

// MOCK ENV
const TARGET_YEAR = 2026; // Hardcoded to match presumed env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://mock.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "mock-key";

// --- Copied Logic from run-scraper/index.ts ---

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTimeFromHtml(html: string): string | null {
  const timePatterns = [
    /(\d{1,2})[.:h](\d{2})\s*(am|pm)?/i,
    /(\d{1,2})\s*uhr/i,
  ];
  for (const pattern of timePatterns) {
    const match = html.match(pattern);
    if (match) {
      // Simplification for debug: just return HH:MM
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
  }
  return null;
}

function mapToInternalCategory(input?: string): InternalCategory {
  const value = (input || "").toLowerCase();
  const category = classifyTextToCategory(value);
  if (INTERNAL_CATEGORIES.includes(category as InternalCategory)) {
    return category as InternalCategory;
  }
  return "community";
}

function isTargetYear(isoDate: string | null): boolean {
  return !!isoDate && isoDate.startsWith(`${TARGET_YEAR}-`);
}

async function sha256Hex(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

async function createEventFingerprint(title: string, eventDate: string, sourceId: string): Promise<string> {
  return sha256Hex(`${title}|${eventDate}|${sourceId}`);
}

interface NormalizedEvent {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  image_url: string | null;
  venue_name: string;
  venue_address?: string;
  internal_category: InternalCategory;
  detail_url?: string | null;
}

// Mock ScraperSource
interface ScraperSource {
    id: string;
    name: string;
    url: string;
    config: any;
    default_coordinates?: { lat: number, lng: number };
}

interface RawEventCard {
    title?: string;
    date: string;
    location?: string;
    description?: string;
    rawHtml: string;
    url?: string;
    imageUrl?: string;
    detailUrl?: string;
    categoryHint?: string;
    detailPageTime?: string | null;
}

function cheapNormalizeEvent(raw: RawEventCard, source: ScraperSource): NormalizedEvent | null {
  console.log(`\n--- Normalizing Event: ${raw.title} ---`);
  
  if (!raw.title) {
      console.log("FAIL: No title");
      return null;
  }
  
  const isoDate = parseToISODate(raw.date);
  console.log(`Date: raw="${raw.date}" -> iso="${isoDate}"`);
  
  if (!isoDate) {
      console.log("FAIL: Could not parse date");
      return null;
  }
  
  if (!isTargetYear(isoDate)) {
      console.log(`FAIL: Date ${isoDate} is not in target year ${TARGET_YEAR}`);
      return null;
  }

  const time = raw.detailPageTime || extractTimeFromHtml(raw.rawHtml) || extractTimeFromHtml(raw.description || "") || "TBD";
  console.log(`Time: ${time}`);

  const description = normalizeWhitespace(raw.description || "") || normalizeWhitespace(cheerio.load(raw.rawHtml || "").text()).slice(0, 240);

  return {
    title: normalizeWhitespace(raw.title),
    description,
    event_date: isoDate,
    event_time: time || "TBD",
    image_url: raw.imageUrl || null,
    venue_name: raw.location || source.name,
    internal_category: mapToInternalCategory(raw.categoryHint || raw.description || raw.title),
    detail_url: raw.detailUrl,
  };
}

// --- Main Debug Script ---

async function runDebug() {
    console.log("Starting Debug Script...");
    console.log(`Target Year: ${TARGET_YEAR}`);
    
    // 1. Mock Source
    const source: ScraperSource = {
        id: "debug-source-123",
        name: "Debug Source",
        url: "https://example.com/events",
        config: {},
        default_coordinates: { lat: 52.3676, lng: 4.9041 }
    };

    // 2. Test Cases
    const testCases: RawEventCard[] = [
        {
            title: "Valid Future Event",
            date: "2026-05-20",
            location: "Paradiso",
            description: "A great concert",
            rawHtml: "<div>20:00</div>",
            url: "https://example.com/e/1"
        },
        {
            title: "Event with Dutch Date",
            date: "20 mei 2026",
            location: "Melkweg",
            description: "Another concert",
            rawHtml: "<div>Starts at 19:30</div>",
            url: "https://example.com/e/2"
        },
        {
            title: "Event with Relative Date (Tomorrow)", 
            date: "morgen", // Logic depends on "today", mocked inside dateUtils? No, dateUtils uses new Date()
            location: "Test Loc",
            rawHtml: "",
            url: "https://example.com/e/3"
        },
        {
             title: "Event in 2025 (Should Fail)",
             date: "2025-12-31",
             location: "Oude Kerk",
             rawHtml: "",
             url: "https://example.com/e/4"
        }
    ];

    for (const raw of testCases) {
        const normalized = cheapNormalizeEvent(raw, source);
        if (normalized) {
            console.log("✅ Normalized Successfully:");
            console.log(normalized);
            
            // Check Fingerprint
            const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, source.id);
            console.log(`Fingerprint: ${fingerprint}`);
            
        } else {
            console.log("❌ Failed Normalization");
        }
    }
}

runDebug();

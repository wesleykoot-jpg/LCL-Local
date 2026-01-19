
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../supabase/functions/_shared/dateUtils.ts";
import { classifyTextToCategory, INTERNAL_CATEGORIES, type InternalCategory } from "../supabase/functions/_shared/categoryMapping.ts";

const TARGET_YEAR = 2026;

// --- Copied Logic ---

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
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
  }
  return null;
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

// Global deduplication hash
async function createContentHash(title: string, eventDate: string): Promise<string> {
  return sha256Hex(`${title}|${eventDate}`);
}

// Mock DB State
const EXISTING_EVENTS_DB = new Set<string>(); // Stores contentHashes

// --- Main Debug ---

async function runDebug() {
    console.log("Starting Debug Script - Deduplication Check...");
    
    // Simulate an existing event from Source A
    const eventA = {
        title: "Same Event",
        event_date: "2026-06-01"
    };
    const hashA = await createContentHash(eventA.title, eventA.event_date);
    EXISTING_EVENTS_DB.add(hashA);
    console.log(`[DB Setup] Added existing event: "${eventA.title}" on ${eventA.event_date} (Hash: ${hashA})`);

    // Simulate New Source B scraping the SAME event
    const sourceBId = "source-B";
    const rawEventB = {
        title: "Same Event",
        date: "2026-06-01",
        rawHtml: ""
    };

    console.log(`\nProcessing Source B event: "${rawEventB.title}" on ${rawEventB.date}`);
    
    // Normalize
    const title = normalizeWhitespace(rawEventB.title);
    const date = "2026-06-01"; // simplified for test

    // 1. Check Content Hash (Global Dedupe) - Used by scrape-worker
    const contentHash = await createContentHash(title, date);
    console.log(`Generated Content Hash: ${contentHash}`);
    
    if (EXISTING_EVENTS_DB.has(contentHash)) {
        console.log("❌ BLOCKED by Content Hash (Global Deduplication)");
        console.log("   Reason: This event already exists in the DB, possibly from another source.");
    } else {
        console.log("✅ Passed Content Hash check");
    }

    // 2. Check Fingerprint (Source Specific) - Used by run-scraper
    const fingerprint = await createEventFingerprint(title, date, sourceBId);
    console.log(`Generated Fingerprint: ${fingerprint}`);
    // Assume we check against DB for (sourceId, fingerprint)
    // Since sourceB is new, this would pass.
    console.log("✅ Would pass Fingerprint check (since Source ID is new)");

}

runDebug();

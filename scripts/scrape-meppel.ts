/**
 * Meppel Event Scraper
 * 
 * Scrapes event data from https://ontdekmeppel.nl/ontdek-meppel/agenda/
 * Uses OpenAI to parse and clean event data, then inserts into Supabase.
 * 
 * Required environment variables:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_PUBLISHABLE_KEY
 * - OPENAI_API_KEY
 * - SYSTEM_ADMIN_UUID (optional, for created_by field)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// =====================================================
// Configuration
// =====================================================

const TARGET_URL = 'https://ontdekmeppel.nl/ontdek-meppel/agenda/';

// Valid categories for the events table (from schema)
const VALID_CATEGORIES = ['cinema', 'crafts', 'sports', 'gaming', 'market'] as const;
type Category = typeof VALID_CATEGORIES[number];

// Default event type for scraped events
const DEFAULT_EVENT_TYPE = 'anchor';

// =====================================================
// Environment Validation
// =====================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SYSTEM_ADMIN_UUID = process.env.SYSTEM_ADMIN_UUID;

function validateEnvironment(): void {
  const missing: string[] = [];
  
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!SUPABASE_KEY) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease add these to your .env file.');
    process.exit(1);
  }
  
  if (!SYSTEM_ADMIN_UUID) {
    console.warn('⚠️  SYSTEM_ADMIN_UUID not set - events will be created without a creator.');
  }
}

// =====================================================
// Supabase Client
// =====================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

function createSupabaseClient(): AnySupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_KEY!);
}

// =====================================================
// OpenAI Client
// =====================================================

function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
}

// =====================================================
// Venue Geocoding
// =====================================================

interface VenueLocation {
  name: string;
  lat: number;
  lng: number;
}

// Hardcoded coordinates for known Meppel venues
const MEPPEL_VENUES: VenueLocation[] = [
  { name: 'Schouwburg Ogterop', lat: 52.6956, lng: 6.1938 },
  { name: 'Ogterop', lat: 52.6956, lng: 6.1938 },
  { name: "Herberg 't Plein", lat: 52.6964, lng: 6.1925 },
  { name: 't Plein', lat: 52.6964, lng: 6.1925 },
  { name: 'De Plataan', lat: 52.6961, lng: 6.1944 },
  { name: 'Café de Plataan', lat: 52.6961, lng: 6.1944 },
  { name: 'Sportpark Ezinge', lat: 52.6898, lng: 6.2012 },
  { name: 'Alcides', lat: 52.6898, lng: 6.2012 },
  { name: 'De Beurs', lat: 52.6959, lng: 6.1931 },
  { name: 'Luxor Cinema', lat: 52.6968, lng: 6.1920 },
  { name: 'Bibliotheek Meppel', lat: 52.6950, lng: 6.1905 },
  { name: 'Meppel Centrum', lat: 52.6960, lng: 6.1920 },
  { name: 'Reestkerk', lat: 52.7050, lng: 6.1950 },
  { name: 'Markt Meppel', lat: 52.6958, lng: 6.1935 },
];

// Default Meppel center coordinates
const DEFAULT_MEPPEL_LOCATION = { lat: 52.6960, lng: 6.1920 };

/**
 * Get coordinates for a venue name.
 * Tries fuzzy matching against known venues, returns default Meppel center if not found.
 */
function getVenueCoordinates(venueName: string): { lat: number; lng: number } {
  const normalizedName = venueName.toLowerCase().trim();
  
  for (const venue of MEPPEL_VENUES) {
    const normalizedVenueName = venue.name.toLowerCase();
    if (normalizedName.includes(normalizedVenueName) || normalizedVenueName.includes(normalizedName)) {
      return { lat: venue.lat, lng: venue.lng };
    }
  }
  
  // Return default Meppel center if venue not found
  console.log(`   📍 Unknown venue "${venueName}", using default Meppel center`);
  return DEFAULT_MEPPEL_LOCATION;
}

// =====================================================
// Scraping Functions
// =====================================================

interface RawEventCard {
  rawHtml: string;
  title: string;
  date: string;
  location: string;
  imageUrl: string | null;
  description: string;
  detailUrl: string | null;
}

/**
 * Fetches the agenda page and extracts raw event cards.
 */
async function scrapeEventCards(): Promise<RawEventCard[]> {
  console.log(`🌐 Fetching agenda from ${TARGET_URL}...`);
  
  const response = await axios.get(TARGET_URL, {
    headers: {
      'User-Agent': 'LCL-Meppel-Scraper/1.0 (Event aggregator for local social app)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
    },
    timeout: 30000,
  });
  
  const $ = cheerio.load(response.data);
  const events: RawEventCard[] = [];
  
  // Try multiple selectors to find event cards
  // Common patterns: article.event-card, div.agenda-item, .event-item, .card
  const selectors = [
    'article.event-card',
    'article.agenda-item',
    'div.event-card',
    'div.agenda-item',
    '.event-item',
    '.card.event',
    'article',
    '.agenda-event',
    '[class*="event"]',
    '[class*="agenda"]',
  ];
  
  let foundElements = $([]);
  
  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`   Found ${elements.length} elements with selector: ${selector}`);
      foundElements = elements;
      break;
    }
  }
  
  if (foundElements.length === 0) {
    console.log('   ⚠️  No event elements found with common selectors. Trying generic approach...');
    // Fallback: look for any article or card-like elements
    foundElements = $('article, .card, [class*="item"]').filter((_, el) => {
      const text = $(el).text();
      // Must have some content that looks like an event
      return text.length > 50 && text.length < 5000;
    });
  }
  
  console.log(`   Processing ${foundElements.length} potential event cards...`);
  
  foundElements.each((index, element) => {
    const $el = $(element);
    
    // Extract raw HTML for AI parsing
    const rawHtml = $el.html() || '';
    
    // Try to extract structured data directly
    const title = $el.find('h1, h2, h3, h4, .title, [class*="title"]').first().text().trim() ||
                  $el.find('a').first().text().trim();
    
    const date = $el.find('time, .date, [class*="date"], .event-date').first().text().trim() ||
                 $el.find('[datetime]').first().attr('datetime') || '';
    
    const location = $el.find('.location, .venue, [class*="location"], [class*="venue"]').first().text().trim() ||
                     $el.find('address').first().text().trim();
    
    const imageUrl = $el.find('img').first().attr('src') ||
                     $el.find('[style*="background-image"]').first().attr('style')?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] ||
                     null;
    
    const description = $el.find('.description, .excerpt, .summary, p').first().text().trim();
    
    const detailUrl = $el.find('a').first().attr('href') || null;
    
    // Only add if we have meaningful content
    if (title || rawHtml.length > 100) {
      events.push({
        rawHtml: rawHtml.substring(0, 3000), // Limit HTML size for AI
        title,
        date,
        location,
        imageUrl,
        description,
        detailUrl,
      });
    }
  });
  
  console.log(`   ✅ Extracted ${events.length} event cards`);
  return events;
}

// =====================================================
// AI Parsing
// =====================================================

interface ParsedEvent {
  title: string;
  description: string;
  category: Category;
  venue_name: string;
  event_date: string; // YYYY-MM-DD
  event_time: string; // HH:MM or descriptive
  image_url: string | null;
}

const AI_SYSTEM_PROMPT = `You are a data cleaner for a social event app in the Netherlands.
Your task is to extract event information from raw HTML text.

Extract the following fields:
- title: The event name (clean, without extra formatting)
- description: A nice, readable description (max 200 chars). If vague, create a brief summary.
- category: Map to one of these EXACT values: cinema, crafts, sports, gaming, market
  - cinema: movies, films, theater, performances, shows, concerts, music
  - crafts: workshops, art, creative activities, exhibitions
  - sports: sports events, fitness, outdoor activities, walking, cycling
  - gaming: gaming events, esports, board games
  - market: markets, fairs, festivals, food events, community events
- venue_name: The venue/location name
- event_date: Date in YYYY-MM-DD format. If only relative (e.g., "tomorrow"), calculate from today.
- event_time: Time in HH:MM format, or descriptive like "Evening" or "All day"
- image_url: Full image URL if found, or null

Today's date is: ${new Date().toISOString().split('T')[0]}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.
If you cannot extract meaningful data, return null for that field.`;

/**
 * Uses OpenAI to parse raw event data into structured format.
 */
async function parseEventWithAI(
  openai: OpenAI,
  rawEvent: RawEventCard
): Promise<ParsedEvent | null> {
  try {
    const userPrompt = `Parse this event data:

Title hint: ${rawEvent.title || 'unknown'}
Date hint: ${rawEvent.date || 'unknown'}
Location hint: ${rawEvent.location || 'unknown'}
Description hint: ${rawEvent.description || 'unknown'}
Image URL hint: ${rawEvent.imageUrl || 'none'}

Raw HTML:
${rawEvent.rawHtml}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log('   ⚠️  Empty AI response');
      return null;
    }

    const parsed = JSON.parse(content);
    
    // Validate required fields
    if (!parsed.title || !parsed.venue_name) {
      console.log('   ⚠️  Missing required fields from AI response');
      return null;
    }
    
    // Validate category
    if (!VALID_CATEGORIES.includes(parsed.category)) {
      console.log(`   ⚠️  Invalid category "${parsed.category}", defaulting to "market"`);
      parsed.category = 'market';
    }
    
    // Validate date format
    if (parsed.event_date && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.event_date)) {
      console.log(`   ⚠️  Invalid date format "${parsed.event_date}"`);
      // Try to parse and reformat
      const dateObj = new Date(parsed.event_date);
      if (!isNaN(dateObj.getTime())) {
        parsed.event_date = dateObj.toISOString().split('T')[0];
      } else {
        parsed.event_date = new Date().toISOString().split('T')[0];
      }
    }
    
    // Ensure event_date has a default
    if (!parsed.event_date) {
      parsed.event_date = new Date().toISOString().split('T')[0];
    }
    
    // Validate time format
    if (parsed.event_time && /^\d{1,2}:\d{2}$/.test(parsed.event_time)) {
      // Normalize to HH:MM
      const [hours, mins] = parsed.event_time.split(':');
      parsed.event_time = `${hours.padStart(2, '0')}:${mins}`;
    } else if (!parsed.event_time) {
      parsed.event_time = 'TBD';
    }

    return {
      title: parsed.title,
      description: parsed.description || '',
      category: parsed.category,
      venue_name: parsed.venue_name,
      event_date: parsed.event_date,
      event_time: parsed.event_time,
      image_url: parsed.image_url || rawEvent.imageUrl || null,
    };
  } catch (error) {
    console.error('   ❌ AI parsing error:', error);
    return null;
  }
}

// =====================================================
// Database Operations
// =====================================================

interface EventInsert {
  title: string;
  description: string;
  category: Category;
  event_type: string;
  venue_name: string;
  location: string; // PostGIS point as WKT
  event_date: string;
  event_time: string;
  image_url: string | null;
  created_by: string | null;
  status: string;
}

/**
 * Checks if an event with the same title and date already exists.
 */
async function eventExists(
  supabase: AnySupabaseClient,
  title: string,
  eventDate: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('title', title)
    .gte('event_date', `${eventDate}T00:00:00`)
    .lte('event_date', `${eventDate}T23:59:59`)
    .limit(1);
  
  if (error) {
    console.error('   ❌ Error checking for duplicates:', error.message);
    return false;
  }
  
  return (data?.length ?? 0) > 0;
}

/**
 * Inserts a single event into the database.
 */
async function insertEvent(
  supabase: AnySupabaseClient,
  event: EventInsert
): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .insert(event);
  
  if (error) {
    console.error(`   ❌ Failed to insert "${event.title}":`, error.message);
    return false;
  }
  
  return true;
}

// =====================================================
// Main Execution
// =====================================================

async function main(): Promise<void> {
  console.log('🚀 Meppel Event Scraper');
  console.log('========================\n');
  
  // Validate environment
  validateEnvironment();
  
  // Initialize clients
  const supabase = createSupabaseClient();
  const openai = createOpenAIClient();
  
  // Step 1: Scrape events
  console.log('\n📥 Step 1: Scraping event cards...\n');
  let rawEvents: RawEventCard[];
  
  try {
    rawEvents = await scrapeEventCards();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ Failed to fetch page: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
      }
    } else {
      console.error('❌ Scraping error:', error);
    }
    process.exit(1);
  }
  
  if (rawEvents.length === 0) {
    console.log('ℹ️  No events found on the page.');
    process.exit(0);
  }
  
  // Step 2: Parse with AI
  console.log('\n🤖 Step 2: Parsing events with AI...\n');
  const parsedEvents: ParsedEvent[] = [];
  
  for (let i = 0; i < rawEvents.length; i++) {
    const rawEvent = rawEvents[i];
    console.log(`   [${i + 1}/${rawEvents.length}] Processing: ${rawEvent.title || 'Unknown event'}...`);
    
    const parsed = await parseEventWithAI(openai, rawEvent);
    if (parsed) {
      parsedEvents.push(parsed);
      console.log(`      ✅ Parsed: "${parsed.title}" (${parsed.category})`);
    } else {
      console.log(`      ⚠️  Skipped: Could not parse event`);
    }
    
    // Rate limiting: small delay between API calls
    if (i < rawEvents.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`\n   ✅ Successfully parsed ${parsedEvents.length} of ${rawEvents.length} events`);
  
  // Step 3: Insert into database
  console.log('\n💾 Step 3: Inserting events into database...\n');
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const event of parsedEvents) {
    // Check for duplicates
    const exists = await eventExists(supabase, event.title, event.event_date);
    if (exists) {
      console.log(`   ⏭️  Skipping duplicate: "${event.title}" on ${event.event_date}`);
      skipped++;
      continue;
    }
    
    // Get venue coordinates
    const coords = getVenueCoordinates(event.venue_name);
    
    // Prepare insert data
    const insertData: EventInsert = {
      title: event.title,
      description: event.description,
      category: event.category,
      event_type: DEFAULT_EVENT_TYPE,
      venue_name: event.venue_name,
      location: `POINT(${coords.lng} ${coords.lat})`,
      event_date: `${event.event_date}T12:00:00Z`, // Default to noon if no time
      event_time: event.event_time,
      image_url: event.image_url,
      created_by: SYSTEM_ADMIN_UUID || null,
      status: 'Upcoming',
    };
    
    const success = await insertEvent(supabase, insertData);
    if (success) {
      console.log(`   ✅ Inserted: "${event.title}"`);
      inserted++;
    } else {
      failed++;
    }
  }
  
  // Summary
  console.log('\n========================');
  console.log('📊 Summary');
  console.log('========================');
  console.log(`   Total scraped:  ${rawEvents.length}`);
  console.log(`   Parsed by AI:   ${parsedEvents.length}`);
  console.log(`   Inserted:       ${inserted}`);
  console.log(`   Skipped (dup):  ${skipped}`);
  console.log(`   Failed:         ${failed}`);
  console.log('\n✨ Done!\n');
}

// Run the scraper
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

/**
 * Intelligent Categorizer - Language-Agnostic Event Classification
 * 
 * This module implements the "Refinery" categorization logic with:
 * - Bilingual keyword dictionaries (Dutch/English)
 * - Source default fallbacks
 * - AI classification for ambiguous cases
 * 
 * Returns uppercase CategoryKey values (e.g., 'MUSIC', 'ACTIVE')
 * which are stored in the database and localized in the frontend.
 */

import type { CategoryKey } from './types.ts';
import { CATEGORY_KEYS } from './types.ts';

// ============================================================================
// BILINGUAL KEYWORD MAPPINGS
// ============================================================================

interface KeywordMap {
  key: CategoryKey;
  nl: string[];  // Dutch keywords
  en: string[];  // English keywords
  urlPatterns?: RegExp[];  // URL pattern hints
}

// Re-order to check specific categories first
const KEYWORD_MAPS: KeywordMap[] = [
  {
    key: 'NIGHTLIFE',
    nl: ['club', 'disco', 'uitgaan', 'feest', 'dansen', 'nachtleven', 'party', 'rave', 'techno', 'house', 'nachtclub', 'nachtmarkt'],
    en: ['club', 'nightclub', 'party', 'dance', 'nightlife', 'clubbing', 'rave', 'techno', 'house'],
    urlPatterns: [/\/club/i, /\/party/i, /\/nightlife/i]
  },
  {
    key: 'FOOD',
    nl: ['proeverij', 'culinair', 'restaurant', 'foodtruck', 'wijn', 'bier', 'lunch', 'streekmarkt', 'gastronomie'],
    en: ['tasting', 'culinary', 'restaurant', 'food truck', 'wine', 'beer', 'lunch', 'gastronomy'],
    urlPatterns: [/\/food/i, /\/restaurant/i, /\/markt/i, /\/market/i]
  },
  {
    key: 'FAMILY',
    nl: ['kinderen', 'familie', 'gezin', 'kids', 'jeugd', 'basisschool', 'speeltuin', 'kinderfestival', 'kinderboerderij', 'kermis'],
    en: ['children', 'family', 'kids', 'youth', 'playground', 'family-friendly', 'petting zoo', 'fair'],
    urlPatterns: [/\/kids/i, /\/family/i, /\/kinderen/i]
  },
  {
    key: 'MUSIC',
    nl: ['muziek', 'optreden', 'concert', 'band', 'dj', 'jazz', 'klassiek', 'pop', 'rock', 'live', 'zanger', 'zangeres', 'orkest', 'koor', 'jam-sessie', 'recital'],
    en: ['music', 'concert', 'gig', 'festival', 'band', 'performance', 'live music', 'jazz', 'classical', 'pop', 'rock', 'singer', 'orchestra', 'choir', 'jam session', 'recital'],
    urlPatterns: [/\/concert/i, /\/muziek/i, /\/music/i, /\/live/i]
  },
  {
    key: 'CULTURE',
    nl: ['theater', 'museum', 'tentoonstelling', 'kunst', 'film', 'bioscoop', 'voorstelling', 'cabaret', 'comedy', 'workshop', 'cursus', 'gaming', 'expositie', 'poëzie', 'literatuur', 'lezing', 'bibliotheek'],
    en: ['theater', 'theatre', 'museum', 'exhibition', 'art', 'cinema', 'film', 'show', 'cabaret', 'comedy', 'workshop', 'course', 'gaming', 'poetry', 'literature', 'lecture', 'library'],
    urlPatterns: [/\/theater/i, /\/museum/i, /\/art/i, /\/workshop/i, /\/expositie/i, /\/lezing/i]
  },
  {
    key: 'ACTIVE',
    nl: ['sport', 'yoga', 'wandeling', 'hardlopen', 'fietsen', 'fitness', 'gym', 'marathon', 'voetbal', 'tennis', 'zwemmen', 'dansles', 'bootcamp', 'surfen', 'zeilen', 'stadsommetje'],
    en: ['sports', 'yoga', 'hiking', 'running', 'cycling', 'workout', 'fitness', 'gym', 'marathon', 'football', 'soccer', 'tennis', 'swimming', 'dance class', 'bootcamp', 'surfing', 'sailing'],
    urlPatterns: [/\/sport/i, /\/fitness/i, /\/yoga/i]
  },
  {
    key: 'SOCIAL',
    nl: ['borrel', 'netwerken', 'meetup', 'vrijmibo', 'vrijdagmiddag', 'networking', 'drink', 'sociaal', 'afterwork', 'ontmoeting', 'bijeenkomst', 'gezelligheid', 'speeddate', 'vereniging'],
    en: ['drinks', 'networking', 'meetup', 'social', 'happy hour', 'afterwork', 'gathering', 'networking event', 'speed dating', 'club meeting'],
    urlPatterns: [/\/networking/i, /\/meetup/i, /\/social/i]
  },
  {
    key: 'CIVIC',
    nl: ['politiek', 'gemeente', 'inspraak', 'vergadering', 'gemeenteraad', 'overheid', 'vrijwilliger', 'buurt', 'wijkreünie', 'town hall'],
    en: ['politics', 'municipality', 'civic', 'meeting', 'government', 'council', 'volunteer', 'neighborhood', 'service'],
    urlPatterns: [/\/gemeente/i, /\/civic/i, /\/politics/i]
  }
];

// ============================================================================
// TAGGING LOGIC (Granular Classification)
// ============================================================================

const TAG_DEFINITIONS: Record<CategoryKey, string[]> = {
  MUSIC: ['concert', 'live', 'jazz', 'band', 'dj', 'klassiek', 'pop', 'rock', 'orkest', 'koor', 'jam-sessie', 'recital'],
  SOCIAL: ['networking', 'drink', 'meetup', 'borrel', 'vrijmibo', 'speeddate', 'ontmoeting', 'netwerk', 'netwerken'],
  ACTIVE: ['yoga', 'hiking', 'run', 'sport', 'fitness', 'dansles', 'bootcamp', 'surfen', 'zeilen', 'wandeling'],
  CULTURE: ['film', 'art', 'theater', 'museum', 'expositie', 'kunst', 'cabaret', 'comedy', 'workshop', 'cursus', 'poëzie', 'lezing'],
  FOOD: ['market', 'wine', 'beer', 'proeverij', 'brunch', 'diner', 'lunch', 'streekmarkt'],
  NIGHTLIFE: ['rave', 'techno', 'house', 'club', 'party', 'festival', 'dj'],
  FAMILY: ['kids', 'family', 'fair', 'speeltuin', 'kinderboerderij', 'jeugd'],
  CIVIC: ['buurt', 'service', 'vrijwilliger', 'gemeente', 'politiek', 'inspraak'],
  COMMUNITY: ['buurt', 'vrijwilliger']
};

/**
 * Extracts granular tags from text based on the assigned category.
 */
export function extractTags(text: string, category: CategoryKey): string[] {
  const lowerText = (text || '').toLowerCase();
  const possibleTags = TAG_DEFINITIONS[category] || [];
  
  // Find all matching tags from the definition
  const foundTags = possibleTags.filter(tag => {
    // For tags, we allow it to be at start/end or surrounded by non-alpha characters
    // This handles "sporten" matching "sport" but we should be careful.
    // Let's use a simpler "includes" or a more flexible regex.
    return lowerText.includes(tag);
  });

  return [...new Set(foundTags)];
}

// ============================================================================
// PRIORITY-BASED CATEGORIZATION
// ============================================================================

/**
 * Maps text and URL to a CategoryKey using multi-tier logic:
 * 
 * Priority 1: URL patterns (fastest, most reliable)
 * Priority 2: Keyword matching (bilingual)
 * Priority 3: Source default (venue-specific hint)
 * Priority 4: Fallback to COMMUNITY
 * 
 * @param text - Event description, title, or combined text
 * @param sourceDefault - Optional default category from source config
 * @param url - Optional event URL for pattern matching
 * @returns Uppercase CategoryKey
 */
export function mapToCategoryKey(
  text: string,
  sourceDefault?: CategoryKey,
  url?: string
): CategoryKey {
  const lowerText = (text || '').toLowerCase();
  
  // Priority 1: URL pattern matching (fast path)
  if (url) {
    for (const map of KEYWORD_MAPS) {
      if (map.urlPatterns && map.urlPatterns.some(pattern => pattern.test(url))) {
        return map.key;
      }
    }
  }
  
  // Priority 2: Keyword matching (Dutch + English)
  for (const map of KEYWORD_MAPS) {
    const allKeywords = [...map.nl, ...map.en];
    if (allKeywords.some(keyword => {
      // Use regex for word boundaries to improve accuracy
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerText);
    })) {
      return map.key;
    }
  }
  
  // Priority 3: Source default (venue-specific)
  if (sourceDefault && CATEGORY_KEYS.includes(sourceDefault)) {
    return sourceDefault;
  }
  
  // Priority 4: Fallback to COMMUNITY
  return 'COMMUNITY';
}

/**
 * Filter out non-event noise (comments, blog posts, etc.)
 */
export function isProbableEvent(title: string, description?: string): boolean {
  const lowerTitle = (title || '').toLowerCase();
  const _lowerDesc = (description || '').toLowerCase();

  // 1. Check for comment/blog patterns in title
  const noisePatterns = [
    /^reactie op/i,
    /^comment on/i,
    /^re:/i,
    /antwoorden$/i,
    /reply$/i,
    /leestijd/i, // Reading time (blog post)
    /geschreven door/i,
    /posted by/i
  ];

  if (noisePatterns.some(pattern => pattern.test(lowerTitle))) {
    return false;
  }

  // 2. Minimum length requirements
  if (lowerTitle.length < 5) return false;

  // 3. Reject if title is just a username or very generic
  const genericTitles = ['admin', 'geen titel', 'no title', 'anonymous'];
  if (genericTitles.includes(lowerTitle)) return false;

  return true;
}

/**
 * AI-based classification for ambiguous cases
 * Uses OpenAI to select one of the 9 CategoryKey values
 * 
 * @param apiKey - OpenAI API key (should start with 'sk-')
 * @param description - Event description/title
 * @param fetcher - Fetch function (for testing compatibility)
 * @returns CategoryKey or 'COMMUNITY' on failure
 */
export async function classifyWithAI(
  apiKey: string,
  description: string,
  fetcher: typeof fetch = fetch
): Promise<CategoryKey> {
  const prompt = `You are an event categorization expert. Assign EXACTLY ONE category key from this list:
${CATEGORY_KEYS.join(', ')}

Category definitions:
- MUSIC: Concerts, festivals, live performances
- SOCIAL: Networking, meetups, drinks (borrel)
- ACTIVE: Sports, fitness, outdoor activities
- CULTURE: Theater, museums, workshops, gaming
- FOOD: Dining, tastings, culinary events
- NIGHTLIFE: Clubs, parties, late-night events
- FAMILY: Kids activities, family-friendly
- CIVIC: Political, municipal, civic engagement
- COMMUNITY: General community events (fallback)

Event description: ${description.slice(0, 500)}

Respond with ONLY the category key in uppercase, nothing else.`;

  try {
    const response = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      console.warn('AI categorization failed:', response.status);
      return 'COMMUNITY';
    }
    
    const data = await response.json();
    const key = data.choices?.[0]?.message?.content?.trim() as CategoryKey;
    
    // Validate response
    return CATEGORY_KEYS.includes(key) ? key : 'COMMUNITY';
  } catch (error) {
    console.error('Error in AI classification:', error);
    return 'COMMUNITY';
  }
}

/**
 * Legacy compatibility: Maps old lowercase category values to new uppercase keys
 * Used during migration period
 */
export function legacyCategoryToKey(oldCategory: string): CategoryKey {
  const mapping: Record<string, CategoryKey> = {
    'music': 'MUSIC',
    'active': 'ACTIVE',
    'social': 'SOCIAL',
    'family': 'FAMILY',
    'foodie': 'FOOD',
    'food': 'FOOD',
    'entertainment': 'CULTURE',
    'gaming': 'CULTURE',
    'workshops': 'CULTURE',
    'outdoors': 'ACTIVE',
    'nightlife': 'NIGHTLIFE',
    'community': 'COMMUNITY'
  };
  
  return mapping[oldCategory.toLowerCase()] || 'COMMUNITY';
}

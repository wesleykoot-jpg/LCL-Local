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

const KEYWORD_MAPS: KeywordMap[] = [
  {
    key: 'MUSIC',
    nl: ['muziek', 'optreden', 'concert', 'festival', 'band', 'dj', 'jazz', 'klassiek', 'pop', 'rock', 'live'],
    en: ['music', 'concert', 'gig', 'festival', 'band', 'performance', 'live music', 'jazz', 'classical', 'pop', 'rock'],
    urlPatterns: [/\/concert/i, /\/muziek/i, /\/music/i, /\/live/i]
  },
  {
    key: 'ACTIVE',
    nl: ['sport', 'yoga', 'wandeling', 'hardlopen', 'fietsen', 'fitness', 'gym', 'marathon', 'voetbal', 'tennis', 'zwemmen'],
    en: ['sports', 'yoga', 'hiking', 'running', 'cycling', 'workout', 'fitness', 'gym', 'marathon', 'football', 'soccer', 'tennis', 'swimming'],
    urlPatterns: [/\/sport/i, /\/fitness/i, /\/yoga/i]
  },
  {
    key: 'CULTURE',
    nl: ['theater', 'museum', 'tentoonstelling', 'kunst', 'film', 'bioscoop', 'voorstelling', 'cabaret', 'comedy', 'workshop', 'cursus', 'gaming'],
    en: ['theater', 'theatre', 'museum', 'exhibition', 'art', 'cinema', 'film', 'show', 'cabaret', 'comedy', 'workshop', 'course', 'gaming'],
    urlPatterns: [/\/theater/i, /\/museum/i, /\/art/i, /\/workshop/i]
  },
  {
    key: 'FOOD',
    nl: ['eten', 'proeverij', 'culinair', 'restaurant', 'markt', 'foodtruck', 'wijn', 'bier', 'diner', 'lunch', 'koken'],
    en: ['food', 'tasting', 'culinary', 'restaurant', 'market', 'food truck', 'wine', 'beer', 'dining', 'dinner', 'lunch', 'cooking'],
    urlPatterns: [/\/food/i, /\/restaurant/i, /\/markt/i, /\/market/i]
  },
  {
    key: 'NIGHTLIFE',
    nl: ['club', 'disco', 'uitgaan', 'feest', 'dansen', 'nachtleven', 'party'],
    en: ['club', 'nightclub', 'party', 'dance', 'nightlife', 'clubbing'],
    urlPatterns: [/\/club/i, /\/party/i, /\/nightlife/i]
  },
  {
    key: 'SOCIAL',
    nl: ['borrel', 'netwerken', 'meetup', 'vrijmibo', 'vrijdagmiddag', 'networking', 'drink', 'sociaal', 'afterwork'],
    en: ['drinks', 'networking', 'meetup', 'social', 'happy hour', 'afterwork', 'gathering'],
    urlPatterns: [/\/networking/i, /\/meetup/i, /\/social/i]
  },
  {
    key: 'FAMILY',
    nl: ['kinderen', 'familie', 'gezin', 'kids', 'jeugd', 'basisschool', 'speeltuin', 'kinderfestival'],
    en: ['children', 'family', 'kids', 'youth', 'playground', 'family-friendly'],
    urlPatterns: [/\/kids/i, /\/family/i, /\/kinderen/i]
  },
  {
    key: 'CIVIC',
    nl: ['politiek', 'gemeente', 'inspraak', 'vergadering', 'gemeenteraad', 'overheid'],
    en: ['politics', 'municipality', 'civic', 'meeting', 'government', 'council'],
    urlPatterns: [/\/gemeente/i, /\/civic/i, /\/politics/i]
  }
];

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
    if (allKeywords.some(keyword => lowerText.includes(keyword))) {
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

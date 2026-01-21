/**
 * Category definitions for event classification
 * Maps to categories from src/lib/categories.ts
 * 
 * Used by source-discovery and scrape-events functions
 */

import type { CategoryKey } from './types.ts';
import { CATEGORY_KEYS } from './types.ts';

/**
 * Modern category IDs used across the application
 * @deprecated Use CategoryKey from types.ts instead
 */
export const INTERNAL_CATEGORIES = CATEGORY_KEYS;
export type InternalCategory = CategoryKey;

export interface CategoryDefinition {
  /** Category ID matching src/lib/categories.ts */
  id: string;
  /** Dutch label for search queries */
  labelNL: string;
  /** English label */
  labelEN: string;
  /** Dutch search terms for agenda discovery */
  searchTermsNL: string[];
  /** Keywords that indicate this category in event content */
  keywordsNL: string[];
  keywordsEN: string[];
}

/**
 * Categories aligned with src/lib/categories.ts
 */
export const CATEGORIES: CategoryDefinition[] = [
  {
    id: "active",
    labelNL: "Sport & Actief",
    labelEN: "Active",
    searchTermsNL: ["sport", "fitness", "hardlopen", "wielrennen", "zwemmen", "wandelen", "yoga"],
    keywordsNL: ["sport", "fitness", "hardlopen", "wielrennen", "fietsen", "zwemmen", "wandelen", "yoga", "bootcamp", "marathon", "trimloop", "atletiek", "gym", "crossfit", "voetbal", "voetbalwedstrijd", "ajax", "feyenoord", "psv", "tennis", "hockey", "basketbal", "volleybal"],
    keywordsEN: ["sport", "fitness", "running", "cycling", "swimming", "walking", "yoga", "gym", "workout", "marathon", "soccer", "football", "tennis", "hockey", "basketball", "volleyball"],
  },
  {
    id: "gaming",
    labelNL: "Gaming",
    labelEN: "Gaming",
    searchTermsNL: ["gaming", "esports", "spelletjes", "boardgames"],
    keywordsNL: ["gaming", "esports", "spelletjes", "bordspellen", "videogames", "lan-party", "gamenight", "spellenavond", "dungeons", "roleplay"],
    keywordsEN: ["gaming", "esports", "video games", "board games", "tabletop", "lan party", "dungeons", "roleplay"],
  },
  {
    id: "entertainment",
    labelNL: "Entertainment",
    labelEN: "Entertainment",
    searchTermsNL: ["theater", "film", "comedy", "cabaret", "bioscoop", "voorstelling"],
    keywordsNL: ["theater", "film", "bioscoop", "comedy", "cabaret", "musical", "show", "voorstelling", "stand-up", "circus", "entertainment", "optreden"],
    keywordsEN: ["theater", "film", "cinema", "comedy", "show", "performance", "stand-up", "circus", "entertainment"],
  },
  {
    id: "social",
    labelNL: "Sociaal",
    labelEN: "Social",
    searchTermsNL: ["borrel", "netwerken", "meetup", "ontmoeting", "sociaal"],
    keywordsNL: ["borrel", "vrijmibo", "vrijdagmiddag", "netwerken", "networking", "meetup", "ontmoeting", "drink", "happy hour", "afterwork", "bijeenkomst", "sociaal"],
    keywordsEN: ["networking", "meetup", "social", "drinks", "happy hour", "afterwork", "gathering"],
  },
  {
    id: "family",
    labelNL: "Familie",
    labelEN: "Family",
    searchTermsNL: ["kinderen", "familie", "gezin", "jeugd", "speeltuin"],
    keywordsNL: ["kinderen", "kids", "familie", "gezin", "jeugd", "basisschool", "speeltuin", "kinderopvang", "zwemles", "voorlezen", "knutselen", "familiedag", "kinderfestival", "peutergroep"],
    keywordsEN: ["children", "kids", "family", "youth", "playground", "daycare", "swimming lessons", "craft", "reading"],
  },
  {
    id: "outdoors",
    labelNL: "Buitenactiviteiten",
    labelEN: "Outdoors",
    searchTermsNL: ["natuur", "buiten", "wandeling", "excursie", "outdoor"],
    keywordsNL: ["natuur", "buiten", "outdoor", "wandeling", "excursie", "fietstocht", "vogelen", "kamperen", "picknick", "park", "bos", "strand", "duinen"],
    keywordsEN: ["nature", "outdoor", "hiking", "excursion", "cycling tour", "birdwatching", "camping", "picnic", "park", "forest", "beach"],
  },
  {
    id: "music",
    labelNL: "Muziek",
    labelEN: "Music",
    searchTermsNL: ["concert", "muziek", "festival", "live muziek", "optreden"],
    keywordsNL: ["concert", "muziek", "festival", "live", "optreden", "band", "dj", "jazz", "klassiek", "pop", "rock", "dance", "techno", "house", "openlucht"],
    keywordsEN: ["concert", "music", "festival", "live", "performance", "band", "dj", "jazz", "classical", "pop", "rock", "dance"],
  },
  {
    id: "workshops",
    labelNL: "Workshops",
    labelEN: "Workshops",
    searchTermsNL: ["workshop", "cursus", "les", "training", "masterclass"],
    keywordsNL: ["workshop", "cursus", "les", "training", "masterclass", "lezing", "college", "leren", "creatief", "koken", "schilderen", "fotograferen", "ambacht"],
    keywordsEN: ["workshop", "course", "lesson", "training", "masterclass", "lecture", "learning", "creative", "cooking", "painting", "photography", "craft"],
  },
  {
    id: "foodie",
    labelNL: "Food & Drink",
    labelEN: "Foodie",
    searchTermsNL: ["eten", "proeverij", "wijn", "bier", "culinair", "markt"],
    keywordsNL: ["eten", "food", "proeverij", "wijn", "bier", "culinair", "restaurant", "markt", "foodtruck", "koken", "smaak", "diner", "lunch", "high tea", "borrelhapjes"],
    keywordsEN: ["food", "tasting", "wine", "beer", "culinary", "restaurant", "market", "food truck", "cooking", "dinner", "lunch", "high tea"],
  },
  {
    id: "community",
    labelNL: "Community",
    labelEN: "Community",
    searchTermsNL: ["buurt", "wijk", "gemeente", "vrijwilliger", "inspraak"],
    keywordsNL: ["buurt", "wijk", "gemeente", "vrijwilliger", "inspraak", "bewoners", "vereniging", "stichting", "lokaal", "samen", "participatie", "buurthuis", "wijkcentrum"],
    keywordsEN: ["neighborhood", "community", "volunteer", "local", "together", "participation", "community center"],
  },
];

/**
 * Dutch parenting keywords that force "family" category (Hybrid Life logic)
 */
export const DUTCH_FAMILY_KEYWORDS = [
  "basisschool",
  "speeltuin",
  "kinderopvang",
  "zwemles",
  "peutergroep",
  "kinderfeest",
  "jeugdclub",
  "schoolfeest",
  "kinderactiviteit",
  "gezinsdag",
  "voorlezen",
  "kinderboerderij",
  "kinderdisco",
  "sinterklaas",
  "kinderen",
  "ouder-kind",
];

/**
 * Dutch adult social keywords that prioritize "social" or "foodie" (Hybrid Life logic)
 */
export const DUTCH_SOCIAL_KEYWORDS = [
  "borrel",
  "vrijdagmiddag",
  "vrijmibo",
  "netwerken",
  "networking",
  "proeverij",
  "wijnproeverij",
  "bierproeverij",
  "happy hour",
  "afterwork",
  "stamppot",
  "vrijgezellenfeest",
  "singles",
  "speed date",
];

/**
 * Get category by ID
 */
export function getCategoryById(id: string): CategoryDefinition | undefined {
  return CATEGORIES.find(c => c.id === id);
}

/**
 * Classify text to category using keyword matching
 * Implements "Hybrid Life" logic for Dutch-specific keywords
 * 
 * @returns Uppercase CategoryKey (e.g., 'MUSIC', 'ACTIVE')
 */
export function classifyTextToCategory(text: string): CategoryKey {
  // Handle null/undefined input defensively
  if (!text) {
    return 'COMMUNITY';
  }
  
  const lowerText = text.toLowerCase();

  // Hybrid Life: Force family if Dutch parenting keywords detected
  for (const keyword of DUTCH_FAMILY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return 'FAMILY';
    }
  }

  // Hybrid Life: Prioritize social/foodie for adult social keywords
  for (const keyword of DUTCH_SOCIAL_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      // Check if it's more food-related
      if (lowerText.includes('proeverij') || lowerText.includes('wijn') || lowerText.includes('bier') || lowerText.includes('eten')) {
        return 'FOOD';
      }
      return 'SOCIAL';
    }
  }

  // Direct keyword mapping (uppercase returns)
  const keywordToCategoryMap: Record<string, CategoryKey> = {
    // Music
    'muziek': 'MUSIC', 'concert': 'MUSIC', 'optreden': 'MUSIC', 'festival': 'MUSIC', 'band': 'MUSIC', 'dj': 'MUSIC',
    // Active
    'sport': 'ACTIVE', 'yoga': 'ACTIVE', 'wandeling': 'ACTIVE', 'hardlopen': 'ACTIVE', 'fietsen': 'ACTIVE', 'fitness': 'ACTIVE',
    // Culture
    'theater': 'CULTURE', 'theatre': 'CULTURE', 'museum': 'CULTURE', 'film': 'CULTURE', 'bioscoop': 'CULTURE', 
    'tentoonstelling': 'CULTURE', 'kunst': 'CULTURE', 'workshop': 'CULTURE', 'cursus': 'CULTURE', 'gaming': 'CULTURE',
    // Food
    'eten': 'FOOD', 'restaurant': 'FOOD', 'culinair': 'FOOD', 'markt': 'FOOD', 'market': 'FOOD',
    // Nightlife
    'club': 'NIGHTLIFE', 'feest': 'NIGHTLIFE', 'uitgaan': 'NIGHTLIFE', 'disco': 'NIGHTLIFE', 'party': 'NIGHTLIFE',
    // Social
    'netwerken': 'SOCIAL', 'networking': 'SOCIAL', 'meetup': 'SOCIAL',
    // Family
    'kinderen': 'FAMILY', 'familie': 'FAMILY', 'kids': 'FAMILY', 'gezin': 'FAMILY',
    // Civic
    'politiek': 'CIVIC', 'gemeente': 'CIVIC', 'gemeenteraad': 'CIVIC'
  };

  // Check for keyword matches
  for (const [keyword, category] of Object.entries(keywordToCategoryMap)) {
    if (lowerText.includes(keyword)) {
      return category;
    }
  }

  // Standard category keyword matching using category definitions
  for (const category of CATEGORIES) {
    for (const keyword of category.keywordsNL) {
      if (lowerText.includes(keyword)) {
        // Map old IDs to new CategoryKeys
        return mapLegacyIdToKey(category.id);
      }
    }
    for (const keyword of category.keywordsEN) {
      if (lowerText.includes(keyword)) {
        return mapLegacyIdToKey(category.id);
      }
    }
  }

  // Default to COMMUNITY for general events
  return 'COMMUNITY';
}

/**
 * Maps legacy lowercase category IDs to uppercase CategoryKeys
 */
function mapLegacyIdToKey(legacyId: string): CategoryKey {
  const mapping: Record<string, CategoryKey> = {
    'active': 'ACTIVE',
    'gaming': 'CULTURE',
    'entertainment': 'CULTURE',
    'social': 'SOCIAL',
    'family': 'FAMILY',
    'outdoors': 'ACTIVE',
    'music': 'MUSIC',
    'workshops': 'CULTURE',
    'foodie': 'FOOD',
    'community': 'COMMUNITY'
  };
  
  return mapping[legacyId] || 'COMMUNITY';
}

/**
 * Get search queries for a category in Dutch
 */
export function getSearchQueriesForCategory(categoryId: string): string[] {
  const category = getCategoryById(categoryId);
  if (!category) return [];
  return category.searchTermsNL;
}

/**
 * Get all category IDs
 */
export function getAllCategoryIds(): string[] {
  return CATEGORIES.map(c => c.id);
}

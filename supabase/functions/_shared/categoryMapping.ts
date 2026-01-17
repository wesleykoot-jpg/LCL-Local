/**
 * Category definitions for event classification
 * Maps to categories from src/lib/categories.ts
 * 
 * Used by source-discovery and scrape-events functions
 */

/**
 * Modern category IDs used across the application
 */
export const INTERNAL_CATEGORIES = ["active", "gaming", "entertainment", "social", "family", "outdoors", "music", "workshops", "foodie", "community"] as const;
export type InternalCategory = (typeof INTERNAL_CATEGORIES)[number];

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
    keywordsNL: ["sport", "fitness", "hardlopen", "wielrennen", "fietsen", "zwemmen", "wandelen", "yoga", "bootcamp", "marathon", "trimloop", "atletiek", "gym", "crossfit", "voetbal"],
    keywordsEN: ["sport", "fitness", "running", "cycling", "swimming", "walking", "yoga", "gym", "workout", "marathon", "soccer", "football"],
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
 * Note: Returns category IDs from src/lib/categories.ts.
 * The scrape functions have their own INTERNAL_CATEGORIES mapping.
 */
export function classifyTextToCategory(text: string): string {
  // Handle null/undefined input defensively
  if (!text) {
    return "community";
  }
  
  const lowerText = text.toLowerCase();

  // Hybrid Life: Force family if Dutch parenting keywords detected
  for (const keyword of DUTCH_FAMILY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return "family";
    }
  }

  // Hybrid Life: Prioritize social/foodie for adult social keywords
  for (const keyword of DUTCH_SOCIAL_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      // Check if it's more food-related
      if (lowerText.includes("proeverij") || lowerText.includes("wijn") || lowerText.includes("bier") || lowerText.includes("eten")) {
        return "foodie";
      }
      return "social";
    }
  }

  // Standard keyword matching using category definitions
  for (const category of CATEGORIES) {
    for (const keyword of category.keywordsNL) {
      if (lowerText.includes(keyword)) {
        return category.id;
      }
    }
    for (const keyword of category.keywordsEN) {
      if (lowerText.includes(keyword)) {
        return category.id;
      }
    }
  }

  // Default to community for general events
  return "community";
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

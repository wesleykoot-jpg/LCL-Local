import { describe, it, expect } from 'vitest';

/**
 * Test for NL-Context Intelligent Mapping (Phase 2)
 * Tests the Hybrid Life logic for Dutch keyword classification
 */

// Dutch parenting keywords that force "family" category
const DUTCH_FAMILY_KEYWORDS = [
  "basisschool", "speeltuin", "kinderopvang", "zwemles", "peutergroep",
  "kinderfeest", "jeugdclub", "schoolfeest", "kinderactiviteit", "gezinsdag",
  "voorlezen", "kinderboerderij", "kinderdisco", "sinterklaas", "kinderen", "ouder-kind"
];

// Dutch adult social keywords that prioritize "social" or "foodie"
const DUTCH_SOCIAL_KEYWORDS = [
  "borrel", "vrijdagmiddag", "vrijmibo", "netwerken", "networking", "proeverij",
  "wijnproeverij", "bierproeverij", "happy hour", "afterwork", "singles", "speed date"
];

// Internal categories (matching INTERNAL_CATEGORIES in scrape-events)
type InternalCategory = "nightlife" | "food" | "culture" | "active" | "family";

/**
 * mapToInternalCategory implementation matching the one in scrape-events
 * This is extracted here for testing purposes
 */
function mapToInternalCategory(input?: string): InternalCategory {
  const value = (input || "").toLowerCase();

  // Hybrid Life: Force family if Dutch parenting keywords detected
  for (const keyword of DUTCH_FAMILY_KEYWORDS) {
    if (value.includes(keyword)) {
      return "family";
    }
  }

  // Hybrid Life: Prioritize food/social for adult social keywords
  for (const keyword of DUTCH_SOCIAL_KEYWORDS) {
    if (value.includes(keyword)) {
      // Check if it's more food-related
      if (value.includes("proeverij") || value.includes("wijn") || value.includes("bier") || value.includes("eten")) {
        return "food";
      }
      return "culture"; // Maps to social activities
    }
  }

  const keywordMap: Array<{ cat: InternalCategory; terms: string[] }> = [
    { cat: "nightlife", terms: ["night", "club", "dj", "concert", "music", "party", "bar"] },
    { cat: "food", terms: ["food", "dinner", "restaurant", "wine", "beer", "market", "taste"] },
    { cat: "culture", terms: ["museum", "exhibition", "theater", "art", "culture", "film"] },
    { cat: "active", terms: ["sport", "run", "walk", "cycling", "bike", "yoga", "fitness"] },
    { cat: "family", terms: ["kids", "family", "children", "parent", "play", "zoo"] },
  ];

  for (const entry of keywordMap) {
    if (entry.terms.some((term) => value.includes(term))) {
      return entry.cat;
    }
  }

  // map legacy categories from AI outputs
  if (["cinema", "gaming"].includes(value)) return "culture";
  if (["crafts"].includes(value)) return "family";
  if (["sports"].includes(value)) return "active";

  return "culture";
}

describe('Hybrid Life Category Classification', () => {
  describe('Dutch Family Keywords (Phase 2)', () => {
    it('should classify basisschool events as family', () => {
      expect(mapToInternalCategory('Basisschool Open Dag')).toBe('family');
      expect(mapToInternalCategory('workshop voor basisschool kinderen')).toBe('family');
    });

    it('should classify speeltuin events as family', () => {
      expect(mapToInternalCategory('Speeltuin Festival')).toBe('family');
      expect(mapToInternalCategory('Nieuwe speeltuin geopend')).toBe('family');
    });

    it('should classify kinderopvang events as family', () => {
      expect(mapToInternalCategory('Kinderopvang Open Huis')).toBe('family');
    });

    it('should classify zwemles events as family', () => {
      expect(mapToInternalCategory('Zwemles voor beginners')).toBe('family');
    });

    it('should classify sinterklaas events as family', () => {
      expect(mapToInternalCategory('Sinterklaas Intocht')).toBe('family');
      expect(mapToInternalCategory('Sinterklaasfeest voor kinderen')).toBe('family');
    });

    it('should classify voorlezen events as family', () => {
      expect(mapToInternalCategory('Voorlezen in de bibliotheek')).toBe('family');
    });

    it('should classify kinderboerderij events as family', () => {
      expect(mapToInternalCategory('Bezoek kinderboerderij')).toBe('family');
    });
  });

  describe('Dutch Adult Social Keywords (Phase 2)', () => {
    it('should classify borrel events as culture (social activity)', () => {
      expect(mapToInternalCategory('Vrijdagmiddag Borrel')).toBe('culture');
      expect(mapToInternalCategory('Nieuwjaarsborrel')).toBe('culture');
    });

    it('should classify vrijmibo events as culture', () => {
      expect(mapToInternalCategory('Vrijmibo bij het stadskantoor')).toBe('culture');
    });

    it('should classify netwerken events as culture', () => {
      expect(mapToInternalCategory('Netwerken voor ondernemers')).toBe('culture');
      expect(mapToInternalCategory('Networking Event Amsterdam')).toBe('culture');
    });

    it('should classify wijnproeverij as food', () => {
      expect(mapToInternalCategory('Wijnproeverij')).toBe('food');
      expect(mapToInternalCategory('Franse wijnproeverij avond')).toBe('food');
    });

    it('should classify bierproeverij as food', () => {
      expect(mapToInternalCategory('Bierproeverij lokale brouwerij')).toBe('food');
    });

    it('should classify proeverij with food context as food', () => {
      expect(mapToInternalCategory('Kaas en wijn proeverij')).toBe('food');
    });
  });

  describe('Standard Category Classification', () => {
    it('should classify music events as nightlife', () => {
      expect(mapToInternalCategory('Concert in het park')).toBe('nightlife');
      expect(mapToInternalCategory('DJ Night')).toBe('nightlife');
    });

    it('should classify food events as food', () => {
      expect(mapToInternalCategory('Food Festival')).toBe('food');
      expect(mapToInternalCategory('Restaurant Week')).toBe('food');
    });

    it('should classify museum events as culture', () => {
      expect(mapToInternalCategory('Museum Open Day')).toBe('culture');
      expect(mapToInternalCategory('Art Exhibition')).toBe('culture');
    });

    it('should classify sport events as active', () => {
      expect(mapToInternalCategory('Sport Dag')).toBe('active');
      expect(mapToInternalCategory('Running Event')).toBe('active');
      expect(mapToInternalCategory('Yoga in the park')).toBe('active');
    });

    it('should classify family events as family', () => {
      expect(mapToInternalCategory('Family Day')).toBe('family');
      expect(mapToInternalCategory('Kids Workshop')).toBe('family');
    });
  });

  describe('Priority of Dutch Keywords', () => {
    it('should prioritize Dutch family keywords over general keywords', () => {
      // Even though "music" is present, basisschool should take priority
      expect(mapToInternalCategory('Basisschool Muziekfestival')).toBe('family');
    });

    it('should prioritize Dutch family keywords over nightlife', () => {
      expect(mapToInternalCategory('Kinderdisco Party Night')).toBe('family');
    });

    it('should prioritize food-related social keywords', () => {
      // Wijnproeverij should be food, not just social
      expect(mapToInternalCategory('Netwerk borrel met wijnproeverij')).toBe('food');
    });
  });

  describe('Fallback to culture', () => {
    it('should default to culture for unknown events', () => {
      expect(mapToInternalCategory('Algemene bijeenkomst')).toBe('culture');
      expect(mapToInternalCategory('Vergadering')).toBe('culture');
    });

    it('should map gaming to culture', () => {
      expect(mapToInternalCategory('gaming')).toBe('culture');
    });

    it('should map cinema to culture', () => {
      expect(mapToInternalCategory('cinema')).toBe('culture');
    });

    it('should map crafts to family', () => {
      expect(mapToInternalCategory('crafts')).toBe('family');
    });
  });
});

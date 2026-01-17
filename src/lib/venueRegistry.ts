/**
 * Venue Registry - Client-side version for testing
 * 
 * This is a copy of the Supabase function's venue registry for unit testing.
 * Keep in sync with supabase/functions/_shared/venueRegistry.ts
 */

export interface VenueRegistryEntry {
  id?: string;
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  address: string;
  city: string;
  google_place_id?: string;
  category?: 'stadium' | 'arena' | 'theatre' | 'cinema' | 'museum' | 'concert_hall' | 'venue' | 'park';
  contact_phone?: string;
  website_url?: string;
}

/**
 * Sample of Dutch venues for testing (subset of the full registry)
 */
export const VENUE_REGISTRY: VenueRegistryEntry[] = [
  {
    name: "Johan Cruijff ArenA",
    aliases: ["Ajax Stadium", "Amsterdam ArenA", "JC ArenA", "Arena", "Ajax Arena"],
    lat: 52.3145,
    lng: 4.9417,
    address: "ArenA Boulevard 1, 1101 AX Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJMwmhB7UJxkcRHw_YqmTLNYE",
    category: "stadium",
    website_url: "https://www.johancruijffarena.nl"
  },
  {
    name: "De Kuip",
    aliases: ["Stadion Feijenoord", "Feyenoord Stadion", "Feyenoord Stadium", "Kuip"],
    lat: 51.8939,
    lng: 4.5231,
    address: "Van Zandvlietplein 1, 3077 AA Rotterdam",
    city: "Rotterdam",
    google_place_id: "ChIJA8JmKb_iwkcRTZKRvnH-7rc",
    category: "stadium"
  },
  {
    name: "Ziggo Dome",
    aliases: ["Ziggodome", "Ziggo Arena"],
    lat: 52.3131,
    lng: 4.9378,
    address: "De Passage 100, 1101 AX Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJHVFXCrUJxkcRv4u7nN2rHj0",
    category: "arena",
    website_url: "https://www.ziggodome.nl"
  },
  {
    name: "Paradiso",
    aliases: ["Paradiso Amsterdam"],
    lat: 52.3621,
    lng: 4.8836,
    address: "Weteringschans 6-8, 1017 SG Amsterdam",
    city: "Amsterdam",
    category: "concert_hall",
    website_url: "https://www.paradiso.nl"
  },
  {
    name: "Luxor Cinema Meppel",
    aliases: ["Luxor Meppel", "Bioscoop Meppel"],
    lat: 52.6958,
    lng: 6.1933,
    address: "Groenmarkt 32, 7941 JA Meppel",
    city: "Meppel",
    category: "cinema"
  },
];

/**
 * Normalize a venue name for matching
 */
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\b(stadium|stadion|theater|theatre|cinema|bioscoop|museum|arena|hall|hallen|park|plaza|dome)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up a venue in the registry by name or alias
 */
export function lookupVenue(nameQuery: string, city?: string): VenueRegistryEntry | null {
  if (!nameQuery || nameQuery.length < 2) return null;
  
  const normalizedQuery = normalizeVenueName(nameQuery);
  const normalizedCity = city ? normalizeVenueName(city) : null;
  
  // First pass: exact name match
  for (const venue of VENUE_REGISTRY) {
    const normalizedName = normalizeVenueName(venue.name);
    if (normalizedName === normalizedQuery) {
      if (normalizedCity && normalizeVenueName(venue.city) !== normalizedCity) {
        continue;
      }
      return venue;
    }
  }
  
  // Second pass: alias match
  for (const venue of VENUE_REGISTRY) {
    for (const alias of venue.aliases) {
      const normalizedAlias = normalizeVenueName(alias);
      if (normalizedAlias === normalizedQuery) {
        if (normalizedCity && normalizeVenueName(venue.city) !== normalizedCity) {
          continue;
        }
        return venue;
      }
    }
  }
  
  // Third pass: partial match (contains) - only if both strings are sufficiently long
  // to avoid false positives with short substring matches
  const MIN_PARTIAL_MATCH_LENGTH = 5;
  if (normalizedQuery.length >= MIN_PARTIAL_MATCH_LENGTH) {
    for (const venue of VENUE_REGISTRY) {
      const normalizedName = normalizeVenueName(venue.name);
      // Only match if the name is a significant substring
      if (normalizedName.length >= MIN_PARTIAL_MATCH_LENGTH) {
        if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
          if (normalizedCity && normalizeVenueName(venue.city) !== normalizedCity) {
            continue;
          }
          return venue;
        }
      }
      
      // Check aliases for partial match - only for long aliases
      for (const alias of venue.aliases) {
        const normalizedAlias = normalizeVenueName(alias);
        if (normalizedAlias.length >= MIN_PARTIAL_MATCH_LENGTH) {
          if (normalizedAlias.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlias)) {
            if (normalizedCity && normalizeVenueName(venue.city) !== normalizedCity) {
              continue;
            }
            return venue;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Look up a venue by Google Place ID
 */
export function lookupVenueByPlaceId(placeId: string): VenueRegistryEntry | null {
  if (!placeId) return null;
  
  for (const venue of VENUE_REGISTRY) {
    if (venue.google_place_id === placeId) {
      return venue;
    }
  }
  
  return null;
}

/**
 * Get all venues in a specific city
 */
export function getVenuesByCity(city: string): VenueRegistryEntry[] {
  const normalizedCity = normalizeVenueName(city);
  return VENUE_REGISTRY.filter(
    venue => normalizeVenueName(venue.city) === normalizedCity
  );
}

/**
 * Get all venues of a specific category
 */
export function getVenuesByCategory(category: VenueRegistryEntry['category']): VenueRegistryEntry[] {
  return VENUE_REGISTRY.filter(venue => venue.category === category);
}

/**
 * Venue Registry - Local venue data for Dutch venues
 * 
 * This registry provides a local cache of well-known venues to minimize
 * external API calls (Google Places) during event enrichment.
 * 
 * Registry entries include:
 * - name: Official venue name
 * - aliases: Alternative names the venue might be known by
 * - lat, lng: Geographic coordinates (POINT order: lng, lat for PostGIS)
 * - address: Formatted address
 * - google_place_id: Optional Google Places ID if known
 * - city: City name for better matching
 * - category: Venue category for context
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
 * Curated registry of ~50 major Dutch venues
 * Focus on stadiums, arenas, theatres, and major event venues
 */
export const VENUE_REGISTRY: VenueRegistryEntry[] = [
  // ============================================================
  // FOOTBALL STADIUMS
  // ============================================================
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
    category: "stadium",
    website_url: "https://www.dekuip.nl"
  },
  {
    name: "Philips Stadion",
    aliases: ["PSV Stadion", "PSV Stadium", "Philips Stadium"],
    lat: 51.4417,
    lng: 5.4675,
    address: "Frederiklaan 10a, 5616 NH Eindhoven",
    city: "Eindhoven",
    google_place_id: "ChIJBxl7X5rlxkcRXvwWLGi_kL8",
    category: "stadium",
    website_url: "https://www.psv.nl"
  },
  {
    name: "GelreDome",
    aliases: ["Vitesse Stadion", "Gelredome Arnhem"],
    lat: 51.9631,
    lng: 5.8927,
    address: "Batavierenweg 25, 6841 HN Arnhem",
    city: "Arnhem",
    google_place_id: "ChIJGWh_b0dqxkcRCfgJJ2HxCLo",
    category: "stadium"
  },
  {
    name: "AFAS Stadion",
    aliases: ["AZ Stadion", "AZ Alkmaar Stadion", "AFAS Stadium"],
    lat: 52.6127,
    lng: 4.7408,
    address: "Stadionweg 1, 1812 NC Alkmaar",
    city: "Alkmaar",
    category: "stadium"
  },
  {
    name: "Abe Lenstra Stadion",
    aliases: ["Heerenveen Stadion", "SC Heerenveen Stadium"],
    lat: 52.9553,
    lng: 5.9497,
    address: "Abe Lenstra Boulevard 21, 8448 JA Heerenveen",
    city: "Heerenveen",
    category: "stadium"
  },
  {
    name: "Euroborg",
    aliases: ["FC Groningen Stadion", "Euroborg Stadion"],
    lat: 53.2064,
    lng: 6.5917,
    address: "Boumaboulevard 41, 9723 ZS Groningen",
    city: "Groningen",
    category: "stadium"
  },
  {
    name: "Goffertstadion",
    aliases: ["NEC Stadion", "De Goffert"],
    lat: 51.8317,
    lng: 5.8383,
    address: "Stadionplein 1, 6532 AD Nijmegen",
    city: "Nijmegen",
    category: "stadium"
  },
  {
    name: "Rat Verlegh Stadion",
    aliases: ["NAC Stadion", "NAC Breda Stadion"],
    lat: 51.5833,
    lng: 4.7833,
    address: "Stadionstraat 19, 4815 NC Breda",
    city: "Breda",
    category: "stadium"
  },
  {
    name: "MAC³PARK Stadion",
    aliases: ["PEC Zwolle Stadion", "MAC3PARK"],
    lat: 52.5186,
    lng: 6.1117,
    address: "Van Wevelinkhovenstraat 15, 8021 CV Zwolle",
    city: "Zwolle",
    category: "stadium"
  },
  // ============================================================
  // CONCERT VENUES & ARENAS
  // ============================================================
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
    name: "Rotterdam Ahoy",
    aliases: ["Ahoy Rotterdam", "Ahoy Arena", "Ahoy"],
    lat: 51.8875,
    lng: 4.4856,
    address: "Ahoyweg 10, 3084 BA Rotterdam",
    city: "Rotterdam",
    google_place_id: "ChIJC5KZLfjlxUcRIKxc8kE7HtI",
    category: "arena",
    website_url: "https://www.ahoy.nl"
  },
  {
    name: "AFAS Live",
    aliases: ["Heineken Music Hall", "HMH", "AFAS Live Amsterdam"],
    lat: 52.3122,
    lng: 4.9356,
    address: "ArenA Boulevard 590, 1101 DS Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJ99eSNrQJxkcROQH8vEOybzA",
    category: "concert_hall"
  },
  {
    name: "Paradiso",
    aliases: ["Paradiso Amsterdam"],
    lat: 52.3621,
    lng: 4.8836,
    address: "Weteringschans 6-8, 1017 SG Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJpWFCMuQJxkcR8uNT0jdlJrY",
    category: "concert_hall",
    website_url: "https://www.paradiso.nl"
  },
  {
    name: "Melkweg",
    aliases: ["Melkweg Amsterdam", "De Melkweg"],
    lat: 52.3644,
    lng: 4.8811,
    address: "Lijnbaansgracht 234A, 1017 PH Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJP8jYruQJxkcR9uNT0jdlJrY",
    category: "concert_hall"
  },
  {
    name: "TivoliVredenburg",
    aliases: ["Tivoli", "Vredenburg", "Tivoli Utrecht"],
    lat: 52.0919,
    lng: 5.1128,
    address: "Vredenburgkade 11, 3511 WC Utrecht",
    city: "Utrecht",
    google_place_id: "ChIJyUx8xXzlxUcRF_-R4t1c8OQ",
    category: "concert_hall"
  },
  {
    name: "013",
    aliases: ["Poppodium 013", "013 Tilburg", "Popcentrum 013"],
    lat: 51.5561,
    lng: 5.0878,
    address: "Veemarktstraat 44, 5038 CV Tilburg",
    city: "Tilburg",
    google_place_id: "ChIJl7x7GxPpxkcRdw8jkjS9ot0",
    category: "concert_hall"
  },
  // ============================================================
  // THEATRES
  // ============================================================
  {
    name: "Koninklijk Theater Carré",
    aliases: ["Carré", "Theater Carré", "Koninklijk Carré", "Carre Amsterdam"],
    lat: 52.3606,
    lng: 4.9031,
    address: "Amstel 115-125, 1018 EM Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJVxoGguAJxkcRz3P_f3yD0cE",
    category: "theatre"
  },
  {
    name: "Stadsschouwburg Amsterdam",
    aliases: ["Internationaal Theater Amsterdam", "ITA", "Stadsschouwburg"],
    lat: 52.3650,
    lng: 4.8833,
    address: "Leidseplein 26, 1017 PT Amsterdam",
    city: "Amsterdam",
    category: "theatre"
  },
  {
    name: "De Doelen",
    aliases: ["Doelen Rotterdam", "Concertgebouw De Doelen"],
    lat: 51.9225,
    lng: 4.4792,
    address: "Schouwburgplein 50, 3012 CL Rotterdam",
    city: "Rotterdam",
    category: "concert_hall"
  },
  {
    name: "Concertgebouw",
    aliases: ["Concertgebouw Amsterdam", "Het Concertgebouw", "Royal Concertgebouw"],
    lat: 52.3564,
    lng: 4.8792,
    address: "Concertgebouwplein 10, 1071 LN Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJBxnlBNgJxkcRKL7HvHNWv4I",
    category: "concert_hall"
  },
  {
    name: "Chassé Theater",
    aliases: ["Chasse Theater Breda", "Chasse"],
    lat: 51.5894,
    lng: 4.7750,
    address: "Claudius Prinsenlaan 8, 4811 DJ Breda",
    city: "Breda",
    category: "theatre"
  },
  // ============================================================
  // MUSEUMS & CULTURAL VENUES
  // ============================================================
  {
    name: "Rijksmuseum",
    aliases: ["Rijksmuseum Amsterdam", "Het Rijksmuseum"],
    lat: 52.3600,
    lng: 4.8852,
    address: "Museumstraat 1, 1071 XX Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJx8gYL-cJxkcRDZ-a0JxrBck",
    category: "museum",
    website_url: "https://www.rijksmuseum.nl"
  },
  {
    name: "Van Gogh Museum",
    aliases: ["Van Gogh", "Vincent van Gogh Museum"],
    lat: 52.3584,
    lng: 4.8811,
    address: "Museumplein 6, 1071 DJ Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJG-cOsdkJxkcRuH_FyBEWbKA",
    category: "museum"
  },
  {
    name: "Anne Frank Huis",
    aliases: ["Anne Frank House", "Anne Frank Museum"],
    lat: 52.3753,
    lng: 4.8839,
    address: "Westermarkt 20, 1016 DK Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJ25vOJdkJxkcR8aXe8A_N1_o",
    category: "museum"
  },
  {
    name: "NEMO Science Museum",
    aliases: ["NEMO", "NEMO Amsterdam", "Science Center NEMO"],
    lat: 52.3739,
    lng: 4.9122,
    address: "Oosterdok 2, 1011 VX Amsterdam",
    city: "Amsterdam",
    category: "museum"
  },
  {
    name: "Kunsthal Rotterdam",
    aliases: ["Kunsthal", "Kunsthal Museum"],
    lat: 51.9128,
    lng: 4.4719,
    address: "Museumpark, Westzeedijk 341, 3015 AA Rotterdam",
    city: "Rotterdam",
    category: "museum"
  },
  // ============================================================
  // CINEMAS
  // ============================================================
  {
    name: "Pathé Tuschinski",
    aliases: ["Tuschinski", "Theater Tuschinski", "Tuschinski Amsterdam"],
    lat: 52.3667,
    lng: 4.8944,
    address: "Reguliersbreestraat 26-34, 1017 CN Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJU4Y0hOQJxkcRoGxoNnMqsPI",
    category: "cinema"
  },
  {
    name: "Eye Filmmuseum",
    aliases: ["Eye", "Eye Film", "Eye Amsterdam", "EYE Film Institute"],
    lat: 52.3844,
    lng: 4.9011,
    address: "IJpromenade 1, 1031 KT Amsterdam",
    city: "Amsterdam",
    category: "cinema"
  },
  {
    name: "Pathé Arena",
    aliases: ["Pathe Arena", "Pathé Amsterdam Arena"],
    lat: 52.3125,
    lng: 4.9361,
    address: "ArenA Boulevard 600, 1101 DL Amsterdam",
    city: "Amsterdam",
    category: "cinema"
  },
  {
    name: "Filmhuis Den Haag",
    aliases: ["Filmhuis", "Filmhuis The Hague"],
    lat: 52.0794,
    lng: 4.3133,
    address: "Spui 191, 2511 BN Den Haag",
    city: "Den Haag",
    category: "cinema"
  },
  // ============================================================
  // CONVENTION CENTERS & EXPO VENUES
  // ============================================================
  {
    name: "RAI Amsterdam",
    aliases: ["RAI", "Amsterdam RAI", "RAI Convention Centre"],
    lat: 52.3400,
    lng: 4.8889,
    address: "Europaplein, 1078 GZ Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJYbhDkLUJxkcRcfqBqW0_5nQ",
    category: "venue"
  },
  {
    name: "Jaarbeurs",
    aliases: ["Jaarbeurs Utrecht", "Jaarbeursplein"],
    lat: 52.0889,
    lng: 5.1022,
    address: "Jaarbeursboulevard 1, 3521 AL Utrecht",
    city: "Utrecht",
    google_place_id: "ChIJqwLzuoDlxUcR8WY3bsNmkHA",
    category: "venue"
  },
  {
    name: "MECC Maastricht",
    aliases: ["MECC", "Maastricht Exhibition and Congress Centre"],
    lat: 50.8386,
    lng: 5.7153,
    address: "Forum 100, 6229 GV Maastricht",
    city: "Maastricht",
    category: "venue"
  },
  {
    name: "World Forum",
    aliases: ["World Forum The Hague", "World Forum Den Haag"],
    lat: 52.0936,
    lng: 4.2831,
    address: "Churchillplein 10, 2517 JW Den Haag",
    city: "Den Haag",
    category: "venue"
  },
  // ============================================================
  // PARKS & OUTDOOR VENUES
  // ============================================================
  {
    name: "Vondelpark",
    aliases: ["Vondelpark Amsterdam", "Het Vondelpark"],
    lat: 52.3579,
    lng: 4.8686,
    address: "Vondelpark, 1071 AA Amsterdam",
    city: "Amsterdam",
    google_place_id: "ChIJYaF6gNoJxkcRqYaHM-5_-NU",
    category: "park"
  },
  {
    name: "Het Park",
    aliases: ["Park Rotterdam", "Euromast Park"],
    lat: 51.9053,
    lng: 4.4664,
    address: "Het Park, 3016 Rotterdam",
    city: "Rotterdam",
    category: "park"
  },
  {
    name: "Malieveld",
    aliases: ["Malieveld Den Haag", "The Malieveld"],
    lat: 52.0822,
    lng: 4.3219,
    address: "Malieveld, 2514 Den Haag",
    city: "Den Haag",
    category: "park"
  },
  // ============================================================
  // REGIONAL VENUES - MEPPEL AREA (for existing seed data)
  // ============================================================
  {
    name: "Luxor Cinema Meppel",
    aliases: ["Luxor Meppel", "Bioscoop Meppel"],
    lat: 52.6958,
    lng: 6.1933,
    address: "Groenmarkt 32, 7941 JA Meppel",
    city: "Meppel",
    category: "cinema"
  },
  {
    name: "Sportpark Ezinge",
    aliases: ["Ezinge Meppel", "Sportpark"],
    lat: 52.695,
    lng: 6.21,
    address: "Ezingerweg, 7941 Meppel",
    city: "Meppel",
    category: "stadium"
  },
  {
    name: "De Plataan",
    aliases: ["Plataan Meppel"],
    lat: 52.698,
    lng: 6.203,
    address: "Stationsweg, 7941 Meppel",
    city: "Meppel",
    category: "venue"
  },
  {
    name: "Reestkerk",
    aliases: ["Reest Kerk Meppel"],
    lat: 52.705,
    lng: 6.195,
    address: "Kerkstraat, 7941 Meppel",
    city: "Meppel",
    category: "venue"
  },
  // ============================================================
  // ADDITIONAL POPULAR VENUES
  // ============================================================
  {
    name: "Olympisch Stadion",
    aliases: ["Olympic Stadium Amsterdam", "Olympisch Stadion Amsterdam"],
    lat: 52.3428,
    lng: 4.8533,
    address: "Olympisch Stadion 2, 1076 DE Amsterdam",
    city: "Amsterdam",
    category: "stadium"
  },
  {
    name: "Martiniplaza",
    aliases: ["Martini Plaza Groningen", "MartiniPlaza"],
    lat: 53.2175,
    lng: 6.5697,
    address: "Leonard Springerlaan 2, 9727 KB Groningen",
    city: "Groningen",
    category: "venue"
  },
  {
    name: "Theaters Tilburg",
    aliases: ["Schouwburg Tilburg", "Concertzaal Tilburg"],
    lat: 51.5594,
    lng: 5.0833,
    address: "Louis Bouwmeesterplein 1, 5038 TN Tilburg",
    city: "Tilburg",
    category: "theatre"
  },
  {
    name: "Parktheater Eindhoven",
    aliases: ["Parktheater", "Park Theater Eindhoven"],
    lat: 51.4356,
    lng: 5.4797,
    address: "Elzentlaan 50, 5611 LX Eindhoven",
    city: "Eindhoven",
    category: "theatre"
  },
  {
    name: "Brabanthallen",
    aliases: ["Brabanthallen Den Bosch", "'s-Hertogenbosch Brabanthallen"],
    lat: 51.6833,
    lng: 5.2917,
    address: "Diezekade 2, 5222 AK 's-Hertogenbosch",
    city: "'s-Hertogenbosch",
    category: "venue"
  }
];

/**
 * Normalize a venue name for matching
 * - Lowercase
 * - Remove diacritics
 * - Remove common suffixes (stadium, theater, etc.)
 * - Collapse whitespace
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
 * Returns the best match or null if no match found
 */
export function lookupVenue(nameQuery: string, city?: string): VenueRegistryEntry | null {
  if (!nameQuery || nameQuery.length < 2) return null;
  
  const normalizedQuery = normalizeVenueName(nameQuery);
  const normalizedCity = city ? normalizeVenueName(city) : null;
  
  // First pass: exact name match
  for (const venue of VENUE_REGISTRY) {
    const normalizedName = normalizeVenueName(venue.name);
    if (normalizedName === normalizedQuery) {
      // If city provided, verify it matches
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
  
  // Third pass: partial match (contains)
  for (const venue of VENUE_REGISTRY) {
    const normalizedName = normalizeVenueName(venue.name);
    if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
      if (normalizedCity && normalizeVenueName(venue.city) !== normalizedCity) {
        continue;
      }
      return venue;
    }
    
    // Check aliases for partial match
    for (const alias of venue.aliases) {
      const normalizedAlias = normalizeVenueName(alias);
      if (normalizedAlias.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlias)) {
        if (normalizedCity && normalizeVenueName(venue.city) !== normalizedCity) {
          continue;
        }
        return venue;
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

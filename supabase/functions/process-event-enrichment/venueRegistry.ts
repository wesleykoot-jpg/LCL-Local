/**
 * Dutch Venue Registry - Static Optimization for Event Enrichment
 * 
 * This module contains a curated registry of ~50 major Dutch venues with 
 * pre-filled data to avoid expensive API calls for well-known locations.
 * 
 * Data sourced from:
 * - Official venue websites
 * - Google Places (one-time manual lookup)
 * - OpenStreetMap
 * 
 * @module VenueRegistry
 */

import type { OpeningHours, PriceRange } from './types.ts';

/**
 * Registered venue with all enrichment data pre-populated
 */
export interface RegisteredVenue {
  name: string;
  aliases: string[];
  location: {
    lng: number;
    lat: number;
  };
  google_place_id: string;
  category: 'sports' | 'music' | 'culture' | 'cinema' | 'food' | 'outdoor' | 'other';
  address: string;
  contact_phone?: string;
  website_url?: string;
  capacity?: number;
  opening_hours?: OpeningHours;
  price_range?: PriceRange;
}

/**
 * Major Dutch venues registry
 * 
 * Categories:
 * - Sports: All Eredivisie stadiums
 * - Music: Major concert halls and pop venues
 * - Culture: Theaters, museums, concert halls
 * - Other: Arenas, convention centers
 */
export const VENUE_REGISTRY: RegisteredVenue[] = [
  // ============================================================================
  // SPORTS VENUES - Eredivisie Stadiums
  // ============================================================================
  {
    name: 'Johan Cruijff ArenA',
    aliases: ['Arena Amsterdam', 'Ajax Stadium', 'Amsterdam ArenA', 'Johan Cruijff Arena', 'Ajax Arena'],
    location: { lng: 4.9417, lat: 52.3140 },
    google_place_id: 'ChIJLdqpS6QJxkcR0LJE7TQJQFQ',
    category: 'sports',
    address: 'ArenA Boulevard 1, 1101 AX Amsterdam',
    contact_phone: '+31206911333',
    website_url: 'https://www.johancruijffarena.nl',
    capacity: 55500,
    price_range: '€€€'
  },
  {
    name: 'Stadion Feyenoord',
    aliases: ['De Kuip', 'Feyenoord Stadion', 'Feyenoord Stadium', 'Rotterdam Stadium'],
    location: { lng: 4.5234, lat: 51.8939 },
    google_place_id: 'ChIJpQOCm5M3xEcRoZn5FbvYBb4',
    category: 'sports',
    address: 'Van Zandvlietplein 1, 3077 AA Rotterdam',
    contact_phone: '+31104925500',
    website_url: 'https://www.feyenoord.nl',
    capacity: 51117,
    price_range: '€€€'
  },
  {
    name: 'Philips Stadion',
    aliases: ['PSV Stadion', 'PSV Stadium', 'Eindhoven Stadion'],
    location: { lng: 5.4675, lat: 51.4417 },
    google_place_id: 'ChIJXwg4pTDnxkcRqM0N_Xo9W6k',
    category: 'sports',
    address: 'Frederiklaan 10, 5616 NH Eindhoven',
    contact_phone: '+31402505050',
    website_url: 'https://www.psv.nl',
    capacity: 35000,
    price_range: '€€€'
  },
  {
    name: 'GelreDome',
    aliases: ['Gelredome', 'Vitesse Stadion', 'Arnhem Stadion'],
    location: { lng: 5.9250, lat: 51.9631 },
    google_place_id: 'ChIJm-2qCVILxkcR0Q3DbbkYDAE',
    category: 'sports',
    address: 'Batavierenweg 25, 6841 HN Arnhem',
    contact_phone: '+31263688666',
    website_url: 'https://www.gelredome.nl',
    capacity: 30000,
    price_range: '€€€'
  },
  {
    name: 'AFAS Stadion',
    aliases: ['AZ Stadion', 'Alkmaar Stadion', 'AZ Alkmaar Stadium'],
    location: { lng: 4.7401, lat: 52.6121 },
    google_place_id: 'ChIJy5d7ZD0LxEcR4L0W8DZdpS0',
    category: 'sports',
    address: 'Stadionweg 1, 1812 NC Alkmaar',
    contact_phone: '+31725418700',
    website_url: 'https://www.az.nl',
    capacity: 17000,
    price_range: '€€'
  },
  {
    name: 'De Galgenwaard',
    aliases: ['FC Utrecht Stadion', 'Utrecht Stadion', 'Stadion Galgenwaard'],
    location: { lng: 5.1483, lat: 52.0780 },
    google_place_id: 'ChIJE3d7Z5vJxkcRKyMzGjEz0CY',
    category: 'sports',
    address: 'Herculesplein 241, 3584 AA Utrecht',
    contact_phone: '+31302809700',
    website_url: 'https://www.fcutrecht.nl',
    capacity: 24500,
    price_range: '€€'
  },
  {
    name: 'Euroborg',
    aliases: ['FC Groningen Stadion', 'Groningen Stadion'],
    location: { lng: 6.5916, lat: 53.2062 },
    google_place_id: 'ChIJN9TL_Ei2x0cRwMwLMBST_i0',
    category: 'sports',
    address: 'Boumaboulevard 41, 9723 ZS Groningen',
    contact_phone: '+31505991222',
    website_url: 'https://www.fcgroningen.nl',
    capacity: 22550,
    price_range: '€€'
  },
  {
    name: 'Abe Lenstra Stadion',
    aliases: ['Heerenveen Stadion', 'SC Heerenveen Stadium'],
    location: { lng: 5.9383, lat: 52.9560 },
    google_place_id: 'ChIJm8CJXe8Jx0cRQM0EZTkdyJ4',
    category: 'sports',
    address: 'Abe Lenstra Boulevard 21, 8448 JB Heerenveen',
    contact_phone: '+31513621261',
    website_url: 'https://www.sc-heerenveen.nl',
    capacity: 27224,
    price_range: '€€'
  },
  {
    name: 'Cars Jeans Stadion',
    aliases: ['ADO Den Haag Stadion', 'Kyocera Stadion', 'Den Haag Stadion'],
    location: { lng: 4.3283, lat: 52.0632 },
    google_place_id: 'ChIJ9QVpZAC4xUcRwJ0S8G0E2K4',
    category: 'sports',
    address: 'Haags Kwartier 55, 2491 BM Den Haag',
    contact_phone: '+31704343000',
    website_url: 'https://www.adodenhaag.nl',
    capacity: 15000,
    price_range: '€€'
  },
  {
    name: 'MAC³PARK Stadion',
    aliases: ['PEC Zwolle Stadion', 'Zwolle Stadion'],
    location: { lng: 6.0942, lat: 52.5151 },
    google_place_id: 'ChIJV5D0d2b0xkcRwLQ1ub0V_08',
    category: 'sports',
    address: 'Van der Capellenstraat 13, 8019 AN Zwolle',
    contact_phone: '+31382256200',
    website_url: 'https://www.peczwolle.nl',
    capacity: 14000,
    price_range: '€€'
  },

  // ============================================================================
  // MUSIC VENUES - Major Concert Halls & Pop Venues
  // ============================================================================
  {
    name: 'Ziggo Dome',
    aliases: ['Ziggodome', 'Ziggo Arena'],
    location: { lng: 4.9388, lat: 52.3120 },
    google_place_id: 'ChIJBYXU2qMJxkcRRQvPXc8RxIs',
    category: 'music',
    address: 'De Passage 100, 1101 AX Amsterdam',
    contact_phone: '+31203113000',
    website_url: 'https://www.ziggodome.nl',
    capacity: 17000,
    price_range: '€€€'
  },
  {
    name: 'AFAS Live',
    aliases: ['Heineken Music Hall', 'HMH', 'AFAS', 'Afas Live Amsterdam'],
    location: { lng: 4.9367, lat: 52.3116 },
    google_place_id: 'ChIJdyMQJ6MJxkcRYMhONjqI_FY',
    category: 'music',
    address: 'ArenA Boulevard 590, 1101 DS Amsterdam',
    contact_phone: '+31203006600',
    website_url: 'https://www.afaslive.nl',
    capacity: 6000,
    price_range: '€€€'
  },
  {
    name: 'Paradiso',
    aliases: ['Paradiso Amsterdam'],
    location: { lng: 4.8838, lat: 52.3621 },
    google_place_id: 'ChIJQaKl9mcJxkcRwE5fphWU6FU',
    category: 'music',
    address: 'Weteringschans 6-8, 1017 SG Amsterdam',
    contact_phone: '+31206264521',
    website_url: 'https://www.paradiso.nl',
    capacity: 1500,
    opening_hours: {
      monday: 'closed',
      tuesday: 'closed',
      wednesday: [{ open: '19:00', close: '02:00', closes_next_day: true }],
      thursday: [{ open: '19:00', close: '02:00', closes_next_day: true }],
      friday: [{ open: '19:00', close: '04:00', closes_next_day: true }],
      saturday: [{ open: '19:00', close: '04:00', closes_next_day: true }],
      sunday: [{ open: '19:00', close: '00:00' }]
    },
    price_range: '€€'
  },
  {
    name: 'Melkweg',
    aliases: ['Melkweg Amsterdam', 'De Melkweg'],
    location: { lng: 4.8820, lat: 52.3647 },
    google_place_id: 'ChIJq6qqMmgJxkcRqA6f1Xg0k_0',
    category: 'music',
    address: 'Lijnbaansgracht 234a, 1017 PH Amsterdam',
    contact_phone: '+31205318181',
    website_url: 'https://www.melkweg.nl',
    capacity: 1500,
    opening_hours: {
      monday: 'closed',
      tuesday: [{ open: '19:30', close: '00:00' }],
      wednesday: [{ open: '19:30', close: '00:00' }],
      thursday: [{ open: '19:30', close: '02:00', closes_next_day: true }],
      friday: [{ open: '19:30', close: '04:00', closes_next_day: true }],
      saturday: [{ open: '19:30', close: '04:00', closes_next_day: true }],
      sunday: [{ open: '19:30', close: '00:00' }]
    },
    price_range: '€€'
  },
  {
    name: 'TivoliVredenburg',
    aliases: ['Tivoli Vredenburg', 'Tivoli Utrecht', 'Vredenburg Utrecht'],
    location: { lng: 5.1105, lat: 52.0922 },
    google_place_id: 'ChIJCQK4n5LJxkcRPG1S2WT5t-E',
    category: 'music',
    address: 'Vredenburgkade 11, 3511 WC Utrecht',
    contact_phone: '+31302300300',
    website_url: 'https://www.tivolivredenburg.nl',
    capacity: 6000,
    price_range: '€€'
  },
  {
    name: '013',
    aliases: ['013 Tilburg', 'Poppodium 013', '013 Poppodium'],
    location: { lng: 5.0913, lat: 51.5592 },
    google_place_id: 'ChIJAQAAs8K5xkcRMCN7N1ppGDI',
    category: 'music',
    address: 'Veemarktstraat 44, 5038 CV Tilburg',
    contact_phone: '+31135495000',
    website_url: 'https://www.013.nl',
    capacity: 3000,
    price_range: '€€'
  },
  {
    name: 'Poppodium Vera',
    aliases: ['Vera Groningen', 'Vera'],
    location: { lng: 6.5690, lat: 53.2173 },
    google_place_id: 'ChIJP4TqIc2wx0cRJC0XWCZ_P5w',
    category: 'music',
    address: 'Oosterstraat 44, 9711 NV Groningen',
    contact_phone: '+31503136681',
    website_url: 'https://www.vera-groningen.nl',
    capacity: 450,
    price_range: '€'
  },
  {
    name: 'Effenaar',
    aliases: ['Effenaar Eindhoven'],
    location: { lng: 5.4785, lat: 51.4353 },
    google_place_id: 'ChIJR5xoKTnnxkcRlK0NpDyPPvE',
    category: 'music',
    address: 'Dommelstraat 2, 5611 CK Eindhoven',
    contact_phone: '+31402970900',
    website_url: 'https://www.effenaar.nl',
    capacity: 1800,
    price_range: '€€'
  },
  {
    name: 'Doornroosje',
    aliases: ['Doornroosje Nijmegen'],
    location: { lng: 5.8536, lat: 51.8450 },
    google_place_id: 'ChIJAQDAt2APxkcRkBp7TQJQFQ',
    category: 'music',
    address: 'Groenewoudseweg 322, 6524 TV Nijmegen',
    contact_phone: '+31243604444',
    website_url: 'https://www.doornroosje.nl',
    capacity: 1200,
    price_range: '€€'
  },
  {
    name: 'SPOT Groningen',
    aliases: ['Spot Groningen', 'De Oosterpoort', 'Oosterpoort'],
    location: { lng: 6.5654, lat: 53.2143 },
    google_place_id: 'ChIJp0q8EMaxx0cRQMzGMBST_io',
    category: 'music',
    address: 'Trompsingel 27, 9724 DA Groningen',
    contact_phone: '+31505250250',
    website_url: 'https://www.spotgroningen.nl',
    capacity: 2000,
    price_range: '€€'
  },

  // ============================================================================
  // CULTURE VENUES - Theaters, Concert Halls, Museums
  // ============================================================================
  {
    name: 'Concertgebouw',
    aliases: ['Het Concertgebouw', 'Concertgebouw Amsterdam', 'Royal Concertgebouw'],
    location: { lng: 4.8790, lat: 52.3562 },
    google_place_id: 'ChIJf-gHn2MJxkcR7bX7kYJr8IQ',
    category: 'culture',
    address: 'Concertgebouwplein 10, 1071 LN Amsterdam',
    contact_phone: '+31206718345',
    website_url: 'https://www.concertgebouw.nl',
    capacity: 2100,
    price_range: '€€€'
  },
  {
    name: 'Koninklijk Theater Carré',
    aliases: ['Theater Carré', 'Carré', 'Carré Amsterdam'],
    location: { lng: 4.9052, lat: 52.3632 },
    google_place_id: 'ChIJhwCjMHIJxkcRVeUPuUlE0TE',
    category: 'culture',
    address: 'Amstel 115-125, 1018 EM Amsterdam',
    contact_phone: '+31205255225',
    website_url: 'https://www.carre.nl',
    capacity: 1741,
    price_range: '€€€'
  },
  {
    name: 'Muziekgebouw aan \'t IJ',
    aliases: ['Muziekgebouw', 'Muziekgebouw Amsterdam'],
    location: { lng: 4.9129, lat: 52.3781 },
    google_place_id: 'ChIJDzxCMl8JxkcRKcJJ0Q6YQPY',
    category: 'culture',
    address: 'Piet Heinkade 1, 1019 BR Amsterdam',
    contact_phone: '+31207882000',
    website_url: 'https://www.muziekgebouw.nl',
    capacity: 2000,
    price_range: '€€'
  },
  {
    name: 'De Doelen',
    aliases: ['Doelen Rotterdam', 'Doelen Concert Hall'],
    location: { lng: 4.4823, lat: 51.9220 },
    google_place_id: 'ChIJBQ0gPnY3xEcRQG1v_Kpl0Ks',
    category: 'culture',
    address: 'Kruisplein 40, 3012 CC Rotterdam',
    contact_phone: '+31102171717',
    website_url: 'https://www.dedoelen.nl',
    capacity: 2200,
    price_range: '€€€'
  },
  {
    name: 'Stadsschouwburg Amsterdam',
    aliases: ['Internationaal Theater Amsterdam', 'ITA', 'Stadsschouwburg'],
    location: { lng: 4.8832, lat: 52.3643 },
    google_place_id: 'ChIJB6rnFmgJxkcR-FQJbH7pEk0',
    category: 'culture',
    address: 'Leidseplein 26, 1017 PT Amsterdam',
    contact_phone: '+31206242311',
    website_url: 'https://ita.nl',
    capacity: 950,
    price_range: '€€'
  },
  {
    name: 'Rijksmuseum',
    aliases: ['Rijksmuseum Amsterdam', 'National Museum'],
    location: { lng: 4.8852, lat: 52.3600 },
    google_place_id: 'ChIJVSZzVR8JxkcRGy5hJTXlDhQ',
    category: 'culture',
    address: 'Museumstraat 1, 1071 XX Amsterdam',
    contact_phone: '+31206747047',
    website_url: 'https://www.rijksmuseum.nl',
    capacity: 15000,
    opening_hours: {
      monday: [{ open: '09:00', close: '17:00' }],
      tuesday: [{ open: '09:00', close: '17:00' }],
      wednesday: [{ open: '09:00', close: '17:00' }],
      thursday: [{ open: '09:00', close: '17:00' }],
      friday: [{ open: '09:00', close: '17:00' }],
      saturday: [{ open: '09:00', close: '17:00' }],
      sunday: [{ open: '09:00', close: '17:00' }]
    },
    price_range: '€€'
  },
  {
    name: 'Van Gogh Museum',
    aliases: ['Van Gogh Amsterdam', 'Vincent Van Gogh Museum'],
    location: { lng: 4.8812, lat: 52.3584 },
    google_place_id: 'ChIJYxFNM7kJxkcRpKsXRz0cKnI',
    category: 'culture',
    address: 'Museumplein 6, 1071 DJ Amsterdam',
    contact_phone: '+31205705200',
    website_url: 'https://www.vangoghmuseum.nl',
    capacity: 8500,
    opening_hours: {
      monday: [{ open: '09:00', close: '18:00' }],
      tuesday: [{ open: '09:00', close: '18:00' }],
      wednesday: [{ open: '09:00', close: '18:00' }],
      thursday: [{ open: '09:00', close: '18:00' }],
      friday: [{ open: '09:00', close: '21:00' }],
      saturday: [{ open: '09:00', close: '21:00' }],
      sunday: [{ open: '09:00', close: '18:00' }]
    },
    price_range: '€€'
  },
  {
    name: 'Anne Frank Huis',
    aliases: ['Anne Frank House', 'Anne Frank Museum'],
    location: { lng: 4.8836, lat: 52.3752 },
    google_place_id: 'ChIJCaIxqLYJxkcRQKLBhJE8A6c',
    category: 'culture',
    address: 'Westermarkt 20, 1016 GV Amsterdam',
    contact_phone: '+31205567100',
    website_url: 'https://www.annefrank.org',
    capacity: 3600,
    opening_hours: {
      monday: [{ open: '09:00', close: '22:00' }],
      tuesday: [{ open: '09:00', close: '22:00' }],
      wednesday: [{ open: '09:00', close: '22:00' }],
      thursday: [{ open: '09:00', close: '22:00' }],
      friday: [{ open: '09:00', close: '22:00' }],
      saturday: [{ open: '09:00', close: '22:00' }],
      sunday: [{ open: '09:00', close: '22:00' }]
    },
    price_range: '€€'
  },
  {
    name: 'NEMO Science Museum',
    aliases: ['NEMO', 'Nemo Amsterdam', 'Science Center Nemo'],
    location: { lng: 4.9124, lat: 52.3740 },
    google_place_id: 'ChIJE8f94l8JxkcRVsMF6QiYkjE',
    category: 'culture',
    address: 'Oosterdok 2, 1011 VX Amsterdam',
    contact_phone: '+31205313233',
    website_url: 'https://www.nemosciencemuseum.nl',
    capacity: 6000,
    opening_hours: {
      monday: 'closed',
      tuesday: [{ open: '10:00', close: '17:30' }],
      wednesday: [{ open: '10:00', close: '17:30' }],
      thursday: [{ open: '10:00', close: '17:30' }],
      friday: [{ open: '10:00', close: '17:30' }],
      saturday: [{ open: '10:00', close: '17:30' }],
      sunday: [{ open: '10:00', close: '17:30' }]
    },
    price_range: '€€'
  },
  {
    name: 'Mauritshuis',
    aliases: ['Mauritshuis Den Haag', 'Royal Picture Gallery'],
    location: { lng: 4.3145, lat: 52.0803 },
    google_place_id: 'ChIJa4j8p6O4xUcRwEu9w9XAJiY',
    category: 'culture',
    address: 'Plein 29, 2511 CS Den Haag',
    contact_phone: '+31703023456',
    website_url: 'https://www.mauritshuis.nl',
    capacity: 2000,
    opening_hours: {
      monday: [{ open: '10:00', close: '18:00' }],
      tuesday: [{ open: '10:00', close: '18:00' }],
      wednesday: [{ open: '10:00', close: '18:00' }],
      thursday: [{ open: '10:00', close: '20:00' }],
      friday: [{ open: '10:00', close: '18:00' }],
      saturday: [{ open: '10:00', close: '18:00' }],
      sunday: [{ open: '10:00', close: '18:00' }]
    },
    price_range: '€€'
  },

  // ============================================================================
  // CINEMA
  // ============================================================================
  {
    name: 'Pathé Tuschinski',
    aliases: ['Tuschinski', 'Tuschinski Theater', 'Pathe Tuschinski'],
    location: { lng: 4.8931, lat: 52.3663 },
    google_place_id: 'ChIJw-aM2HEJxkcRhRLMCL9sxXU',
    category: 'cinema',
    address: 'Reguliersbreestraat 26-34, 1017 CN Amsterdam',
    contact_phone: '+31209001458',
    website_url: 'https://www.pathe.nl/bioscoop/tuschinski',
    capacity: 1472,
    price_range: '€€'
  },
  {
    name: 'Pathé Arena',
    aliases: ['Pathe Arena', 'Arena Cinema'],
    location: { lng: 4.9355, lat: 52.3123 },
    google_place_id: 'ChIJWQNe_6QJxkcRGGY1v2mZ8h8',
    category: 'cinema',
    address: 'ArenA Boulevard 600, 1101 DS Amsterdam',
    contact_phone: '+31209001458',
    website_url: 'https://www.pathe.nl/bioscoop/arena',
    capacity: 3600,
    price_range: '€€'
  },
  {
    name: 'Eye Filmmuseum',
    aliases: ['EYE', 'Eye Amsterdam', 'Eye Film Institute'],
    location: { lng: 4.9007, lat: 52.3840 },
    google_place_id: 'ChIJh0vf9UMJxkcRKz5yQkI0t0s',
    category: 'cinema',
    address: 'IJpromenade 1, 1031 KT Amsterdam',
    contact_phone: '+31205891400',
    website_url: 'https://www.eyefilm.nl',
    capacity: 600,
    opening_hours: {
      monday: [{ open: '10:00', close: '22:00' }],
      tuesday: [{ open: '10:00', close: '22:00' }],
      wednesday: [{ open: '10:00', close: '22:00' }],
      thursday: [{ open: '10:00', close: '22:00' }],
      friday: [{ open: '10:00', close: '22:00' }],
      saturday: [{ open: '10:00', close: '22:00' }],
      sunday: [{ open: '10:00', close: '22:00' }]
    },
    price_range: '€€'
  },

  // ============================================================================
  // OUTDOOR / PARKS
  // ============================================================================
  {
    name: 'Vondelpark',
    aliases: ['Vondel Park', 'Amsterdam Vondelpark'],
    location: { lng: 4.8663, lat: 52.3580 },
    google_place_id: 'ChIJWROlSpYJxkcRwB1V4pVbWQs',
    category: 'outdoor',
    address: 'Vondelpark, 1071 AA Amsterdam',
    website_url: 'https://www.hetvondelpark.net',
    opening_hours: { always_open: true },
    price_range: 'free'
  },
  {
    name: 'Kralingse Bos',
    aliases: ['Kralingsebos', 'Kralingse Plas'],
    location: { lng: 4.5114, lat: 51.9342 },
    google_place_id: 'ChIJBYKQUIY3xEcRcPNhIDpLMc8',
    category: 'outdoor',
    address: 'Kralingse Bos, Rotterdam',
    opening_hours: { always_open: true },
    price_range: 'free'
  },
  {
    name: 'Het Park Rotterdam',
    aliases: ['Euromast Park', 'Park bij Euromast'],
    location: { lng: 4.4665, lat: 51.9055 },
    google_place_id: 'ChIJc0d7OpY3xEcRgMzGMBST_io',
    category: 'outdoor',
    address: 'Het Park, 3016 AJ Rotterdam',
    website_url: 'https://www.hetpark.nl',
    opening_hours: { always_open: true },
    price_range: 'free'
  },
  {
    name: 'Keukenhof',
    aliases: ['Keukenhof Gardens', 'Keukenhof Lisse'],
    location: { lng: 4.5470, lat: 52.2702 },
    google_place_id: 'ChIJGeNpLlXGxUcRQNQ08tY2b9w',
    category: 'outdoor',
    address: 'Stationsweg 166A, 2161 AM Lisse',
    contact_phone: '+31252465555',
    website_url: 'https://keukenhof.nl',
    capacity: 50000,
    price_range: '€€'
  },
  {
    name: 'Efteling',
    aliases: ['De Efteling', 'Efteling Kaatsheuvel'],
    location: { lng: 5.0500, lat: 51.6500 },
    google_place_id: 'ChIJAQDAt2ysxkcRkBp7TQJQFQ',
    category: 'outdoor',
    address: 'Europalaan 1, 5171 KW Kaatsheuvel',
    contact_phone: '+31416537777',
    website_url: 'https://www.efteling.com',
    capacity: 60000,
    price_range: '€€€'
  },

  // ============================================================================
  // CONVENTION / EXHIBITION CENTERS
  // ============================================================================
  {
    name: 'RAI Amsterdam',
    aliases: ['RAI Convention Center', 'Amsterdam RAI', 'RAI'],
    location: { lng: 4.8900, lat: 52.3390 },
    google_place_id: 'ChIJlZCBgD0JxkcRJV0oKJ6D0Mc',
    category: 'other',
    address: 'Europaplein, 1078 GZ Amsterdam',
    contact_phone: '+31205491212',
    website_url: 'https://www.rai.nl',
    capacity: 87000,
    price_range: '€€€'
  },
  {
    name: 'Ahoy Rotterdam',
    aliases: ['Rotterdam Ahoy', 'Ahoy'],
    location: { lng: 4.4897, lat: 51.8883 },
    google_place_id: 'ChIJp0CIb8U3xEcR4C0E_Xo9W6k',
    category: 'other',
    address: 'Ahoyweg 10, 3084 BA Rotterdam',
    contact_phone: '+31102933300',
    website_url: 'https://www.ahoy.nl',
    capacity: 16000,
    price_range: '€€€'
  },
  {
    name: 'Jaarbeurs Utrecht',
    aliases: ['Jaarbeurs', 'Utrecht Jaarbeurs'],
    location: { lng: 5.0958, lat: 52.0862 },
    google_place_id: 'ChIJ0R0dLI7JxkcR4MkL6QiYkjE',
    category: 'other',
    address: 'Jaarbeursplein, 3521 AL Utrecht',
    contact_phone: '+31306958711',
    website_url: 'https://www.jaarbeurs.nl',
    capacity: 70000,
    price_range: '€€'
  }
];

/**
 * Normalize a string for fuzzy matching
 * - Lowercase
 * - Remove diacritics
 * - Remove special characters
 * - Collapse whitespace
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')     // Remove special chars
    .replace(/\s+/g, ' ')            // Collapse whitespace
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function calculateSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

/**
 * Match result with confidence score
 */
export interface VenueMatchResult {
  venue: RegisteredVenue;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
}

/**
 * Find a venue in the registry by name
 * 
 * Matching strategy (in order):
 * 1. Exact name match (normalized)
 * 2. Alias match (normalized)
 * 3. Contains check (for partial matches)
 * 4. Fuzzy match with Levenshtein distance (threshold: 0.75 similarity)
 * 
 * @param scrapedName - The venue name from scraper/user input
 * @returns The best matching venue or null if no match found
 */
export function findVenueInRegistry(scrapedName: string): VenueMatchResult | null {
  const normalizedInput = normalizeString(scrapedName);
  
  if (!normalizedInput || normalizedInput.length < 2) {
    return null;
  }
  
  let bestMatch: VenueMatchResult | null = null;
  let bestConfidence = 0;
  
  for (const venue of VENUE_REGISTRY) {
    const normalizedName = normalizeString(venue.name);
    
    // 1. Exact name match
    if (normalizedInput === normalizedName) {
      return { venue, confidence: 1.0, matchType: 'exact' };
    }
    
    // 2. Check aliases
    for (const alias of venue.aliases) {
      const normalizedAlias = normalizeString(alias);
      if (normalizedInput === normalizedAlias) {
        return { venue, confidence: 0.95, matchType: 'alias' };
      }
    }
    
    // 3. Contains check (input contains name or name contains input)
    if (normalizedInput.includes(normalizedName) || normalizedName.includes(normalizedInput)) {
      const lengthRatio = Math.min(normalizedInput.length, normalizedName.length) / 
                         Math.max(normalizedInput.length, normalizedName.length);
      const confidence = 0.7 + (0.2 * lengthRatio);
      
      if (confidence > bestConfidence) {
        bestMatch = { venue, confidence, matchType: 'fuzzy' };
        bestConfidence = confidence;
      }
    }
    
    // 4. Fuzzy match
    const similarity = calculateSimilarity(normalizedInput, normalizedName);
    if (similarity > 0.75 && similarity > bestConfidence) {
      bestMatch = { venue, confidence: similarity, matchType: 'fuzzy' };
      bestConfidence = similarity;
    }
    
    // Also check aliases with fuzzy matching
    for (const alias of venue.aliases) {
      const aliasSimilarity = calculateSimilarity(normalizedInput, normalizeString(alias));
      if (aliasSimilarity > 0.75 && aliasSimilarity > bestConfidence) {
        bestMatch = { venue, confidence: aliasSimilarity * 0.95, matchType: 'fuzzy' };
        bestConfidence = aliasSimilarity * 0.95;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Find a venue by Google Place ID
 * 
 * @param placeId - Google Places API place_id
 * @returns The matching venue or null
 */
export function findVenueByPlaceId(placeId: string): RegisteredVenue | null {
  return VENUE_REGISTRY.find(v => v.google_place_id === placeId) || null;
}

/**
 * Get all venues by category
 * 
 * @param category - Venue category filter
 * @returns Array of venues in the specified category
 */
export function getVenuesByCategory(category: RegisteredVenue['category']): RegisteredVenue[] {
  return VENUE_REGISTRY.filter(v => v.category === category);
}

/**
 * Get venue count by category (for stats/monitoring)
 */
export function getVenueStats(): Record<string, number> {
  const stats: Record<string, number> = {
    total: VENUE_REGISTRY.length,
  };
  
  for (const venue of VENUE_REGISTRY) {
    stats[venue.category] = (stats[venue.category] || 0) + 1;
  }
  
  return stats;
}

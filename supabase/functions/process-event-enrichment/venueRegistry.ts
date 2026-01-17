import type { OpeningHours } from './types.ts';

export interface RegisteredVenue {
  name: string;
  aliases: string[];
  location: {
    lng: number;
    lat: number;
  };
  google_place_id: string;
  category: 'sports' | 'music' | 'culture' | 'other';
  address: string;
  contact_phone?: string;
  website_url?: string;
  capacity?: number;
  opening_hours?: OpeningHours;
}

export const VENUE_REGISTRY: RegisteredVenue[] = [
  {
    name: 'Johan Cruijff ArenA',
    aliases: ['Amsterdam Arena', 'Johan Cruijff Arena', 'ArenA', 'Ajax Stadium', 'Arena Amsterdam'],
    location: { lng: 4.9416, lat: 52.3140 },
    google_place_id: 'place_id_johan_cruijff_arena',
    category: 'sports',
    address: 'Johan Cruijff Boulevard 1, 1101 AX Amsterdam',
    website_url: 'https://www.johancruijffarena.nl',
    capacity: 55000,
  },
  {
    name: 'Stadion Feijenoord (De Kuip)',
    aliases: ['De Kuip', 'Feyenoord Stadium', 'Stadion Feijenoord'],
    location: { lng: 4.5230, lat: 51.8936 },
    google_place_id: 'place_id_de_kuip',
    category: 'sports',
    address: 'Van Zandvlietplein 1, 3077 AA Rotterdam',
    website_url: 'https://www.feyenoord.nl',
    capacity: 51000,
  },
  {
    name: 'Philips Stadion',
    aliases: ['PSV Stadion', 'PSV Stadium'],
    location: { lng: 5.4670, lat: 51.4416 },
    google_place_id: 'place_id_philips_stadion',
    category: 'sports',
    address: 'Frederiklaan 10A, 5616 NH Eindhoven',
    website_url: 'https://www.psv.nl',
    capacity: 35000,
  },
  {
    name: 'GelreDome',
    aliases: ['Gelredome', 'Vitesse Stadium'],
    location: { lng: 5.8922, lat: 51.9648 },
    google_place_id: 'place_id_gelredome',
    category: 'sports',
    address: 'Batavierenweg 25, 6841 HN Arnhem',
    website_url: 'https://www.gelredome.nl',
    capacity: 34000,
  },
  {
    name: 'AFAS Stadion',
    aliases: ['AZ Stadion', 'AFAS Stadium'],
    location: { lng: 4.7424, lat: 52.6014 },
    google_place_id: 'place_id_afas_stadion',
    category: 'sports',
    address: 'Stadionweg 1, 1812 AZ Alkmaar',
    website_url: 'https://www.az.nl',
    capacity: 19500,
  },
  {
    name: 'Stadion Galgenwaard',
    aliases: ['FC Utrecht Stadion', 'Galgenwaard'],
    location: { lng: 5.1369, lat: 52.0847 },
    google_place_id: 'place_id_galgenwaard',
    category: 'sports',
    address: 'Herculesplein 241, 3584 AA Utrecht',
    website_url: 'https://www.fcutrecht.nl',
    capacity: 23750,
  },
  {
    name: 'De Grolsch Veste',
    aliases: ['Grolsch Veste', 'FC Twente Stadion'],
    location: { lng: 6.8403, lat: 52.2369 },
    google_place_id: 'place_id_grolsch_veste',
    category: 'sports',
    address: 'Colosseum 65, 7521 PP Enschede',
    website_url: 'https://www.fctwente.nl',
    capacity: 30500,
  },
  {
    name: 'Abe Lenstra Stadion',
    aliases: ['SC Heerenveen Stadion', 'Abe Lenstra'],
    location: { lng: 5.9148, lat: 52.9594 },
    google_place_id: 'place_id_abe_lenstra',
    category: 'sports',
    address: 'Abe Lenstra Boulevard 19, 8448 JA Heerenveen',
    website_url: 'https://www.sc-heerenveen.nl',
    capacity: 26100,
  },
  {
    name: 'Euroborg',
    aliases: ['FC Groningen Stadion'],
    location: { lng: 6.5665, lat: 53.2156 },
    google_place_id: 'place_id_euroborg',
    category: 'sports',
    address: 'Boumaboulevard 41, 9723 ZS Groningen',
    website_url: 'https://www.fcgroningen.nl',
    capacity: 22550,
  },
  {
    name: 'Goffertstadion',
    aliases: ['NEC Stadion', 'De Goffert'],
    location: { lng: 5.8386, lat: 51.8207 },
    google_place_id: 'place_id_goffertstadion',
    category: 'sports',
    address: 'Stadionplein 1, 6532 AJ Nijmegen',
    website_url: 'https://www.nec-nijmegen.nl',
    capacity: 12500,
  },
  {
    name: 'Sparta Stadion Het Kasteel',
    aliases: ['Het Kasteel', 'Sparta Rotterdam Stadion'],
    location: { lng: 4.4397, lat: 51.9137 },
    google_place_id: 'place_id_het_kasteel',
    category: 'sports',
    address: 'Spartapark Noord 1, 3027 VW Rotterdam',
    website_url: 'https://www.sparta-rotterdam.nl',
    capacity: 11000,
  },
  {
    name: 'De Adelaarshorst',
    aliases: ['Go Ahead Eagles Stadion'],
    location: { lng: 6.1802, lat: 52.2553 },
    google_place_id: 'place_id_adelaarshorst',
    category: 'sports',
    address: 'Brinkgreverweg 35, 7413 EA Deventer',
    website_url: 'https://www.ga-eagles.nl',
    capacity: 10000,
  },
  {
    name: 'Fortuna Sittard Stadion',
    aliases: ['Fortuna Sittard', 'Fortuna Stadion'],
    location: { lng: 5.8689, lat: 51.0016 },
    google_place_id: 'place_id_fortuna_sittard',
    category: 'sports',
    address: 'Milaanstraat 120, 6135 LH Sittard',
    website_url: 'https://fortunasittard.nl',
    capacity: 12500,
  },
  {
    name: 'Van Donge & De Roo Stadion',
    aliases: ['Excelsior Stadion', 'Excelsior Rotterdam'],
    location: { lng: 4.5089, lat: 51.9319 },
    google_place_id: 'place_id_van_donge_de_roo',
    category: 'sports',
    address: 'Van Zandvlietplein 3, 3042 KK Rotterdam',
    website_url: 'https://excelsiorrotterdam.nl',
    capacity: 4400,
  },
  {
    name: 'Erve Asito',
    aliases: ['Heracles Stadion', 'Heracles Almelo'],
    location: { lng: 6.6661, lat: 52.3558 },
    google_place_id: 'place_id_erve_asito',
    category: 'sports',
    address: 'Westermaatweg 15, 7607 HG Almelo',
    website_url: 'https://www.heracles.nl',
    capacity: 12500,
  },
  {
    name: 'MAC³PARK Stadion',
    aliases: ['PEC Zwolle Stadion', 'Oosterenkstadion'],
    location: { lng: 6.0878, lat: 52.5181 },
    google_place_id: 'place_id_mac3park',
    category: 'sports',
    address: 'Stadionplein 20, 8025 CP Zwolle',
    website_url: 'https://www.peczwolle.nl',
    capacity: 14000,
  },
  {
    name: 'Mandemakers Stadion',
    aliases: ['RKC Waalwijk Stadion'],
    location: { lng: 5.0563, lat: 51.6887 },
    google_place_id: 'place_id_mandemakers',
    category: 'sports',
    address: 'Akkerlaan 2, 5143 AN Waalwijk',
    website_url: 'https://www.rkcwaalwijk.nl',
    capacity: 7500,
  },
  {
    name: 'Kras Stadion',
    aliases: ['FC Volendam Stadion'],
    location: { lng: 5.0712, lat: 52.4998 },
    google_place_id: 'place_id_kras_stadion',
    category: 'sports',
    address: 'Havenstraat 1, 1131 EP Volendam',
    website_url: 'https://fcvolendam.nl',
    capacity: 6700,
  },
  {
    name: 'Yanmar Stadion',
    aliases: ['Almere City Stadion'],
    location: { lng: 5.1983, lat: 52.3590 },
    google_place_id: 'place_id_yanmar_stadion',
    category: 'sports',
    address: 'Competitiestraat 20, 1318 EA Almere',
    website_url: 'https://almerecityfc.nl',
    capacity: 4500,
  },
  {
    name: 'De Koel',
    aliases: ['VVV Venlo Stadion'],
    location: { lng: 6.1699, lat: 51.3697 },
    google_place_id: 'place_id_de_koel',
    category: 'sports',
    address: 'Kaldenkerkerweg 8, 5913 AB Venlo',
    website_url: 'https://www.vvv-venlo.nl',
    capacity: 7200,
  },
  {
    name: 'Rat Verlegh Stadion',
    aliases: ['NAC Breda Stadion'],
    location: { lng: 4.7911, lat: 51.5876 },
    google_place_id: 'place_id_rat_verlegh',
    category: 'sports',
    address: 'Rat Verleghstraat 2, 4815 NZ Breda',
    website_url: 'https://www.nac.nl',
    capacity: 19000,
  },
  {
    name: 'De Oude Meerdijk',
    aliases: ['FC Emmen Stadion'],
    location: { lng: 6.8973, lat: 52.7881 },
    google_place_id: 'place_id_oude_meerdijk',
    category: 'sports',
    address: 'Stadionstraat 5, 7815 SR Emmen',
    website_url: 'https://fcemmen.nl',
    capacity: 8600,
  },
  {
    name: 'Ziggo Dome',
    aliases: ['Ziggo', 'Ziggo Dome Amsterdam'],
    location: { lng: 4.9449, lat: 52.3120 },
    google_place_id: 'place_id_ziggo_dome',
    category: 'music',
    address: 'De Passage 100, 1101 AX Amsterdam',
    website_url: 'https://www.ziggodome.nl',
    capacity: 17000,
  },
  {
    name: 'AFAS Live',
    aliases: ['Heineken Music Hall', 'AFAS Live Amsterdam'],
    location: { lng: 4.9465, lat: 52.3124 },
    google_place_id: 'place_id_afas_live',
    category: 'music',
    address: 'Johan Cruijff Boulevard 590, 1101 DS Amsterdam',
    website_url: 'https://www.afaslive.nl',
    capacity: 6000,
  },
  {
    name: 'Paradiso',
    aliases: ['Paradiso Amsterdam'],
    location: { lng: 4.8820, lat: 52.3638 },
    google_place_id: 'place_id_paradiso',
    category: 'music',
    address: 'Weteringschans 6-8, 1017 SG Amsterdam',
    website_url: 'https://www.paradiso.nl',
    capacity: 1500,
  },
  {
    name: 'Melkweg',
    aliases: ['Melkweg Amsterdam'],
    location: { lng: 4.8796, lat: 52.3632 },
    google_place_id: 'place_id_melkweg',
    category: 'music',
    address: 'Lijnbaansgracht 234a, 1017 PH Amsterdam',
    website_url: 'https://www.melkweg.nl',
    capacity: 1500,
  },
  {
    name: 'TivoliVredenburg',
    aliases: ['Tivoli', 'Tivoli Vredenburg'],
    location: { lng: 5.1126, lat: 52.0934 },
    google_place_id: 'place_id_tivoli_vredenburg',
    category: 'music',
    address: 'Vredenburgkade 11, 3511 WC Utrecht',
    website_url: 'https://www.tivolivredenburg.nl',
    capacity: 5000,
  },
  {
    name: '013',
    aliases: ['Poppodium 013', '013 Tilburg'],
    location: { lng: 5.0839, lat: 51.5604 },
    google_place_id: 'place_id_013',
    category: 'music',
    address: 'Veemarktstraat 44, 5038 CV Tilburg',
    website_url: 'https://www.013.nl',
    capacity: 3000,
  },
  {
    name: 'Poppodium Vera',
    aliases: ['Vera Groningen'],
    location: { lng: 6.5634, lat: 53.2196 },
    google_place_id: 'place_id_vera',
    category: 'music',
    address: 'Oosterstraat 44, 9711 NV Groningen',
    website_url: 'https://www.vera-groningen.nl',
    capacity: 700,
  },
  {
    name: 'Doornroosje',
    aliases: ['Doornroosje Nijmegen'],
    location: { lng: 5.8621, lat: 51.8443 },
    google_place_id: 'place_id_doornroosje',
    category: 'music',
    address: 'Stationsplein 11, 6512 AB Nijmegen',
    website_url: 'https://www.doornroosje.nl',
    capacity: 1100,
  },
  {
    name: 'Effenaar',
    aliases: ['Effenaar Eindhoven'],
    location: { lng: 5.4790, lat: 51.4425 },
    google_place_id: 'place_id_effenaar',
    category: 'music',
    address: 'Dommelstraat 2, 5611 CK Eindhoven',
    website_url: 'https://www.effenaar.nl',
    capacity: 1300,
  },
  {
    name: 'Patronaat',
    aliases: ['Patronaat Haarlem'],
    location: { lng: 4.6426, lat: 52.3807 },
    google_place_id: 'place_id_patronaat',
    category: 'music',
    address: 'Zijlsingel 2, 2013 DN Haarlem',
    website_url: 'https://www.patronaat.nl',
    capacity: 1000,
  },
  {
    name: 'Paard',
    aliases: ['Paard van Troje', 'Paard Den Haag'],
    location: { lng: 4.3235, lat: 52.0783 },
    google_place_id: 'place_id_paard',
    category: 'music',
    address: 'Prinsegracht 12, 2512 GA Den Haag',
    website_url: 'https://www.paard.nl',
    capacity: 1200,
  },
  {
    name: 'Oosterpoort',
    aliases: ['De Oosterpoort', 'Oosterpoort Groningen'],
    location: { lng: 6.5702, lat: 53.2139 },
    google_place_id: 'place_id_oosterpoort',
    category: 'music',
    address: 'Trompsingel 27, 9724 DA Groningen',
    website_url: 'https://www.oosterpoort.nl',
    capacity: 1800,
  },
  {
    name: 'Hedon',
    aliases: ['Hedon Zwolle'],
    location: { lng: 6.0949, lat: 52.5128 },
    google_place_id: 'place_id_hedon',
    category: 'music',
    address: 'Burgemeester Drijbersingel 19, 8021 JB Zwolle',
    website_url: 'https://www.hedon-zwolle.nl',
    capacity: 850,
  },
  {
    name: 'Luxor Live',
    aliases: ['Luxor Live Arnhem'],
    location: { lng: 5.9129, lat: 51.9851 },
    google_place_id: 'place_id_luxor_live',
    category: 'music',
    address: 'Willemsplein 10, 6811 KB Arnhem',
    website_url: 'https://www.luxorlive.nl',
    capacity: 900,
  },
  {
    name: 'Mezz',
    aliases: ['Mezz Breda'],
    location: { lng: 4.7808, lat: 51.5888 },
    google_place_id: 'place_id_mezz',
    category: 'music',
    address: 'Keizerstraat 101, 4811 HL Breda',
    website_url: 'https://www.mezz.nl',
    capacity: 1200,
  },
  {
    name: 'Concertgebouw',
    aliases: ['Concertgebouw Amsterdam'],
    location: { lng: 4.8791, lat: 52.3560 },
    google_place_id: 'place_id_concertgebouw',
    category: 'culture',
    address: 'Concertgebouwplein 10, 1071 LN Amsterdam',
    website_url: 'https://www.concertgebouw.nl',
  },
  {
    name: 'Koninklijk Theater Carré',
    aliases: ['Theater Carré', 'Carré Amsterdam'],
    location: { lng: 4.9020, lat: 52.3610 },
    google_place_id: 'place_id_carre',
    category: 'culture',
    address: 'Amstel 115-125, 1018 EM Amsterdam',
    website_url: 'https://www.carre.nl',
  },
  {
    name: 'Muziekgebouw aan \'t IJ',
    aliases: ['Muziekgebouw aan het IJ'],
    location: { lng: 4.9130, lat: 52.3789 },
    google_place_id: 'place_id_muziekgebouw_ij',
    category: 'culture',
    address: 'Piet Heinkade 1, 1019 BR Amsterdam',
    website_url: 'https://www.muziekgebouw.nl',
  },
  {
    name: 'Nationale Opera & Ballet',
    aliases: ['Dutch National Opera', 'Stopera'],
    location: { lng: 4.9006, lat: 52.3680 },
    google_place_id: 'place_id_nationale_opera',
    category: 'culture',
    address: 'Amstel 3, 1011 PN Amsterdam',
    website_url: 'https://www.operaballet.nl',
  },
  {
    name: 'Stadsschouwburg Amsterdam',
    aliases: ['Schouwburg Amsterdam'],
    location: { lng: 4.8836, lat: 52.3642 },
    google_place_id: 'place_id_stadsschouwburg',
    category: 'culture',
    address: 'Leidseplein 26, 1017 PT Amsterdam',
    website_url: 'https://www.stadsschouwburgamsterdam.nl',
  },
  {
    name: 'DeLaMar Theater',
    aliases: ['DeLaMar'],
    location: { lng: 4.8816, lat: 52.3643 },
    google_place_id: 'place_id_delamar',
    category: 'culture',
    address: 'Marnixstraat 402, 1016 NT Amsterdam',
    website_url: 'https://www.delamar.nl',
  },
  {
    name: 'De Doelen',
    aliases: ['De Doelen Rotterdam'],
    location: { lng: 4.4777, lat: 51.9225 },
    google_place_id: 'place_id_doelen',
    category: 'culture',
    address: 'Schouwburgplein 50, 3012 CL Rotterdam',
    website_url: 'https://www.dedoelen.nl',
  },
  {
    name: 'Chassé Theater',
    aliases: ['Chasse Theater Breda'],
    location: { lng: 4.7810, lat: 51.5890 },
    google_place_id: 'place_id_chasse',
    category: 'culture',
    address: 'Claudius Prinsenlaan 8, 4811 DJ Breda',
    website_url: 'https://www.chasse.nl',
  },
  {
    name: 'Theater Rotterdam',
    aliases: ['Rotterdam Schouwburg'],
    location: { lng: 4.4793, lat: 51.9217 },
    google_place_id: 'place_id_theater_rotterdam',
    category: 'culture',
    address: 'Schouwburgplein 25, 3012 CL Rotterdam',
    website_url: 'https://www.theaterrotterdam.nl',
  },
  {
    name: 'Museum Boijmans Van Beuningen',
    aliases: ['Boijmans', 'Boijmans Rotterdam'],
    location: { lng: 4.4730, lat: 51.9143 },
    google_place_id: 'place_id_boijmans',
    category: 'culture',
    address: 'Museumpark 18, 3015 CX Rotterdam',
    website_url: 'https://www.boijmans.nl',
  },
  {
    name: 'Rijksmuseum',
    aliases: ['Rijksmuseum Amsterdam'],
    location: { lng: 4.8852, lat: 52.3600 },
    google_place_id: 'place_id_rijksmuseum',
    category: 'culture',
    address: 'Museumstraat 1, 1071 XX Amsterdam',
    website_url: 'https://www.rijksmuseum.nl',
  },
  {
    name: 'Van Gogh Museum',
    aliases: ['Van Gogh Museum Amsterdam'],
    location: { lng: 4.8811, lat: 52.3584 },
    google_place_id: 'place_id_vangogh',
    category: 'culture',
    address: 'Museumplein 6, 1071 DJ Amsterdam',
    website_url: 'https://www.vangoghmuseum.nl',
  },
  {
    name: 'Anne Frank House',
    aliases: ['Anne Frank Huis'],
    location: { lng: 4.8838, lat: 52.3752 },
    google_place_id: 'place_id_anne_frank',
    category: 'culture',
    address: 'Prinsengracht 263-267, 1016 GV Amsterdam',
    website_url: 'https://www.annefrank.org',
  },
  {
    name: 'NEMO Science Museum',
    aliases: ['NEMO'],
    location: { lng: 4.9120, lat: 52.3730 },
    google_place_id: 'place_id_nemo',
    category: 'other',
    address: 'Oosterdok 2, 1011 VX Amsterdam',
    website_url: 'https://www.nemosciencemuseum.nl',
  },
  {
    name: 'Efteling',
    aliases: ['Efteling Theme Park'],
    location: { lng: 5.0420, lat: 51.6490 },
    google_place_id: 'place_id_efteling',
    category: 'other',
    address: 'Europalaan 1, 5171 KW Kaatsheuvel',
    website_url: 'https://www.efteling.com',
  },
];

const NORMALIZED_REGISTRY = VENUE_REGISTRY.map((venue) => ({
  venue,
  names: [venue.name, ...venue.aliases].map(normalizeVenueName),
}));

export function findVenueInRegistry(scrapedName: string): RegisteredVenue | null {
  const normalized = normalizeVenueName(scrapedName);
  if (!normalized) return null;

  let bestMatch: { venue: RegisteredVenue; score: number } | null = null;

  for (const entry of NORMALIZED_REGISTRY) {
    for (const name of entry.names) {
      if (name === normalized) {
        return entry.venue;
      }

      if (name.includes(normalized) || normalized.includes(name)) {
        return entry.venue;
      }

      const score = similarityScore(normalized, name);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { venue: entry.venue, score };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.82) {
    return bestMatch.venue;
  }

  return null;
}

function normalizeVenueName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

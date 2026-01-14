/**
 * Dutch Municipalities (Gemeenten) with population > 1000 residents
 * Includes center coordinates for geocoding fallback
 * 
 * Source: CBS (Centraal Bureau voor de Statistiek) municipal data
 * Coordinates are approximate center points for each municipality
 */

export interface Municipality {
  /** Municipality name in Dutch */
  name: string;
  /** Province (Provincie) */
  province: string;
  /** Approximate population */
  population: number;
  /** Center latitude */
  lat: number;
  /** Center longitude */
  lng: number;
}

/**
 * Major Dutch municipalities with >50,000 residents
 * These are prioritized for source discovery
 */
export const MAJOR_MUNICIPALITIES: Municipality[] = [
  { name: "Amsterdam", province: "Noord-Holland", population: 882633, lat: 52.3676, lng: 4.9041 },
  { name: "Rotterdam", province: "Zuid-Holland", population: 656050, lat: 51.9225, lng: 4.4792 },
  { name: "Den Haag", province: "Zuid-Holland", population: 552995, lat: 52.0705, lng: 4.3007 },
  { name: "Utrecht", province: "Utrecht", population: 361924, lat: 52.0907, lng: 5.1214 },
  { name: "Eindhoven", province: "Noord-Brabant", population: 238478, lat: 51.4416, lng: 5.4697 },
  { name: "Groningen", province: "Groningen", population: 234649, lat: 53.2194, lng: 6.5665 },
  { name: "Tilburg", province: "Noord-Brabant", population: 224702, lat: 51.5555, lng: 5.0913 },
  { name: "Almere", province: "Flevoland", population: 218096, lat: 52.3508, lng: 5.2647 },
  { name: "Breda", province: "Noord-Brabant", population: 185587, lat: 51.5719, lng: 4.7683 },
  { name: "Nijmegen", province: "Gelderland", population: 179073, lat: 51.8126, lng: 5.8372 },
  { name: "Apeldoorn", province: "Gelderland", population: 165474, lat: 52.2112, lng: 5.9699 },
  { name: "Arnhem", province: "Gelderland", population: 163888, lat: 51.9851, lng: 5.8987 },
  { name: "Haarlem", province: "Noord-Holland", population: 162902, lat: 52.3874, lng: 4.6462 },
  { name: "Haarlemmermeer", province: "Noord-Holland", population: 158356, lat: 52.3030, lng: 4.6888 },
  { name: "Enschede", province: "Overijssel", population: 158553, lat: 52.2215, lng: 6.8937 },
  { name: "Amersfoort", province: "Utrecht", population: 158005, lat: 52.1561, lng: 5.3878 },
  { name: "Zaanstad", province: "Noord-Holland", population: 156802, lat: 52.4566, lng: 4.8083 },
  { name: "'s-Hertogenbosch", province: "Noord-Brabant", population: 156754, lat: 51.6978, lng: 5.3037 },
  { name: "Zwolle", province: "Overijssel", population: 132397, lat: 52.5168, lng: 6.0830 },
  { name: "Leiden", province: "Zuid-Holland", population: 125574, lat: 52.1601, lng: 4.4970 },
  { name: "Leeuwarden", province: "Friesland", population: 124481, lat: 53.2012, lng: 5.7999 },
  { name: "Maastricht", province: "Limburg", population: 121151, lat: 50.8514, lng: 5.6910 },
  { name: "Dordrecht", province: "Zuid-Holland", population: 119395, lat: 51.8133, lng: 4.6901 },
  { name: "Zoetermeer", province: "Zuid-Holland", population: 126322, lat: 52.0572, lng: 4.4931 },
  { name: "Westland", province: "Zuid-Holland", population: 113236, lat: 52.0299, lng: 4.2128 },
  { name: "Emmen", province: "Drenthe", population: 107235, lat: 52.7792, lng: 6.8995 },
  { name: "Ede", province: "Gelderland", population: 119802, lat: 52.0484, lng: 5.6650 },
  { name: "Venlo", province: "Limburg", population: 101999, lat: 51.3704, lng: 6.1724 },
  { name: "Delft", province: "Zuid-Holland", population: 104463, lat: 52.0116, lng: 4.3571 },
  { name: "Deventer", province: "Overijssel", population: 101514, lat: 52.2500, lng: 6.1640 },
];

/**
 * Medium-sized municipalities (10,000 - 50,000 residents)
 * Second priority for source discovery
 */
export const MEDIUM_MUNICIPALITIES: Municipality[] = [
  { name: "Alkmaar", province: "Noord-Holland", population: 110918, lat: 52.6324, lng: 4.7534 },
  { name: "Sittard-Geleen", province: "Limburg", population: 91817, lat: 50.9987, lng: 5.8627 },
  { name: "Heerlen", province: "Limburg", population: 86877, lat: 50.8882, lng: 5.9792 },
  { name: "Helmond", province: "Noord-Brabant", population: 93472, lat: 51.4758, lng: 5.6615 },
  { name: "Hilversum", province: "Noord-Holland", population: 92337, lat: 52.2292, lng: 5.1669 },
  { name: "Oss", province: "Noord-Brabant", population: 93091, lat: 51.7651, lng: 5.5183 },
  { name: "Roosendaal", province: "Noord-Brabant", population: 77096, lat: 51.5308, lng: 4.4652 },
  { name: "Purmerend", province: "Noord-Holland", population: 82127, lat: 52.5054, lng: 4.9590 },
  { name: "Schiedam", province: "Zuid-Holland", population: 80069, lat: 51.9167, lng: 4.3889 },
  { name: "Almelo", province: "Overijssel", population: 73026, lat: 52.3567, lng: 6.6623 },
  { name: "Lelystad", province: "Flevoland", population: 81465, lat: 52.5185, lng: 5.4714 },
  { name: "Hoorn", province: "Noord-Holland", population: 73814, lat: 52.6439, lng: 5.0594 },
  { name: "Vlaardingen", province: "Zuid-Holland", population: 72389, lat: 51.9125, lng: 4.3419 },
  { name: "Velsen", province: "Noord-Holland", population: 68792, lat: 52.4597, lng: 4.6203 },
  { name: "Bergen op Zoom", province: "Noord-Brabant", population: 67227, lat: 51.4949, lng: 4.2911 },
  { name: "Gouda", province: "Zuid-Holland", population: 74610, lat: 52.0115, lng: 4.7104 },
  { name: "Katwijk", province: "Zuid-Holland", population: 66267, lat: 52.2019, lng: 4.4147 },
  { name: "Meppel", province: "Drenthe", population: 34893, lat: 52.6957, lng: 6.1944 },
  { name: "Assen", province: "Drenthe", population: 68776, lat: 52.9925, lng: 6.5649 },
  { name: "Hoogeveen", province: "Drenthe", population: 55756, lat: 52.7236, lng: 6.4756 },
  { name: "Kampen", province: "Overijssel", population: 54696, lat: 52.5557, lng: 5.9096 },
  { name: "Hardenberg", province: "Overijssel", population: 61259, lat: 52.5764, lng: 6.6208 },
  { name: "Veenendaal", province: "Utrecht", population: 67617, lat: 52.0281, lng: 5.5583 },
  { name: "Zeist", province: "Utrecht", population: 64835, lat: 52.0887, lng: 5.2339 },
  { name: "Nieuwegein", province: "Utrecht", population: 64892, lat: 52.0302, lng: 5.0848 },
  { name: "Houten", province: "Utrecht", population: 51148, lat: 52.0285, lng: 5.1688 },
  { name: "Capelle aan den IJssel", province: "Zuid-Holland", population: 67088, lat: 51.9295, lng: 4.5780 },
  { name: "Spijkenisse", province: "Zuid-Holland", population: 71667, lat: 51.8467, lng: 4.3292 },
  { name: "Middelburg", province: "Zeeland", population: 49161, lat: 51.4988, lng: 3.6136 },
  { name: "Vlissingen", province: "Zeeland", population: 44534, lat: 51.4536, lng: 3.5714 },
  { name: "Goes", province: "Zeeland", population: 38788, lat: 51.5040, lng: 3.8901 },
  { name: "Terneuzen", province: "Zeeland", population: 54545, lat: 51.3373, lng: 3.8281 },
];

/**
 * Smaller municipalities (1,000 - 10,000 residents)
 * Lower priority but still relevant for nationwide coverage
 */
export const SMALL_MUNICIPALITIES: Municipality[] = [
  { name: "Vught", province: "Noord-Brabant", population: 26926, lat: 51.6561, lng: 5.2948 },
  { name: "Boxtel", province: "Noord-Brabant", population: 32027, lat: 51.5911, lng: 5.3289 },
  { name: "Veghel", province: "Noord-Brabant", population: 38245, lat: 51.6144, lng: 5.5488 },
  { name: "Waalwijk", province: "Noord-Brabant", population: 48842, lat: 51.6827, lng: 5.0713 },
  { name: "Cuijk", province: "Noord-Brabant", population: 25139, lat: 51.7284, lng: 5.8803 },
  { name: "Uden", province: "Noord-Brabant", population: 42156, lat: 51.6610, lng: 5.6190 },
  { name: "Best", province: "Noord-Brabant", population: 30469, lat: 51.5093, lng: 5.3902 },
  { name: "Geldrop-Mierlo", province: "Noord-Brabant", population: 40179, lat: 51.4202, lng: 5.5589 },
  { name: "Valkenswaard", province: "Noord-Brabant", population: 31286, lat: 51.3516, lng: 5.4614 },
  { name: "Culemborg", province: "Gelderland", population: 29691, lat: 51.9572, lng: 5.2279 },
  { name: "Tiel", province: "Gelderland", population: 42015, lat: 51.8867, lng: 5.4283 },
  { name: "Barneveld", province: "Gelderland", population: 60185, lat: 52.1400, lng: 5.5881 },
  { name: "Wageningen", province: "Gelderland", population: 40016, lat: 51.9692, lng: 5.6653 },
  { name: "Doetinchem", province: "Gelderland", population: 58395, lat: 51.9655, lng: 6.2883 },
  { name: "Winterswijk", province: "Gelderland", population: 29123, lat: 51.9707, lng: 6.7194 },
  { name: "Harderwijk", province: "Gelderland", population: 48691, lat: 52.3421, lng: 5.6200 },
  { name: "Ermelo", province: "Gelderland", population: 27657, lat: 52.2997, lng: 5.6200 },
  { name: "Nunspeet", province: "Gelderland", population: 28325, lat: 52.3767, lng: 5.7850 },
  { name: "Elburg", province: "Gelderland", population: 23563, lat: 52.4500, lng: 5.8350 },
  { name: "Zutphen", province: "Gelderland", population: 48168, lat: 52.1385, lng: 6.2014 },
  { name: "Lochem", province: "Gelderland", population: 34027, lat: 52.1607, lng: 6.4144 },
  { name: "Hengelo", province: "Overijssel", population: 81165, lat: 52.2658, lng: 6.7931 },
  { name: "Oldenzaal", province: "Overijssel", population: 32173, lat: 52.3106, lng: 6.9292 },
  { name: "Raalte", province: "Overijssel", population: 38119, lat: 52.3878, lng: 6.2750 },
  { name: "Dalfsen", province: "Overijssel", population: 28952, lat: 52.5069, lng: 6.2553 },
  { name: "Steenwijkerland", province: "Overijssel", population: 44530, lat: 52.7883, lng: 6.1192 },
  { name: "Staphorst", province: "Overijssel", population: 17302, lat: 52.6403, lng: 6.2092 },
  { name: "Coevorden", province: "Drenthe", population: 35175, lat: 52.6617, lng: 6.7408 },
  { name: "Borger-Odoorn", province: "Drenthe", population: 25420, lat: 52.9283, lng: 6.7903 },
  { name: "Tynaarlo", province: "Drenthe", population: 34195, lat: 53.0742, lng: 6.5931 },
  { name: "Noordenveld", province: "Drenthe", population: 31705, lat: 53.1408, lng: 6.4525 },
  { name: "Westerveld", province: "Drenthe", population: 19474, lat: 52.8492, lng: 6.3058 },
  { name: "De Wolden", province: "Drenthe", population: 24378, lat: 52.7117, lng: 6.3500 },
  { name: "Midden-Drenthe", province: "Drenthe", population: 33453, lat: 52.8575, lng: 6.5533 },
  { name: "Aa en Hunze", province: "Drenthe", population: 25632, lat: 52.9817, lng: 6.7342 },
  { name: "Harlingen", province: "Friesland", population: 15892, lat: 53.1742, lng: 5.4236 },
  { name: "Franekeradeel", province: "Friesland", population: 20466, lat: 53.1833, lng: 5.5417 },
  { name: "Het Bildt", province: "Friesland", population: 10655, lat: 53.2583, lng: 5.5917 },
  { name: "Menameradiel", province: "Friesland", population: 13895, lat: 53.2042, lng: 5.6250 },
  { name: "Súdwest-Fryslân", province: "Friesland", population: 89914, lat: 53.0333, lng: 5.6500 },
  { name: "De Fryske Marren", province: "Friesland", population: 51775, lat: 52.9333, lng: 5.7500 },
  { name: "Heerenveen", province: "Friesland", population: 50542, lat: 52.9592, lng: 5.9231 },
  { name: "Smallingerland", province: "Friesland", population: 56141, lat: 53.1000, lng: 6.0833 },
  { name: "Tytsjerksteradiel", province: "Friesland", population: 32006, lat: 53.2167, lng: 5.9667 },
  { name: "Dantumadiel", province: "Friesland", population: 18990, lat: 53.2917, lng: 6.0083 },
  { name: "Dongeradeel", province: "Friesland", population: 23997, lat: 53.3667, lng: 6.0167 },
  { name: "Kollumerland en Nieuwkruisland", province: "Friesland", population: 12757, lat: 53.2750, lng: 6.1583 },
  { name: "Achtkarspelen", province: "Friesland", population: 27929, lat: 53.2250, lng: 6.1250 },
  { name: "Opsterland", province: "Friesland", population: 29942, lat: 53.0667, lng: 6.1667 },
  { name: "Ooststellingwerf", province: "Friesland", population: 25576, lat: 52.9500, lng: 6.2833 },
  { name: "Weststellingwerf", province: "Friesland", population: 25877, lat: 52.8917, lng: 6.0167 },
];

/**
 * All municipalities combined, sorted by population (descending)
 */
export const ALL_MUNICIPALITIES: Municipality[] = [
  ...MAJOR_MUNICIPALITIES,
  ...MEDIUM_MUNICIPALITIES,
  ...SMALL_MUNICIPALITIES,
].sort((a, b) => b.population - a.population);

/**
 * Get municipalities by minimum population
 */
export function getMunicipalitiesByMinPopulation(minPopulation: number): Municipality[] {
  return ALL_MUNICIPALITIES.filter(m => m.population >= minPopulation);
}

/**
 * Get municipalities by province
 */
export function getMunicipalitiesByProvince(province: string): Municipality[] {
  return ALL_MUNICIPALITIES.filter(m => 
    m.province.toLowerCase() === province.toLowerCase()
  );
}

/**
 * Find municipality by name (case-insensitive)
 */
export function findMunicipalityByName(name: string): Municipality | undefined {
  const normalized = name.toLowerCase().replace(/['']/g, "'");
  return ALL_MUNICIPALITIES.find(m => 
    m.name.toLowerCase().replace(/['']/g, "'") === normalized
  );
}

/**
 * Get coordinates for a municipality name
 */
export function getMunicipalityCoordinates(name: string): { lat: number; lng: number } | null {
  const municipality = findMunicipalityByName(name);
  return municipality ? { lat: municipality.lat, lng: municipality.lng } : null;
}

export interface MunicipalitySelectionOptions {
  /** Minimum population threshold */
  minPopulation?: number;
  /** Limit the number of municipalities to process */
  maxMunicipalities?: number;
  /** Explicit municipality name filter (case-insensitive) */
  municipalities?: string[];
}

/**
 * Helper used by source discovery to pick municipalities to process
 */
export function selectMunicipalitiesForDiscovery(
  options: MunicipalitySelectionOptions = {}
): Municipality[] {
  const {
    minPopulation = 1000,
    maxMunicipalities,
    municipalities,
  } = options;

  const baseList =
    municipalities && municipalities.length > 0
      ? ALL_MUNICIPALITIES.filter((m) =>
          municipalities.some(
            (name) => m.name.toLowerCase() === name.toLowerCase()
          )
        )
      : getMunicipalitiesByMinPopulation(minPopulation);

  if (
    Number.isFinite(maxMunicipalities) &&
    (maxMunicipalities ?? 0) > 0
  ) {
    return baseList.slice(0, maxMunicipalities);
  }

  return baseList;
}

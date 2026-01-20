
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CITIES = [
  "Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", 
  "Apeldoorn", "Arnhem", "Haarlem", "Enschede", "Haarlemmermeer", "Amersfoort", "Zaanstad", "'s-Hertogenbosch", "Zwolle", "Zoetermeer", 
  "Leiden", "Leeuwarden", "Dordrecht", "Ede", "Alphen aan den Rijn", "Westland", "Alkmaar", "Emmen", "Delft", "Venlo", 
  "Deventer", "Helmond", "Oss", "Amstelveen", "Hilversum", "Sittard-Geleen", "Heerlen", "Nissewaard", "Sudwest-Fryslan", "Hengelo", 
  "Purmerend", "Schiedam", "Roosendaal", "Lelystad", "Leidschendam-Voorburg", "Almelo", "Hoorn", "Gouda", "Vlaardingen", "Assen", 
  "Velsen", "Bergen op Zoom", "Capelle aan den IJssel", "Veenendaal", "Katwijk", "Zeist", "Nieuwegein", "Hardenberg", "Roermond", "Doetinchem", 
  "Gooise Meren", "Den Helder", "Smallingerland", "Hoogeveen", "Krimpenerwaard", "Terneuzen", "Oosterhout", "De Fryske Marren", "Pijnacker-Nootdorp", "Kampen", 
  "Woerden", "De Bilt", "Heerenveen", "Rijswijk", "West Betuwe", "Houten", "Goeree-Overflakkee", "Midden-Groningen", "Utrechtse Heuvelrug", "Barendrecht", 
  "Middelburg", "Waalwijk", "Hollands Kroon", "Overbetuwe", "Soest", "Harderwijk", "Veldhoven", "Heusden", "Westland", "Lingewaard"
];

const COMMON_PATTERNS = [
  (city: string) => `https://www.uitin${city.toLowerCase().replace(/[^a-z0-9]/g, '')}.nl`,
  (city: string) => `https://${city.toLowerCase().replace(/[\s']/g, '-')}.nl/evenementen`,
  (city: string) => `https://www.uitagend${city.toLowerCase().replace(/[^a-z0-9]/g, '')}.nl`,
];

async function seedCities() {
  console.log(`Seeding top ${CITIES.length} Dutch cities...`);
  
  let added = 0;
  let skipped = 0;

  for (const city of CITIES) {
    // Generate a best-guess URL (defaulting to uittin[city].nl as it's very common)
    const slug = city.toLowerCase().replace(/[\s']/g, '-');
    const simpleSlug = city.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Default to the most likely pattern for major cities
    const url = `https://www.uitin${simpleSlug}.nl`; 

    // Check if exists
    const { data: existing } = await supabase
      .from("scraper_sources")
      .select("id")
      .ilike("name", `%${city}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Skipping ${city} (already exists)`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("scraper_sources").insert({
      name: `Uitagenda ${city}`,
      url: url,
      tier: "aggregator",
      enabled: true, // Activate them so they get scraped
      preferred_method: "auto", // Let the new waterfall figure it out!
      config: {
        selectors: [
          ".event-item", ".agenda-item", "article.event", 
          ".card--event", ".activity-card", ".search-result"
        ], // Generic selectors
        match_patterns: [slug, "agenda", "evenement"],
        feed_discovery: true // Important: Enable feed discovery for these!
      }
    });

    if (error) {
      console.error(`Failed to add ${city}:`, error.message);
    } else {
      console.log(`Added ${city} -> ${url}`);
      added++;
    }
  }

  console.log(`\nDone! Added: ${added}, Skipped: ${skipped}`);
}

if (import.meta.main) {
  await seedCities();
}

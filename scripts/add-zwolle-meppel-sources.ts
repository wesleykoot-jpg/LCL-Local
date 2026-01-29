// Script to add Zwolle and Meppel event sources
// Run with: npx tsx scripts/add-zwolle-meppel-sources.ts

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('Run: export $(grep -E "^SUPABASE_" .env | xargs)');
  process.exit(1);
}

interface Source {
  name: string;
  url: string;
  city: string;
  country_code: string;
  tier: string;
  discovery_method: string;
  enabled: boolean;
  quarantined: boolean;
  fetch_strategy: { fetcher: string; anti_bot?: boolean };
  extraction_config: Record<string, unknown>;
}

const zwolleSources: Source[] = [
  {
    name: "uitagendazwolle.nl",
    url: "https://www.uitagendazwolle.nl/",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "zwollebruist.nl",
    url: "https://www.zwollebruist.nl/evenementen",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "hedonzwolle.nl",
    url: "https://www.hedonzwolle.nl/agenda",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "schouwburgodeon.nl",
    url: "https://www.schouwburgodeon.nl/agenda",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "openluchttheaterzwolle.nl",
    url: "https://openluchttheaterzwolle.nl/programma/",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "bandsintown-zwolle",
    url: "https://www.bandsintown.com/c/zwolle-netherlands",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "browserless", anti_bot: true },
    extraction_config: {}
  },
  {
    name: "inzwolle.nl",
    url: "https://www.inzwolle.nl/evenementen",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "dejazzagenda-zwolle",
    url: "https://www.dejazzagenda.nl/zoek?zoek=zwolle",
    city: "Zwolle",
    country_code: "NL",
    tier: "tier_2_regional",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  }
];

const meppelSources: Source[] = [
  {
    name: "meppel.nl-evenementen",
    url: "https://www.meppel.nl/inwoners/vrije-tijd/evenementen",
    city: "Meppel",
    country_code: "NL",
    tier: "tier_3_hyperlocal",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "ogterop.nl",
    url: "https://www.ogterop.nl/agenda/",
    city: "Meppel",
    country_code: "NL",
    tier: "tier_3_hyperlocal",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "vfriesland.nl-meppel",
    url: "https://www.vfriesland.nl/agenda/meppel",
    city: "Meppel",
    country_code: "NL",
    tier: "tier_3_hyperlocal",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "drenthetotaal.nl-meppel",
    url: "https://www.drenthetotaal.nl/evenementen/meppel",
    city: "Meppel",
    country_code: "NL",
    tier: "tier_3_hyperlocal",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "schouwvaria.nl",
    url: "https://www.schouwvaria.nl/agenda",
    city: "Meppel",
    country_code: "NL",
    tier: "tier_3_hyperlocal",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  },
  {
    name: "uitindrenthe.nl-meppel",
    url: "https://www.uitindrenthe.nl/evenementen?location=meppel",
    city: "Meppel",
    country_code: "NL",
    tier: "tier_3_hyperlocal",
    discovery_method: "seed_list",
    enabled: true,
    quarantined: false,
    fetch_strategy: { fetcher: "static" },
    extraction_config: {}
  }
];

async function addSources(sources: Source[]): Promise<number> {
  let added = 0;
  
  for (const source of sources) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/sg_sources`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(source)
      });

      if (response.ok) {
        console.log(`✓ Added: ${source.name} (${source.city})`);
        added++;
      } else {
        const error = await response.text();
        if (error.includes('duplicate')) {
          console.log(`⚠ Already exists: ${source.name}`);
        } else {
          console.error(`✗ Failed: ${source.name} - ${error}`);
        }
      }
    } catch (err) {
      console.error(`✗ Error adding ${source.name}:`, err);
    }
  }
  
  return added;
}

async function main() {
  console.log('=== Adding Zwolle Sources ===');
  const zwolleAdded = await addSources(zwolleSources);
  
  console.log('\n=== Adding Meppel Sources ===');
  const meppelAdded = await addSources(meppelSources);
  
  console.log(`\n✅ Total added: ${zwolleAdded + meppelAdded} sources`);
  console.log(`   Zwolle: ${zwolleAdded}/${zwolleSources.length}`);
  console.log(`   Meppel: ${meppelAdded}/${meppelSources.length}`);
}

main().catch(console.error);

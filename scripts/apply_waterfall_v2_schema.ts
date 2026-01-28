/**
 * Apply Waterfall v2 Schema
 * 
 * Run with: npx ts-node scripts/apply_waterfall_v2_schema.ts
 * Or: deno run --allow-net --allow-env scripts/apply_waterfall_v2_schema.ts
 */

const SUPABASE_PROJECT_REF = 'mlpefjsbriqgxcaqxhic';

async function main() {
  // Get access token from supabase CLI
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const tokenPath = `${homeDir}/.supabase/access-token`;
  
  let accessToken: string;
  try {
    const fs = await import('fs');
    accessToken = fs.readFileSync(tokenPath, 'utf-8').trim();
  } catch {
    console.error('Could not read Supabase access token. Run: npx supabase login');
    process.exit(1);
  }

  const sql = `
-- Add nl_tier column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraper_sources' 
    AND column_name = 'nl_tier'
  ) THEN
    ALTER TABLE public.scraper_sources ADD COLUMN nl_tier integer DEFAULT 3 CHECK (nl_tier BETWEEN 1 AND 3);
    CREATE INDEX IF NOT EXISTS idx_scraper_sources_nl_tier ON public.scraper_sources(nl_tier);
  END IF;
END $$;

-- Add health_score column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraper_sources' 
    AND column_name = 'health_score'
  ) THEN
    ALTER TABLE public.scraper_sources ADD COLUMN health_score integer DEFAULT 70 CHECK (health_score BETWEEN 0 AND 100);
    ALTER TABLE public.scraper_sources ADD COLUMN health_last_updated_at timestamptz DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS idx_scraper_sources_health_score ON public.scraper_sources(health_score DESC) WHERE enabled = true;
  END IF;
END $$;

-- Add Social Five columns to events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'doors_open_time') THEN
    ALTER TABLE public.events ADD COLUMN doors_open_time time;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'language_profile') THEN
    ALTER TABLE public.events ADD COLUMN language_profile varchar(10) DEFAULT 'NL' CHECK (language_profile IN ('NL', 'EN', 'Mixed', 'Other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'interaction_mode') THEN
    ALTER TABLE public.events ADD COLUMN interaction_mode varchar(10) DEFAULT 'medium' CHECK (interaction_mode IN ('high', 'medium', 'low', 'passive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'structured_address') THEN
    ALTER TABLE public.events ADD COLUMN structured_address jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'social_five_score') THEN
    ALTER TABLE public.events ADD COLUMN social_five_score integer DEFAULT 0 CHECK (social_five_score BETWEEN 0 AND 5);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_language_profile ON public.events(language_profile);
CREATE INDEX IF NOT EXISTS idx_events_interaction_mode ON public.events(interaction_mode);
CREATE INDEX IF NOT EXISTS idx_events_social_five_score ON public.events(social_five_score DESC);

SELECT 'Waterfall v2 schema applied!' as status;
  `;

  console.log('Applying Waterfall v2 schema to Supabase...');
  
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to apply schema:', error);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Schema applied successfully!');
  console.log(result);
}

main().catch(console.error);

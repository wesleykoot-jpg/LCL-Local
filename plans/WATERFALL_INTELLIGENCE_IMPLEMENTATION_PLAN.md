# Waterfall Intelligence Scraper Pipeline - Implementation Plan

> **Document Status**: Implementation Blueprint  
> **PRD Source**: Waterfall Intelligence Scraper Pipeline PRD  
> **Target**: Netherlands (Tier 1-3)  
> **Estimated Total Effort**: 6-8 weeks

---

## Table of Contents

1. [Gap Analysis](#1-gap-analysis)
2. [Implementation Phases](#2-implementation-phases)
3. [Phase 1: Database Schema Extension](#phase-1-database-schema-extension)
4. [Phase 2: Enrichment Service with Structured Outputs](#phase-2-enrichment-service-with-structured-outputs)
5. [Phase 3: Analyzer Module (JS-Heavy Detection)](#phase-3-analyzer-module-js-heavy-detection)
6. [Phase 4: Self-Healing Selector Loop](#phase-4-self-healing-selector-loop)
7. [Detailed Task Breakdown](#3-detailed-task-breakdown)
8. [Risk Assessment](#4-risk-assessment)
9. [Success Metrics](#5-success-metrics)

---

## 1. Gap Analysis

### What Already Exists ✅

| PRD Requirement | Current Implementation | Status |
|-----------------|------------------------|--------|
| **Waterfall Extraction** | 4-tier system in `dataExtractors.ts` (Hydration → JSON-LD → Feed → DOM) | ✅ Implemented |
| **Two-Pass Execution** | Discovery (`scrape-events`) → Enrichment (`process-worker`) | ✅ Implemented |
| **Source Tier Classification** | `scraper_sources.tier` column exists (`aggregator`/`venue`/`general`) | ✅ Implemented |
| **Preferred Extraction Method** | `scraper_sources.preferred_method` column exists | ✅ Implemented |
| **CMS Fingerprinting** | `fingerprintCMS()` in `dataExtractors.ts` | ✅ Implemented |
| **Strategy Insights Logging** | `scraper_insights` table with `log_scraper_insight()` RPC | ✅ Implemented |
| **Self-Healing Fetcher Upgrade** | `fetcher_type` enum with auto-upgrade logic | ✅ Implemented |
| **Circuit Breakers** | `consecutive_errors` and quarantine logic | ✅ Implemented |
| **Doors Open vs Start Time** | Partial in `strategies/music.ts` | 🟡 Partial |

### Gaps to Fill 🔴

| PRD Requirement | Gap Description | Priority |
|-----------------|-----------------|----------|
| **"Social Five" Schema** | Missing: `doors_open`, `end_time`, `language_profile`, `interaction_mode` columns in `events` | 🔴 High |
| **Dutch Tier Tagging (`nl_tier`)** | No `nl_tier` (1=G4, 2=Centrum, 3=Village) column on `scraper_sources` | 🔴 High |
| **Source Health Score** | No explicit `health_score` (0-100) column with decay/gain logic | 🔴 High |
| **AWAITING_ENRICHMENT Status** | `raw_event_staging` uses `pending` but PRD wants explicit `AWAITING_ENRICHMENT` | 🟡 Medium |
| **AI Analyzer Agent** | No LLM call to detect "JS-Heavy" signature and decide fetcher type | 🔴 High |
| **Selector Healer Agent** | No LLM-based CSS selector regeneration on failure | 🔴 High |
| **Vibe Classifier Agent** | No AI inference of `interaction_mode` and persona tags | 🔴 High |
| **OpenAI Structured Outputs** | Current AI uses freeform JSON, not Structured Outputs API | 🟡 Medium |
| **Browserless Integration** | Playwright exists but no dedicated "Browserless" service config | 🟡 Medium |
| **Language Auto-Detection** | No language detection for events (`NL`/`EN`/`Mixed`) | 🔴 High |

---

## 2. Implementation Phases

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION ROADMAP                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  PHASE 1 ─────────► PHASE 2 ─────────► PHASE 3 ─────────► PHASE 4                   │
│  (Week 1-2)         (Week 2-4)         (Week 4-5)         (Week 5-7)                │
│                                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐          │
│  │   DATABASE   │   │  ENRICHMENT  │   │   ANALYZER   │   │ SELF-HEALING │          │
│  │   SCHEMA     │   │   SERVICE    │   │   MODULE     │   │    LOOP      │          │
│  │              │   │              │   │              │   │              │          │
│  │ • nl_tier    │   │ • Social Five│   │ • JS-Heavy   │   │ • Selector   │          │
│  │ • health_score│  │ • Structured │   │   Detection  │   │   Regeneration│         │
│  │ • Social Five│   │   Outputs    │   │ • Browserless│   │ • LLM Diff   │          │
│  │   columns    │   │ • Language   │   │   Fallback   │   │   Analysis   │          │
│  │              │   │   Detection  │   │              │   │              │          │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘          │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema Extension

**Duration**: Week 1-2  
**Effort**: 3-4 days

### 1.1 Migration: `nl_tier` and `health_score`

Create migration: `supabase/migrations/YYYYMMDD_waterfall_nl_tier_and_health.sql`

```sql
-- ============================================================================
-- Waterfall Intelligence: Dutch Tier Classification & Source Health
-- ============================================================================

-- Add Dutch-specific tier classification (Tier 1 = G4, Tier 2 = Centrum, Tier 3 = Village)
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS nl_tier integer DEFAULT 3
CHECK (nl_tier BETWEEN 1 AND 3);

COMMENT ON COLUMN public.scraper_sources.nl_tier IS 
  'Dutch rollout tier: 1=G4 cities (Amsterdam, Rotterdam, The Hague, Utrecht), 2=Centrum (regional aggregators), 3=Villages (local sites)';

-- Add Source Reliability Score (0-100)
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 70
CHECK (health_score BETWEEN 0 AND 100);

COMMENT ON COLUMN public.scraper_sources.health_score IS 
  'Source reliability score (0-100). +10 for full Social Five extraction, -20 for 4xx/5xx errors, -10 for missing images/addresses. Quarantine at <40.';

-- Add health trend tracking
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS health_last_updated_at timestamptz DEFAULT NOW();

-- Index for prioritizing healthy sources
CREATE INDEX IF NOT EXISTS idx_scraper_sources_health_score 
ON public.scraper_sources(health_score DESC) 
WHERE enabled = true;

-- Index for tier-based scheduling
CREATE INDEX IF NOT EXISTS idx_scraper_sources_nl_tier 
ON public.scraper_sources(nl_tier);
```

### 1.2 Migration: "Social Five" Event Columns

Create migration: `supabase/migrations/YYYYMMDD_waterfall_social_five_schema.sql`

```sql
-- ============================================================================
-- Waterfall Intelligence: "Social Five" Data Schema
-- ============================================================================

-- 1. Doors Open Time (distinct from performance start)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS doors_open_time time DEFAULT NULL;

COMMENT ON COLUMN public.events.doors_open_time IS 
  'When doors open (distinct from event_time which is performance/activity start)';

-- 2. End Time (for itinerary gap filling)
-- NOTE: end_time column already exists, just ensure it's used

-- 3. Language Profile
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS language_profile text DEFAULT 'NL'
CHECK (language_profile IN ('NL', 'EN', 'Mixed', 'Other'));

COMMENT ON COLUMN public.events.language_profile IS 
  'Primary language of the event: NL (Dutch), EN (English), Mixed, Other';

-- 4. Interaction Mode (AI-inferred energy level)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS interaction_mode text DEFAULT NULL
CHECK (interaction_mode IN ('high', 'medium', 'low', 'passive'));

COMMENT ON COLUMN public.events.interaction_mode IS 
  'AI-inferred social interaction level: high (workshops, meetups), medium (concerts, markets), low (talks, screenings), passive (movies, exhibitions)';

-- 5. Persona Fit Tags (e.g., #ExpatFriendly, #DigitalNomad)
-- NOTE: tags column already exists, but add specific persona tags index
CREATE INDEX IF NOT EXISTS idx_events_persona_tags 
ON public.events USING gin(tags) 
WHERE tags IS NOT NULL;

-- Add structured venue address (map-ready)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS structured_address jsonb DEFAULT NULL;

COMMENT ON COLUMN public.events.structured_address IS 
  'Structured address for map display: {street, city, postal_code, country, coordinates: {lat, lng}}';
```

### 1.3 Migration: Health Score RPC Functions

```sql
-- ============================================================================
-- Source Health Management Functions
-- ============================================================================

-- Update health score based on scrape result
CREATE OR REPLACE FUNCTION public.update_source_health(
    p_source_id UUID,
    p_social_five_complete BOOLEAN,
    p_has_error BOOLEAN,
    p_error_code INTEGER DEFAULT NULL,
    p_missing_image BOOLEAN DEFAULT FALSE,
    p_missing_address BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_score INTEGER;
    v_new_score INTEGER;
    v_delta INTEGER := 0;
BEGIN
    -- Get current score
    SELECT health_score INTO v_current_score
    FROM public.scraper_sources
    WHERE id = p_source_id;
    
    IF v_current_score IS NULL THEN
        v_current_score := 70;
    END IF;
    
    -- Calculate delta
    IF p_has_error THEN
        -- 4xx/5xx errors: -20 points
        v_delta := v_delta - 20;
    ELSIF p_social_five_complete THEN
        -- Full Social Five extraction: +10 points
        v_delta := v_delta + 10;
    ELSE
        -- Partial success: +2 points (still working)
        v_delta := v_delta + 2;
    END IF;
    
    -- Penalties for missing data
    IF p_missing_image THEN
        v_delta := v_delta - 5;
    END IF;
    
    IF p_missing_address THEN
        v_delta := v_delta - 5;
    END IF;
    
    -- Calculate new score (clamp 0-100)
    v_new_score := GREATEST(0, LEAST(100, v_current_score + v_delta));
    
    -- Update source
    UPDATE public.scraper_sources
    SET 
        health_score = v_new_score,
        health_last_updated_at = NOW(),
        -- Auto-quarantine at <40
        enabled = CASE WHEN v_new_score < 40 THEN false ELSE enabled END,
        disabled_reason = CASE WHEN v_new_score < 40 THEN 'health_score_quarantine' ELSE disabled_reason END
    WHERE id = p_source_id;
    
    RETURN v_new_score;
END;
$$;

-- Get sources eligible for scraping (not quarantined)
CREATE OR REPLACE FUNCTION public.get_healthy_sources(
    p_nl_tier INTEGER DEFAULT NULL,
    p_min_health INTEGER DEFAULT 40
)
RETURNS SETOF public.scraper_sources
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT *
    FROM public.scraper_sources
    WHERE enabled = true
      AND (auto_disabled = false OR auto_disabled IS NULL)
      AND health_score >= p_min_health
      AND (p_nl_tier IS NULL OR nl_tier = p_nl_tier)
    ORDER BY 
        nl_tier ASC,  -- Prioritize Tier 1 (G4 cities)
        health_score DESC,
        last_scraped_at ASC NULLS FIRST
    LIMIT 50;
$$;
```

### 1.4 TypeScript Type Updates

Update `src/integrations/supabase/types.ts` to include new columns (regenerate from Supabase).

---

## Phase 2: Enrichment Service with Structured Outputs

**Duration**: Week 2-4  
**Effort**: 5-7 days

### 2.1 Create OpenAI Structured Outputs Schema

Create file: `supabase/functions/_shared/socialFiveSchema.ts`

```typescript
/**
 * Social Five Extraction Schema for OpenAI Structured Outputs
 * 
 * Ensures consistent, validated extraction of the 5 key social data points.
 */

export const SOCIAL_FIVE_SCHEMA = {
  name: "social_event_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      // 1. Start Time & Doors Open
      start_time: {
        type: "string",
        description: "Event start time in HH:MM format (24-hour). This is when the main activity begins.",
        pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
      },
      doors_open_time: {
        type: ["string", "null"],
        description: "When doors/entry opens (if different from start_time). HH:MM format or null.",
        pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
      },
      
      // 2. Precise Location
      venue_name: {
        type: "string",
        description: "Name of the venue (e.g., 'Paradiso', 'De Balie')"
      },
      street_address: {
        type: ["string", "null"],
        description: "Full street address (e.g., 'Weteringschans 6-8')"
      },
      city: {
        type: ["string", "null"],
        description: "City name (e.g., 'Amsterdam')"
      },
      postal_code: {
        type: ["string", "null"],
        description: "Postal code (e.g., '1017 SG')"
      },
      
      // 3. Duration/End Time
      end_time: {
        type: ["string", "null"],
        description: "Event end time in HH:MM format (24-hour) or null if unknown.",
        pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
      },
      estimated_duration_minutes: {
        type: ["integer", "null"],
        description: "Estimated duration in minutes if end_time is unknown"
      },
      
      // 4. Language Profile
      language_profile: {
        type: "string",
        enum: ["NL", "EN", "Mixed", "Other"],
        description: "Primary language of the event"
      },
      
      // 5. Interaction Mode
      interaction_mode: {
        type: "string",
        enum: ["high", "medium", "low", "passive"],
        description: "Social interaction level: high (workshops, networking), medium (concerts, markets), low (talks), passive (movies, exhibitions)"
      },
      
      // Additional useful fields
      title: {
        type: "string",
        description: "Clean event title"
      },
      description: {
        type: "string",
        description: "Event description (max 500 chars)"
      },
      event_date: {
        type: "string",
        description: "Event date in YYYY-MM-DD format",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      category: {
        type: "string",
        enum: ["MUSIC", "SOCIAL", "ACTIVE", "CULTURE", "FOOD", "NIGHTLIFE", "FAMILY", "CIVIC", "COMMUNITY"],
        description: "Event category"
      },
      persona_tags: {
        type: "array",
        items: { type: "string" },
        description: "Persona fit tags (e.g., 'ExpatFriendly', 'DigitalNomad', 'FamilyFriendly')"
      },
      image_url: {
        type: ["string", "null"],
        description: "URL to event image"
      },
      ticket_url: {
        type: ["string", "null"],
        description: "URL to purchase tickets"
      }
    },
    required: [
      "title",
      "event_date",
      "start_time",
      "venue_name",
      "language_profile",
      "interaction_mode",
      "category"
    ],
    additionalProperties: false
  }
};

export interface SocialFiveEvent {
  title: string;
  description?: string;
  event_date: string;
  start_time: string;
  doors_open_time?: string | null;
  end_time?: string | null;
  estimated_duration_minutes?: number | null;
  venue_name: string;
  street_address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  language_profile: 'NL' | 'EN' | 'Mixed' | 'Other';
  interaction_mode: 'high' | 'medium' | 'low' | 'passive';
  category: string;
  persona_tags?: string[];
  image_url?: string | null;
  ticket_url?: string | null;
}
```

### 2.2 Implement Enrichment Service

Create file: `supabase/functions/_shared/enrichmentService.ts`

```typescript
/**
 * Enrichment Service - Extracts "Social Five" data using OpenAI Structured Outputs
 * 
 * AI Injection Point: "Enrichment Engine" (Curator role)
 */

import { SOCIAL_FIVE_SCHEMA, SocialFiveEvent } from "./socialFiveSchema.ts";
import { htmlToMarkdown } from "./markdownUtils.ts";

interface EnrichmentOptions {
  detailHtml: string;
  baseUrl: string;
  rawEvent: {
    title?: string;
    date?: string;
    location?: string;
  };
  targetYear?: number;
}

/**
 * Extract Social Five data from event detail page using OpenAI Structured Outputs
 */
export async function enrichWithSocialFive(
  apiKey: string,
  options: EnrichmentOptions,
  fetcher: typeof fetch = fetch
): Promise<SocialFiveEvent | null> {
  const { detailHtml, baseUrl, rawEvent, targetYear = new Date().getFullYear() } = options;
  
  // Convert HTML to Markdown for cleaner AI processing
  const markdown = htmlToMarkdown(detailHtml, { baseUrl, maxLength: 8000 });
  
  const systemPrompt = `You are a precise data extraction agent for a Dutch event platform.
Extract the "Social Five" data points from event pages:
1. Start Time & Doors Open (distinguish between when doors open vs. when the main event starts)
2. Precise Location (venue name + full street address ready for maps)
3. Duration/End Time (when the event ends or estimated duration)
4. Language Profile (NL=Dutch, EN=English, Mixed, Other)
5. Interaction Mode (high=workshops/networking, medium=concerts/markets, low=talks, passive=movies/exhibitions)

Current year: ${targetYear}
Only extract events happening in ${targetYear} or later.
If you cannot determine a required field, make your best inference based on context.`;

  const userPrompt = `Extract the Social Five from this event page:

URL: ${baseUrl}
Hints from listing:
- Title: ${rawEvent.title || 'Unknown'}
- Date hint: ${rawEvent.date || 'Unknown'}
- Location hint: ${rawEvent.location || 'Unknown'}

Page content (Markdown):
${markdown}`;

  try {
    const response = await fetcher("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: SOCIAL_FIVE_SCHEMA
        },
        temperature: 0.1,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      console.error(`OpenAI enrichment error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("Empty response from OpenAI enrichment");
      return null;
    }

    return JSON.parse(content) as SocialFiveEvent;
  } catch (error) {
    console.error("Enrichment failed:", error);
    return null;
  }
}

/**
 * Calculate Social Five completeness score (0-5)
 */
export function calculateSocialFiveScore(event: Partial<SocialFiveEvent>): number {
  let score = 0;
  
  // 1. Start Time & Doors Open
  if (event.start_time) score++;
  
  // 2. Precise Location (venue + address)
  if (event.venue_name && (event.street_address || event.city)) score++;
  
  // 3. End Time/Duration
  if (event.end_time || event.estimated_duration_minutes) score++;
  
  // 4. Language Profile
  if (event.language_profile) score++;
  
  // 5. Interaction Mode
  if (event.interaction_mode) score++;
  
  return score;
}
```

### 2.3 Implement Language Detection Service

Create file: `supabase/functions/_shared/languageDetection.ts`

```typescript
/**
 * Language Detection for Event Content
 * 
 * Detects whether event is in Dutch (NL), English (EN), or Mixed
 */

// Dutch indicator words
const DUTCH_INDICATORS = [
  'van', 'het', 'een', 'voor', 'met', 'op', 'aan', 'bij',
  'gratis', 'toegang', 'kaarten', 'entree', 'aanvang', 'deuren',
  'zaterdag', 'zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag',
  'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus',
  'september', 'oktober', 'november', 'december',
  'uur', 'locatie', 'meer informatie', 'tickets', 'programma'
];

// English indicator words
const ENGLISH_INDICATORS = [
  'the', 'a', 'an', 'for', 'with', 'at', 'by', 'on',
  'free', 'entry', 'admission', 'tickets', 'doors', 'start',
  'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'location', 'more info', 'program', 'schedule'
];

export type LanguageProfile = 'NL' | 'EN' | 'Mixed' | 'Other';

export function detectLanguage(text: string): LanguageProfile {
  if (!text || text.length < 20) return 'Other';
  
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let dutchScore = 0;
  let englishScore = 0;
  
  for (const word of words) {
    if (DUTCH_INDICATORS.includes(word)) dutchScore++;
    if (ENGLISH_INDICATORS.includes(word)) englishScore++;
  }
  
  const total = dutchScore + englishScore;
  
  if (total < 3) return 'Other';
  
  const dutchRatio = dutchScore / total;
  const englishRatio = englishScore / total;
  
  if (dutchRatio > 0.7) return 'NL';
  if (englishRatio > 0.7) return 'EN';
  if (dutchRatio > 0.3 && englishRatio > 0.3) return 'Mixed';
  
  return dutchRatio > englishRatio ? 'NL' : 'EN';
}
```

### 2.4 Implement Vibe Classifier Agent

Create file: `supabase/functions/_shared/vibeClassifier.ts`

```typescript
/**
 * Vibe Classifier - AI Agent to infer Social Interaction Level
 * 
 * AI Injection Point: "Vibe Classifier" (Sociologist role)
 */

export type InteractionMode = 'high' | 'medium' | 'low' | 'passive';

interface VibeClassificationResult {
  interaction_mode: InteractionMode;
  persona_tags: string[];
  confidence: number;
}

// Rule-based classification as fast path
export function classifyVibeFromCategory(category: string, description: string): VibeClassificationResult {
  const lowerDesc = description.toLowerCase();
  const personaTags: string[] = [];
  
  // Detect persona tags
  if (lowerDesc.includes('english') || lowerDesc.includes('in english') || lowerDesc.includes('engelstalig')) {
    personaTags.push('ExpatFriendly');
  }
  if (lowerDesc.includes('remote') || lowerDesc.includes('freelance') || lowerDesc.includes('coworking')) {
    personaTags.push('DigitalNomad');
  }
  if (lowerDesc.includes('kind') || lowerDesc.includes('familie') || lowerDesc.includes('children') || lowerDesc.includes('family')) {
    personaTags.push('FamilyFriendly');
  }
  if (lowerDesc.includes('netwerk') || lowerDesc.includes('network') || lowerDesc.includes('meetup')) {
    personaTags.push('Networking');
  }
  if (lowerDesc.includes('beginner') || lowerDesc.includes('introductie') || lowerDesc.includes('introduction')) {
    personaTags.push('BeginnerFriendly');
  }
  
  // Category-based interaction mode
  const categoryLower = category.toLowerCase();
  
  // High interaction: workshops, meetups, networking, active sports
  if (['social', 'community', 'active'].includes(categoryLower) ||
      lowerDesc.includes('workshop') ||
      lowerDesc.includes('masterclass') ||
      lowerDesc.includes('meetup') ||
      lowerDesc.includes('networking')) {
    return { interaction_mode: 'high', persona_tags: personaTags, confidence: 0.8 };
  }
  
  // Medium interaction: concerts, markets, festivals
  if (['music', 'food', 'nightlife'].includes(categoryLower) ||
      lowerDesc.includes('concert') ||
      lowerDesc.includes('markt') ||
      lowerDesc.includes('festival')) {
    return { interaction_mode: 'medium', persona_tags: personaTags, confidence: 0.8 };
  }
  
  // Low interaction: talks, lectures, presentations
  if (lowerDesc.includes('lezing') ||
      lowerDesc.includes('lecture') ||
      lowerDesc.includes('presentatie') ||
      lowerDesc.includes('talk')) {
    return { interaction_mode: 'low', persona_tags: personaTags, confidence: 0.7 };
  }
  
  // Passive: movies, exhibitions, theater
  if (['culture', 'family'].includes(categoryLower) ||
      lowerDesc.includes('film') ||
      lowerDesc.includes('movie') ||
      lowerDesc.includes('expositie') ||
      lowerDesc.includes('exhibition') ||
      lowerDesc.includes('theater') ||
      lowerDesc.includes('voorstelling')) {
    return { interaction_mode: 'passive', persona_tags: personaTags, confidence: 0.8 };
  }
  
  // Default to medium
  return { interaction_mode: 'medium', persona_tags: personaTags, confidence: 0.5 };
}

/**
 * AI-powered vibe classification for complex cases
 */
export async function classifyVibeWithAI(
  apiKey: string,
  title: string,
  description: string,
  category: string,
  fetcher: typeof fetch = fetch
): Promise<VibeClassificationResult> {
  // Fast path: use rules if description is clear
  const rulesResult = classifyVibeFromCategory(category, description);
  if (rulesResult.confidence >= 0.7) {
    return rulesResult;
  }
  
  // AI path for ambiguous cases
  const prompt = `Classify this Dutch event's social interaction level:

Title: ${title}
Category: ${category}
Description: ${description.slice(0, 500)}

Return JSON with:
- interaction_mode: "high" (workshops, networking), "medium" (concerts, markets), "low" (talks), or "passive" (movies, exhibitions)
- persona_tags: array of relevant tags like ["ExpatFriendly", "DigitalNomad", "FamilyFriendly", "Networking", "BeginnerFriendly"]`;

  try {
    const response = await fetcher("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.warn("Vibe classifier AI failed, using rules fallback");
      return rulesResult;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    
    return {
      interaction_mode: parsed.interaction_mode || rulesResult.interaction_mode,
      persona_tags: [...new Set([...rulesResult.persona_tags, ...(parsed.persona_tags || [])])],
      confidence: 0.9
    };
  } catch {
    return rulesResult;
  }
}
```

---

## Phase 3: Analyzer Module (JS-Heavy Detection)

**Duration**: Week 4-5  
**Effort**: 3-4 days

### 3.1 Create Analyzer Agent

Create file: `supabase/functions/_shared/analyzerAgent.ts`

```typescript
/**
 * Analyzer Agent - Determines optimal fetcher strategy
 * 
 * AI Injection Point: "The Analyzer" (Technician role)
 * Scans raw HTML to detect "JS-Heavy" signature and decides between STATIC or BROWSERLESS.
 */

export type FetcherRecommendation = 'static' | 'browserless';

interface AnalysisResult {
  recommendation: FetcherRecommendation;
  confidence: number;
  signals: string[];
  jsFramework?: string;
}

// JS framework signatures
const JS_HEAVY_SIGNATURES = [
  // React/Next.js
  { pattern: /__NEXT_DATA__/, framework: 'Next.js', weight: 0.9 },
  { pattern: /react-root|react-app|data-reactroot/, framework: 'React', weight: 0.7 },
  { pattern: /_next\/static/, framework: 'Next.js', weight: 0.8 },
  
  // Vue/Nuxt
  { pattern: /__NUXT__|nuxt-link|v-cloak/, framework: 'Nuxt/Vue', weight: 0.9 },
  { pattern: /vue-app|v-if|v-for/, framework: 'Vue', weight: 0.7 },
  
  // Angular
  { pattern: /ng-app|ng-controller|angular\.module/, framework: 'Angular', weight: 0.8 },
  { pattern: /_ngcontent|ng-version/, framework: 'Angular', weight: 0.7 },
  
  // SPA indicators
  { pattern: /<div id="app"><\/div>|<div id="root"><\/div>/, framework: 'SPA', weight: 0.9 },
  { pattern: /window\.__INITIAL_STATE__|window\.__PRELOADED_STATE__/, framework: 'SSR App', weight: 0.8 },
  
  // Wix
  { pattern: /wix-code-sdk|wixcode-iframe/, framework: 'Wix', weight: 0.9 },
  
  // Loading states (indicates content loaded via JS)
  { pattern: /loading\.{3}|skeleton-loader|placeholder-content/, framework: 'Lazy Load', weight: 0.6 }
];

// Static site indicators
const STATIC_SIGNATURES = [
  // WordPress
  { pattern: /wp-content|wordpress|wp-json/, platform: 'WordPress' },
  
  // Classic HTML
  { pattern: /<table[^>]*>.*<\/table>/s, platform: 'Classic HTML' },
  
  // Server-rendered with data
  { pattern: /application\/ld\+json/, platform: 'JSON-LD' },
  { pattern: /itemtype=".*Event"/, platform: 'Microdata' },
  
  // Dutch CMS platforms (typically static)
  { pattern: /ontdek-|beleef-|visit-|uit-/i, platform: 'Dutch CMS' }
];

/**
 * Analyze HTML to determine optimal fetcher type
 */
export function analyzeHtmlForFetcher(html: string): AnalysisResult {
  const signals: string[] = [];
  let jsScore = 0;
  let staticScore = 0;
  let detectedFramework: string | undefined;
  
  // Check content density (empty body = JS-heavy)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch?.[1] || '';
  const textContent = bodyContent.replace(/<[^>]*>/g, '').trim();
  
  if (textContent.length < 500) {
    signals.push('Low text content - possible SPA');
    jsScore += 0.4;
  }
  
  // Check for JS framework signatures
  for (const sig of JS_HEAVY_SIGNATURES) {
    if (sig.pattern.test(html)) {
      signals.push(`Detected: ${sig.framework}`);
      jsScore += sig.weight;
      if (!detectedFramework) detectedFramework = sig.framework;
    }
  }
  
  // Check for static site indicators
  for (const sig of STATIC_SIGNATURES) {
    if (sig.pattern.test(html)) {
      signals.push(`Static indicator: ${sig.platform}`);
      staticScore += 0.3;
    }
  }
  
  // Normalize scores
  const totalScore = jsScore + staticScore;
  const jsRatio = totalScore > 0 ? jsScore / totalScore : 0.5;
  
  // Determine recommendation
  if (jsRatio > 0.6) {
    return {
      recommendation: 'browserless',
      confidence: Math.min(jsRatio, 0.95),
      signals,
      jsFramework: detectedFramework
    };
  }
  
  return {
    recommendation: 'static',
    confidence: 1 - jsRatio,
    signals
  };
}

/**
 * AI-powered analysis for edge cases
 */
export async function analyzeWithAI(
  apiKey: string,
  html: string,
  previousAttemptFailed: boolean,
  fetcher: typeof fetch = fetch
): Promise<AnalysisResult> {
  // First try rule-based analysis
  const rulesResult = analyzeHtmlForFetcher(html);
  
  // If previous attempt failed or rules are uncertain, use AI
  if (!previousAttemptFailed && rulesResult.confidence > 0.7) {
    return rulesResult;
  }
  
  const htmlSample = html.slice(0, 4000);
  const prompt = `Analyze this HTML snippet to determine if a headless browser (Playwright/Browserless) is needed to scrape event data, or if static fetching is sufficient.

HTML sample:
\`\`\`html
${htmlSample}
\`\`\`

Previous static fetch attempt failed: ${previousAttemptFailed}

Respond with JSON:
{
  "recommendation": "static" | "browserless",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "detected_framework": "framework name if applicable"
}`;

  try {
    const response = await fetcher("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      return rulesResult;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    
    return {
      recommendation: parsed.recommendation || rulesResult.recommendation,
      confidence: parsed.confidence || rulesResult.confidence,
      signals: [...rulesResult.signals, parsed.reasoning],
      jsFramework: parsed.detected_framework || rulesResult.jsFramework
    };
  } catch {
    return rulesResult;
  }
}
```

### 3.2 Browserless Integration Config

Create file: `supabase/functions/_shared/browserlessClient.ts`

```typescript
/**
 * Browserless Client - Remote headless browser for JS-heavy sites
 * 
 * Uses Browserless.io or self-hosted Playwright service
 */

interface BrowserlessConfig {
  apiKey: string;
  endpoint?: string;
  timeout?: number;
}

interface RenderResult {
  html: string;
  statusCode: number;
  loadTime: number;
}

export async function renderWithBrowserless(
  url: string,
  config: BrowserlessConfig,
  fetcher: typeof fetch = fetch
): Promise<RenderResult> {
  const endpoint = config.endpoint || 'https://chrome.browserless.io/content';
  const timeout = config.timeout || 30000;
  
  const startTime = Date.now();
  
  const response = await fetcher(`${endpoint}?token=${config.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      waitFor: 2000, // Wait for JS to render
      gotoOptions: {
        waitUntil: 'networkidle2',
        timeout
      }
    })
  });
  
  const loadTime = Date.now() - startTime;
  
  if (!response.ok) {
    throw new Error(`Browserless render failed: ${response.status}`);
  }
  
  const html = await response.text();
  
  return {
    html,
    statusCode: response.status,
    loadTime
  };
}
```

---

## Phase 4: Self-Healing Selector Loop

**Duration**: Week 5-7  
**Effort**: 4-5 days

### 4.1 Selector Healer Agent

Create file: `supabase/functions/_shared/selectorHealer.ts`

```typescript
/**
 * Selector Healer - AI-powered CSS selector regeneration
 * 
 * AI Injection Point: "Selector Healer" (Doctor role)
 * Triggered on 3 failed attempts. Compares old vs. new Markdown to generate fresh selectors.
 */

import { htmlToMarkdown } from "./markdownUtils.ts";

interface HealingResult {
  newSelectors: string[];
  confidence: number;
  analysis: string;
}

interface HealingContext {
  sourceId: string;
  sourceName: string;
  oldSelectors: string[];
  oldHtml?: string;
  newHtml: string;
  failureCount: number;
}

/**
 * Analyze HTML structure changes and generate new selectors
 */
export async function healBrokenSelectors(
  apiKey: string,
  context: HealingContext,
  fetcher: typeof fetch = fetch
): Promise<HealingResult> {
  const { oldSelectors, oldHtml, newHtml, sourceName } = context;
  
  // Convert to Markdown for cleaner comparison
  const newMarkdown = htmlToMarkdown(newHtml, { maxLength: 6000 });
  const oldMarkdown = oldHtml ? htmlToMarkdown(oldHtml, { maxLength: 6000 }) : null;
  
  const prompt = `You are a CSS selector expert helping heal a broken web scraper.

Source: ${sourceName}
Failure count: ${context.failureCount}
Old selectors that no longer work:
${JSON.stringify(oldSelectors, null, 2)}

${oldMarkdown ? `OLD page structure (Markdown):
${oldMarkdown.slice(0, 3000)}

---

` : ''}NEW page structure (Markdown):
${newMarkdown}

Analyze the HTML structure and generate new CSS selectors to extract event listings.
Look for patterns like:
- Event cards, agenda items, program listings
- Date/time patterns
- Venue/location mentions
- Title/heading patterns

Respond with JSON:
{
  "analysis": "Brief explanation of what changed",
  "newSelectors": ["selector1", "selector2", ...],
  "confidence": 0.0-1.0
}

Generate 3-5 selectors, ordered by confidence.`;

  try {
    const response = await fetcher("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.error(`Selector healer failed: ${response.status}`);
      return {
        newSelectors: [],
        confidence: 0,
        analysis: "AI healing failed"
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    
    return {
      newSelectors: parsed.newSelectors || [],
      confidence: parsed.confidence || 0,
      analysis: parsed.analysis || "No analysis provided"
    };
  } catch (error) {
    console.error("Selector healing error:", error);
    return {
      newSelectors: [],
      confidence: 0,
      analysis: `Healing error: ${error}`
    };
  }
}

/**
 * Apply healed selectors to source configuration
 */
export async function applySelectorHealing(
  supabase: any,
  sourceId: string,
  healingResult: HealingResult
): Promise<boolean> {
  if (healingResult.newSelectors.length === 0 || healingResult.confidence < 0.5) {
    console.log(`Healing rejected: low confidence (${healingResult.confidence})`);
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('scraper_sources')
      .update({
        config: {
          selectors: healingResult.newSelectors,
          last_healed_at: new Date().toISOString(),
          healing_analysis: healingResult.analysis
        },
        consecutive_failures: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceId);
    
    if (error) {
      console.error("Failed to apply healing:", error);
      return false;
    }
    
    console.log(`✅ Healed source ${sourceId} with ${healingResult.newSelectors.length} new selectors`);
    return true;
  } catch (error) {
    console.error("Healing application error:", error);
    return false;
  }
}
```

### 4.2 Self-Healing Orchestration

Update the process worker to trigger healing:

```typescript
// Add to supabase/functions/process-worker/index.ts

import { healBrokenSelectors, applySelectorHealing } from "../_shared/selectorHealer.ts";

const HEALING_THRESHOLD = 3; // Trigger healing after 3 failures

async function checkAndTriggerHealing(
  supabase: SupabaseClient,
  source: ScraperSource,
  latestHtml: string
): Promise<boolean> {
  if (source.consecutive_failures < HEALING_THRESHOLD) {
    return false;
  }
  
  console.log(`🏥 Triggering self-healing for ${source.name} (${source.consecutive_failures} failures)`);
  
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    console.warn("No OpenAI key for healing");
    return false;
  }
  
  const healingResult = await healBrokenSelectors(openaiKey, {
    sourceId: source.id,
    sourceName: source.name,
    oldSelectors: source.config?.selectors || [],
    newHtml: latestHtml,
    failureCount: source.consecutive_failures
  });
  
  return await applySelectorHealing(supabase, source.id, healingResult);
}
```

---

## 3. Detailed Task Breakdown

### Phase 1 Tasks (Week 1-2)

| Task ID | Task | Effort | Dependencies |
|---------|------|--------|--------------|
| P1.1 | Create `nl_tier` and `health_score` migration | 2h | None |
| P1.2 | Create "Social Five" columns migration | 2h | None |
| P1.3 | Create `update_source_health()` RPC | 3h | P1.1 |
| P1.4 | Create `get_healthy_sources()` RPC | 2h | P1.1 |
| P1.5 | Update TypeScript types | 1h | P1.1, P1.2 |
| P1.6 | Add initial `nl_tier` tagging for existing sources | 2h | P1.1 |
| P1.7 | Write migration tests | 2h | P1.1-P1.4 |

### Phase 2 Tasks (Week 2-4)

| Task ID | Task | Effort | Dependencies |
|---------|------|--------|--------------|
| P2.1 | Create `socialFiveSchema.ts` | 3h | P1.2 |
| P2.2 | Implement `enrichmentService.ts` | 6h | P2.1 |
| P2.3 | Create `markdownUtils.ts` (HTML to Markdown) | 3h | None |
| P2.4 | Implement `languageDetection.ts` | 2h | None |
| P2.5 | Implement `vibeClassifier.ts` | 4h | None |
| P2.6 | Integrate enrichment into `process-worker` | 4h | P2.1-P2.5 |
| P2.7 | Update health score after enrichment | 2h | P1.3 |
| P2.8 | Write enrichment unit tests | 4h | P2.2 |

### Phase 3 Tasks (Week 4-5)

| Task ID | Task | Effort | Dependencies |
|---------|------|--------|--------------|
| P3.1 | Create `analyzerAgent.ts` | 4h | None |
| P3.2 | Create `browserlessClient.ts` | 3h | None |
| P3.3 | Integrate analyzer into scrape-events | 4h | P3.1, P3.2 |
| P3.4 | Add Browserless config to environment | 1h | P3.2 |
| P3.5 | Write analyzer unit tests | 3h | P3.1 |

### Phase 4 Tasks (Week 5-7)

| Task ID | Task | Effort | Dependencies |
|---------|------|--------|--------------|
| P4.1 | Create `selectorHealer.ts` | 6h | P2.3 |
| P4.2 | Add healing trigger to process-worker | 4h | P4.1 |
| P4.3 | Create healing audit log table | 2h | None |
| P4.4 | Add Slack notification for healing events | 2h | P4.2 |
| P4.5 | Write healing integration tests | 4h | P4.1, P4.2 |
| P4.6 | Documentation and runbook updates | 4h | All |

---

## 4. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OpenAI rate limits during enrichment | Medium | High | Implement batch processing, use Gemini fallback |
| Browserless costs for JS-heavy sites | Medium | Medium | Cache rendered HTML, limit to Tier 1 initially |
| AI selector healing produces bad selectors | Medium | Medium | Require >0.7 confidence, test before apply |
| Health score decay too aggressive | Low | Medium | Make decay configurable, add manual override |
| Migration conflicts with existing data | Low | High | Run on staging first, create rollback scripts |

---

## 5. Success Metrics

### Phase 1 Success Criteria
- [ ] All migrations applied without errors
- [ ] 100% of existing sources tagged with `nl_tier`
- [ ] Health score tracking active for all sources

### Phase 2 Success Criteria
- [ ] >80% of events have complete Social Five data
- [ ] Language detection accuracy >90%
- [ ] Enrichment adds <500ms average latency

### Phase 3 Success Criteria
- [ ] Analyzer correctly identifies JS-heavy sites with >85% accuracy
- [ ] Browserless fallback recovers >70% of failed static fetches
- [ ] No increase in scraping costs beyond 20%

### Phase 4 Success Criteria
- [ ] Self-healing reduces manual intervention by >50%
- [ ] Healed selectors have >70% success rate
- [ ] Zero false-positive healing (breaking working sources)

---

## Appendix A: File Structure

```
supabase/
├── migrations/
│   ├── YYYYMMDD_waterfall_nl_tier_and_health.sql
│   └── YYYYMMDD_waterfall_social_five_schema.sql
└── functions/
    └── _shared/
        ├── socialFiveSchema.ts      # Phase 2
        ├── enrichmentService.ts     # Phase 2
        ├── markdownUtils.ts         # Phase 2
        ├── languageDetection.ts     # Phase 2
        ├── vibeClassifier.ts        # Phase 2
        ├── analyzerAgent.ts         # Phase 3
        ├── browserlessClient.ts     # Phase 3
        └── selectorHealer.ts        # Phase 4
```

---

## Appendix B: Environment Variables Required

```bash
# Phase 2
OPENAI_API_KEY=sk-...

# Phase 3
BROWSERLESS_API_KEY=...
BROWSERLESS_ENDPOINT=https://chrome.browserless.io  # or self-hosted

# Phase 4 (optional)
SLACK_WEBHOOK_HEALING=https://hooks.slack.com/...
```

---

*Document created: January 2026*  
*Last updated: January 2026*

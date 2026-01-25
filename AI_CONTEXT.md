# LCL - AI Context Summary

> **Copy this section into any AI conversation for instant context.**

## One-Liner

LCL is a React/TypeScript/Supabase social events app for discovering and joining
local events globally, with an AI-powered event scraper. _(See
[docs/AI_KNOWLEDGE.md](docs/AI_KNOWLEDGE.md) for detailed architecture,
workflows, and tooling)_

## Core Concept: Fork Event Model

- **Anchors**: Official/scraped events (cinema, markets, sports, concerts)
- **Forks**: User meetups attached to anchors (pre-movie drinks, post-game
  hangout)
- **Signals**: Standalone user events (gaming sessions, casual meetups)

## Tech Stack

| Layer    | Technology                                                     |
| -------- | -------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion        |
| Mobile   | Capacitor (iOS native haptics, gestures)                       |
| Backend  | Supabase (PostgreSQL + PostGIS, Auth, Storage, Edge Functions) |
| State    | React Context + TanStack Query                                 |

## Database Schema (7 Core Tables)

```
profiles          - User data: reliability_score, verified_resident, current_persona
events            - PostGIS location, category, event_type (anchor/fork/signal)
event_attendees   - Join table: status (going/interested/waitlist)
persona_stats     - Gamification: rallies_hosted, newcomers_welcomed, host_rating
persona_badges    - Achievement badges per persona type
scraper_sources   - Web scraping targets with config and status
geocode_cache     - Nominatim API result caching for coordinates
```

## Key Files

| File                                                                                                                                                                 | Purpose                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`src/lib/feedAlgorithm.ts`](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/feedAlgorithm.ts)                     | Smart ranking: category(35%), time(20%), social(15%), match(10%), distance(20%) + urgency/trending boosts |
| [`src/lib/eventService.ts`](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/eventService.ts)                       | CRUD operations for events                                                                                |
| [`src/features/events/hooks/hooks.ts`](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/features/events/hooks/hooks.ts) | Data fetching hooks: useEvents, useProfile, useEventAttendees, useJoinEvent                               |
| [`src/features/events/discovery/`](https://github.com/wesleykoot-jpg/LCL-Local/tree/main/src/features/events/discovery)                                              | **Discovery Rails**: Strategy-based 5-pillar system with RailProviderRegistry, TitleFormatter, RitualDetection |
| [`supabase/functions/scrape-events/`](https://github.com/wesleykoot-jpg/LCL-Local/tree/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/supabase/functions/scrape-events)    | AI-powered event scraper with OpenAI                                                                      |
| [`src/contexts/AuthContext.tsx`](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/contexts/AuthContext.tsx)             | Authentication state management (email + Google OAuth)                                                    |
| [`src/contexts/LocationContext.tsx`](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/contexts/LocationContext.tsx)     | User geolocation tracking                                                                                 |
| [`DOCS/DESIGN_SYSTEM_CORE.md`](./DOCS/DESIGN_SYSTEM_CORE.md)                                                                                                         | **Design System v4.0** - Solid surfaces, colors, shadows, spacing, component patterns                     |

## Important Patterns

- **Coordinates**: `events.location` is PostGIS `geography(POINT, 4326)` -
  longitude first!
- **Profile linking**: `profiles.id` (UUID) linked to `auth.users` via
  `profiles.user_id`
- **RLS**: All tables have row-level security enabled
- **Haptics**: Native iOS feedback via `src/lib/haptics.ts`
- **Safe Areas**: iOS notch and home indicator handled via `pt-safe`/`pb-safe` utilities
- **OAuth**: Google OAuth with validated redirect URL (prefers `VITE_SITE_URL` over `window.location.origin`)
- **Categories**: active, gaming, entertainment, social, family, outdoors,
  music, workshops, foodie, community (no database constraint - validated at
  application layer)

## Discovery Rails (5 Psychological Pillars)

Strategy-based Discovery system for narrative-driven event exploration:

| Rail | Priority | Pillar | Animation |
|------|----------|--------|-----------|
| **For You** | 1 | The Ego (personalization) | Glow |
| **Rituals** | 2 | The Habit (recurring events) | Rhythm |
| **This Weekend** | 3 | The Reward (temporal anticipation) | Sparkle |
| **Location** | 4 | The Grounding (proximity) | Pulse |
| **Pulse** | 5 | The Collective (social proof) | Wave |

Key components:
- `RailProviderRegistry`: Extensible strategy pattern
- `TitleFormatter`: Dynamic contextual headers
- `ritualDetection.ts`: Detects recurring events via keywords + patterns

## Current Status

- ~94 events in database (mostly scraped from Dutch sources)
- Internal team use only (not public-facing)
- Location-agnostic design (works globally)
- iOS-optimized with native haptics and safe-area handling
- Google OAuth enabled for authentication
- Optimized bundle splitting (8 vendor chunks)

---

## Quick Context (Paste-Ready)

```
LCL is a React/TypeScript/Supabase social events app for discovering local events globally.

Core model: Anchors (official events) -> Forks (user meetups attached) -> Signals (standalone events). 
Events stored with PostGIS coordinates.

Discovery Rails: 5 psychological pillars (For You, Rituals, This Weekend, Location, Pulse) with strategy-based registry.

Database: profiles, events, event_attendees, persona_stats, persona_badges, scraper_sources, geocode_cache. 
All tables have RLS enabled.

Key files:
- src/lib/feedAlgorithm.ts: Smart ranking (category 35%, time 20%, social 15%, match 10%, distance 20%) + urgency/trending boosts
- src/lib/eventService.ts: CRUD operations for events
- src/features/events/hooks/hooks.ts: Data fetching hooks (useEvents, useProfile, etc.)
- src/features/events/discovery/: Discovery Rails with RailProviderRegistry, TitleFormatter, ritualDetection
- supabase/functions/scrape-events/: AI-powered event scraper

Stack: React 18, TypeScript, Vite, Tailwind, Capacitor (iOS), Supabase, Framer Motion

Auth: Email/password + Google OAuth
Status: Internal team use, ~94 events, location-agnostic design, iOS-optimized with native haptics.
```

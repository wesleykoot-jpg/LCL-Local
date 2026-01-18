# LCL - Local Social Events App

> **AI Context**: LCL is a React/TypeScript/Supabase social events app for discovering local events globally. Core model: Anchors (official events) → Forks (user meetups attached) → Signals (standalone events). Events stored with PostGIS coordinates. Internal team use only.

A modern, iOS-optimized social events platform built with React, TypeScript, and Supabase. Discover, create, and join local events in your community.

## Quick Context (for AI assistants)

```
Stack: React 18, TypeScript, Vite, Tailwind, Capacitor (iOS), Supabase, Framer Motion

Database: profiles, events, event_attendees, persona_stats, persona_badges, scraper_sources, geocode_cache
All tables have RLS enabled. Events use PostGIS geography(POINT, 4326).

Key files:
- src/lib/feedAlgorithm.ts: Smart ranking (category 35%, time 20%, social 15%, match 10%, distance 20%)
- src/lib/eventService.ts: CRUD operations for events
- src/features/events/hooks/hooks.ts: Data fetching hooks (useEvents, useProfile, etc.)
- supabase/functions/scrape-events/: AI-powered event scraper with OpenAI

See AI_CONTEXT.md for comprehensive AI context.
```

---

## Features

- 🎉 **Event Discovery** - Browse local events with smart feed algorithm
- 🤖 **AI Event Scraper** - Automatically scrape events from configured websites
- ➕ **Create Events** - Host your own events with image uploads
- 📱 **iOS-Optimized** - Native haptics, gestures, and smooth animations
- ⚡ **Real-time Updates** - Live event changes via Supabase Realtime
- 🔐 **Secure Auth** - Email/password authentication with Supabase
- 🗺️ **Location-Agnostic** - Works globally with any coordinates

## Architecture

### Fork Event Model
| Type | Description | Example |
|------|-------------|---------|
| **Anchor** | Official/scraped events | Cinema screening, festival, sports match |
| **Fork** | User meetup attached to anchor | Pre-movie drinks, post-game hangout |
| **Signal** | Standalone user event | Gaming session, casual meetup |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Mobile | Capacitor (iOS native features, haptics) |
| Backend | Supabase (PostgreSQL + PostGIS, Auth, Storage, Edge Functions) |
| State | React Context + TanStack Query |
| AI | OpenAI (event extraction from scraped HTML) |

## Database Schema

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User data | `reliability_score`, `verified_resident`, `location_coordinates` |
| `events` | All events | `location` (PostGIS), `category`, `event_type` (anchor/fork/signal) |
| `event_attendees` | Participation | `status` (going/interested/waitlist), `profile_id`, `event_id` |
| `persona_stats` | Gamification | `rallies_hosted`, `newcomers_welcomed`, `host_rating` |
| `persona_badges` | Achievements | `badge_name`, `badge_level`, `persona_type` |
| `scraper_sources` | Scraping config | `url`, `config`, `enabled`, `last_success` |
| `geocode_cache` | Coordinate cache | `venue_key`, `lat`, `lng` |

## Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── EventFeed.tsx    # Main feed component
│   ├── EventStackCard.tsx
│   └── ...
├── contexts/            # React Context providers
│   ├── AuthContext.tsx  # Authentication state
│   └── LocationContext.tsx
├── lib/                 # Core utilities
│   ├── feedAlgorithm.ts # Smart ranking algorithm
│   ├── eventService.ts  # Event CRUD operations
│   ├── haptics.ts       # iOS haptic feedback
│   └── ...
├── features/            # Feature modules
│   └── events/hooks/    # Event-related hooks
│       └── hooks.ts     # Data fetching hooks (useEvents, etc.)
├── pages/               # Route components
└── integrations/        # Supabase client

supabase/
├── functions/
│   └── scrape-events/   # AI event scraper
├── migrations/          # Database migrations
└── config.toml          # Supabase config
```

## Key Services

### Feed Algorithm ([`src/lib/feedAlgorithm.ts`](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/feedAlgorithm.ts))
Multi-factor scoring system with configurable weights and boost multipliers:

#### Scoring Weights
```typescript
// Source: https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/feedAlgorithm.ts#L76-L82
const WEIGHTS = {
  CATEGORY: 0.35,  // 35% - matches user's preferred categories
  TIME: 0.20,      // 20% - prioritizes upcoming events with exponential decay
  SOCIAL: 0.15,    // 15% - attendee count with logarithmic scaling
  MATCH: 0.10,     // 10% - pre-computed match_percentage from database
  DISTANCE: 0.20,  // 20% - proximity to user location
} as const;
```

#### Configuration Constants
```typescript
// Source: https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/feedAlgorithm.ts#L85-L96
const CONFIG = {
  TIME_DECAY_DAYS: 7,          // Time decay half-life (days)
  SOCIAL_LOG_BASE: 10,         // Logarithmic base for attendee scaling
  DIVERSITY_MIN_GAP: 2,        // Min positions between same-category events
  DEFAULT_RADIUS_KM: 25,       // Default search radius
  DISTANCE_MIN_SCORE: 0.1,     // Minimum distance score
} as const;
```

#### Boost Multipliers
- **Urgency Boost** (1.0-1.2x): Events within 6-72 hours get priority ([code](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/feedAlgorithm.ts#L226-L236))
- **Trending Boost** (1.0-1.2x): Events with 10+ attendees get boosted ([code](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/feedAlgorithm.ts#L241-L247))
- Combined boost capped at 1.5x maximum

#### Diversity Enforcement
Prevents category clustering by tracking recent categories and applying penalties to repeated categories within `DIVERSITY_MIN_GAP` positions ([code](https://github.com/wesleykoot-jpg/LCL-Local/blob/b12d76c8dc51c1ddb6f9cee26ce100f448fcba69/src/lib/feedAlgorithm.ts#L304-L352)).

### Event Scraper (`supabase/functions/scrape-events/`)
- Fetches HTML from configured sources
- Uses OpenAI to extract structured event data
- Geocodes venues via Nominatim with caching
- Handles Dutch CMS platforms (Ontdek, Beleef, Visit, Uit)
- Strategy-driven discovery: sources define discovery anchors/alternate paths and the scraper probes candidates before parsing.
- URL normalization utilities resolve against the final URL/base href and strip tracking parameters before deduplication.
- Optional external renderer: set `RENDER_SERVICE_URL` and flag `requires_render` on a source to render JS-heavy listings; probe results persist to `last_probe_urls` for debugging.

### Haptics (`src/lib/haptics.ts`)
Native iOS feedback for:
- Impact (light, medium, heavy)
- Notification (success, warning, error)
- Selection changes

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project with PostGIS enabled
- OpenAI API key (for scraper)

### Installation

```bash
npm install
cp .env.example .env  # Add Supabase credentials
npm run dev
```

### iOS Build

```bash
npm run build
npx cap sync ios
npx cap open ios
```

## Documentation

| Document | Purpose |
|----------|---------|
| [AI_CONTEXT.md](./AI_CONTEXT.md) | Concise context for AI assistants |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and diagrams |
| [docs/core/STRATEGIES.md](docs/core/STRATEGIES.md) | **Important**: Strategy Pattern (Production vs Test) |
| [docs/core/FEED_ALGORITHM.md](docs/core/FEED_ALGORITHM.md) | Feed ranking algorithm details |
| [docs/core/BACKEND_SETUP.md](docs/core/BACKEND_SETUP.md) | Database configuration |
| [docs/core/DEPLOYMENT_GUIDE.md](docs/core/DEPLOYMENT_GUIDE.md) | iOS App Store deployment |
| [docs/design_system/README.md](docs/design_system/README.md) | **Design System v4.0** |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Documentation & Contribution Guidelines |

## Current Status

- **Events**: ~94 in database (mostly scraped from Dutch sources)
- **Users**: Internal team only
- **Scraper Sources**: 5 configured (2 working, 3 need URL updates)
- **Location**: Global support (no hardcoded regions)

## Event Scraper

The event scraper runs as a Supabase Edge Function (`supabase/functions/scrape-events/`) with the following features:

- 🤖 **AI-powered extraction**: Uses OpenAI to parse HTML and extract event data
- 🗺️ **Geocoding**: Converts venue addresses to coordinates via Nominatim API
- 📋 **Strategy-driven**: Configurable sources with discovery patterns
- 🔄 **URL normalization**: Deduplication and tracking parameter removal
- 💾 **Caching**: Geocode results cached in `geocode_cache` table
- 🌐 **Dutch CMS support**: Handles Ontdek, Beleef, Visit, and Uit platforms

### Configuration

1. **Add secrets** in Supabase Edge Function settings:
   - `OPENAI_API_KEY`: OpenAI API key for event extraction
   - `RENDER_SERVICE_URL` (optional): External renderer for JS-heavy sites

2. **Configure sources** in `scraper_sources` database table or via Supabase dashboard

3. **Deploy function**:
   ```bash
   supabase functions deploy scrape-events
   ```

### Documentation

- [**Runbook**](docs/scraper/RUNBOOK.md): Operational guide for monitoring and troubleshooting
- **Configuration**: See `scraper_sources` table in Supabase for source configuration
- **Schema**: Database tables in `supabase/migrations/`

## Scripts

```bash
npm run dev           # Development server
npm run build         # Production build
npm run build:dev     # Development build
npm run preview       # Preview build
npm run lint          # ESLint
npm run test          # Run tests (Vitest)
npm run storybook     # Start Storybook dev server
npm run build-storybook  # Build Storybook
```

**Note**: Event scraper runs via Supabase Edge Functions (see `supabase/functions/scrape-events/`), not npm scripts.

---

Built with ❤️ using React, TypeScript, and Supabase

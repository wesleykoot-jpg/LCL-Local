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
- src/lib/hooks.ts: Data fetching hooks (useEvents, useProfile, etc.)
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

### Sidecar Event Model
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
│   ├── hooks.ts         # Data fetching hooks
│   ├── haptics.ts       # iOS haptic feedback
│   └── ...
├── pages/               # Route components
└── integrations/        # Supabase client

supabase/
├── functions/
│   └── scrape-events/   # AI event scraper
├── migrations/          # Database migrations
└── config.toml          # Supabase config
```

## Key Services

### Feed Algorithm (`src/lib/feedAlgorithm.ts`)
Multi-factor scoring system:
- **Category Match**: 35% weight - matches user's preferred categories
- **Time Relevance**: 20% weight - prioritizes upcoming events
- **Social Proof**: 15% weight - attendee count and velocity
- **Compatibility**: 10% weight - profile match percentage
- **Distance**: 20% weight - proximity to user location

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
| [FEED_ALGORITHM.md](./FEED_ALGORITHM.md) | Feed ranking algorithm details |
| [BACKEND_SETUP.md](./BACKEND_SETUP.md) | Database configuration |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | iOS App Store deployment |

## Current Status

- **Events**: ~94 in database (mostly scraped from Dutch sources)
- **Users**: Internal team only
- **Scraper Sources**: 5 configured (2 working, 3 need URL updates)
- **Location**: Global support (no hardcoded regions)

## Defensive Scheduled Scraper

A robust, polite web scraper that runs daily to fetch events from configured sources with comprehensive error handling and monitoring.

### Features

- 🛡️ **Defensive crawling**: Respects robots.txt, rate limits, and exponential backoff
- 📊 **Full observability**: Logs every fetch attempt to Supabase for debugging
- 🔔 **Smart alerts**: Slack notifications with intelligent error analysis and suppression
- 🔄 **Conditional GETs**: Uses ETag/If-Modified-Since to minimize bandwidth
- ⏱️ **Rate limiting**: Per-domain concurrency and request throttling with Bottleneck
- 🧪 **Dry-run mode**: Test without writing data or sending alerts

### Quick Start

1. **Add GitHub Secrets**:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Supabase service role key
   - `SLACK_WEBHOOK_URL`: Slack incoming webhook for alerts
   - `SCRAPER_USER_AGENT` (optional): Custom user agent string

2. **Configure sources** in `src/config/sources.json`:
   ```json
   [
     {
       "source_id": "example.site",
       "url": "https://example.com/events",
       "domain": "example.com",
       "rate_limit": {
         "requests_per_minute": 12,
         "concurrency": 1
       }
     }
   ]
   ```

3. **Apply migration**:
   ```bash
   # In Supabase dashboard or using Supabase CLI
   supabase migration up
   ```

4. **Test locally**:
   ```bash
   # Dry run (no writes, no alerts)
   npm run scrape:dry-run
   
   # Real run (writes to Supabase)
   npm run scrape:run
   ```

5. **GitHub Actions**: Runs daily at 03:00 UTC automatically via `.github/workflows/scrape.yml`

### Documentation

- [**Runbook**](docs/runbook.md): Operational guide for monitoring and troubleshooting
- **Configuration**: See `src/config/defaults.ts` for tunable parameters
- **Schema**: Database tables in `supabase/migrations/20260113000000_scraper_defensive_schema.sql`

### Behavioral Rules

- ✅ Honors robots.txt `User-agent` and `Crawl-delay` directives
- ✅ Uses conditional GETs with ETag/Last-Modified caching
- ✅ Exponential backoff with full jitter on transient errors (429, 5xx, timeouts)
- ✅ Respects `Retry-After` headers
- ✅ Alerts only after threshold (default: 3 consecutive failures)
- ✅ Suppresses duplicate alerts (default: 30-minute window)
- ✅ Persists all attempts to `scrape_events` for replay and debugging

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview build
npm run lint     # ESLint
npm run test     # Run tests

# Scraper commands
npm run scrape:dry-run  # Test scraper without writes/alerts
npm run scrape:run      # Run scraper (writes to Supabase)
```

---

Built with ❤️ using React, TypeScript, and Supabase

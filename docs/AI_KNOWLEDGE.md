# LCL Project Knowledge Base

This document serves as a comprehensive reference for the LCL (Local Social
Events) project, synthesizing architecture, integrations, and core technical
patterns. It is designed to serve as "memory" for AI assistants working on the
project.

## 🏗️ Core Architecture: Fork Event Model

LCL utilizes a unique hierarchical event model to bridge official listings with
community interactions.

- **Anchors**: Official or scraped events (e.g., festivals, cinema screenings,
  sports matches). These serve as the parent context.
- **Forks**: User-generated meetups attached to an **Anchor** (e.g., "Drinks
  before the movie").
- **Signals**: Standalone user events with no parent anchor (e.g., "Casual park
  hangout").

### Data Flow

1. **Waterfall Intelligence Pipeline (SG)**: `sg_sources` → `sg_pipeline_queue` (stage-based) → `events` via `sg-orchestrator` + workers (`sg-scout`, `sg-strategist`, `sg-curator`, `sg-vectorizer`).
2. **Discovery Pipeline**: `useEvents()` → `feedAlgorithm.ts` → `Ranked Feed`.

---

## 🛠️ Technical Stack

| Layer          | Technology            | Key Responsibility                                      |
| :------------- | :-------------------- | :------------------------------------------------------ |
| **Frontend**   | React 18, Vite        | UI Rendering & state management.                        |
| **Backend**    | Supabase (PostgreSQL) | Database, Auth, Storage, Edge Functions.                |
| **Geospatial** | PostGIS               | `geography(POINT, 4326)` for global coordinate support. |
| **AI**         | OpenAI (GPT-4o/mini)  | Structured event extraction from raw HTML.              |
| **Mobile**     | Capacitor             | iOS native features (Haptics, Gestures).                |
| **State**      | TanStack Query        | Server state synchronization & caching.                 |

---

## 📊 Database & Geospatial

LCL is **location-agnostic**, meaning it works globally without hardcoded
cities.

- **PostGIS Implementation**: Coordinates are stored as `longitude, latitude`
  using `POINT(4326)`.
- **Geocode Cache**: Nominatim API results are cached in `geocode_cache` to
  minimize external hits.
- **RLS (Row-Level Security)**: strictly enforced on all tables (`profiles`,
  `events`, `event_attendees`).

---

## 🧠 Feed Algorithm (`src/lib/feedAlgorithm.ts`)

Events are ranked using a multi-factor scoring system:

| Factor       | Weight | Logic                                               |
| :----------- | :----- | :-------------------------------------------------- |
| **Category** | 35%    | Matches user preferences.                           |
| **Time**     | 20%    | Prioritizes upcoming events with exponential decay. |
| **Distance** | 20%    | Proximity to user's current location.               |
| **Social**   | 15%    | Logarithmic scaling based on attendee count.        |
| **Match**    | 10%    | Pre-computed compatibility score.                   |

### Boosts & Diversity

- **Urgency Boost**: 1.0x - 1.2x boost for events in the 6h - 72h window.
- **Trending Boost**: 1.0x - 1.2x boost for events with >10 attendees.
- **Diversity Enforcement**: Prevents more than 2 consecutive events of the same
  category in the feed.

---

## 🧭 Discovery Rails (`src/features/events/discovery/`)

Strategy-based Discovery system transforming event lists into narrative-driven experiences using 5 psychological pillars:

| Rail | Priority | Pillar | Animation | Weighting Focus |
|------|----------|--------|-----------|-----------------|
| **For You** | 1 | The Ego | Glow | Category (40%) |
| **Rituals** | 2 | The Habit | Rhythm | Consistency (30%) |
| **This Weekend** | 3 | The Reward | Sparkle | Time (35%) |
| **Location** | 4 | The Grounding | Pulse | Distance (40%) |
| **Pulse** | 5 | The Collective | Wave | Social (35%) |

### Key Components

- **RailProviderRegistry**: Each rail is a standalone strategy with own filtering logic, metadata, and priority
- **TitleFormatter**: Dynamic contextual headers (e.g., "Zwolle's Saturday Night", "Your Tuesday Rituals")
- **Ritual Detection Engine**: Detects recurring events via:
  - Keyword matching (`weekly`, `monthly`, `meetup`, `borrel`, etc.)
  - Pattern analysis (same venue + title + day of week)
  - Streak tracking for user participation

### Contextual Weights

Each rail type has its own weight configuration for the ranking algorithm, allowing the "Rituals" rail to prioritize consistency while "Location" prioritizes proximity.

---

## 🤖 Scraper Pipeline (`supabase/functions/scrape-events/`)

The scraper uses a **Strategy Pattern** to handle various CMS platforms (Ontdek,
Beleef, Visit, Uit).

### Strategy Locations

- **Production**: `supabase/functions/scrape-events/strategies/` (Real logic).
- **Test**: `strategies/` (Local validation).

### Pipeline Flow

1. **Probe**: Checks source URLs/anchors for new content.
2. **Extract**: Uses OpenAI to turn HTML into JSON.
3. **Validate/Geocode**: Normalizes URLs and fetches coordinates.
4. **Insert**: Deduplicates and saves to `events`.

---

## 💻 AI Workflow & Automation (`.agent/rules/workflow.md`)

The project follows a strict AI-assisted workflow:

- **Branching**: MANDATORY `feature/<description>` branches. Direct commits to
  `main` are PROHIBITED.
- **Commits**: Must follow **Conventional Commits** (e.g., `feat:`, `fix:`,
  `chore:`).
- **PR Automation**:
  1. Generate "Metric-Driven Summary".
  2. Identify risks/testing owners.
  3. Use `gh pr create` for pull requests.

---

## 🛠️ Development Tools

### Direct SQL Integration

- **SQL Tools**: The project supports direct SQL execution via VS Code
  extensions (e.g., `Supabase.session.sql`).
- **Direct DB Scripts**: `check_db_direct.cjs` enables direct PostgreSQL
  connections using `postgres` package for quick verification without the
  Supabase client overhead.
- **Migrations**: Managed via `supabase/migrations` and deployed automatically
  on merge to main (`.github/workflows/deploy-migrations.yml`).

### Scraper Daemon

- **Daemon**: Runs as a background process (`scripts/scraper-daemon.ts`).
- **CI/CD**: Scheduled via GitHub Actions
  (`.github/workflows/scraper-daemon.yml`) to run every 5 minutes.

---

## 📱 iOS Optimization

- **Native Haptics**: Managed via `src/lib/haptics.ts` using Capacitor `Impact`
  and `Notification` types.
- **Gestures**: Framer Motion for desktop-level smoothness on mobile.
- **Safe Areas**: Tailwind utilities for iOS notch and home indicator handling:
  - `pt-safe`: Top padding for notch
  - `pb-safe`: Bottom padding for home indicator
  - `top-safe`: Positioned safe from top
  - Applied to headers, drawers, toasts, modals

---

## 🔐 Authentication

- **Email/Password**: Standard Supabase Auth flow
- **Google OAuth**: Enabled with validated redirect handling
  - Prefers `VITE_SITE_URL` environment variable
  - Falls back to `window.location.origin`
  - Both `LoginView.tsx` and `SignUpView.tsx` have Google buttons
  - Profile auto-created for new OAuth users
- **Setup Guide**: See `docs/GOOGLE_OAUTH_SETUP.md`

---

## 🔑 Key Code Patterns

- **Hooks**: `useEvents`, `useProfile`, `useJoinEvent`, `useDiscoveryRails` encapsulate all TanStack
  Query logic.
- **Services**: `eventService.ts` handles all Supabase RPC and table mutations.
- **Rail Strategies**: `RailProviderRegistry` with `ForYou`, `Rituals`, `ThisWeekend`, `Location`, `Pulse` providers.
- **RLS Policies**: Users can only edit `profiles` where `user_id = auth.uid()`.

## 🏗️ Supabase Integration Infrastructure

The project uses a resilient infrastructure for Supabase interactions:

### Resiliency Patterns
- **Error Handling**: Use `handleSupabaseError` and `getUserFriendlyErrorMessage` from `@/lib/errorHandler`.
- **Timeouts**: Use `queryWithTimeout` from `@/lib/queryTimeout` (Standard: 10s, Complex/RPC: 15s).
- **Retries**: Use `retrySupabaseQuery` or `retryWithBackoff` for transient network/5xx failures.
- **Monitoring**: Use `monitorQuery` from `@/lib/queryMonitor` to track slow queries (>1s).

### Database Interaction Rules
- **Atomic Operations**: Always use RPC for "Check-then-Act" patterns (e.g., Joining events, Claiming rows) to prevent race conditions.
- **Security Declarations**: Database functions must explicitly declare `SECURITY DEFINER` (for RLS bypass) or `SECURITY INVOKER` (default).
- **Connection Pooling**: Node.js scripts must use `scripts/lib/db.cjs` for efficient PostgreSQL access.
- **Environment Variables**: Never hardcode Supabase credentials; use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## 🚀 Development & Ops

- **Build**: `npm run build`
- **Testing**: Vitest for utility testing; manual dry-runs for scraper via
  `scripts/run-scraper-dryrun.sh`.
- **Runbook**: See `docs/scraper/RUNBOOK.md` for troubleshooting HTTP 429/5xx
  and robots.txt issues.

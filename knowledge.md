# LCL Project Knowledge Base & Rules

> **Agent Memory**: This document contains the core architectural, workflow, and
> technical rules for the LCL project. Updated Jan 2026.

## 🏗️ Core Architecture: Fork Event Model

LCL utilizes a unique hierarchical event model to bridge official listings with
community interactions.

- **Anchors**: Official or scraped events (e.g., festivals, cinema screenings,
  sports matches). These serve as the parent context.
- **Forks**: User-generated meetups attached to an **Anchor** (e.g., "Drinks
  before the movie").
- **Signals**: Standalone user events with no parent anchor (e.g., "Casual park
  hangout").

---

## 🛠️ Technical Stack

| Layer          | Technology            | Key Responsibility                                     |
| :------------- | :-------------------- | :----------------------------------------------------- |
| **Frontend**   | React 18, Vite        | UI Rendering & state management.                       |
| **Backend**    | Supabase (PostgreSQL) | Database, Auth, Storage, Edge Functions.               |
| **Geospatial** | PostGIS               | `geography(POINT, 4326)` with local geocode caching.   |
| **AI**         | OpenAI (GPT-4o/mini)  | Structured event extraction & semantic categorization. |
| **Mobile**     | Capacitor             | iOS native features (Haptics, Gestures).               |
| **State**      | TanStack Query        | Server state synchronization & caching.                |

---

## 🦾 Scraping Intelligence (Phase 3 & 4 Upgrades)

LCL employs a high-fidelity, self-healing scraping engine designed for depth and accuracy.

### 1. Depth & Discovery

- **Pagination**: The ingestor performs "Next Page" crawling (default depth 3) to ensure full coverage of event portals.
- **Iframe Unwrapping**: Logic to detect and extract events from embedded Google Calendars, specialized agenda widgets, and cross-domain iframes.

### 2. Extraction Strategy (The Waterfall)

- **JSON-LD/Microdata**: Primary choice for structured data (LD+JSON, Schema.org).
- **DOM Selectors**: Fallback to high-precision CSS selectors for unstructured HTML.
- **AI Fallback**: GPT-4o-mini used only when structured/DOM methods fail.
- **Strategy Persistence**: The `scraper_sources.preferred_method` stores the winning strategy. Future runs skip the trial-and-error waterfall, optimizing for speed and cost.

### 3. Detail-First Strategy

- Every event proactively fetches its `detail_url` to capture long-form descriptions, high-resolution header images, and specific venue details often missing from listing "cards."
- **HTML Cleaning**: All extracted descriptions are automatically stripped of messy HTML and normalized for a premium UI presentation.

### 4. Semantic Deduplication

- **Logical Merging**: Events are merged across different sources using a **Global Fingerprint** (Title + Date + Venue).
- **Metadata Promotion**: If multiple sources provide the same event, the refinery promotes the "Best Record" (longest description, highest res image).
- **Source Preservation**: All booking/info links are preserved in the `all_source_urls` array.

---

## 📊 Database & Geospatial

LCL is **location-agnostic**, meaning it works globally without hardcoded
cities.

- **PostGIS Implementation**: Coordinates are stored as `longitude, latitude`
  using `POINT(4326)`.
- **Verified Venues**: A local database of verified locations (`verified_venues`) maps messy names (e.g., "Muziekgebouw") to exact coordinates, minimizing Nominatim API hits.
- **Geocode Cache**: Nominatim API results are cached in `geocode_cache` for free, robust geocoding.
- **Enforced Integrity**: A unique constraint on `event_fingerprint` ensures zero duplication in the production feed.

---

## 🧠 Feed Algorithm (`src/lib/feedAlgorithm.ts`)

Events are ranked using a multi-factor scoring system:

| Factor       | Weight | Logic                                               |
| :----------- | :----- | :-------------------------------------------------- |
| **Category** | 35%    | Matches user preferences via semantic mapping.      |
| **Time**     | 20%    | Prioritizes upcoming events with exponential decay. |
| **Distance** | 20%    | Proximity to user's current location.               |
| **Social**   | 15%    | Logarithmic scaling based on attendee count.        |
| **Match**    | 10%    | Pre-computed compatibility score.                   |

---

## 🤖 Scraper Daemon & Pipeline

- **Daemon**: Runs as a background process (`scripts/scraper-daemon.ts`).
- **Ingestion**: `run_v2_worker_local.ts` handles source crawling and raw staging.
- **Refinery**: `run_process_worker_safe.ts` performs enrichment, deduplication, and final insertion into `events`.

---

## 💻 AI Workflow & Automation (`.agent/rules/workflow.md`)

- **Implementation Plans**: Required before any complex file modifications.
- **Task Boundaries**: Mandatory for communicating progress through the task UI.
- **Artifacts**: Used to document plans, walkthroughs, and technical analysis.

---

## 📱 iOS Optimization

- **Native Haptics**: Managed via `src/lib/haptics.ts` using Capacitor.
- **Gestures**: Framer Motion for desktop-level smoothness on mobile.
- **Safe Areas**: Tailwind utilities for iOS notch and home indicator handling.

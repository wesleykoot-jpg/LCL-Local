# LCL Project Knowledge Base & Rules

> **Agent Memory**: This document contains the core architectural, workflow, and
> technical rules for the LCL project. Updated Jan 2026.

## 🏗️ Core Architecture: Fork Event Model

LCL utilizes a unique hierarchical event model to bridge official listings with community interactions.

- **Anchors**: Official or scraped events (e.g., festivals). These are the parents.
- **Forks**: User-generated meetups attached to an **Anchor**.
- **Signals**: Standalone user events with no parent.

---

## 🛠️ Technical Stack

| Layer          | Technology            | Key Responsibility                                     |
| :------------- | :-------------------- | :----------------------------------------------------- |
| **Frontend**   | React 18, Vite        | UI Rendering & state management.                       |
| **Backend**    | Supabase (PostgreSQL) | Database, Auth, Storage, Edge Functions.               |
| **Geospatial** | PostGIS               | `geography(POINT, 4326)` with local geocode caching.   |
| **AI**         | OpenAI (GPT-4o/mini)  | Structured event extraction & semantic categorization. |
| **Mobile**     | Capacitor             | iOS native features (Haptics, Gestures).               |

---

## 🦾 Scraping Intelligence (The Refinery Pipeline)

LCL employs a high-fidelity, self-healing scraping engine.

### 1. Data Flow

1. **Ingestion**: `scraper_sources` → `run_v2_worker_local.ts` → `raw_event_staging`.
2. **Refinery**: `raw_event_staging` → `run_process_worker_safe.ts` → `PostGIS (events)`.

### 2. Strategy Persistence

The `scraper_sources.preferred_method` stores the winning strategy (JSON-LD, Microdata, or DOM). Future runs skip the trial-and-error waterfall, optimizing for speed and cost.

### 3. Detail-First Strategy & Deduplication

- **Proactive Enrichment**: The refinery fetches `detail_url` for every event to capture full descriptions and high-res images.
- **Global Deduplication**: Events are merged across different sources using a **Global Fingerprint** (Title + Date + Venue).
- **Metadata Promotion**: The source with the longest description and best image resolution is promoted as the "Primary" for that event.

---

## 📊 Database & Resiliency

### Primary Connection Method

LCL uses **Direct PostgreSQL Connections** (via PgBouncer/Supabase Pooler) for administrative/bulk tasks.

- **Session Mode (Port 6543)**: For DDL and migrations.
- **Transaction Mode (Port 5432)**: For standard operations.
- **Credentials**: Use `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or DB user/pass from `.env`).

### Resiliency Patterns

- **Error Handling**: Use `handleSupabaseError` from `@/lib/errorHandler`.
- **Timeouts**: `queryWithTimeout` (Standard: 10s, Complex/RPC: 15s).
- **Retries**: Use `retrySupabaseQuery` for transient failures.
- **Verified Venues**: Use the `verified_venues` table to normalize location names and coordinates locally (Free fallback to Nominatim).

---

## 🧠 Feed Algorithm (`src/lib/feedAlgorithm.ts`)

Events are ranked using a multi-factor scoring system:

- **Category (35%)**: Semantic match.
- **Time (20%)**: Exponential decay for upcoming events.
- **Distance (20%)**: Proximity to user.
- **Social (15%)**: Attendee count logarithmic scaling.

---

## 💻 AI Workflow & iOS

- **Workflow**: Always generate an `implementation_plan.md` before coding. Use `task_boundary` for all complex work.
- **iOS**: Framer Motion gestures and Native Haptics via `src/lib/haptics.ts`.
- **Safe Areas**: Tailwind `pb-safe` and `pt-safe` for iOS home indicators.

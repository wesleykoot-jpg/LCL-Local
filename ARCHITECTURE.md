# LCL Architecture Documentation

## System Overview

LCL is a hyper-local social events platform that combines scraped official events with user-generated meetups.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LCL Architecture                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   React UI   │────▶│  TanStack    │────▶│   Supabase   │        │
│  │  (Capacitor) │     │    Query     │     │   Client     │        │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│         │                                         │                 │
│         ▼                                         ▼                 │
│  ┌──────────────┐                         ┌──────────────┐         │
│  │   Contexts   │                         │  PostgreSQL  │         │
│  │ Auth/Location│                         │   + PostGIS  │         │
│  └──────────────┘                         └──────────────┘         │
│                                                   │                 │
│                                                   ▼                 │
│                                           ┌──────────────┐         │
│                                           │Edge Functions│         │
│                                           │  (Scraper)   │         │
│                                           └──────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

## Fork Event Model

The core innovation of LCL is the "fork" event model:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Event Type Hierarchy                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐                                                 │
│  │   ANCHOR   │  Official events (scraped or verified)         │
│  │  (Parent)  │  Examples: Movie screenings, festivals          │
│  └─────┬──────┘                                                 │
│        │                                                        │
│        ├────────────────┐                                       │
│        ▼                ▼                                       │
│  ┌────────────┐   ┌────────────┐                               │
│  │    FORK    │   │    FORK    │  User meetups attached        │
│  │  (Child)   │   │  (Child)   │  to anchors                   │
│  └────────────┘   └────────────┘                               │
│                                                                  │
│  ┌────────────┐                                                 │
│  │   SIGNAL   │  Standalone user events                        │
│  │(Standalone)│  No parent event                               │
│  └────────────┘                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                     Database Schema (PostGIS)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  profiles ─────────────┬────────────────┬───────────────────    │
│  - id (UUID, PK)       │                │                       │
│  - user_id (FK auth)   │                │                       │
│  - full_name           │                │                       │
│  - reliability_score   │                │                       │
│  - location_coordinates│                │                       │
│           │            │                │                       │
│           ▼            ▼                ▼                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │persona_stats│ │persona_badge│ │event_attend.│               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                         │                       │
│                                         ▼                       │
│                                  ┌─────────────┐               │
│                                  │   events    │               │
│                                  │ - location  │◀── PostGIS    │
│                                  │ - category  │    POINT      │
│                                  │ - event_type│               │
│                                  └─────────────┘               │
│                                         ▲                       │
│                                         │                       │
│  ┌─────────────┐                       │                       │
│  │scraper_src  │───────────────────────┘                       │
│  └─────────────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │geocode_cache│                                               │
│  └─────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Event Scraping Pipeline
```
scraper_sources (config)
       │
       ▼
Edge Function: scrape-events
       │
       ├──▶ Fetch HTML from source URL
       │
       ├──▶ OpenAI extracts event data
       │
       ├──▶ Nominatim geocodes venues
       │         │
       │         ▼
       │    geocode_cache (cached)
       │
       └──▶ Insert into events table
```

### 2. Feed Algorithm Pipeline
```
User Request
       │
       ▼
useEvents() hook (src/features/events/hooks/hooks.ts)
       │
       ▼
Supabase query (all events)
       │
       ▼
feedAlgorithm.ts
       │
       ├──▶ Category Match Score (35%)
       ├──▶ Time Relevance Score (20%)
       ├──▶ Social Proof Score (15%)
       ├──▶ Compatibility Score (10%)
       └──▶ Distance Score (20%)
              │
              ▼
       Urgency Boost (1.0-1.2x)
       Trending Boost (1.0-1.2x)
              │
              ▼
       Diversity Enforcement
              │
              ▼
       Sorted Event Feed
```

### 3. User Authentication Flow
```
User Login/Signup
       │
       ├──▶ Email/Password ──▶ Supabase Auth
       │
       └──▶ Google OAuth ──▶ Google Consent ──▶ Supabase Callback
               │
               ▼
       AuthContext.tsx
               │
               ├──▶ Create/fetch profile
               │
               └──▶ Store session
                      │
                      ▼
               Protected Routes
```

### 4. Discovery Rails Pipeline
```
All Events
       │
       ▼
RailProviderRegistry.generateRails()
       │
       ├──▶ ForYouProvider (priority 1)
       │         └── Category matching, match_percentage sort
       │
       ├──▶ RitualsProvider (priority 2)
       │         └── Keyword + pattern-based ritual detection
       │
       ├──▶ ThisWeekendProvider (priority 3)
       │         └── Temporal filtering (Sat-Sun)
       │
       ├──▶ LocationProvider (priority 4)
       │         └── Distance-based filtering (half radius)
       │
       └──▶ PulseProvider (priority 5)
                 └── Social proof (10+ attendees)
               │
               ▼
       TitleFormatter (contextual headers)
               │
               ▼
       RailResult[] (metadata + events + animations)
```

## Component Hierarchy

```
App.tsx
├── AuthProvider
│   └── LocationProvider
│       └── QueryClientProvider
│           └── Router
│               ├── /discovery ───▶ Discovery.tsx
│               │                    ├── useDiscoveryRails()
│               │                    └── DynamicRailRenderer.tsx
│               │                        ├── RailAnimation.tsx
│               │                        └── RitualCard.tsx
│               │
│               ├── /feed ─────────▶ Feed.tsx
│               │                     └── EventFeed.tsx
│               │                         ├── TimeFilterPills.tsx
│               │                         └── EventStackCard.tsx
│               │
│               ├── /my-events ────▶ MyEvents.tsx
│               │                     └── EventTimeline.tsx
│               │
│               ├── /profile ──────▶ Profile.tsx
│               │                     └── ProfileView.tsx
│               │
│               └── /login ────────▶ Login.tsx
│                                     ├── LoginView.tsx (Google OAuth)
│                                     └── SignUpView.tsx
```

## Edge Functions

### scrape-events
- **Trigger**: Manual or scheduled
- **Purpose**: Scrape events from configured sources
- **Dependencies**: OpenAI API, Nominatim API
- **Secrets**: `OPENAI_API_KEY`

### google-calendar-auth
- **Purpose**: Handle Google Calendar OAuth
- **Status**: Configured but optional

## Key Design Decisions

### 1. PostGIS for Geospatial
- Events stored as `geography(POINT, 4326)` for accurate distance calculations
- Supports global coordinates (longitude, latitude)
- Enables proximity-based queries

### 2. Location-Agnostic Design
- No hardcoded regions or cities
- Scraper sources configurable per deployment
- Feed algorithm works with any coordinates

### 3. Row-Level Security (RLS)
- All tables have RLS enabled
- Profiles: Users can only modify their own
- Events: Anyone can view, only creators can modify
- Attendees: Users can only manage their own attendance

### 4. Optimistic UI
- Event joining uses optimistic updates
- Immediate haptic feedback on iOS
- Background sync with error rollback

### 5. Discovery Rails Strategy Pattern
- Each rail is a standalone strategy (RailProvider interface)
- Extensible via RailProviderRegistry
- Contextual weights allow different ranking per rail
- Dynamic titles via TitleFormatter utility

## Performance Considerations

### Bundle Optimization
- Code split by route with lazy loading
- 8 vendor chunks (react, supabase, icons, animation, query, ui, map, form)
- Tree shaking enabled
- Main bundle: ~757 kB (gzip: ~212 kB)

### Database Queries
- PostGIS indexes on location columns
- Attendee count via subquery
- Limited attendee fetch (first 5) for feed

### Mobile Optimization
- Native haptics via Capacitor
- Safe area handling for iOS (pt-safe, pb-safe utilities)
- Touch gesture support

## Security Model

### Authentication
- Supabase Auth with email/password and Google OAuth
- Session-based with refresh tokens
- Protected routes via AuthContext
- OAuth redirect validation (prefers VITE_SITE_URL over window.location.origin)

### Authorization
- RLS policies on all tables
- Profile-based ownership checks
- Event creator ownership for mutations

### Data Protection
- No sensitive data in client bundle
- API keys in edge function secrets
- Public anon key for client SDK

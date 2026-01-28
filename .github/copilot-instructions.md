# LCL - AI Development Instructions

## Project Overview

LCL is a React/TypeScript/Supabase social events application for discovering and joining local events globally. It features an AI-powered event scraper and iOS-native optimizations with Capacitor.

### Core Concept: Sidecar Event Model
- **Anchors**: Official/scraped events (cinema screenings, festivals, sports matches, concerts)
- **Forks**: User meetups attached to anchors (pre-movie drinks, post-game hangout)
- **Signals**: Standalone user events (gaming sessions, casual meetups)

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Mobile**: Capacitor (iOS native haptics, gestures, notifications)
- **Backend**: Supabase (PostgreSQL + PostGIS, Auth, Storage, Edge Functions)
- **State Management**: React Context + TanStack Query
- **Testing**: Vitest with @testing-library/react
- **AI**: OpenAI for event extraction from scraped HTML

## Development Workflow

### Commands
```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run test     # Run Vitest tests
npm run preview  # Preview production build

# iOS Build
npm run build
npx cap sync ios
npx cap open ios
```

### Waterfall Intelligence (SG pipeline)
Use the `sg-orchestrator` edge function to coordinate pipeline runs and stage-specific workers.

### Environment Setup
- Copy `.env.example` to `.env` and add Supabase credentials
- Requires Node.js 18+
- Supabase project must have PostGIS enabled

## Code Style and Conventions

### TypeScript
- **Strict mode enabled**: All TypeScript strict checks are on
- **Path aliases**: Use `@/*` for imports from `src/` (e.g., `import { supabase } from '@/integrations/supabase/client'`)
- **Types**: Import database types from `@/integrations/supabase/types`
- **Unused variables**: ESLint rule disabled for `@typescript-eslint/no-unused-vars`

### React Patterns
- **Functional components**: Use functional components with hooks
- **Hooks**: Follow React Hooks rules (enforced by eslint-plugin-react-hooks)
- **Context providers**: See `src/contexts/` for AuthContext, LocationContext, FeedContext
- **Data fetching**: Use TanStack Query hooks from `src/lib/hooks.ts` (useEvents, useProfile, etc.)

### File Organization
```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui components (badge, tabs, dialog, etc.)
│   ├── EventFeed.tsx    # Main feed component
│   └── EventStackCard.tsx
├── contexts/            # React Context providers
│   ├── AuthContext.tsx  # Authentication state
│   └── LocationContext.tsx
├── lib/                 # Core utilities and services
│   ├── feedAlgorithm.ts # Smart ranking algorithm
│   ├── eventService.ts  # Event CRUD operations
│   ├── hooks.ts         # Data fetching hooks
│   ├── haptics.ts       # iOS haptic feedback
│   └── __tests__/       # Unit tests (Vitest)
├── pages/               # Route components
└── integrations/        # Supabase client and types
```

### Naming Conventions
- **Components**: PascalCase (e.g., `EventStackCard.tsx`)
- **Utilities**: camelCase (e.g., `feedAlgorithm.ts`)
- **Hooks**: Start with `use` (e.g., `useEvents`, `useProfile`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Event handlers**: Prefix with `handle` (e.g., `handleJoinEvent`)

### Comments
- **JSDoc**: Use JSDoc comments for exported functions and complex utilities
- **Inline comments**: Minimal; code should be self-explanatory
- **Module headers**: Add module-level JSDoc explaining purpose and key concepts (see `feedAlgorithm.ts` for example)

## Database Schema and Patterns

### Core Tables
- `profiles`: User data with `reliability_score`, `verified_resident`, `current_persona`, `location_coordinates`
- `events`: Events with PostGIS `location` column, `category`, `event_type` (anchor/fork/signal)
- `event_attendees`: Join table with `status` (going/interested/waitlist)
- `persona_stats`: Gamification data (`rallies_hosted`, `newcomers_welcomed`, `host_rating`)
- `persona_badges`: Achievement badges per persona type
- `sg_sources`: Waterfall Intelligence source registry
- `sg_pipeline_queue`: Stage-based Waterfall Intelligence queue
- `sg_geocode_cache`: Geocode cache for SG pipeline

### Important Database Patterns

#### PostGIS Coordinates
- **CRITICAL**: `events.location` is PostGIS `geography(POINT, 4326)` - **longitude comes first!**
- Format: `POINT(lng lat)` or `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`
- Query example: `ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)`

#### Row-Level Security (RLS)
- All tables have RLS enabled
- Test policies thoroughly when modifying database access
- Use service role key for admin operations (scraper, migrations)

#### Profile Linking
- `profiles.id` (UUID) is the primary key
- `profiles.user_id` links to `auth.users` via foreign key
- Always use `profiles.id` for relationships, not `user_id`

### Event Categories
Valid categories: `cinema`, `crafts`, `sports`, `gaming`, `market`, `food`, `music`, `wellness`, `family`, `outdoor`

### Event Types
- `anchor`: Official/scraped events
- `fork`: User meetups attached to anchors (requires `parent_event_id`)
- `signal`: Standalone user events

## Key Architectural Patterns

### Feed Algorithm (`src/lib/feedAlgorithm.ts`)
Multi-factor scoring system with weights:
- **Category Match**: 35% - matches user's preferred categories
- **Time Relevance**: 20% - prioritizes upcoming events with exponential decay
- **Social Proof**: 15% - attendee count with logarithmic scaling
- **Compatibility Match**: 10% - pre-computed match_percentage from database
- **Distance**: 20% - proximity to user location

The algorithm ensures feed diversity by preventing consecutive cards from the same category and boosting underrepresented categories.

### Event Service (`src/lib/eventService.ts`)
Handles all event CRUD operations:
- `joinEvent()`: Adds user to event with automatic waitlist handling when capacity is reached
- `createEvent()`: Creates new events with proper validation
- Always use TypeScript interfaces: `JoinEventParams`, `CreateEventParams`

### Haptics (`src/lib/haptics.ts`)
Native iOS feedback via Capacitor:
- `triggerImpact('light' | 'medium' | 'heavy')`: Physical feedback
- `triggerNotification('success' | 'warning' | 'error')`: Status feedback
- `triggerSelection()`: Selection change feedback
- Always wrap in try-catch; gracefully degrades on non-iOS platforms

### Waterfall Intelligence Pipeline (SG)
Located in `supabase/functions/sg-*`:
- `sg-orchestrator`: Coordinates the pipeline and stage workers
- `sg-scout`: Discovers sources and queues URLs
- `sg-strategist`: Determines fetch strategies
- `sg-curator`: Fetches, extracts Social Five, enriches, deduplicates
- `sg-vectorizer`: Embeddings + persist to `events`

Observability tables: `sg_pipeline_metrics`, `sg_failure_log`, `sg_ai_repair_log`.

## Testing Patterns

### Unit Tests (Vitest)
- Test files: `*.test.ts` or `*.test.tsx` in `__tests__/` directories
- Use `describe` and `it` blocks from Vitest
- Import from `vitest`: `import { describe, expect, it } from 'vitest';`
- Example structure:
```typescript
describe('feature name', () => {
  it('should behave correctly', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Testing Utilities
- Use `@testing-library/react` for component tests
- Use `@testing-library/jest-dom` for DOM matchers
- Mock Supabase client when needed
- Test files located in `src/lib/__tests__/` and `src/components/__tests__/`

### Running Tests
```bash
npm run test        # Run all tests
npm run test:watch  # Watch mode (if available)
```

## Common Tasks

### Adding a New Feature
1. Create types in appropriate service file or `types.ts`
2. Implement service functions in `src/lib/` (e.g., `eventService.ts`)
3. Add React hooks in `src/lib/hooks.ts` if data fetching is needed
4. Create UI components in `src/components/`
5. Add tests in `__tests__/` directories
6. Update documentation if significant

### Modifying Database
1. Create migration in `supabase/migrations/`
2. Update RLS policies if needed
3. Test migration locally with Supabase CLI
4. Update TypeScript types (regenerate from Supabase)
5. Update service functions to use new schema

### Adding a New Event Category
1. Add category to valid list in database enum (migration)
2. Update TypeScript types
3. Update `src/lib/categories.ts` if it exists
4. Add category to feed algorithm weights if needed
5. Update UI components that display categories

### iOS Native Features
1. Import from `@capacitor/*` packages
2. Wrap in try-catch for graceful degradation
3. Test on iOS simulator/device
4. Document platform-specific behavior

### Scraper Configuration
1. Add source to `sg_sources` or run `sg-scout` discovery
2. Configure `fetch_strategy` and `extraction_config`
3. Run `sg-orchestrator` (mode `run_all` or stage-specific)
4. Monitor `sg_pipeline_queue` and SG observability tables

## Security Considerations

### Authentication
- Always check `AuthContext` for current user
- Use `supabase.auth.getUser()` for server-side checks
- Don't trust client-side auth state for sensitive operations

### Input Validation
- Validate all user inputs before database operations
- Use Zod schemas for complex validation
- Sanitize HTML if rendering user-generated content

### RLS Policies
- All tables have RLS enabled
- Test policies with different user contexts
- Use service role key only for admin operations (not in client code)

### API Keys
- Never commit API keys to repository
- Use `.env` files (gitignored)
- Reference keys from environment: `import.meta.env.VITE_*` for client-side

### Coordinates Privacy
- User location stored as PostGIS point in `profiles.location_coordinates`
- Consider privacy implications when querying user locations
- Implement location sharing controls

## Performance Optimization

### React Rendering
- Use React.memo for expensive components
- Implement useMemo/useCallback for expensive computations
- Lazy load routes with React.lazy

### Database Queries
- Use indexes on frequently queried columns
- Limit query results with pagination
- Use PostGIS spatial indexes for location queries
- Cache geocoding results in `geocode_cache` table

### Image Optimization
- Use Supabase Storage for event images
- Implement lazy loading for images
- Consider image CDN for production

### Feed Algorithm
- Pre-compute `match_percentage` in database when possible
- Use efficient spatial queries with PostGIS
- Implement virtual scrolling for long feeds (TanStack Virtual)

## Location-Agnostic Design

LCL works globally with any coordinates:
- No hardcoded regions or cities
- Distance calculations use PostGIS geography type (meters)
- Convert meters to km/miles in UI as needed
- Default radius: 25km (configurable per user)

## Documentation

Key documentation files:
- `AI_CONTEXT.md`: Quick AI context summary
- `ARCHITECTURE.md`: System architecture and diagrams
- `FEED_ALGORITHM.md`: Feed ranking algorithm details
- `BACKEND_SETUP.md`: Database configuration
- `DEPLOYMENT_GUIDE.md`: iOS App Store deployment
- `docs/runbook.md`: Scraper operational guide

## Current Status

- **Events**: ~94 in database (mostly scraped from Dutch sources)
- **Users**: Internal team only (not public-facing)
- **Scraper Sources**: 5 configured sources
- **Deployment**: iOS-optimized, global location support

## AI Assistant Guidelines

When working on this codebase:

1. **Always read existing documentation first**: Check AI_CONTEXT.md and relevant docs before making changes
2. **Follow existing patterns**: Match the style and structure of existing code
3. **Test your changes**: Run linter and tests before committing
4. **Minimal changes**: Make the smallest possible change to achieve the goal
5. **PostGIS awareness**: Remember longitude comes first in POINT(lng, lat)
6. **Type safety**: Use TypeScript types from `@/integrations/supabase/types`
7. **iOS compatibility**: Consider mobile/iOS behavior for UI changes
8. **Security**: Always consider RLS policies and input validation
9. **Documentation**: Update docs if making significant architectural changes
10. **Ask for clarification**: If requirements are unclear, ask before implementing

## Common Pitfalls to Avoid

- ❌ Don't swap latitude/longitude in PostGIS queries (it's lng first!)
- ❌ Don't bypass RLS policies by using service role key in client code
- ❌ Don't forget to handle waitlist logic when joining events with capacity limits
- ❌ Don't hard-code location coordinates or assume a specific region
- ❌ Don't ignore iOS-specific features (haptics, gestures) in mobile UI
- ❌ Don't modify existing tests without understanding their purpose
- ❌ Don't commit `.env` files or API keys
- ❌ Don't skip TypeScript type checking
- ❌ Don't break existing RLS policies when modifying database schema
- ❌ Don't ignore the feed algorithm weights when modifying ranking logic

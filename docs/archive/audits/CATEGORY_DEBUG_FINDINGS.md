# Category Scraper Debug - Findings and Root Cause

## Problem Statement
The scraper is not fetching events for new categories like "gaming", "music", "workshops", "outdoors", "social", "entertainment", "foodie", and "community".

## Root Cause Analysis

### The Issue
Events ARE being scraped, but they are being **mis-categorized** due to a mismatch between:
1. The scraper's category mapping logic
2. The database schema constraints  
3. The UI's category system

### Three Systems, Three Different Category Lists

#### 1. **Scraper's Internal Categories** (`mapToInternalCategory` in `scrape-events/index.ts`)
Maps to only **5 legacy categories**:
- `'nightlife'` - concerts, clubs, DJs, music, parties
- `'food'` - food, dinner, restaurants, wine, beer, markets
- `'culture'` - museums, exhibitions, theater, art, film (catch-all)
- `'active'` - sports, running, walking, cycling, yoga, fitness
- `'family'` - kids, family, children, parents, play, zoo

**Fallback**: Unmapped events default to `'culture'`

#### 2. **Database Constraint** (migration `20260113173323`)
Allows **10 categories**:
```sql
['nightlife', 'food', 'culture', 'active', 'family', 
 'cinema', 'crafts', 'sports', 'gaming', 'market']
```

#### 3. **Modern UI Categories** (`src/lib/categories.ts` & `_shared/categoryMapping.ts`)
Defines **10 modern categories**:
- `'active'` - Sports & Active
- `'gaming'` - Gaming
- `'entertainment'` - Entertainment  
- `'social'` - Social
- `'family'` - Family
- `'outdoors'` - Outdoors
- `'music'` - Music
- `'workshops'` - Workshops
- `'foodie'` - Food & Drink
- `'community'` - Community

### The Problem

1. **Scraper doesn't use modern categories**: 
   - The scraper calls `mapToInternalCategory()` which only knows about 5 legacy categories
   - It never calls `classifyTextToCategory()` from `categoryMapping.ts` which has the modern 10-category system

2. **Events get mis-categorized**:
   - Gaming events → forced to `'culture'` (the catch-all)
   - Music/concert events → mapped to `'nightlife'` (wrong - should be `'music'`)
   - Workshop events → forced to `'culture'` (no mapping exists)
   - Social/networking events → forced to `'culture'` (no `'social'` in legacy)
   - Outdoor events → forced to `'culture'` (no `'outdoors'` in legacy)
   - Food events → mapped to `'food'` (should be `'foodie'`)

3. **Database allows some but not all**:
   - DB allows `'gaming'` but scraper maps it to `'culture'`
   - DB doesn't allow `'social'`, `'music'`, `'workshops'`, `'outdoors'`, `'foodie'`, `'community'` or `'entertainment'`

## Examples of Mis-Categorization

| Event Type | Keywords | Current Mapping | Should Be |
|------------|----------|-----------------|-----------|
| Gaming tournament | "esports", "gaming", "lan party" | `'culture'` | `'gaming'` |
| Live concert | "concert", "band", "live music" | `'nightlife'` | `'music'` |
| Cooking workshop | "workshop", "cooking class" | `'culture'` | `'workshops'` |
| Hiking excursion | "nature", "hiking", "outdoor" | `'culture'` | `'outdoors'` |
| Networking event | "networking", "borrel", "meetup" | `'culture'` | `'social'` |
| Food festival | "food festival", "tasting" | `'food'` | `'foodie'` |
| Community meeting | "buurt", "vergadering", "community" | `'culture'` | `'community'` |

## Code Locations

### Scraper Functions Using Legacy Mapping
1. `supabase/functions/scrape-events/index.ts:195-238` - `mapToInternalCategory()`
2. `supabase/functions/run-scraper/index.ts:107-128` - `mapToInternalCategory()`  
3. `supabase/functions/scrape-worker/index.ts` - `mapToInternalCategory()`

All three scrapers use the same legacy 5-category mapping.

### Modern Category System (Not Used by Scraper)
1. `supabase/functions/_shared/categoryMapping.ts:164-201` - `classifyTextToCategory()`
   - Has all 10 modern categories
   - Includes Dutch keyword logic (Hybrid Life)
   - Includes ALL category definitions

2. `src/lib/categories.ts:11-92` - UI category configs
   - Has all 10 modern categories with colors and labels

### Database Schema
1. `supabase/migrations/20260113173323_52105bd8-b9fe-4ea1-a1f1-965ca0ecfb56.sql` - Category constraint
   - Allows 10 categories but not the right 10

## Why This Happened

Looking at the code and migration history:

1. **Original system** (Jan 9): Database had 5 original categories: `'cinema'`, `'crafts'`, `'sports'`, `'gaming'`, `'market'`

2. **Scraper added** (Jan 12-13): Scraper introduced with 5 different "internal" categories: `'nightlife'`, `'food'`, `'culture'`, `'active'`, `'family'`

3. **Migration** (Jan 13): Updated constraint to allow BOTH sets (10 total categories)

4. **Modern UI system added** (Jan 14): New 10-category system introduced in `categoryMapping.ts` for source-discovery

5. **Disconnect**: The scraper was never updated to use the modern category system

## The Fix Options

### Option 1: Update Scraper to Use Modern Categories (Recommended)
**Pros:**
- Aligns all systems to one source of truth
- Enables proper categorization of all event types
- Future-proof

**Changes needed:**
1. Update scraper to call `classifyTextToCategory()` instead of `mapToInternalCategory()`
2. Update database constraint to allow modern categories:
   ```sql
   CHECK (category = ANY (ARRAY[
     'active', 'gaming', 'entertainment', 'social', 'family',
     'outdoors', 'music', 'workshops', 'foodie', 'community'
   ]))
   ```
3. Update existing events with legacy categories (migration/data fix)

### Option 2: Keep Legacy, Map in UI
**Pros:**
- No database migration needed
- Less risky

**Cons:**
- Doesn't solve the core problem - events still mis-categorized
- Gaming, music, workshops still forced into wrong categories
- Technical debt remains

## Recommendation

**Go with Option 1** - Update the scraper to use the modern category system. This is the only way to properly categorize events in the new categories like gaming, music, workshops, etc.

The source-discovery function already uses the modern system, so this aligns the entire codebase.

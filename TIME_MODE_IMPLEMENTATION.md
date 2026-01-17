# Time Mode & Opening Hours Implementation

## Overview

The LCL app now supports three different time modes for events, allowing the system to properly represent fixed events (concerts, movies), venues with opening hours (restaurants, museums), and always-accessible locations (parks, monuments).

## Time Modes

### 1. Fixed Mode (Default)
**Use Case**: Events with specific start/end times
- Concerts, movies, sports matches
- Workshops, classes
- Scheduled meetups

**Database Fields**:
- `time_mode`: `'fixed'`
- `event_date`: Required (timestamptz)
- `event_time`: Display time string
- `opening_hours`: NULL

**UI Display**: Shows specific date and time
```
📅 Sat 12 Oct • 20:00
```

### 2. Window Mode
**Use Case**: Venues with recurring opening hours
- Restaurants, cafes
- Museums, galleries
- Shops, markets

**Database Fields**:
- `time_mode`: `'window'`
- `event_date`: Optional (can be NULL)
- `opening_hours`: JSONB with schedule
- `event_time`: Fallback display string

**Opening Hours Format**:
```json
{
  "monday": ["09:00-17:00"],
  "tuesday": ["09:00-17:00"],
  "friday": ["09:00-12:00", "13:00-22:00"]
}
```

**UI Display**: Shows open/closed status
```
🟢 Open Now • Closes 22:00
🔴 Closed • Opens Tue 09:00
```

### 3. Anytime Mode
**Use Case**: Always accessible locations
- Parks, hiking trails
- Public monuments, street art
- Open plazas, viewpoints

**Database Fields**:
- `time_mode`: `'anytime'`
- `event_date`: Optional (can be NULL)
- `opening_hours`: NULL
- `event_time`: Optional display string

**UI Display**: Shows availability message
```
☀️ Always Open
```

## Database Schema

### Migration
The migration file `20260117010000_add_time_mode_and_opening_hours.sql` includes:

1. **New enum type**: `time_mode` with values: `'fixed'`, `'window'`, `'anytime'`
2. **New column**: `opening_hours` (JSONB) for storing venue schedules
3. **Relaxed constraints**: `event_date` is now nullable
4. **Check constraint**: Fixed events must have `event_date` set
5. **Helper functions**:
   - `is_venue_open_now(opening_hours, check_time)`: Check if venue is currently open
   - `get_next_opening_time(opening_hours, from_time)`: Find next opening time

### Example Queries

Check if a venue is open now:
```sql
SELECT is_venue_open_now(opening_hours, NOW()) as is_open
FROM events
WHERE time_mode = 'window';
```

Get all currently open venues:
```sql
SELECT * FROM events
WHERE time_mode = 'window'
  AND is_venue_open_now(opening_hours, NOW()) = true;
```

## TypeScript Usage

### Using Opening Hours Utilities

```typescript
import { isOpenNow, getClosingTimeToday } from '@/lib/openingHours';

const venueHours = {
  monday: ['09:00-17:00'],
  friday: ['09:00-12:00', '13:00-22:00']
};

// Check if open right now
const isOpen = isOpenNow(venueHours);

// Get closing time for today
const closingTime = getClosingTimeToday(venueHours);
console.log(`Closes at ${closingTime}`); // "Closes at 17:00"
```

### Using SmartTimeLabel Component

```tsx
import { SmartTimeLabel } from '@/components/SmartTimeLabel';

// Fixed event
<SmartTimeLabel
  timeMode="fixed"
  eventDate="2026-01-20T20:00:00Z"
  eventTime="20:00"
/>

// Venue with hours
<SmartTimeLabel
  timeMode="window"
  openingHours={{
    monday: ['09:00-17:00'],
    tuesday: ['09:00-17:00']
  }}
/>

// Anytime location
<SmartTimeLabel timeMode="anytime" />
```

## Scraper Integration

The scraper currently defaults all events to `time_mode: 'fixed'`. Future enhancements will include:

### Planned Enhancements

1. **Venue Detection**: Identify whether a scraped item is an event or venue
   - Check for keywords like "restaurant", "museum", "café"
   - Analyze description and category

2. **Opening Hours Parsing**: Extract opening hours from text
   - Parse formats like "Mon-Fri 9-5", "Daily 10:00-22:00"
   - Use LLM (Gemini/OpenAI) to extract from unstructured text
   - Store in standardized JSONB format

3. **Smart Classification**:
   ```typescript
   if (isVenue(title, description)) {
     time_mode = 'window';
     opening_hours = parseOpeningHours(htmlContent);
   } else if (isAlwaysOpen(category)) {
     time_mode = 'anytime';
   } else {
     time_mode = 'fixed';
   }
   ```

## UI Components

### TimelineEventCard
Automatically displays the appropriate time format based on `time_mode`:
- Fixed: Calendar icon with date/time
- Window: Clock icon with open/closed status
- Anytime: Sun icon with "Always Open" message

### Future: CreateEventModal Updates
When forking a venue or anytime location:
- Show gentle warning if selecting time outside opening hours
- Allow users to override (for private events, rentals)
- Example: "Heads up: This place might be closed at that time."

## Testing

### Unit Tests
Run opening hours tests:
```bash
npm test src/lib/__tests__/openingHours.test.ts
```

Tests cover:
- Open/closed status detection
- Closing time retrieval
- Next opening time calculation
- Split shift handling
- Edge cases (no hours, empty hours)

### Manual Testing

1. **Create a venue event**:
   - Set `time_mode = 'window'`
   - Add opening hours JSON
   - Verify UI shows open/closed status

2. **Create an anytime event**:
   - Set `time_mode = 'anytime'`
   - Verify UI shows "Always Open"

3. **Check existing events**:
   - All existing events default to `time_mode = 'fixed'`
   - Verify they still display correctly

## Migration Notes

### Backwards Compatibility
- All existing events automatically get `time_mode = 'fixed'`
- No data loss or breaking changes
- `event_date` constraint only enforced for fixed events
- Nullable `event_date` allows window/anytime events without specific dates

### Applying the Migration

```bash
# Using Supabase CLI
supabase db push

# Or apply manually in Supabase dashboard
# Copy contents of migration file to SQL editor
```

### Rollback Strategy
If needed, revert by:
1. Setting all events back to `time_mode = 'fixed'`
2. Making `event_date` NOT NULL again
3. Dropping the new columns

## Future Enhancements

### Phase 1 (Completed) ✅
- Database schema with time_mode and opening_hours
- TypeScript types and utilities
- UI components (SmartTimeLabel)
- Basic scraper support

### Phase 2 (Planned)
- Venue detection in scraper
- Opening hours parsing with LLM
- Enhanced UI for forking venues
- Warning toasts for outside-hours bookings

### Phase 3 (Future)
- Real-time opening status updates
- Push notifications when venues open/close
- User preferences for venue types
- Integration with Google Places API for hours

## Examples

### Restaurant (Window Mode)
```json
{
  "title": "Café Central",
  "time_mode": "window",
  "opening_hours": {
    "monday": ["08:00-17:00"],
    "tuesday": ["08:00-17:00"],
    "wednesday": ["08:00-17:00"],
    "thursday": ["08:00-17:00"],
    "friday": ["08:00-17:00", "18:00-23:00"],
    "saturday": ["09:00-23:00"],
    "sunday": ["09:00-16:00"]
  },
  "event_date": null,
  "category": "food"
}
```

### Concert (Fixed Mode)
```json
{
  "title": "Summer Jazz Festival",
  "time_mode": "fixed",
  "event_date": "2026-07-15T20:00:00Z",
  "event_time": "20:00",
  "opening_hours": null,
  "category": "music"
}
```

### Park (Anytime Mode)
```json
{
  "title": "Central Park",
  "time_mode": "anytime",
  "event_date": null,
  "event_time": null,
  "opening_hours": null,
  "category": "outdoor"
}
```

## Related Files

- Migration: `supabase/migrations/20260117010000_add_time_mode_and_opening_hours.sql`
- Types: `src/integrations/supabase/types.ts`
- Utilities: `src/lib/openingHours.ts`
- Component: `src/components/SmartTimeLabel.tsx`
- Tests: `src/lib/__tests__/openingHours.test.ts`
- Scraper: `supabase/functions/scrape-events/index.ts`

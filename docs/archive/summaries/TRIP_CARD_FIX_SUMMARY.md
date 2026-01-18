# Trip-Card Layout Fix - Technical Summary

## Problem Statement
The "Jazz & Wine Tasting" trip-card on the Planning page was rendering with:
- **Duplicated title** - title appeared twice (once above poster, once in body)
- **Skewed poster band** - visual separation between poster and title
- **Non-integrated appearance** - poster and title looked disconnected

## Solution Implemented

### Before
```
┌─────────────────────────┐
│ Small Title             │  ← First title render
├─────────────────────────┤
│                         │
│   Poster Image          │
│   (no overlay)          │
│                         │
├─────────────────────────┤
│ Large Title             │  ← Duplicate title render
│ Venue                   │
│ Attendees | Category    │
└─────────────────────────┘
```

### After
```
┌─────────────────────────┐
│                         │
│   Poster Image          │
│   with gradient         │
│                         │
│   Title (overlay) ◄─────┼─ Single integrated title
├─────────────────────────┤
│ Venue                   │  ← No duplicate title
│ Attendees | Category    │
│ Ticket Number           │
└─────────────────────────┘
```

## Technical Changes

### 1. TimelineEventCard.tsx - Trip-Card Variant

#### Poster Section
```tsx
// NEW: Integrated poster with title overlay
<div className="relative w-full aspect-[2/1] overflow-hidden rounded-t-[28px] bg-gradient-to-br from-primary/10 to-primary/5">
  <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
  {/* Gradient overlay for readability */}
  <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
  {/* Title overlaid on poster */}
  <h4 className="absolute left-4 bottom-4 z-20 text-lg font-bold text-white leading-tight line-clamp-2 pr-4">
    {event.title}
  </h4>
</div>
```

**Key Changes:**
- Added `overflow-hidden` and `rounded-t-[28px]` for proper corner alignment
- Added `loading="lazy"` for performance
- Added gradient overlay for text contrast
- Positioned title absolutely at bottom-left with z-index 20
- Fallback gradient when no image available

#### Body Section
```tsx
// NEW: Adjusted padding and removed duplicate title
<div className="p-4 pt-0">
  {/* No title here - it's in the overlay */}
  {event.venue_name && <VenueRow />}
  <AttendeeAndCategoryRow />
  {event.ticket_number && <TicketNumber />}
</div>
```

**Key Changes:**
- Changed padding from `p-4` to `p-4 pt-0` for seamless transition
- Removed duplicate title element
- Added `mt-3` to venue to compensate for removed title spacing

### 2. ItineraryTimeline.tsx

Added defensive comment:
```tsx
/* TimelineEventCard with trip-card variant handles title internally 
   as an overlay on the poster, so no external title is needed here */
```

### 3. Test Updates

Fixed test expectations:
- Category label: `entertainment` → `Entertainment` (correct capitalization)
- Ticket number: Only visible in trip-card variant
- Added tests for:
  - Poster overlay structure
  - Image attributes (`loading="lazy"`, `object-cover`)
  - Fallback gradient when no image

## CSS Classes Reference

| Class | Purpose |
|-------|---------|
| `aspect-[2/1]` | 2:1 aspect ratio for cinematic poster |
| `overflow-hidden` | Clip content to container bounds |
| `rounded-t-[28px]` | Match parent card's rounded corners |
| `bg-gradient-to-t from-card/80 via-transparent to-transparent` | Darken bottom for text readability |
| `absolute left-4 bottom-4 z-20` | Position title overlay |
| `p-4 pt-0` | Body padding with no top (seamless with poster) |
| `loading="lazy"` | Defer image loading for performance |

## Verification

### Tests
- ✅ All 16 tests passing
- ✅ New tests for overlay structure
- ✅ Image attribute validation

### Build
- ✅ TypeScript compilation successful
- ✅ No new linting errors
- ✅ Production build successful

### Compatibility
- ✅ Default variant unchanged
- ✅ Minimal variant unchanged
- ✅ Only trip-card variant modified

## Visual Design Benefits

1. **Single Integrated Unit** - Title and poster form one cohesive element
2. **TripAdvisor-Style** - Matches modern travel app design patterns
3. **Better Readability** - Gradient ensures text is always readable
4. **Space Efficient** - Eliminates redundant title, more room for content
5. **Professional Look** - Polished, magazine-style presentation

## Mock Data Location

The "Jazz & Wine Tasting" event is defined in:
- File: `src/features/events/hooks/useUnifiedItinerary.ts`
- Location: Mock item #3
- Properties:
  - `image_url`: Unsplash jazz photo
  - `attendee_count`: 12
  - `ticket_number`: Available in originalData

## Related Files

- Primary implementation: `src/features/events/components/TimelineEventCard.tsx`
- Timeline usage: `src/features/events/components/ItineraryTimeline.tsx`
- Tests: `src/features/events/components/__tests__/TimelineEventCard.test.tsx`
- Mock data: `src/features/events/hooks/useUnifiedItinerary.ts`

## Future Enhancements (Optional)

1. Add hover effect to poster (subtle zoom)
2. Support for multiple images (carousel)
3. Custom gradient colors per category
4. Responsive aspect ratios (3:2 on mobile, 2:1 on desktop)

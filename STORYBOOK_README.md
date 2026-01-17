# EventTimeline Storybook Stories

This document describes the Storybook stories implementation for the EventTimeline v2 iOS/mobile-first vertical timeline UI.

## Overview

This implementation provides comprehensive Storybook stories for the `EventTimeline` and `TimelineEventCard` components, showcasing the mobile-first design with iOS optimization, glassmorphism effects, and accessibility features.

## Installation & Running

### Install Dependencies
```bash
npm install
```

### Start Storybook (Development)
```bash
npm run storybook
```
Opens at http://localhost:6006

### Build Storybook (Production)
```bash
npm run build-storybook
```
Outputs to `storybook-static/`

## Files Created

### Configuration
- `.storybook/main.ts` - Storybook configuration with addons and framework setup
- `.storybook/preview.ts` - Global decorators, parameters, iOS viewports, and accessibility config

### Mock Data
- `src/storybook/mocks/events.ts` - Comprehensive event data fixtures
  - Calendar events (Google Calendar imports)
  - Discovery/native events (with/without images)
  - Mixed event collections
  - Edge cases (long descriptions, missing data)

### Stories
- `src/features/events/components/TimelineEventCard.stories.tsx` - Card-level stories
- `src/features/events/components/EventTimeline.stories.tsx` - Full timeline stories

## Story Coverage

### TimelineEventCard Stories

#### Variants
- **Default** - Full event details with time, location, category
- **Minimal** - Simplified view with category badge in top-right
- **Trip Card** - Visual poster design with 2:1 aspect ratio image

#### Event Types
- **Calendar Event** - Simple, flat styling without images
- **Discovery with Image** - Glassmorphism with media block
- **Discovery without Image** - Glass with gradient fallback

#### States & Features
- Past events (dimmed styling)
- Long content (line-clamp test)
- Join button interactions
- Category variants (gaming, family, outdoors, foodie, workshop)
- Dark mode
- Mobile breakpoints (375px, 430px)
- Accessibility focus states
- Reduced motion

### EventTimeline Stories

#### Timeline Scenarios
- **Mixed Events** - Calendar + Discovery events together
- **Calendar-Only** - All calendar imports
- **Discovery-Only** - All native/scraped events
- **Discovery with Images** - Glass effects showcase
- **Discovery without Images** - Gradient fallbacks
- **Grouped Dates** - Multiple events per day

#### Layout & Interaction
- Single event today
- Multiple events same day
- With past events
- Long content handling
- Empty timeline
- Join buttons interactive

#### Mobile & Accessibility
- Mobile 375px (iPhone 12 mini)
- Mobile 430px (iPhone 14 Pro Max)
- Vertical line alignment check
- Date header glass pill overlay
- Motion & interaction (hover/tap states)
- Reduced motion
- Accessibility focus (keyboard navigation)
- Dark mode
- Contrast over media

## iOS Viewports Configured

The Storybook preview is configured with the following iOS device viewports:

- **iPhone 12 mini** - 375×812px
- **iPhone 12/13** - 390×844px (default)
- **iPhone 14 Pro** - 393×852px
- **iPhone 14 Pro Max** - 430×932px

## Accessibility Features

### Built-in A11y Testing
- Color contrast checks (WCAG AA)
- Focus order and semantics
- Label validation
- Keyboard navigation testing

### Test Coverage
- Focus rings with sufficient contrast
- Aria-labels for screen readers
- Reduced motion support (respects `prefers-reduced-motion`)
- Text contrast over glassmorphism and media

## Design System Integration

### Glassmorphism (io26-glass.css)
Discovery events use the io26-glass design system with:
- Backdrop blur and saturation
- Ambient shadows with category colors
- Specular glints for device tilt
- Luminous glass banners

### Calendar vs Discovery Events

#### Calendar Events
- Simple, flat card styling
- No images (typically)
- Solid background
- Focus on content and time

#### Discovery Events
- Rich glassmorphism effects
- Media blocks with images
- Gradient fallbacks when no image
- Category color ambient shadows

## Mock Data Structure

Mock events in `src/storybook/mocks/events.ts` include:

### Individual Events
- `calendarEvent` - Basic Google Calendar import
- `discoveryEventWithImage` - Native event with image
- `discoveryEventNoImage` - Native event without image
- `eventLongDescription` - Long content test
- `pastEvent` - Past event for dimmed styling
- `gamingEvent`, `familyEvent`, `outdoorEvent`, `foodieEvent`, `workshopEvent` - Category examples

### Collections
- `mixedEvents` - Calendar + Discovery
- `calendarOnlyEvents` - Only calendar imports
- `discoveryOnlyEvents` - Only native events
- `eventsWithImages` - All events with images
- `eventsWithoutImages` - All events without images
- `edgeCaseEvents` - Long titles, max capacity, etc.
- `timelineGroupedEvents` - Events grouped by date for timeline

## Testing Checklist

### Visual Checks
- [ ] All stories render at 375px and 430px breakpoints
- [ ] Vertical line aligned and centered on mobile
- [ ] Time nodes aligned with vertical line
- [ ] Calendar events: correct card and icon design
- [ ] Discovery events: glassmorphism effects visible
- [ ] Date headers: glass pill overlay with continuous line
- [ ] Images load and display correctly

### Interaction Checks
- [ ] Hover/tap scale effects work
- [ ] Join button interactions (if auth context available)
- [ ] Reduced motion respected (no animations when OS setting enabled)

### Accessibility Checks
- [ ] Focus rings visible on all interactive elements
- [ ] Sufficient text contrast (especially over glass/media)
- [ ] Keyboard navigation works (Tab key)
- [ ] Aria-labels present and accurate
- [ ] No a11y violations in Storybook addon panel

### Browser/Device Checks
- [ ] Chrome DevTools mobile preview
- [ ] Safari iOS simulator
- [ ] Actual iOS device (if available)

## Known Limitations

1. **Auth Context** - Join button functionality requires `AuthContext` which is not available in Storybook. Buttons are visible but may not be fully functional.

2. **Framer Motion** - Some motion effects may appear differently in Storybook vs production due to timing/performance differences.

3. **Supabase Integration** - Stories use mock data; real database queries are not tested.

4. **PostGIS Location** - Location data is mocked; actual geospatial queries are not tested.

## Future Enhancements

- Add Chromatic visual regression testing
- Add interaction tests with `@storybook/test`
- Create custom Storybook addon for auth context mocking
- Add more edge case scenarios
- Document specific a11y test results with VoiceOver/NVDA

## References

- **PRD**: Mobile-First Vertical Timeline specification
- **Design System**: io26-glass.css documentation
- **Components**: 
  - `src/features/events/components/EventTimeline.tsx`
  - `src/features/events/components/TimelineEventCard.tsx`

## Maintenance

When updating the EventTimeline or TimelineEventCard components:

1. Update mock data if new fields are added
2. Add new stories for new variants or features
3. Update a11y tests if accessibility features change
4. Re-run visual regression tests (if implemented)
5. Update this README with any new scenarios or limitations

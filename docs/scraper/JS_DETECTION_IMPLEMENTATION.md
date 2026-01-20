# JavaScript Detection & Auto-Rendering Implementation

## Overview

This implementation adds automatic detection of JavaScript frameworks (React, Vue, Angular) and empty-body heuristics to determine if a page requires JavaScript rendering (Puppeteer/Playwright) during the source discovery process.

## Problem Statement

The source discovery system needed heuristics to automatically detect when a scraped page requires JavaScript rendering:

1. **JavaScript Framework Detection**: Check if a page uses React/Vue/Angular
2. **Empty Body Heuristic**: Check if HTML body is mostly empty but contains event keywords
3. **Auto-Configuration**: Automatically set `requires_render: true` and `fetcher_type: 'puppeteer'` based on these heuristics

## Implementation

### 1. Detection Module (`jsDetectionHeuristics.ts`)

Created `/supabase/functions/_shared/jsDetectionHeuristics.ts` with:

#### Core Functions

- **`detectJSFrameworks(html: string)`**: Detects React, Vue, and Angular frameworks
  - React: Looks for `react.production.min.js`, `data-reactroot`, `__INITIAL_STATE__`, etc.
  - Vue: Looks for `vue.js`, `nuxt.js`, `window.__NUXT__`, `v-cloak`, etc.
  - Angular: Looks for `angular.js`, `ng-app`, `ng-controller`, etc.
  - Returns: `{ frameworks: string[], signals: string[] }`

- **`hasEmptyBodyWithEventKeywords(html: string)`**: Checks if body is mostly empty but has event keywords
  - Extracts body content, removes `<script>` and `<style>` tags
  - Considers body "mostly empty" if < 500 characters
  - Checks for event keywords: agenda, evenement, activiteit, programma, kalender, event, concert, etc.
  - Returns: `{ isEmpty: boolean, hasKeywords: boolean, bodyTextLength: number, signals: string[] }`

- **`detectRenderingRequirements(html: string)`**: Main heuristic function
  - Combines framework detection and empty body checks
  - Logic:
    * If page has React/Vue/Angular → requires rendering (confidence: 85%)
    * If body is mostly empty BUT has event keywords → requires rendering (confidence: 75%)
    * If both conditions met → requires rendering (confidence: 95%)
    * Otherwise → static fetching is fine (confidence: 90%)
  - Returns: `JSDetectionResult` with `requiresRender`, `fetcherType`, `confidence`, etc.

- **`needsRendering(html: string)`**: Quick check convenience function
  - Returns boolean indicating if rendering is needed

### 2. Integration with Source Discovery

Updated both `source-discovery/index.ts` and `source-discovery-worker/index.ts`:

#### Changes to `validateSourceWithLLM()`

- Now returns `renderingRequirements: JSDetectionResult` in addition to existing fields
- Calls `detectRenderingRequirements(html)` after fetching the page
- Returns detection results alongside validation results

#### Changes to `DiscoveredSource` Interface

Added fields:
```typescript
interface DiscoveredSource {
  // ... existing fields
  requires_render?: boolean;
  fetcher_type?: 'static' | 'puppeteer' | 'playwright';
  rendering_detection?: JSDetectionResult;
}
```

#### Changes to Source Creation

When creating a discovered source:
```typescript
const source: DiscoveredSource = {
  url: candidate.url,
  name: validation.suggestedName,
  municipality: municipality.name,
  // ... other fields
  requires_render: validation.renderingRequirements.requiresRender,
  fetcher_type: validation.renderingRequirements.fetcherType,
  rendering_detection: validation.renderingRequirements,
};
```

#### Changes to Database Insertion

In `insertDiscoveredSource()`:
```typescript
await supabase.from("scraper_sources").insert({
  // ... existing fields
  requires_render: source.requires_render ?? false,
  fetcher_type: source.fetcher_type ?? 'static',
  // ... other fields
});
```

#### Enhanced Logging

- Dry-run mode now logs: `Rendering: requires_render=true, fetcher_type=puppeteer`
- Logs detected frameworks: `Detected frameworks: react, vue`
- Production logs include fetcher type: `[Worker] Discovered: ... [puppeteer]`

### 3. Tests

Created `tests/jsDetectionHeuristics_deno_test.ts` with comprehensive tests:

- Framework detection tests (React, Vue, Angular)
- Empty body with keywords detection
- Full rendering requirements detection
- Edge cases (no frameworks, static sites with content, etc.)
- Confidence score validation

Run tests with: `deno test tests/jsDetectionHeuristics_deno_test.ts --allow-read`

## Usage

The detection happens automatically during source discovery:

1. When a URL is validated with `validateSourceWithLLM()`, the HTML is analyzed
2. JavaScript frameworks are detected via pattern matching
3. Body emptiness is checked (< 500 chars)
4. Event keywords are searched for
5. `requires_render` and `fetcher_type` are set automatically
6. Source is inserted into database with correct configuration

## Examples

### React SPA (requires rendering)

```html
<html>
  <head>
    <script src="react.production.min.js"></script>
  </head>
  <body data-reactroot="">
    <div id="root"></div>
  </body>
</html>
```

**Result**: `requires_render: true`, `fetcher_type: 'puppeteer'`, `confidence: 85%`

### Empty Body with Event Keywords (requires rendering)

```html
<html>
  <head>
    <title>Evenementen Agenda</title>
  </head>
  <body>
    <script>
      // JavaScript renders content
      window.renderEvents();
    </script>
  </body>
</html>
```

**Result**: `requires_render: true`, `fetcher_type: 'puppeteer'`, `confidence: 75%`

### Static Site with Content (no rendering needed)

```html
<html>
  <head>
    <title>Agenda</title>
  </head>
  <body>
    <h1>Evenementen Agenda Amsterdam</h1>
    <div class="event-list">
      <article class="event">
        <h2>Concert</h2>
        <p>Een concert op 15 januari 2024 in Amsterdam met veel muziek.</p>
      </article>
      <!-- More events... -->
    </div>
  </body>
</html>
```

**Result**: `requires_render: false`, `fetcher_type: 'static'`, `confidence: 90%`

## Benefits

1. **Automatic Configuration**: Sources are automatically configured with the right fetcher type
2. **Better Scraping Success**: JavaScript-heavy sites will be rendered properly
3. **Resource Efficiency**: Static sites avoid unnecessary rendering overhead
4. **High Confidence**: Detection logic provides confidence scores for decision-making
5. **Observable**: Signals provide debugging information about why decisions were made

## Future Enhancements

Potential improvements:
- Add detection for more frameworks (Svelte, Ember, Backbone)
- Machine learning-based detection
- Adaptive threshold tuning based on success rates
- Detection for specific JavaScript libraries (jQuery, Alpine.js)
- Framework version detection for compatibility checks

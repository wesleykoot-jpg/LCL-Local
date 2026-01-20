/**
 * Deno Tests for JavaScript Detection & Auto-Rendering Heuristics
 * 
 * Run with: deno test tests/jsDetectionHeuristics_deno_test.ts
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectJSFrameworks,
  hasEmptyBodyWithEventKeywords,
  detectRenderingRequirements,
  needsRendering,
} from "../supabase/functions/_shared/jsDetectionHeuristics.ts";

Deno.test("detectJSFrameworks - should detect React framework", () => {
  const html = `
    <html>
      <head>
        <script src="react.production.min.js"></script>
      </head>
      <body data-reactroot="">
        <div id="root"></div>
      </body>
    </html>
  `;
  
  const result = detectJSFrameworks(html);
  assert(result.frameworks.includes('react'), 'Should detect React');
  assert(result.signals.length > 0, 'Should have signals');
});

Deno.test("detectJSFrameworks - should detect Vue/Nuxt framework", () => {
  const html = `
    <html>
      <head>
        <script src="_nuxt/app.js"></script>
      </head>
      <body>
        <script>window.__NUXT__ = {};</script>
      </body>
    </html>
  `;
  
  const result = detectJSFrameworks(html);
  assert(result.frameworks.includes('vue'), 'Should detect Vue');
  assert(result.signals.length > 0, 'Should have signals');
});

Deno.test("detectJSFrameworks - should detect Angular framework", () => {
  const html = `
    <html>
      <head>
        <script src="angular.min.js"></script>
      </head>
      <body ng-app="myApp">
        <div ng-controller="MainCtrl"></div>
      </body>
    </html>
  `;
  
  const result = detectJSFrameworks(html);
  assert(result.frameworks.includes('angular'), 'Should detect Angular');
  assert(result.signals.length > 0, 'Should have signals');
});

Deno.test("detectJSFrameworks - should return empty when no frameworks detected", () => {
  const html = `
    <html>
      <head>
        <title>Simple Page</title>
      </head>
      <body>
        <h1>Hello World</h1>
      </body>
    </html>
  `;
  
  const result = detectJSFrameworks(html);
  assertEquals(result.frameworks.length, 0, 'Should detect no frameworks');
  assertEquals(result.signals.length, 0, 'Should have no signals');
});

Deno.test("hasEmptyBodyWithEventKeywords - should detect empty body with event keywords", () => {
  const html = `
    <html>
      <head>
        <title>Agenda</title>
      </head>
      <body>
        <script>
          // JavaScript will render content
          window.events = [];
        </script>
      </body>
    </html>
  `;
  
  const result = hasEmptyBodyWithEventKeywords(html);
  assertEquals(result.isEmpty, true, 'Body should be empty');
  assertEquals(result.hasKeywords, true, 'Should have event keywords');
});

Deno.test("hasEmptyBodyWithEventKeywords - should detect body with content", () => {
  const html = `
    <html>
      <head>
        <title>Agenda</title>
      </head>
      <body>
        <h1>Evenementen Agenda</h1>
        <div class="event-list">
          <article class="event">
            <h2>Concert in Amsterdam</h2>
            <p>Een geweldig concert op 15 januari met veel muziek en plezier.</p>
          </article>
          <article class="event">
            <h2>Theater voorstelling</h2>
            <p>Een prachtige theatervoorstelling in Rotterdam.</p>
          </article>
        </div>
      </body>
    </html>
  `;
  
  const result = hasEmptyBodyWithEventKeywords(html);
  assertEquals(result.isEmpty, false, 'Body should not be empty');
  assertEquals(result.hasKeywords, true, 'Should have event keywords');
  assert(result.bodyTextLength > 500, 'Body text should be > 500 chars');
});

Deno.test("hasEmptyBodyWithEventKeywords - should detect no event keywords", () => {
  const html = `
    <html>
      <body>
        <p>This is just some random content.</p>
      </body>
    </html>
  `;
  
  const result = hasEmptyBodyWithEventKeywords(html);
  assertEquals(result.hasKeywords, false, 'Should not have event keywords');
});

Deno.test("detectRenderingRequirements - should require rendering for React site", () => {
  const html = `
    <html>
      <head>
        <script src="react.production.min.js"></script>
      </head>
      <body data-reactroot="">
        <div id="root"></div>
      </body>
    </html>
  `;
  
  const result = detectRenderingRequirements(html);
  assertEquals(result.requiresRender, true, 'Should require rendering');
  assertEquals(result.fetcherType, 'puppeteer', 'Should use puppeteer');
  assert(result.detectedFrameworks.includes('react'), 'Should detect React');
  assert(result.confidence >= 85, 'Confidence should be >= 85');
});

Deno.test("detectRenderingRequirements - should require rendering for empty body with event keywords", () => {
  const html = `
    <html>
      <head>
        <title>Evenementen Agenda</title>
      </head>
      <body>
        <script>
          // Content will be rendered by JavaScript
          window.renderEvents();
        </script>
      </body>
    </html>
  `;
  
  const result = detectRenderingRequirements(html);
  assertEquals(result.requiresRender, true, 'Should require rendering');
  assertEquals(result.fetcherType, 'puppeteer', 'Should use puppeteer');
  assertEquals(result.hasEmptyBody, true, 'Should have empty body');
  assertEquals(result.hasEventKeywords, true, 'Should have event keywords');
});

Deno.test("detectRenderingRequirements - should NOT require rendering for static site with content", () => {
  const html = `
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
            <span class="date">15-01-2024</span>
          </article>
          <article class="event">
            <h2>Theater</h2>
            <p>Een theatervoorstelling in Rotterdam op 20 februari 2024.</p>
            <span class="date">20-02-2024</span>
          </article>
          <article class="event">
            <h2>Festival</h2>
            <p>Een geweldig festival met veel activiteiten en programma.</p>
            <span class="date">01-03-2024</span>
          </article>
        </div>
      </body>
    </html>
  `;
  
  const result = detectRenderingRequirements(html);
  assertEquals(result.requiresRender, false, 'Should not require rendering');
  assertEquals(result.fetcherType, 'static', 'Should use static fetcher');
  assert(result.confidence >= 60, 'Confidence should be >= 60');
});

Deno.test("detectRenderingRequirements - should have high confidence for React + empty body + keywords", () => {
  const html = `
    <html>
      <head>
        <script src="react.production.min.js"></script>
        <title>Evenementen</title>
      </head>
      <body data-reactroot="">
        <div id="root"></div>
      </body>
    </html>
  `;
  
  const result = detectRenderingRequirements(html);
  assertEquals(result.requiresRender, true, 'Should require rendering');
  assertEquals(result.confidence, 95, 'Confidence should be 95');
  assert(result.detectedFrameworks.includes('react'), 'Should detect React');
  assertEquals(result.hasEventKeywords, true, 'Should have event keywords');
});

Deno.test("needsRendering - should return true for React site", () => {
  const html = `<body data-reactroot=""><div id="root"></div></body>`;
  assertEquals(needsRendering(html), true, 'Should need rendering');
});

Deno.test("needsRendering - should return false for static site", () => {
  const html = `
    <body>
      <h1>Events</h1>
      <p>This is a static page with lots of content that doesn't need rendering.</p>
    </body>
  `;
  assertEquals(needsRendering(html), false, 'Should not need rendering');
});

Deno.test("needsRendering - should return true for empty body with event keywords", () => {
  const html = `
    <head><title>Agenda</title></head>
    <body><script>// render events</script></body>
  `;
  assertEquals(needsRendering(html), true, 'Should need rendering');
});

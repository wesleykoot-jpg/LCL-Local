import {
  ScraperSource,
  parseToISODate,
  fetchEventDetailTime,
  scrapeEventCards,
  parseEventWithAI,
  normalizeEventDateForStorage,
  eventExists,
} from "../supabase/functions/scrape-events/index.ts";
import { normalizeAndResolveUrl, probePaths } from "../src/lib/urlUtils.ts";
import { extractStructuredEvents } from "../src/lib/structuredData.ts";
import { DefaultStrategy } from "../strategies/DefaultStrategy.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("parseToISODate handles localized, textual, and relative dates", () => {
  const today = new Date("2026-07-12T00:00:00Z");
  assertEquals(parseToISODate("12 januari 2026", today), "2026-01-12");
  assertEquals(parseToISODate("zondag 12 juli 2026", today), "2026-07-12");
  assertEquals(parseToISODate("morgen", today), "2026-07-13");
  assertEquals(parseToISODate("vandaag", today), "2026-07-12");
  assertEquals(parseToISODate("13-07-2026", today), "2026-07-13");
  assertEquals(parseToISODate("2026-07-13", today), "2026-07-13");
  assertEquals(parseToISODate("2026-07-14T20:00", today), "2026-07-14");
});

Deno.test("fetchEventDetailTime extracts times across patterns", async () => {
  const pages = [
    `<div class="event-time">aanvang 20:00</div>`,
    `<div class="info">vanaf 21.30 uur</div>`,
    `<div class="copy">starts at 8:00 PM</div>`,
  ];
  let pageIndex = 0;
  const fetcher = () => Promise.resolve(new Response(pages[Math.min(pageIndex++, pages.length - 1)] || ""));

  const time1 = await fetchEventDetailTime("/detail", "https://example.com", fetcher);
  const time2 = await fetchEventDetailTime("/detail", "https://example.com", fetcher);
  const time3 = await fetchEventDetailTime("/detail", "https://example.com", fetcher);

  assertEquals(time1, "20:00");
  assertEquals(time2, "21:30");
  assertEquals(time3, "20:00");
});

Deno.test("scrapeEventCards aggregates selectors and deduplicates", async () => {
  const html = `
    <article class="event-card">
      <h2>Music Night</h2>
      <div class="date">12 juli 2026</div>
      <a href="/music">More</a>
    </article>
    <div class="agenda-item">
      <span class="event-title">Craft Fair</span>
      <span class="date">13 juli 2026</span>
      <a href="/crafts">Details</a>
    </div>
    <div class="agenda-item">
      <span class="event-title">Craft Fair</span>
      <span class="date">13 juli 2026</span>
      <a href="/crafts">Duplicate</a>
    </div>
  `;

  const source: ScraperSource = {
    id: "1",
    name: "Test Source",
    url: "https://example.com",
    enabled: true,
    config: {},
  };

  const events = await scrapeEventCards(source, false, { listingHtml: html, listingUrl: source.url });
  assertEquals(events.length, 2);
  assertEquals(events[0].title, "Music Night");
  assertEquals(events[1].title, "Craft Fair");
});

Deno.test("parseEventWithAI cleans code fences and normalizes internal category", async () => {
  const rawEvent = {
    rawHtml: "<div>Party</div>",
    title: "Party",
    date: "2026-07-13",
    location: "Venue",
    imageUrl: null,
    description: "",
    detailUrl: null,
  };

  const mockCallGemini = async (_apiKey: string, _body: unknown) =>
    "```json\n{\"title\":\"Party\",\"description\":\"Fun\",\"category\":\"invalid\",\"venue_name\":\"Club\",\"event_date\":\"2026-07-13\",\"event_time\":\"19:00\",\"image_url\":null}\n```";

  const parsed = await parseEventWithAI("fake", rawEvent, "nl", { callGeminiFn: mockCallGemini });

  assert(parsed);
  assertEquals(parsed?.internal_category, "culture");
  assertEquals(parsed?.event_date, "2026-07-13");
});

Deno.test("eventExists relies on fingerprint per source", async () => {
  const supabaseStub = {
    from() {
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    limit() {
      return Promise.resolve({ data: [{ id: 1 }], error: null });
    },
  };

  const exists = await eventExists(supabaseStub, "Title", "2026-07-13", "19:00");
  assert(exists);
  const normalized = normalizeEventDateForStorage("2026-07-13", "19:00");
  assert(normalized.timestamp.includes("2026-07-13"));
});

Deno.test("normalizeAndResolveUrl resolves base href and strips tracking", () => {
  const resolved = normalizeAndResolveUrl("/agenda", "https://example.com/base/");
  assertEquals(resolved, "https://example.com/agenda");

  const tracking = normalizeAndResolveUrl("https://example.com/path?utm_source=test#section", "https://example.com");
  assertEquals(tracking, "https://example.com/path");
});

Deno.test("probePaths attempts HEAD then GET", async () => {
  const calls: string[] = [];
  const fetcher = (_url: string, init?: RequestInit) => {
    calls.push(init?.method || "GET");
    const status = init?.method === "HEAD" ? 404 : 200;
    return Promise.resolve(new Response("", { status, headers: { "Content-Type": "text/html" } }));
  };

  const results = await probePaths("https://example.com", ["/agenda"], fetcher as typeof fetch);
  assertEquals(results[0].status, 200);
  assertEquals(calls, ["HEAD", "GET"]);
});

Deno.test("DefaultStrategy discovers anchors with base href and alternate paths", async () => {
  const homepage = `
    <html>
      <head><base href="https://example.com/root/" /></head>
      <body>
        <a href="/ontdek-meppel/agenda">Agenda</a>
      </body>
    </html>
  `;
  const fetcher = (url: string, _init?: RequestInit) => {
    const body = url.includes("ontdek-meppel") ? "" : homepage;
    const response = new Response(body, { status: 200, headers: { "Content-Type": "text/html" } });
    Object.defineProperty(response, "url", { value: url });
    return Promise.resolve(response);
  };

  const source: ScraperSource = {
    id: "src1",
    name: "Discovery",
    url: "https://example.com/home",
    enabled: true,
    config: {
      alternatePaths: ["/agenda"],
    },
  };

  const strategy = new DefaultStrategy(source);
  const urls = await strategy.discoverListingUrls(fetcher as typeof fetch);
  assert(urls.some((u) => u.includes("ontdek-meppel/agenda")));
  assert(urls.some((u) => u.endsWith("/agenda")));
});

Deno.test("extractStructuredEvents parses JSON-LD blocks", () => {
  const html = `
    <script type="application/ld+json">
    [{
      "@type": "Event",
      "name": "Jazz Night",
      "startDate": "2026-07-14T20:00",
      "location": { "name": "Town Hall" },
      "url": "/jazz"
    }]
    </script>
  `;

  const events = extractStructuredEvents(html, "https://example.com/list");
  assertEquals(events.length, 1);
  assertEquals(events[0].title, "Jazz Night");
  assertEquals(events[0].detailUrl, "https://example.com/jazz");
  assertEquals(events[0].detailPageTime, "20:00");
});

// PageFetcher Pattern Tests
import { StaticPageFetcher, DynamicPageFetcher, createFetcherForSource } from "../supabase/functions/scrape-events/strategies.ts";

Deno.test("StaticPageFetcher returns html, finalUrl and statusCode", async () => {
  const mockFetch = (_url: string, _init?: RequestInit) => {
    const response = new Response("<html><body>Test Content</body></html>", { 
      status: 200, 
      headers: { "Content-Type": "text/html" } 
    });
    Object.defineProperty(response, "url", { value: "https://example.com/final" });
    return Promise.resolve(response);
  };

  const fetcher = new StaticPageFetcher(mockFetch as typeof fetch);
  const result = await fetcher.fetchPage("https://example.com/test");

  assertEquals(result.html, "<html><body>Test Content</body></html>");
  assertEquals(result.finalUrl, "https://example.com/final");
  assertEquals(result.statusCode, 200);
});

Deno.test("StaticPageFetcher merges custom headers", async () => {
  let capturedHeaders: Record<string, string> = {};
  
  const mockFetch = (_url: string, init?: RequestInit) => {
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return Promise.resolve(new Response("", { status: 200 }));
  };

  const customHeaders = { "X-Custom-Header": "test-value" };
  const fetcher = new StaticPageFetcher(mockFetch as typeof fetch, customHeaders);
  await fetcher.fetchPage("https://example.com/test");

  assert(capturedHeaders["User-Agent"]?.includes("Mozilla"));
  assertEquals(capturedHeaders["X-Custom-Header"], "test-value");
  assertEquals(capturedHeaders["Accept-Language"], "en-US,en;q=0.5");
});

Deno.test("DynamicPageFetcher returns 501 Not Implemented", async () => {
  const fetcher = new DynamicPageFetcher();
  const result = await fetcher.fetchPage("https://example.com/test");

  assertEquals(result.html, "");
  assertEquals(result.finalUrl, "https://example.com/test");
  assertEquals(result.statusCode, 501);
});

Deno.test("createFetcherForSource returns StaticPageFetcher with source headers", () => {
  const source: ScraperSource = {
    id: "test-source",
    name: "Test Source",
    url: "https://example.com",
    enabled: true,
    config: {
      headers: {
        "X-Source-Header": "source-value",
      },
    },
  };

  const fetcher = createFetcherForSource(source);
  assert(fetcher instanceof StaticPageFetcher);
});

Deno.test("scrapeEventCards works with PageFetcher", async () => {
  const html = `
    <article class="event-card">
      <h2>Music Festival</h2>
      <div class="date">15 juli 2026</div>
      <a href="/festival">Details</a>
    </article>
  `;

  const mockFetch = (_url: string, _init?: RequestInit) => {
    const response = new Response(html, { status: 200 });
    Object.defineProperty(response, "url", { value: "https://example.com/events" });
    return Promise.resolve(response);
  };

  const source: ScraperSource = {
    id: "test-fetcher",
    name: "Test Fetcher Source",
    url: "https://example.com/events",
    enabled: true,
    config: {},
  };

  const fetcher = new StaticPageFetcher(mockFetch as typeof fetch);
  const events = await scrapeEventCards(source, false, { fetcher });

  assertEquals(events.length, 1);
  assertEquals(events[0].title, "Music Festival");
  assertEquals(events[0].date, "15 juli 2026");
});

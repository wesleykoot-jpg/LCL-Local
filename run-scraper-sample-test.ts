#!/usr/bin/env -S deno run -A
import { DefaultStrategy } from "./src/scrapers/DefaultStrategy.ts";
import { extractStructuredEvents } from "./src/lib/structuredData.ts";
import {
  constructEventDateTime,
  parseEventWithAI,
  scrapeEventCards,
} from "./supabase/functions/scrape-events/index.ts";
import type { RawEventCard, ScraperSource } from "./supabase/functions/scrape-events/shared.ts";

type SourceResultEvent = {
  title: string;
  date: string;
  detailPageTime?: string;
  datetimeISO?: string | null;
  location: string | null;
  coordinates: { lat: number; lng: number } | null;
  detailUrl: string | null;
  imageUrl: string | null;
  description: string;
};

type SourceResult = {
  sourceId: string;
  sourceName: string;
  sampleCount: number;
  parsedCount: number;
  passedAssertions: string[];
  failedAssertions: string[];
  events: SourceResultEvent[];
};

type SuiteSummary = {
  totalSources: number;
  totalEvents: number;
  failures: string[];
};

const GEO_STUBS: Record<string, { lat: number; lng: number }> = {
  "Town Hall": { lat: 52.692, lng: 6.186 },
  "Community Center": { lat: 52.7, lng: 6.2 },
};

const MIGRATIONS_DIR = new URL("./supabase/migrations/", import.meta.url);

async function readMigrationSources(): Promise<ScraperSource[]> {
  const sources: ScraperSource[] = [];
  for await (const entry of Deno.readDir(MIGRATIONS_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".sql")) continue;
    const content = await Deno.readTextFile(new URL(entry.name, MIGRATIONS_DIR));
    if (!content.toLowerCase().includes("scraper_sources")) continue;

    const rowRegex = /\(\s*'([^']+)'\s*[^)]*?(https?:\/\/[^'")\s]+)[^)]*?(?:'(\{[\s\S]*?\})'\s*::jsonb)?[^)]*\)/g;
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(content)) !== null) {
      const name = match[1];
      const url = match[2];
      const configStr = match[3];
      let parsedConfig: Record<string, unknown> = {};
      if (configStr) {
        try {
          parsedConfig = JSON.parse(configStr);
        } catch {
          parsedConfig = {};
        }
      }
      sources.push({
        id: `${entry.name}-${sources.length}`,
        name,
        url,
        enabled: true,
        requires_render:
          typeof parsedConfig.requires_render === "boolean"
            ? (parsedConfig.requires_render as boolean)
            : /\brequires_render\b[^)]*true/i.test(match[0]),
        config: {
          selectors: (parsedConfig.selectors as string[] | undefined) ?? [],
          headers: (parsedConfig.headers as Record<string, string> | undefined) ?? {},
          rate_limit_ms: parsedConfig.rate_limit_ms as number | undefined,
          default_coordinates: (parsedConfig.default_coordinates as { lat: number; lng: number } | undefined) ?? undefined,
          language: (parsedConfig.language as string | undefined) ?? undefined,
          country: (parsedConfig.country as string | undefined) ?? undefined,
          dynamic_year: parsedConfig.dynamic_year as boolean | undefined,
          discoveryAnchors: (parsedConfig.discoveryAnchors as string[] | undefined) ?? undefined,
          alternatePaths: (parsedConfig.alternatePaths as string[] | undefined) ?? undefined,
        },
      });
    }
  }

  if (sources.length === 0) {
    return [
      {
        id: "sample-ontdek-meppel",
        name: "Ontdek Meppel",
        url: "https://ontdekmeppel.nl/ontdek-meppel/agenda/",
        enabled: true,
        requires_render: false,
        config: { selectors: [], headers: {}, rate_limit_ms: 200, discoveryAnchors: ["agenda"], alternatePaths: ["/agenda"] },
      },
      {
        id: "render-mock",
        name: "Render Mock Source",
        url: "https://render.example/agenda",
        enabled: true,
        requires_render: true,
        config: { selectors: [], headers: {} },
      },
    ];
  }

  // Ensure a renderer case is covered
  const hasRenderMock = sources.some((s) => s.id === "render-mock");
  if (!hasRenderMock) {
    sources.push({
      id: "render-mock",
      name: "Render Mock Source",
    url: "https://render.example/agenda",
    enabled: true,
    requires_render: true,
    config: { selectors: [], headers: {} },
  });
  }

  return sources;
}

function buildSampleListing(source: ScraperSource) {
  const base = new URL(source.url);
  const events = [
    {
      slug: "music-night",
      title: `${source.name} Music Night`,
      dateText: "12 juli 2026",
      isoDate: "2026-07-12",
      location: "Town Hall",
      timeSnippet: "aanvang 20:00",
      expectTime: "20:00",
      description: "Live music evening.",
      image: "/img/music.jpg",
    },
    {
      slug: "summer-fair",
      title: "Summer Fair",
      dateText: "14 juli",
      isoDate: "2026-07-14",
      location: "Community Center",
      timeSnippet: "vanaf 21.30 uur",
      expectTime: "21:30",
      description: "Handmade crafts and food trucks.",
      image: null,
    },
    {
      slug: "late-show",
      title: "Late Show",
      dateText: "15 juli 2026",
      isoDate: "2026-07-15",
      location: "Unknown Venue",
      timeSnippet: "Starts at 8:00 PM",
      expectTime: "20:00",
      description: "Comedy and drinks.",
      image: null,
    },
  ];

  const listingHtml = `
    <main>
      <article class="event-card">
        <h2>${events[0].title}</h2>
        <div class="date">${events[0].dateText}</div>
        <div class="location">${events[0].location}</div>
        <a href="/events/${events[0].slug}">More</a>
        <img src="${events[0].image}" />
      </article>
      <div class="agenda-item">
        <span class="event-title">${events[1].title}</span>
        <span class="date">${events[1].dateText}</span>
        <span class="location">${events[1].location}</span>
        <a href="/events/${events[1].slug}">Details</a>
      </div>
      <div class="agenda-item">
        <span class="event-title">${events[2].title}</span>
        <span class="date">${events[2].dateText}</span>
        <span class="location">${events[2].location}</span>
        <a href="/events/${events[2].slug}">Duplicate</a>
      </div>
      <article class="agenda-item">
        <h3>${events[2].title}</h3>
        <time datetime="${events[2].isoDate}"></time>
        <div class="location">${events[2].location}</div>
        <a href="/events/${events[2].slug}">Tickets</a>
      </article>
    </main>
  `;

  const detailPages: Record<string, string> = {
    [`${base.origin}/events/${events[0].slug}`]: `<div class="event-time">${events[0].timeSnippet}</div>`,
    [`${base.origin}/events/${events[1].slug}`]: `<div class="info">${events[1].timeSnippet}</div>`,
    [`${base.origin}/events/${events[2].slug}`]: `<div class="copy">${events[2].timeSnippet}</div>`,
  };

  const structuredHtml = `
    <script type="application/ld+json">
    [{
      "@type": "Event",
      "name": "Jazz Night",
      "startDate": "2026-07-14T20:00",
      "location": { "@type": "Place", "name": "Town Hall", "address": "Main St 1" },
      "url": "/jazz"
    }]
    </script>
  `;

  return { listingHtml, detailPages, structuredHtml, events };
}

function makeDetailFetcher(detailPages: Record<string, string>): typeof fetch {
  return (input: RequestInfo | URL, _init?: RequestInit) => {
    const resolved = new URL(typeof input === "string" ? input : input.toString());
    const key = resolved.toString().replace(/\/$/, "");
    const html = detailPages[key];
    if (html) {
      return Promise.resolve(new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }));
    }
    return Promise.resolve(new Response("<p>not found</p>", { status: 404 }));
  };
}

function mockGeminiResponse(raw: RawEventCard, source: ScraperSource) {
  const venue = raw.location || source.name;
  const coords = GEO_STUBS[venue];
  return [
    "```json",
    JSON.stringify({
      title: raw.title || "Untitled",
      description: raw.description || `Samenvatting voor ${raw.title}`,
      category: "market",
      venue_name: venue,
      venue_address: `${venue} Street 1`,
      event_date: raw.date,
      event_time: raw.detailPageTime || "19:00",
      image_url: raw.imageUrl,
      coordinates: coords ?? null,
      mocked: true,
    }),
    "```",
  ].join("\n");
}

function geocodeStub(venue: string | null | undefined, source: ScraperSource) {
  if (venue && GEO_STUBS[venue]) {
    return GEO_STUBS[venue];
  }
  return source.config.default_coordinates || { lat: 52.1, lng: 5.1 };
}

function assertAndRecord(
  passed: string[],
  failed: string[],
  name: string,
  condition: boolean,
  diagnostic?: string,
) {
  if (condition) {
    passed.push(name);
  } else {
    failed.push(diagnostic ? `${name}: ${diagnostic}` : name);
  }
}

async function runSource(source: ScraperSource): Promise<SourceResult> {
  const sample = buildSampleListing(source);
  const detailFetcher = makeDetailFetcher(sample.detailPages);
  const passed: string[] = [];
  const failed: string[] = [];

  const strategy = new DefaultStrategy(source);
  await strategy
    .discoverListingUrls((_url: string, init?: RequestInit) => {
      const html = `<html><head><base href="${source.url}" /></head><body><a href="/agenda">Agenda</a></body></html>`;
      const resp = new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
      return Promise.resolve(resp);
    })
    .catch(() => []);

  let rendererFetch: typeof fetch | undefined;
  if (source.requires_render || source.config.requires_render) {
    const renderedBody = JSON.stringify({
      status: 200,
      finalUrl: source.url,
      html: sample.listingHtml,
    });
    rendererFetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/render")) {
        return Promise.resolve(
          new Response(renderedBody, { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }
      return Promise.resolve(new Response("", { status: 404 }));
    };
  }

  let restoreFetch: (() => void) | undefined;
  if (rendererFetch) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = rendererFetch as typeof fetch;
    restoreFetch = () => {
      globalThis.fetch = originalFetch;
    };
  }

  const rawEvents = await scrapeEventCards(source, true, {
    listingHtml: source.requires_render ? undefined : sample.listingHtml,
    listingUrl: source.url,
    fetcher: source.requires_render ? rendererFetch : undefined,
    detailFetcher,
    rendererUrl: source.requires_render ? "https://renderer.test" : undefined,
    enableDebug: true,
  });

  if (restoreFetch) restoreFetch();

  const structuredEvents = extractStructuredEvents(sample.structuredHtml, source.url);
  assertAndRecord(passed, failed, "structured-data", structuredEvents.length > 0, "No JSON-LD events detected");

  const events: SourceResultEvent[] = [];
  const seen = new Set<string>();

  for (const raw of rawEvents) {
    const parsed = await parseEventWithAI(
      "mock-key",
      raw,
      source.language || "nl",
      source.default_coordinates || source.config.default_coordinates,
      {
        callGeminiFn: async () => mockGeminiResponse(raw, source),
      },
    );
    if (!parsed) {
      failed.push(`ai-parse:${raw.title || "unknown"}`);
      continue;
    }

    const dedupKey = JSON.stringify({
      t: parsed.title.toLowerCase(),
      d: parsed.event_date,
      u: raw.detailUrl || "",
    });
    if (seen.has(dedupKey)) {
      continue;
    }
    seen.add(dedupKey);

    const coords = geocodeStub(parsed.venue_name, source);
    const detailPageTime = raw.detailPageTime || parsed.event_time || undefined;
    const datetimeISO = detailPageTime ? constructEventDateTime(parsed.event_date, detailPageTime) : null;

    assertAndRecord(
      passed,
      failed,
      "date-format",
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.event_date) && parsed.event_date.startsWith("2026"),
      `Bad date ${parsed.event_date}`,
    );
    if (detailPageTime) {
      assertAndRecord(
        passed,
        failed,
        "time-format",
        /^\d{2}:\d{2}$/.test(detailPageTime),
        `Bad time ${detailPageTime}`,
      );
    }
    if (datetimeISO) {
      assertAndRecord(
        passed,
        failed,
        "datetime",
        datetimeISO.includes("2026-"),
        `Datetime not normalized: ${datetimeISO}`,
      );
    }

    const locationOk = (parsed.venue_name || "").length > 0;
    assertAndRecord(
      passed,
      failed,
      "location",
      locationOk,
      `Missing location for ${parsed.title}`,
    );

    if (coords) {
      const latOk = typeof coords.lat === "number" && coords.lat <= 90 && coords.lat >= -90;
      const lngOk = typeof coords.lng === "number" && coords.lng <= 180 && coords.lng >= -180;
      assertAndRecord(passed, failed, "geocoded", latOk && lngOk, `Invalid coords for ${parsed.title}`);
    } else {
      assertAndRecord(
        passed,
        failed,
        "geocode-fallback",
        !!source.default_coordinates || !!source.config.default_coordinates,
        "No coords and no fallback",
      );
    }

    events.push({
      title: parsed.title,
      date: parsed.event_date,
      detailPageTime: detailPageTime || undefined,
      datetimeISO,
      location: parsed.venue_name || raw.location || null,
      coordinates: coords,
      detailUrl: raw.detailUrl,
      imageUrl: parsed.image_url,
      description: parsed.description,
    });
  }

  assertAndRecord(
    passed,
    failed,
    "deduplication",
    rawEvents.length >= events.length && events.length > 0,
    `Expected deduped events, got ${rawEvents.length} -> ${events.length}`,
  );

  return {
    sourceId: source.id,
    sourceName: source.name,
    sampleCount: sample.events.length,
    parsedCount: events.length,
    passedAssertions: Array.from(new Set(passed)),
    failedAssertions: Array.from(new Set(failed)),
    events,
  };
}

function buildSummary(results: SourceResult[]): SuiteSummary {
  const failures = results.flatMap((r) => r.failedAssertions.map((f) => `${r.sourceName}: ${f}`));
  return {
    totalSources: results.length,
    totalEvents: results.reduce((acc, r) => acc + r.parsedCount, 0),
    failures,
  };
}

export async function runSampleScraperSuite(options: { limitSources?: number; writeReport?: boolean } = {}) {
  const sources = (await readMigrationSources()).slice(0, options.limitSources || Number.MAX_SAFE_INTEGER);
  const results: SourceResult[] = [];

  for (const source of sources) {
    const result = await runSource(source);
    results.push(result);
  }

  const summary = buildSummary(results);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `results/tests-report-${timestamp}.json`;

  if (options.writeReport !== false) {
    await Deno.mkdir("results", { recursive: true });
    await Deno.writeTextFile(reportPath, JSON.stringify({ summary, results }, null, 2));
  }

  const failurePreview = summary.failures.slice(0, 5);
  console.log("\n=== Scraper Sample Suite ===");
  console.log(`Sources tested: ${summary.totalSources}`);
  console.log(`Parsed events: ${summary.totalEvents}`);
  console.log(`Critical failures (${failurePreview.length}/${summary.failures.length}):`);
  failurePreview.forEach((f) => console.log(` - ${f}`));
  if (summary.failures.length === 0) {
    console.log("All assertions passed ✅");
  }

  return { summary, results, reportPath };
}

if (import.meta.main) {
  await runSampleScraperSuite();
}

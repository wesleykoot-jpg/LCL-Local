
import { runExtractionWaterfall, FeedExtractionContext } from "../supabase/functions/_shared/dataExtractors.ts";

async function verifyAsyncRss() {
  console.log("Verifying Async RSS Extraction...");

  const mockHtml = `
    <html>
      <head>
        <link rel="alternate" type="application/rss+xml" title="Test RSS" href="/feed.xml" />
      </head>
      <body>
        <h1>Test Page</h1>
      </body>
    </html>
  `;

  const mockRssContent = `
    <?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
    <channel>
      <title>Test Feed</title>
      <item>
        <title>Test Event</title>
        <link>https://example.com/event/1</link>
        <description>This is a test event description.</description>
        <pubDate>Wed, 15 Jan 2026 20:00:00 GMT</pubDate>
      </item>
    </channel>
    </rss>
  `;

  const mockFetcher = {
    fetch: async (url: string) => {
      console.log(`[MockFetcher] Fetching: ${url}`);
      if (url.endsWith("/feed.xml")) {
        return { html: mockRssContent, status: 200 };
      }
      return { html: "", status: 404 };
    }
  };

  const context: FeedExtractionContext = {
    baseUrl: "https://example.com",
    preferredMethod: "feed",
    feedDiscovery: true,
    fetcher: mockFetcher
  };

  const result = await runExtractionWaterfall(mockHtml, context);

  console.log("Waterfall Result:");
  console.log(`Winning Strategy: ${result.winningStrategy}`);
  console.log(`Events Found: ${result.totalEvents}`);
  
  if (result.totalEvents > 0) {
    console.log("Event 0 Title:", result.events[0].title);
  }

  if (result.winningStrategy === 'feed' && result.totalEvents === 1) {
    console.log("✅ verification PASSED");
  } else {
    console.error("❌ verification FAILED");
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await verifyAsyncRss();
}

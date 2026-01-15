import { parseArgs } from "node:util";

type CliOptions = {
  "source-id"?: string;
  "dry-run"?: boolean;
  "enable-deep-scraping"?: boolean;
  limit?: number;
  "run-id"?: string;
};

function buildPayload(options: CliOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (options["source-id"]) payload.sourceId = options["source-id"];
  if (typeof options["dry-run"] === "boolean") payload.dryRun = options["dry-run"];
  if (typeof options["enable-deep-scraping"] === "boolean") {
    payload.enableDeepScraping = options["enable-deep-scraping"];
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit)) {
    payload.limit = options.limit;
  }
  return payload;
}

function parseLimit(raw?: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  if (!Number.isInteger(value) || value <= 0) return undefined;
  return value;
}

async function main() {
  const RUN_SCRAPER_PATH = "/functions/v1/run-scraper";
  const { values } = parseArgs({
    options: {
      "source-id": { type: "string" },
      "dry-run": { type: "boolean" },
      "enable-deep-scraping": { type: "boolean" },
      limit: { type: "string" },
      "run-id": { type: "string" },
    },
  });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️  Using SUPABASE_KEY fallback. Prefer SUPABASE_SERVICE_ROLE_KEY for scraper runs.");
  }

  const normalizedLimit = parseLimit(values.limit);
  const payload = buildPayload({
    "source-id": values["source-id"],
    "dry-run": values["dry-run"],
    "enable-deep-scraping": values["enable-deep-scraping"],
    limit: normalizedLimit,
    "run-id": values["run-id"],
  });

  const targetUrl = `${supabaseUrl.replace(/\/$/, "")}${RUN_SCRAPER_PATH}`;
  const runId = values["run-id"] || `cli-run-${Date.now()}`;

  console.log(`▶️  Starting scraper run ${runId}`);
  console.log(`    Endpoint: ${targetUrl}`);
  console.log(`    Payload: ${JSON.stringify(payload)}`);

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
      "X-Run-Id": runId,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`❌ Scraper run failed (${response.status}): ${text}`);
    process.exit(1);
  }

  console.log(`✅ Scraper run succeeded (${response.status})`);
  console.log(text);
}

main().catch((error) => {
  console.error("Unexpected error running scraper CLI:", error);
  process.exit(1);
});

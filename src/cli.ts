import { parseArgs } from "node:util";

type CliOptions = {
  "source-id"?: string;
  "dry-run"?: boolean;
  "enable-deep-scraping"?: boolean;
  limit?: number;
  "run-id"?: string;
};

function getEnv(name: string): string | undefined {
  return process.env[name] || process.env[name.replace("SUPABASE_", "SUPABASE_SERVICE_ROLE_")];
}

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

async function main() {
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
  const supabaseKey = getEnv("SUPABASE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables.");
    process.exit(1);
  }

  const parsedLimit = values.limit ? Number(values.limit) : undefined;
  const payload = buildPayload({
    ...values,
    limit: parsedLimit,
  });

  const targetUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/run-scraper`;
  const runId = values["run-id"] || `cli-run-${Date.now()}`;

  console.log(`▶️  Starting scraper run ${runId}`);
  console.log(`    Endpoint: ${targetUrl}`);
  console.log(`    Payload: ${JSON.stringify(payload)}`);

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
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

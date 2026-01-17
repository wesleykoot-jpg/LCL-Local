# LCL Monitoring Toolkit

This directory contains a lightweight Prometheus-compatible telemetry client plus example Prometheus/Grafana assets for the LCL external dependency monitoring stack.

## Directory Structure

```
lcl-monitoring/
├── telemetry-client/
│   ├── src/
│   │   └── index.ts          # Main telemetry client implementation
│   └── tests/                # Unit tests
├── prometheus/
│   ├── prometheus.yml        # Prometheus configuration
│   └── alert_rules.yml       # Alert rule definitions
├── grafana/
│   └── dashboards/           # Grafana dashboard JSON files
└── README.md                 # This file
```

## Telemetry Client

The telemetry client is a TypeScript wrapper that records external request metrics and exposes them on a `/metrics` HTTP endpoint.

**Source:** [`telemetry-client/src/index.ts`](./telemetry-client/src/index.ts)

### Basic Usage

```ts
import {
  TelemetryHttpClient,
  createTelemetryMetrics,
  startMetricsServer,
} from './telemetry-client/src/index'

// Create metrics registry
const metrics = createTelemetryMetrics({ 
  environment: 'local',  // or 'production', 'staging'
  region: 'eu'           // geographic region identifier
})

// Start HTTP server to expose metrics
startMetricsServer(metrics, { port: 9464 })

// Create HTTP client with automatic metric recording
const client = new TelemetryHttpClient({ metrics })

// Make requests - metrics are automatically recorded
await client.request('https://api.openai.com/v1', {
  service: 'openai',
  host: 'api.openai.com',
  endpoint: '/v1',
  method: 'POST',
})
```

**Metrics Endpoint:** `http://localhost:9464/metrics` (Prometheus format)

### Supported Labels

The wrapper expects the following context properties when making requests:

**Required Labels:**
- `service` - Service name (e.g., 'openai', 'nominatim', 'scraper')
- `host` - Hostname (e.g., 'api.openai.com')
- `endpoint` - API endpoint path (e.g., '/v1/chat/completions')
- `method` - HTTP method (e.g., 'POST', 'GET')

**Optional Labels:**
- `domain` - Used for `last_success_timestamp` metric (typically for scraper domains)
- `queue_name` - Reserved for queue metrics

### Recorded Metrics

The telemetry client automatically records:

- **Counters:**
  - `external_requests_total` - Total HTTP requests by service/host/endpoint/method/result
  - `external_429_total` - Rate limit (429) responses
  - `external_5xx_total` - Server error (5xx) responses
  - `external_403_total` - Forbidden (403) responses
  - `token_usage_total` - Token usage per service/model
  - `cache_hit_total` / `cache_miss_total` - Cache statistics

- **Gauges:**
  - `external_rate_limit_remaining` - Remaining rate limit quota
  - `external_rate_limit_reset_ts` - Rate limit reset timestamp
  - `db_connections_current` - Active database connections
  - `queue_depth` - Queue depth by queue name
  - `last_success_timestamp` - Last successful scrape timestamp per domain

- **Histograms:**
  - `external_request_duration_seconds` - Request latency distribution

### Backoff and Throttling

The client automatically retries on `429` (rate limit) and `5xx` (server error) responses using exponential backoff and respects `Retry-After` headers when present.

**Configuration Options:**
- `maxRetries` - Maximum retry attempts (default: 2)
- `baseDelayMs` - Base delay for exponential backoff (default: 500ms)
- `maxDelayMs` - Maximum delay between retries (default: 10000ms)
- `jitterRatio` - Jitter ratio for backoff randomization (default: 0.2)

### Rate Limiting with Token Buckets

Per-host token buckets can be configured to limit request rates:

```ts
const client = new TelemetryHttpClient({
  metrics,
  tokenBuckets: {
    'api.openai.com': { 
      capacity: 60,              // Maximum tokens in bucket
      refillRatePerSecond: 1     // Tokens added per second (60/min)
    },
    'nominatim.openstreetmap.org': {
      capacity: 1,
      refillRatePerSecond: 1/60  // 1 request per minute
    }
  },
})
```

**How it works:**
- Each request consumes 1 token from the host's bucket
- Tokens refill at the configured rate
- Requests wait if bucket is empty (automatic throttling)
- Prevents exceeding API rate limits

## Running Locally

### 1. Start the Metrics Server

Start a simple metrics server that exposes metrics on port 9464:

```bash
# Using npx tsx (recommended)
npx tsx -e "import { createTelemetryMetrics, startMetricsServer } from './lcl-monitoring/telemetry-client/src/index.ts'; const metrics = createTelemetryMetrics({ environment: 'local', region: 'eu' }); startMetricsServer(metrics, { port: 9464 }); console.log('Metrics server running on http://localhost:9464/metrics');"

# Or create a simple script file
cat > run-metrics-server.ts << 'EOF'
import { createTelemetryMetrics, startMetricsServer } from './lcl-monitoring/telemetry-client/src/index.ts';
const metrics = createTelemetryMetrics({ environment: 'local', region: 'eu' });
startMetricsServer(metrics, { port: 9464 });
console.log('Metrics server running on http://localhost:9464/metrics');
EOF

npx tsx run-metrics-server.ts
```

**Verify it's running:**
```bash
curl http://localhost:9464/metrics
```

### 2. Start Prometheus

Run Prometheus with Docker, mounting the configuration file:

```bash
cd lcl-monitoring
docker run --rm -p 9090:9090 \
  -v $(pwd)/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
  -v $(pwd)/prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml \
  prom/prometheus
```

**Access Prometheus UI:** http://localhost:9090

**Configuration File:** [`prometheus/prometheus.yml`](./prometheus/prometheus.yml)
- Scrape interval: 15s
- Target: `host.docker.internal:9464` (metrics server)
- Alert rules: [`prometheus/alert_rules.yml`](./prometheus/alert_rules.yml)

### 3. Start Grafana

Run Grafana with Docker:

```bash
docker run --rm -p 3000:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana
```

**Access Grafana UI:** http://localhost:3000 (default credentials: admin/admin)

**Setup Steps:**
1. Add Prometheus data source: Configuration → Data Sources → Add Prometheus
   - URL: `http://host.docker.internal:9090`
2. Import dashboards: Dashboards → Import → Upload JSON file
   - Use dashboard files from `grafana/dashboards/`

## Dashboards

Pre-built Grafana dashboards are available in [`grafana/dashboards/`](./grafana/dashboards/):

| Dashboard | File | Description |
|-----------|------|-------------|
| **Overview** | [`overview.json`](./grafana/dashboards/overview.json) | High-level metrics for all services |
| **OpenAI Service Detail** | [`service-openai.json`](./grafana/dashboards/service-openai.json) | Detailed OpenAI API metrics, token usage, rate limits |
| **Scraper Domains** | [`scraper-domains.json`](./grafana/dashboards/scraper-domains.json) | Per-domain scraping metrics using `host` as domain label |

**To import:**
1. Open Grafana UI (http://localhost:3000)
2. Go to Dashboards → Import
3. Upload JSON file or paste contents
4. Select Prometheus data source

## Alerts

Alert rules are defined in [`prometheus/alert_rules.yml`](./prometheus/alert_rules.yml).

**Key Alert Rules:**
- High external API error rate (5xx responses)
- Rate limit threshold breaches (429 responses)
- Token usage approaching quota
- Database connection pool exhaustion
- Scraper domain failures

**Integrating with Alertmanager:**

1. Configure Alertmanager in `prometheus.yml`:
   ```yaml
   alerting:
     alertmanagers:
       - static_configs:
           - targets: ['localhost:9093']
   ```

2. Start Alertmanager:
   ```bash
   docker run --rm -p 9093:9093 \
     -v $(pwd)/alertmanager.yml:/etc/alertmanager/alertmanager.yml \
     prom/alertmanager
   ```

Thresholds follow suggested values for production workloads. Adjust as needed in `alert_rules.yml`.

## Testing

### Unit Tests

Run unit tests with Vitest:

```bash
# Run all monitoring tests
npm test -- lcl-monitoring/telemetry-client/tests

# Run tests in watch mode
npm test -- --watch lcl-monitoring/telemetry-client/tests
```

**Test Files:** Located in [`telemetry-client/tests/`](./telemetry-client/tests/)

### Simulating Metrics

A script can push synthetic metrics to Prometheus via Pushgateway for testing:

```bash
# Start Pushgateway
docker run --rm -p 9091:9091 prom/pushgateway

# Run simulation script (if available)
node lcl-monitoring/scripts/simulate_metrics.js
```

**Note:** The `simulate_metrics.js` script may need to be created for your specific testing needs.

## Integration with Supabase Edge Functions

To use the telemetry client in a Supabase Edge Function:

```typescript
// In your Edge Function (e.g., scrape-events/index.ts)
import { TelemetryHttpClient, createTelemetryMetrics } from '../_shared/telemetry.ts';

const metrics = createTelemetryMetrics({
  environment: Deno.env.get('ENVIRONMENT') || 'production',
  region: 'global'
});

const httpClient = new TelemetryHttpClient({
  metrics,
  tokenBuckets: {
    'api.openai.com': { capacity: 60, refillRatePerSecond: 1 }
  }
});

// Use httpClient for external requests
const response = await httpClient.request('https://api.openai.com/v1/chat/completions', {
  service: 'openai',
  host: 'api.openai.com',
  endpoint: '/v1/chat/completions',
  method: 'POST'
}, {
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify(payload)
});
```

## Related Documentation

- **Scraper Implementation:** [`supabase/functions/scrape-events/`](../supabase/functions/scrape-events/) - Uses telemetry for monitoring external API calls
- **Operational Runbook:** [`docs/runbook.md`](../docs/runbook.md) - Production monitoring and alerting procedures
- **GitHub Workflows:** [`.github/workflows/README.md`](../.github/workflows/README.md) - CI/CD pipeline documentation

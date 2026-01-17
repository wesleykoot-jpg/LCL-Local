# LCL Monitoring Toolkit

This directory contains a lightweight Prometheus-compatible telemetry client plus example Prometheus/Grafana assets for the LCL external dependency monitoring stack.

## Telemetry client

The telemetry client is a TypeScript wrapper that records external request metrics and exposes them on a `/metrics` HTTP endpoint.

```ts
import {
  TelemetryHttpClient,
  createTelemetryMetrics,
  startMetricsServer,
} from './telemetry-client/src/index'

const metrics = createTelemetryMetrics({ environment: 'local', region: 'eu' })
startMetricsServer(metrics, { port: 9464 })

const client = new TelemetryHttpClient({ metrics })
await client.request('https://api.openai.com/v1', {
  service: 'openai',
  host: 'api.openai.com',
  endpoint: '/v1',
  method: 'POST',
})
```

### Supported labels

The wrapper expects the following context properties:

- `service`, `host`, `endpoint`, `method` (required)
- `domain` (optional, used for `last_success_timestamp`)
- `queue_name` (optional, reserved for queue metrics)

### Backoff and throttling

The client retries on `429` and `5xx` responses using exponential backoff and respects `Retry-After` when present. Per-host token buckets can be configured via the `tokenBuckets` option:

```ts
const client = new TelemetryHttpClient({
  metrics,
  tokenBuckets: {
    'api.openai.com': { capacity: 60, refillRatePerSecond: 1 },
  },
})
```

## Running locally

1. Start the metrics server (example using tsx):

   ```bash
   npx tsx -e "import { createTelemetryMetrics, startMetricsServer } from './lcl-monitoring/telemetry-client/src/index.ts'; const metrics = createTelemetryMetrics({ environment: 'local', region: 'eu' }); startMetricsServer(metrics, { port: 9464 });"
   ```

2. Start Prometheus:

   ```bash
   docker run --rm -p 9090:9090 \
     -v $(pwd)/lcl-monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
     prom/prometheus
   ```

3. Start Grafana and import dashboards from `lcl-monitoring/grafana/dashboards`.

   ```bash
   docker run --rm -p 3000:3000 grafana/grafana
   ```

## Dashboards

- **Overview**: `grafana/dashboards/overview.json`
- **OpenAI Service Detail**: `grafana/dashboards/service-openai.json`
- **Scraper Domains**: `grafana/dashboards/scraper-domains.json`

The scraper domains dashboard uses `host` as the domain label for external scraper requests.

## Alerts

Alert rules are defined in `prometheus/alert_rules.yml`. Wire them into Alertmanager as usual. Thresholds follow the suggested values from the spec.

## Simulating metrics

A small script can push synthetic metrics to Prometheus via Pushgateway:

```bash
docker run --rm -p 9091:9091 prom/pushgateway
node lcl-monitoring/scripts/simulate_metrics.js
```

## Tests

Run unit tests with Vitest:

```bash
npm test -- lcl-monitoring/telemetry-client/tests
```

import http from 'node:http'

export type Labels = Record<string, string>

const DEFAULT_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

const escapeLabelValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')

const serializeLabels = (labelNames: string[], labels: Labels) => {
  if (labelNames.length === 0) {
    return ''
  }
  const pairs = labelNames.map((name) => {
    const value = labels[name]
    return `${name}="${escapeLabelValue(value ?? '')}"`
  })
  return `{${pairs.join(',')}}`
}

export class Counter {
  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly labelNames: string[],
  ) {}

  private readonly values = new Map<string, number>()

  inc(labels: Labels, value = 1) {
    const key = this.key(labels)
    const current = this.values.get(key) ?? 0
    this.values.set(key, current + value)
  }

  get(labels: Labels) {
    return this.values.get(this.key(labels)) ?? 0
  }

  reset() {
    this.values.clear()
  }

  toPrometheus() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`]
    for (const [key, value] of this.values.entries()) {
      lines.push(`${this.name}${key} ${value}`)
    }
    return lines.join('\n')
  }

  private key(labels: Labels) {
    return serializeLabels(this.labelNames, labels)
  }
}

export class Gauge {
  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly labelNames: string[],
  ) {}

  private readonly values = new Map<string, number>()

  set(labels: Labels, value: number) {
    this.values.set(this.key(labels), value)
  }

  inc(labels: Labels, value = 1) {
    const key = this.key(labels)
    const current = this.values.get(key) ?? 0
    this.values.set(key, current + value)
  }

  get(labels: Labels) {
    return this.values.get(this.key(labels)) ?? 0
  }

  reset() {
    this.values.clear()
  }

  toPrometheus() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`]
    for (const [key, value] of this.values.entries()) {
      lines.push(`${this.name}${key} ${value}`)
    }
    return lines.join('\n')
  }

  private key(labels: Labels) {
    return serializeLabels(this.labelNames, labels)
  }
}

export class Histogram {
  constructor(
    public readonly name: string,
    public readonly help: string,
    private readonly labelNames: string[],
    private readonly buckets: number[],
  ) {}

  private readonly values = new Map<string, { buckets: number[]; sum: number; count: number }>()

  observe(labels: Labels, value: number) {
    const key = this.key(labels)
    const state = this.values.get(key) ?? {
      buckets: new Array(this.buckets.length + 1).fill(0),
      sum: 0,
      count: 0,
    }
    const bucketIndex = this.buckets.findIndex((bucket) => value <= bucket)
    const index = bucketIndex === -1 ? this.buckets.length : bucketIndex
    for (let i = index; i < state.buckets.length; i += 1) {
      state.buckets[i] += 1
    }
    state.sum += value
    state.count += 1
    this.values.set(key, state)
  }

  reset() {
    this.values.clear()
  }

  toPrometheus() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`]
    for (const [key, state] of this.values.entries()) {
      for (let i = 0; i < this.buckets.length; i += 1) {
        const bucketLabels = key
          ? key.replace(/}$/, `,le="${this.buckets[i]}"}`)
          : `{le="${this.buckets[i]}"}`
        lines.push(`${this.name}_bucket${bucketLabels} ${state.buckets[i]}`)
      }
      const infLabels = key ? key.replace(/}$/, `,le="+Inf"}`) : `{le="+Inf"}`
      lines.push(`${this.name}_bucket${infLabels} ${state.buckets[state.buckets.length - 1]}`)
      lines.push(`${this.name}_sum${key} ${state.sum}`)
      lines.push(`${this.name}_count${key} ${state.count}`)
    }
    return lines.join('\n')
  }

  private key(labels: Labels) {
    return serializeLabels(this.labelNames, labels)
  }
}

export class MetricsRegistry {
  counters = new Map<string, Counter>()
  gauges = new Map<string, Gauge>()
  histograms = new Map<string, Histogram>()

  counter(name: string, help: string, labelNames: string[]) {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Counter(name, help, labelNames))
    }
    return this.counters.get(name)!
  }

  gauge(name: string, help: string, labelNames: string[]) {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Gauge(name, help, labelNames))
    }
    return this.gauges.get(name)!
  }

  histogram(name: string, help: string, labelNames: string[], buckets: number[]) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Histogram(name, help, labelNames, buckets))
    }
    return this.histograms.get(name)!
  }

  reset() {
    for (const counter of this.counters.values()) counter.reset()
    for (const gauge of this.gauges.values()) gauge.reset()
    for (const histogram of this.histograms.values()) histogram.reset()
  }

  metrics() {
    return [
      ...this.counters.values(),
      ...this.gauges.values(),
      ...this.histograms.values(),
    ]
      .map((metric) => metric.toPrometheus())
      .join('\n')
  }
}

export interface TelemetryMetrics {
  environment: string
  region: string
  registry: MetricsRegistry
  externalRequestsTotal: Counter
  externalRequestDuration: Histogram
  external429Total: Counter
  external5xxTotal: Counter
  external403Total: Counter
  externalRateLimitRetryAfterSeconds: Gauge
  externalRateLimitRemaining: Gauge
  externalRateLimitResetTs: Gauge
  tokenUsageTotal: Counter
  tokensMonthlyQuota: Gauge
  dbConnectionsCurrent: Gauge
  dbConnectionsLimit: Gauge
  cacheHitTotal: Counter
  cacheMissTotal: Counter
  queueDepth: Gauge
  workerCount: Gauge
  lastSuccessTimestamp: Gauge
  scraperDomainConcurrency: Gauge
  storageEgressBytes: Counter
  pushFailureTotal: Counter
  emailSendErrorsTotal: Counter
  paymentApiErrorsTotal: Counter
  githubRateLimitRemaining: Gauge
  metricsText: () => string
  reset: () => void
}

export interface TelemetryMetricsOptions {
  environment?: string
  region?: string
  histogramBuckets?: number[]
}

/**
 * Initializes the telemetry metrics registry with the required metric names.
 */
export const createTelemetryMetrics = (options: TelemetryMetricsOptions = {}): TelemetryMetrics => {
  const environment = options.environment ?? 'local'
  const region = options.region ?? 'local'
  const registry = new MetricsRegistry()
  const histogramBuckets = options.histogramBuckets ?? DEFAULT_BUCKETS

  const externalRequestsTotal = registry.counter(
    'external_requests_total',
    'Total external HTTP requests',
    ['service', 'host', 'endpoint', 'method', 'environment', 'region', 'result_code'],
  )
  const externalRequestDuration = registry.histogram(
    'external_request_duration_seconds',
    'External request duration in seconds',
    ['service', 'host', 'endpoint', 'method', 'environment', 'region'],
    histogramBuckets,
  )
  const external429Total = registry.counter(
    'external_429_total',
    'Total external HTTP 429 responses',
    ['service', 'host', 'environment'],
  )
  const external5xxTotal = registry.counter(
    'external_5xx_total',
    'Total external HTTP 5xx responses',
    ['service', 'host', 'environment'],
  )
  const external403Total = registry.counter(
    'external_403_total',
    'Total external HTTP 403 responses',
    ['service', 'host', 'environment'],
  )
  const externalRateLimitRetryAfterSeconds = registry.gauge(
    'external_rate_limit_retry_after_seconds',
    'Retry-After header value in seconds',
    ['service', 'host', 'environment'],
  )
  const externalRateLimitRemaining = registry.gauge(
    'external_rate_limit_remaining',
    'Rate limit remaining from external services',
    ['service', 'host', 'environment'],
  )
  const externalRateLimitResetTs = registry.gauge(
    'external_rate_limit_reset_ts',
    'Rate limit reset timestamp (epoch seconds)',
    ['service', 'host', 'environment'],
  )
  const tokenUsageTotal = registry.counter(
    'token_usage_total',
    'Token usage per service',
    ['service', 'model', 'org', 'environment'],
  )
  const tokensMonthlyQuota = registry.gauge(
    'tokens_monthly_quota',
    'Monthly token quota',
    ['service', 'org', 'environment'],
  )
  const dbConnectionsCurrent = registry.gauge(
    'db_connections_current',
    'Current database connections',
    ['db', 'environment'],
  )
  const dbConnectionsLimit = registry.gauge(
    'db_connections_limit',
    'Database connection limit',
    ['db', 'environment'],
  )
  const cacheHitTotal = registry.counter(
    'cache_hit_total',
    'Cache hits total',
    ['cache_name', 'environment'],
  )
  const cacheMissTotal = registry.counter(
    'cache_miss_total',
    'Cache misses total',
    ['cache_name', 'environment'],
  )
  const queueDepth = registry.gauge(
    'queue_depth',
    'Queue depth',
    ['queue_name', 'environment'],
  )
  const workerCount = registry.gauge(
    'worker_count',
    'Worker count',
    ['queue_name', 'environment'],
  )
  const lastSuccessTimestamp = registry.gauge(
    'last_success_timestamp',
    'Last success timestamp (epoch seconds)',
    ['scraper_domain', 'environment'],
  )
  const scraperDomainConcurrency = registry.gauge(
    'scraper_domain_concurrency',
    'Scraper domain concurrency',
    ['domain', 'environment'],
  )
  const storageEgressBytes = registry.counter(
    'storage_egress_bytes',
    'Storage egress bytes',
    ['bucket', 'environment'],
  )
  const pushFailureTotal = registry.counter(
    'push_failure_total',
    'Push notification failures',
    ['provider', 'environment'],
  )
  const emailSendErrorsTotal = registry.counter(
    'email_send_errors_total',
    'Email send errors',
    ['provider', 'environment'],
  )
  const paymentApiErrorsTotal = registry.counter(
    'payment_api_errors_total',
    'Payment API errors',
    ['provider', 'environment'],
  )
  const githubRateLimitRemaining = registry.gauge(
    'github_rate_limit_remaining',
    'GitHub API rate limit remaining',
    ['repo_owner', 'repo', 'environment'],
  )

  return {
    environment,
    region,
    registry,
    externalRequestsTotal,
    externalRequestDuration,
    external429Total,
    external5xxTotal,
    external403Total,
    externalRateLimitRetryAfterSeconds,
    externalRateLimitRemaining,
    externalRateLimitResetTs,
    tokenUsageTotal,
    tokensMonthlyQuota,
    dbConnectionsCurrent,
    dbConnectionsLimit,
    cacheHitTotal,
    cacheMissTotal,
    queueDepth,
    workerCount,
    lastSuccessTimestamp,
    scraperDomainConcurrency,
    storageEgressBytes,
    pushFailureTotal,
    emailSendErrorsTotal,
    paymentApiErrorsTotal,
    githubRateLimitRemaining,
    metricsText: () => registry.metrics(),
    reset: () => registry.reset(),
  }
}

export interface RateLimitHeaders {
  retryAfterSeconds?: number
  remaining?: number
  resetTs?: number
}

const getHeader = (
  headers: Headers | Record<string, string | number | null | undefined>,
  name: string,
) => {
  if (headers instanceof Headers) {
    return headers.get(name)
  }
  const target = name.toLowerCase()
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target)
  if (!entry) return null
  const value = entry[1]
  if (value === null || value === undefined) return null
  return String(value)
}

const parseNumericHeader = (value: string | null) => {
  if (!value) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Parses common rate-limit headers for remaining, reset, and retry-after values.
 */
export const parseRateLimitHeaders = (
  headers: Headers | Record<string, string | number | null | undefined>,
): RateLimitHeaders => {
  const retryAfterHeader = getHeader(headers, 'retry-after')
  const remainingHeader =
    getHeader(headers, 'x-ratelimit-remaining') ??
    getHeader(headers, 'ratelimit-remaining') ??
    getHeader(headers, 'rateLimit-remaining')
  const resetHeader =
    getHeader(headers, 'x-ratelimit-reset') ??
    getHeader(headers, 'ratelimit-reset') ??
    getHeader(headers, 'rateLimit-reset')

  const retryAfterSeconds = (() => {
    if (!retryAfterHeader) return undefined
    const numeric = Number.parseInt(retryAfterHeader, 10)
    if (!Number.isNaN(numeric)) return numeric
    const parsedDate = Date.parse(retryAfterHeader)
    if (Number.isNaN(parsedDate)) return undefined
    const diffSeconds = Math.max(0, Math.round((parsedDate - Date.now()) / 1000))
    return diffSeconds
  })()

  const remaining = parseNumericHeader(remainingHeader)

  const resetTs = (() => {
    const parsed = parseNumericHeader(resetHeader)
    if (parsed === undefined) return undefined
    if (parsed > 1e12) return Math.round(parsed / 1000)
    if (parsed > 1e9) return Math.round(parsed)
    return Math.round(Date.now() / 1000 + parsed)
  })()

  return { retryAfterSeconds, remaining, resetTs }
}

export interface TokenBucketConfig {
  capacity: number
  refillRatePerSecond: number
}

export class TokenBucket {
  private tokens: number
  private lastRefill: number
  private pending = Promise.resolve()

  constructor(private readonly config: TokenBucketConfig) {
    this.tokens = config.capacity
    this.lastRefill = Date.now()
  }

  async consume(tokens = 1) {
    const next = this.pending.then(() => this.consumeInternal(tokens))
    this.pending = next.catch(() => undefined)
    return next
  }

  private async consumeInternal(tokens: number) {
    let acquired = false
    while (!acquired) {
      this.refill()
      if (this.tokens >= tokens) {
        this.tokens -= tokens
        acquired = true
        return
      }
      const deficit = tokens - this.tokens
      const waitMs = Math.max(50, (deficit / this.config.refillRatePerSecond) * 1000)
      await sleep(waitMs)
    }
  }

  private refill() {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    if (elapsed <= 0) return
    this.tokens = Math.min(this.config.capacity, this.tokens + elapsed * this.config.refillRatePerSecond)
    this.lastRefill = now
  }
}

export interface TelemetryRequestContext {
  service: string
  host: string
  endpoint: string
  method: string
  domain?: string
  queue_name?: string
}

export interface TelemetryHttpClientConfig {
  environment?: string
  region?: string
  metrics?: TelemetryMetrics
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitterRatio?: number
  tokenBuckets?: Record<string, TokenBucketConfig>
  fetchImpl?: typeof fetch
  randomFn?: () => number
}

/**
 * HTTP client wrapper that records Prometheus metrics and applies backoff + throttling.
 */
export class TelemetryHttpClient {
  private readonly metrics: TelemetryMetrics
  private readonly maxRetries: number
  private readonly baseDelayMs: number
  private readonly maxDelayMs: number
  private readonly jitterRatio: number
  private readonly tokenBuckets: Map<string, TokenBucket>
  private readonly fetchImpl: typeof fetch
  private readonly randomFn: () => number

  constructor(private readonly config: TelemetryHttpClientConfig = {}) {
    this.metrics = config.metrics ?? createTelemetryMetrics(config)
    this.maxRetries = config.maxRetries ?? 2
    this.baseDelayMs = config.baseDelayMs ?? 500
    this.maxDelayMs = config.maxDelayMs ?? 10000
    this.jitterRatio = config.jitterRatio ?? 0.2
    this.tokenBuckets = new Map(
      Object.entries(config.tokenBuckets ?? {}).map(([host, bucket]) => [host, new TokenBucket(bucket)]),
    )
    this.fetchImpl = config.fetchImpl ?? fetch
    this.randomFn = config.randomFn ?? Math.random
  }

  async request(url: string, context: TelemetryRequestContext, init: RequestInit = {}) {
    const tokenBucket = this.tokenBuckets.get(context.host)
    if (tokenBucket) {
      await tokenBucket.consume(1)
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const start = Date.now()
      try {
        const response = await this.fetchImpl(url, { ...init, method: context.method })
        const durationSeconds = (Date.now() - start) / 1000
        this.metrics.externalRequestDuration.observe(this.durationLabels(context), durationSeconds)
        this.metrics.externalRequestsTotal.inc(this.requestLabels(context, String(response.status)))
        this.recordStatusMetrics(context, response.status)
        this.recordRateLimitMetrics(context, response.headers)
        if (context.domain && response.ok) {
          this.metrics.lastSuccessTimestamp.set(
            { scraper_domain: context.domain, environment: this.metrics.environment },
            Math.round(Date.now() / 1000),
          )
        }

        if (this.shouldRetry(response.status)) {
          if (attempt < this.maxRetries) {
            const retryAfterSeconds = parseRateLimitHeaders(response.headers).retryAfterSeconds
            await sleep(this.backoffDelayMs(attempt, retryAfterSeconds))
            continue
          }
          throw new Error(
            `TelemetryHttpClient: ${response.status} after ${attempt + 1} attempts`,
          )
        }

        return response
      } catch (error) {
        const durationSeconds = (Date.now() - start) / 1000
        this.metrics.externalRequestDuration.observe(this.durationLabels(context), durationSeconds)
        this.metrics.externalRequestsTotal.inc(this.requestLabels(context, 'error'))
        if (attempt >= this.maxRetries) {
          throw error
        }
        await sleep(this.backoffDelayMs(attempt))
      }
    }

  }

  private shouldRetry(status: number) {
    return status === 429 || status >= 500
  }

  private recordStatusMetrics(context: TelemetryRequestContext, status: number) {
    const labels = {
      service: context.service,
      host: context.host,
      environment: this.metrics.environment,
    }
    if (status === 429) {
      this.metrics.external429Total.inc(labels)
    }
    if (status === 403) {
      this.metrics.external403Total.inc(labels)
    }
    if (status >= 500) {
      this.metrics.external5xxTotal.inc(labels)
    }
  }

  private recordRateLimitMetrics(context: TelemetryRequestContext, headers: Headers) {
    const parsed = parseRateLimitHeaders(headers)
    const labels = {
      service: context.service,
      host: context.host,
      environment: this.metrics.environment,
    }
    if (parsed.retryAfterSeconds !== undefined) {
      this.metrics.externalRateLimitRetryAfterSeconds.set(labels, parsed.retryAfterSeconds)
    }
    if (parsed.remaining !== undefined) {
      this.metrics.externalRateLimitRemaining.set(labels, parsed.remaining)
    }
    if (parsed.resetTs !== undefined) {
      this.metrics.externalRateLimitResetTs.set(labels, parsed.resetTs)
    }
  }

  private requestLabels(context: TelemetryRequestContext, resultCode: string) {
    return {
      service: context.service,
      host: context.host,
      endpoint: context.endpoint,
      method: context.method,
      environment: this.metrics.environment,
      region: this.metrics.region,
      result_code: resultCode,
    }
  }

  private durationLabels(context: TelemetryRequestContext) {
    return {
      service: context.service,
      host: context.host,
      endpoint: context.endpoint,
      method: context.method,
      environment: this.metrics.environment,
      region: this.metrics.region,
    }
  }

  private backoffDelayMs(attempt: number, retryAfterSeconds?: number) {
    if (retryAfterSeconds !== undefined) {
      return retryAfterSeconds * 1000
    }
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** attempt)
    const jitter = exponential * this.jitterRatio * this.randomFn()
    return exponential + jitter
  }
}

export interface MetricsServerOptions {
  port?: number
  host?: string
}

/**
 * Starts a basic HTTP server that serves Prometheus metrics on /metrics.
 */
export const startMetricsServer = (metrics: TelemetryMetrics, options: MetricsServerOptions = {}) => {
  const port = options.port ?? 9464
  const host = options.host ?? '0.0.0.0'
  const server = http.createServer((req, res) => {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' })
      res.end(metrics.metricsText())
      return
    }
    res.writeHead(404)
    res.end('Not found')
  })
  server.listen(port, host)
  return server
}

/**
 * Utility sleep helper for backoff timing.
 */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

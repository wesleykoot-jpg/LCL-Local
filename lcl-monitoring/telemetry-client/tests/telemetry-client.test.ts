import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TelemetryHttpClient,
  createTelemetryMetrics,
  parseRateLimitHeaders,
} from '../src/index'

const createResponse = (status: number, headers: Record<string, string> = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: new Headers(headers),
})

describe('telemetry client', () => {
  it('parses rate limit headers', () => {
    const parsed = parseRateLimitHeaders({
      'Retry-After': '120',
      'X-RateLimit-Remaining': '42',
      'X-RateLimit-Reset': '1700000000',
    })

    expect(parsed.retryAfterSeconds).toBe(120)
    expect(parsed.remaining).toBe(42)
    expect(parsed.resetTs).toBe(1700000000)
  })

  it('records metrics for successful request', async () => {
    const metrics = createTelemetryMetrics({ environment: 'test', region: 'eu' })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createResponse(200, {
          'X-RateLimit-Remaining': '10',
          'X-RateLimit-Reset': '3600',
        }),
      )
    const client = new TelemetryHttpClient({ metrics, fetchImpl: fetchMock })

    await client.request('https://api.openai.com/v1', {
      service: 'openai',
      host: 'api.openai.com',
      endpoint: '/v1',
      method: 'POST',
    })

    expect(
      metrics.externalRequestsTotal.get({
        service: 'openai',
        host: 'api.openai.com',
        endpoint: '/v1',
        method: 'POST',
        environment: 'test',
        region: 'eu',
        result_code: '200',
      }),
    ).toBe(1)
    expect(
      metrics.externalRateLimitRemaining.get({
        service: 'openai',
        host: 'api.openai.com',
        environment: 'test',
      }),
    ).toBe(10)
  })

  describe('backoff behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('retries with retry-after delay', async () => {
      const metrics = createTelemetryMetrics({ environment: 'test', region: 'eu' })
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          createResponse(429, {
            'Retry-After': '2',
          }),
        )
        .mockResolvedValueOnce(createResponse(200))

      const client = new TelemetryHttpClient({
        metrics,
        fetchImpl: fetchMock,
        randomFn: () => 0,
        baseDelayMs: 1000,
      })

      const requestPromise = client.request('https://api.openai.com/v1', {
        service: 'openai',
        host: 'api.openai.com',
        endpoint: '/v1',
        method: 'POST',
      })

      await vi.advanceTimersByTimeAsync(2000)
      await requestPromise

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(
        metrics.external429Total.get({
          service: 'openai',
          host: 'api.openai.com',
          environment: 'test',
        }),
      ).toBe(1)
    })
  })
})

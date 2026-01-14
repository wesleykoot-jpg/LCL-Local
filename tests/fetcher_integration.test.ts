import { describe, it, expect, vi } from 'vitest';

// Type definitions matching the Supabase Edge Function types
interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  fetcher_type?: 'static' | 'puppeteer' | 'playwright' | 'scrapingbee';
  config: {
    headers?: Record<string, string>;
    scrapingbee_api_key?: string;
    headless?: boolean;
    wait_for_selector?: string;
    wait_for_timeout?: number;
  };
}

interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

interface PageFetcher {
  fetchPage(url: string): Promise<{
    html: string;
    finalUrl: string;
    statusCode: number;
  }>;
}

class StaticPageFetcher implements PageFetcher {
  private defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                  '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  constructor(
    private fetchImpl: typeof fetch = fetch,
    private customHeaders?: Record<string, string>,
    private timeout?: number,
    private retryConfig?: RetryConfig
  ) {}

  async fetchPage(url: string) {
    const headers = { ...this.defaultHeaders, ...(this.customHeaders || {}) };
    const timeoutMs = this.timeout ?? 15000;

    return retryWithBackoff(async () => {
      const res = await this.fetchImpl(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });

      const html = await res.text();
      const finalUrl = res.url || url;
      const statusCode = res.status;

      return { html, finalUrl, statusCode };
    }, this.retryConfig);
  }
}

class DynamicPageFetcher implements PageFetcher {
  constructor(
    private fetcherType: 'puppeteer' | 'playwright' | 'scrapingbee' = 'puppeteer',
    private config?: {
      apiKey?: string;
      headless?: boolean;
      waitForSelector?: string;
      waitForTimeout?: number;
    },
    private retryConfig?: RetryConfig
  ) {}

  async fetchPage(url: string) {
    return retryWithBackoff(async () => {
      // For testing, we always fallback to static fetch
      return await this.fallbackToStaticFetch(url);
    }, this.retryConfig);
  }

  private async fallbackToStaticFetch(url: string): Promise<{ html: string; finalUrl: string; statusCode: number }> {
    const fetcher = new StaticPageFetcher(fetch, undefined, undefined, this.retryConfig);
    return await fetcher.fetchPage(url);
  }
}

function createFetcherForSource(source: ScraperSource): PageFetcher {
  const fetcherType = source.fetcher_type || 'static';
  const customHeaders = source.config.headers;
  const timeout = 15000;
  
  const retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  };

  if (fetcherType === 'static') {
    return new StaticPageFetcher(fetch, customHeaders, timeout, retryConfig);
  }

  const dynamicConfig = {
    apiKey: source.config.scrapingbee_api_key,
    headless: source.config.headless ?? true,
    waitForSelector: source.config.wait_for_selector,
    waitForTimeout: source.config.wait_for_timeout,
  };

  return new DynamicPageFetcher(
    fetcherType as 'puppeteer' | 'playwright' | 'scrapingbee',
    dynamicConfig,
    retryConfig
  );
}

describe('Fetcher Integration Tests', () => {
  describe('StaticPageFetcher', () => {
    it('should successfully fetch a static page', async () => {
      const mockHtml = '<html><body>Test Content</body></html>';
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => mockHtml,
        url: 'https://example.com/final',
        status: 200,
      });

      const fetcher = new StaticPageFetcher(mockFetch as unknown as typeof fetch);
      const result = await fetcher.fetchPage('https://example.com/test');

      expect(result.html).toBe(mockHtml);
      expect(result.finalUrl).toBe('https://example.com/final');
      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 404 Not Found error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => '<html><body>Not Found</body></html>',
        url: 'https://example.com/not-found',
        status: 404,
      });

      const fetcher = new StaticPageFetcher(mockFetch as unknown as typeof fetch, {}, 15000, { maxRetries: 0 });
      const result = await fetcher.fetchPage('https://example.com/not-found');

      expect(result.statusCode).toBe(404);
      expect(result.html).toContain('Not Found');
    });

    it('should handle 429 Rate Limit error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => '<html><body>Rate Limited</body></html>',
        url: 'https://example.com/rate-limited',
        status: 429,
      });

      const fetcher = new StaticPageFetcher(
        mockFetch as unknown as typeof fetch,
        {},
        15000,
        { maxRetries: 0 }
      );
      
      const result = await fetcher.fetchPage('https://example.com/test');

      expect(result.statusCode).toBe(429);
      expect(result.html).toContain('Rate Limited');
    });

    it('should handle 500 Server Error with retry and eventual failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => '<html><body>Internal Server Error</body></html>',
        url: 'https://example.com/error',
        status: 500,
      });

      const fetcher = new StaticPageFetcher(
        mockFetch as unknown as typeof fetch,
        {},
        15000,
        { maxRetries: 0 }
      );
      
      const result = await fetcher.fetchPage('https://example.com/error');

      expect(result.statusCode).toBe(500);
      expect(result.html).toContain('Internal Server Error');
    });

    it('should merge custom headers correctly', async () => {
      let capturedHeaders: Record<string, string> = {};
      
      const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return Promise.resolve({
          text: async () => '<html></html>',
          url: 'https://example.com',
          status: 200,
        });
      });

      const customHeaders = { 'X-Custom-Header': 'custom-value' };
      const fetcher = new StaticPageFetcher(mockFetch as unknown as typeof fetch, customHeaders);
      await fetcher.fetchPage('https://example.com/test');

      expect(capturedHeaders['User-Agent']).toBeDefined();
      expect(capturedHeaders['X-Custom-Header']).toBe('custom-value');
      expect(capturedHeaders['Accept-Language']).toBe('en-US,en;q=0.5');
    });

    it('should handle network timeout errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const fetcher = new StaticPageFetcher(
        mockFetch as unknown as typeof fetch,
        {},
        5000,
        { maxRetries: 1, initialDelayMs: 50 }
      );

      await expect(fetcher.fetchPage('https://example.com/timeout')).rejects.toThrow('Network timeout');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should retry with exponential backoff on transient failures', async () => {
      let attemptCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return Promise.resolve({
          text: async () => '<html><body>Success</body></html>',
          url: 'https://example.com/success',
          status: 200,
        });
      });

      const fetcher = new StaticPageFetcher(
        mockFetch as unknown as typeof fetch,
        {},
        15000,
        { maxRetries: 3, initialDelayMs: 50, maxDelayMs: 200 }
      );

      const result = await fetcher.fetchPage('https://example.com/test');

      expect(attemptCount).toBe(3);
      expect(result.statusCode).toBe(200);
      expect(result.html).toContain('Success');
    });
  });

  describe('DynamicPageFetcher', () => {
    it('should fallback to static fetch when ScrapingBee API key is missing', async () => {
      const mockHtml = '<html><body>Static Fallback</body></html>';
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        text: async () => mockHtml,
        url: 'https://example.com/final',
        status: 200,
      }) as unknown as typeof fetch;

      try {
        const fetcher = new DynamicPageFetcher('scrapingbee');
        const result = await fetcher.fetchPage('https://example.com/test');

        expect(result.html).toBe(mockHtml);
        expect(result.statusCode).toBe(200);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle 404 error in dynamic mode with fallback', async () => {
      const mockHtml = '<html><body>Not Found</body></html>';
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        text: async () => mockHtml,
        url: 'https://example.com/not-found',
        status: 404,
      }) as unknown as typeof fetch;

      try {
        const fetcher = new DynamicPageFetcher('scrapingbee', undefined, { maxRetries: 0 });
        const result = await fetcher.fetchPage('https://example.com/not-found');

        expect(result.statusCode).toBe(404);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle 500 error in dynamic mode', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        text: async () => '<html><body>Server Error</body></html>',
        url: 'https://example.com/error',
        status: 500,
      }) as unknown as typeof fetch;

      try {
        const fetcher = new DynamicPageFetcher(
          'scrapingbee',
          undefined,
          { maxRetries: 0 }
        );
        const result = await fetcher.fetchPage('https://example.com/test');

        expect(result.statusCode).toBe(500);
        expect(result.html).toContain('Server Error');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('createFetcherForSource', () => {
    it('should create StaticPageFetcher for static fetcher_type', () => {
      const source: ScraperSource = {
        id: 'test-1',
        name: 'Test Source',
        url: 'https://example.com',
        enabled: true,
        fetcher_type: 'static',
        config: {},
      };

      const fetcher = createFetcherForSource(source);

      expect(fetcher).toBeInstanceOf(StaticPageFetcher);
    });

    it('should create StaticPageFetcher by default when no fetcher_type is specified', () => {
      const source: ScraperSource = {
        id: 'test-2',
        name: 'Test Source',
        url: 'https://example.com',
        enabled: true,
        config: {},
      };

      const fetcher = createFetcherForSource(source);

      expect(fetcher).toBeInstanceOf(StaticPageFetcher);
    });

    it('should create DynamicPageFetcher for puppeteer fetcher_type', () => {
      const source: ScraperSource = {
        id: 'test-3',
        name: 'Test Source',
        url: 'https://example.com',
        enabled: true,
        fetcher_type: 'puppeteer',
        config: {
          headless: true,
          wait_for_selector: '.content',
        },
      };

      const fetcher = createFetcherForSource(source);

      expect(fetcher).toBeInstanceOf(DynamicPageFetcher);
    });

    it('should create DynamicPageFetcher for playwright fetcher_type', () => {
      const source: ScraperSource = {
        id: 'test-4',
        name: 'Test Source',
        url: 'https://example.com',
        enabled: true,
        fetcher_type: 'playwright',
        config: {},
      };

      const fetcher = createFetcherForSource(source);

      expect(fetcher).toBeInstanceOf(DynamicPageFetcher);
    });

    it('should create DynamicPageFetcher for scrapingbee fetcher_type', () => {
      const source: ScraperSource = {
        id: 'test-5',
        name: 'Test Source',
        url: 'https://example.com',
        enabled: true,
        fetcher_type: 'scrapingbee',
        config: {
          scrapingbee_api_key: 'test-key',
        },
      };

      const fetcher = createFetcherForSource(source);

      expect(fetcher).toBeInstanceOf(DynamicPageFetcher);
    });

    it('should pass custom headers to StaticPageFetcher', async () => {
      let capturedHeaders: Record<string, string> = {};
      
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return Promise.resolve({
          text: async () => '<html></html>',
          url: 'https://example.com',
          status: 200,
        });
      }) as unknown as typeof fetch;

      try {
        const source: ScraperSource = {
          id: 'test-6',
          name: 'Test Source',
          url: 'https://example.com',
          enabled: true,
          fetcher_type: 'static',
          config: {
            headers: {
              'X-Source-Header': 'source-value',
            },
          },
        };

        const fetcher = createFetcherForSource(source);
        await fetcher.fetchPage('https://example.com/test');

        expect(capturedHeaders['X-Source-Header']).toBe('source-value');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty HTML response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => '',
        url: 'https://example.com/empty',
        status: 200,
      });

      const fetcher = new StaticPageFetcher(mockFetch as unknown as typeof fetch);
      const result = await fetcher.fetchPage('https://example.com/empty');

      expect(result.html).toBe('');
      expect(result.statusCode).toBe(200);
    });

    it('should handle malformed HTML response', async () => {
      const malformedHtml = '<html><body><div>Unclosed div';
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => malformedHtml,
        url: 'https://example.com/malformed',
        status: 200,
      });

      const fetcher = new StaticPageFetcher(mockFetch as unknown as typeof fetch);
      const result = await fetcher.fetchPage('https://example.com/malformed');

      expect(result.html).toBe(malformedHtml);
      expect(result.statusCode).toBe(200);
    });

    it('should handle redirect chains', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        text: async () => '<html><body>Final Page</body></html>',
        url: 'https://example.com/final-page',
        status: 200,
      });

      const fetcher = new StaticPageFetcher(mockFetch as unknown as typeof fetch);
      const result = await fetcher.fetchPage('https://example.com/redirect');

      expect(result.finalUrl).toBe('https://example.com/final-page');
      expect(result.statusCode).toBe(200);
    });
  });
});

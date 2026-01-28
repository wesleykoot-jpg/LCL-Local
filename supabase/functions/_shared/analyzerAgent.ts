/**
 * Analyzer Agent - Fetcher Type Routing Intelligence
 * 
 * AI Injection Point: "The Analyzer"
 * 
 * Determines optimal fetcher type for each source based on:
 * 1. HTML analysis for JS-heavy indicators
 * 2. CMS fingerprinting
 * 3. Historical success rates
 * 4. Response patterns
 * 
 * Fetcher Types:
 * - static: Simple HTTP fetch (cheapest, fastest)
 * - puppeteer: Headless browser (handles JS-rendered content)
 * - playwright: Full browser automation (handles complex SPAs)
 * - scrapingbee: Proxy service (handles anti-bot protection)
 * 
 * @module _shared/analyzerAgent
 */

// ============================================================================
// TYPES
// ============================================================================

export type FetcherType = 'static' | 'puppeteer' | 'playwright' | 'scrapingbee';

export interface AnalyzerResult {
  recommended_fetcher: FetcherType;
  confidence: number;
  signals: AnalyzerSignal[];
  reasoning: string;
  should_upgrade: boolean;
  should_downgrade: boolean;
}

export interface AnalyzerSignal {
  type: string;
  weight: number;
  detail: string;
}

export interface SourceHistory {
  fetcher_type: FetcherType;
  success_rate: number;
  avg_events_found: number;
  consecutive_failures: number;
  last_success_at: string | null;
}

// ============================================================================
// SIGNAL WEIGHTS
// ============================================================================

const SIGNALS = {
  // Strong JS-heavy indicators (require browser)
  REACT_ROOT: { weight: 0.9, requires: 'puppeteer' as FetcherType },
  VUE_APP: { weight: 0.9, requires: 'puppeteer' as FetcherType },
  ANGULAR_APP: { weight: 0.9, requires: 'puppeteer' as FetcherType },
  SVELTE_APP: { weight: 0.85, requires: 'puppeteer' as FetcherType },
  NEXT_DATA: { weight: 0.7, requires: 'puppeteer' as FetcherType },
  NUXT_DATA: { weight: 0.7, requires: 'puppeteer' as FetcherType },
  LAZY_LOADING: { weight: 0.6, requires: 'puppeteer' as FetcherType },
  INFINITE_SCROLL: { weight: 0.7, requires: 'puppeteer' as FetcherType },
  CLIENT_ROUTER: { weight: 0.8, requires: 'puppeteer' as FetcherType },
  
  // Anti-bot indicators (require proxy)
  CLOUDFLARE: { weight: 0.95, requires: 'scrapingbee' as FetcherType },
  RECAPTCHA: { weight: 0.9, requires: 'scrapingbee' as FetcherType },
  BOT_DETECTION: { weight: 0.85, requires: 'scrapingbee' as FetcherType },
  
  // Static-friendly indicators (prefer static)
  JSON_LD: { weight: -0.5, requires: 'static' as FetcherType },
  RSS_FEED: { weight: -0.6, requires: 'static' as FetcherType },
  SERVER_RENDERED: { weight: -0.4, requires: 'static' as FetcherType },
  WORDPRESS: { weight: -0.3, requires: 'static' as FetcherType },
  
  // Failure patterns
  CONSECUTIVE_FAILURES: { weight: 0.3, requires: 'puppeteer' as FetcherType },
  EMPTY_BODY: { weight: 0.5, requires: 'puppeteer' as FetcherType },
  REDIRECT_LOOP: { weight: 0.4, requires: 'scrapingbee' as FetcherType }
};

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze HTML and history to recommend optimal fetcher type
 */
export function analyzeSource(
  html: string,
  history?: SourceHistory
): AnalyzerResult {
  const signals: AnalyzerSignal[] = [];
  
  // Analyze HTML for JS framework indicators
  analyzeJsFrameworks(html, signals);
  
  // Analyze for anti-bot protection
  analyzeAntiBotProtection(html, signals);
  
  // Analyze for static-friendly patterns
  analyzeStaticPatterns(html, signals);
  
  // Analyze response quality
  analyzeResponseQuality(html, signals);
  
  // Factor in historical performance
  if (history) {
    analyzeHistory(history, signals);
  }
  
  // Calculate recommendation
  const result = calculateRecommendation(signals, history);
  
  return result;
}

// ============================================================================
// HTML ANALYSIS FUNCTIONS
// ============================================================================

function analyzeJsFrameworks(html: string, signals: AnalyzerSignal[]): void {
  // React indicators
  if (html.includes('id="root"') || html.includes('id="__next"') || 
      html.includes('data-reactroot') || html.includes('__REACT_ROOT__')) {
    signals.push({
      type: 'REACT_ROOT',
      weight: SIGNALS.REACT_ROOT.weight,
      detail: 'React application detected'
    });
  }
  
  // Next.js specific
  if (html.includes('__NEXT_DATA__')) {
    signals.push({
      type: 'NEXT_DATA',
      weight: SIGNALS.NEXT_DATA.weight,
      detail: 'Next.js hydration data present'
    });
  }
  
  // Vue indicators
  if (html.includes('id="app"') && html.includes('v-')) {
    signals.push({
      type: 'VUE_APP',
      weight: SIGNALS.VUE_APP.weight,
      detail: 'Vue.js application detected'
    });
  }
  
  // Nuxt.js
  if (html.includes('__NUXT__')) {
    signals.push({
      type: 'NUXT_DATA',
      weight: SIGNALS.NUXT_DATA.weight,
      detail: 'Nuxt.js hydration data present'
    });
  }
  
  // Angular indicators
  if (html.includes('ng-app') || html.includes('ng-version') ||
      html.includes('_ngcontent')) {
    signals.push({
      type: 'ANGULAR_APP',
      weight: SIGNALS.ANGULAR_APP.weight,
      detail: 'Angular application detected'
    });
  }
  
  // Svelte
  if (html.includes('svelte-') || html.includes('__svelte')) {
    signals.push({
      type: 'SVELTE_APP',
      weight: SIGNALS.SVELTE_APP.weight,
      detail: 'Svelte application detected'
    });
  }
  
  // Lazy loading patterns
  if (html.includes('data-src=') || html.includes('lazyload') ||
      html.includes('loading="lazy"')) {
    signals.push({
      type: 'LAZY_LOADING',
      weight: SIGNALS.LAZY_LOADING.weight,
      detail: 'Lazy loading detected'
    });
  }
  
  // Infinite scroll
  if (html.includes('infinite-scroll') || html.includes('loadMore') ||
      html.includes('load-more')) {
    signals.push({
      type: 'INFINITE_SCROLL',
      weight: SIGNALS.INFINITE_SCROLL.weight,
      detail: 'Infinite scroll pattern detected'
    });
  }
  
  // Client-side routing
  if (html.includes('pushState') || html.includes('replaceState') ||
      html.includes('history.push')) {
    signals.push({
      type: 'CLIENT_ROUTER',
      weight: SIGNALS.CLIENT_ROUTER.weight,
      detail: 'Client-side routing detected'
    });
  }
}

function analyzeAntiBotProtection(html: string, signals: AnalyzerSignal[]): void {
  // Cloudflare
  if (html.includes('cf-browser-verification') || 
      html.includes('cloudflare') ||
      html.includes('cf-ray')) {
    signals.push({
      type: 'CLOUDFLARE',
      weight: SIGNALS.CLOUDFLARE.weight,
      detail: 'Cloudflare protection detected'
    });
  }
  
  // reCAPTCHA
  if (html.includes('recaptcha') || html.includes('grecaptcha')) {
    signals.push({
      type: 'RECAPTCHA',
      weight: SIGNALS.RECAPTCHA.weight,
      detail: 'reCAPTCHA challenge detected'
    });
  }
  
  // Generic bot detection
  if (html.includes('bot-detect') || html.includes('are you human') ||
      html.includes('verify you are not a robot')) {
    signals.push({
      type: 'BOT_DETECTION',
      weight: SIGNALS.BOT_DETECTION.weight,
      detail: 'Bot detection mechanism found'
    });
  }
}

function analyzeStaticPatterns(html: string, signals: AnalyzerSignal[]): void {
  // JSON-LD structured data
  if (html.includes('application/ld+json')) {
    signals.push({
      type: 'JSON_LD',
      weight: SIGNALS.JSON_LD.weight,
      detail: 'JSON-LD structured data present (static-friendly)'
    });
  }
  
  // RSS/Atom feed links
  if (html.includes('application/rss+xml') || html.includes('application/atom+xml')) {
    signals.push({
      type: 'RSS_FEED',
      weight: SIGNALS.RSS_FEED.weight,
      detail: 'RSS/Atom feed available (static-friendly)'
    });
  }
  
  // Server-rendered content markers
  if (html.includes('<!--') && html.length > 5000) {
    // HTML comments usually indicate server-rendered templates
    const commentCount = (html.match(/<!--/g) || []).length;
    if (commentCount > 3) {
      signals.push({
        type: 'SERVER_RENDERED',
        weight: SIGNALS.SERVER_RENDERED.weight,
        detail: 'Server-rendered template markers found'
      });
    }
  }
  
  // WordPress indicators
  if (html.includes('wp-content') || html.includes('wordpress')) {
    signals.push({
      type: 'WORDPRESS',
      weight: SIGNALS.WORDPRESS.weight,
      detail: 'WordPress CMS detected (static-friendly)'
    });
  }
}

function analyzeResponseQuality(html: string, signals: AnalyzerSignal[]): void {
  // Empty or minimal body
  if (html.length < 1000) {
    signals.push({
      type: 'EMPTY_BODY',
      weight: SIGNALS.EMPTY_BODY.weight,
      detail: `Very short response (${html.length} chars) - likely JS-rendered`
    });
  }
  
  // Only contains shell/skeleton
  const textContent = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (textContent.length < 200 && html.length > 1000) {
    signals.push({
      type: 'EMPTY_BODY',
      weight: SIGNALS.EMPTY_BODY.weight,
      detail: 'HTML shell with no meaningful text content'
    });
  }
}

function analyzeHistory(history: SourceHistory, signals: AnalyzerSignal[]): void {
  // Consecutive failures suggest need to upgrade
  if (history.consecutive_failures >= 3) {
    signals.push({
      type: 'CONSECUTIVE_FAILURES',
      weight: SIGNALS.CONSECUTIVE_FAILURES.weight * history.consecutive_failures,
      detail: `${history.consecutive_failures} consecutive failures`
    });
  }
  
  // Low success rate
  if (history.success_rate < 0.5 && history.avg_events_found > 0) {
    signals.push({
      type: 'CONSECUTIVE_FAILURES',
      weight: 0.4,
      detail: `Low success rate: ${(history.success_rate * 100).toFixed(0)}%`
    });
  }
}

// ============================================================================
// RECOMMENDATION CALCULATION
// ============================================================================

function calculateRecommendation(
  signals: AnalyzerSignal[],
  history?: SourceHistory
): AnalyzerResult {
  // Calculate weighted scores per fetcher type
  const scores: Record<FetcherType, number> = {
    static: 0,
    puppeteer: 0,
    playwright: 0,
    scrapingbee: 0
  };
  
  // Base preference for cheaper options
  scores.static = 0.3;
  scores.puppeteer = 0.1;
  scores.playwright = 0.05;
  scores.scrapingbee = 0;
  
  // Apply signal weights
  for (const signal of signals) {
    const signalDef = SIGNALS[signal.type as keyof typeof SIGNALS];
    if (signalDef) {
      if (signal.weight > 0) {
        scores[signalDef.requires] += signal.weight;
      } else {
        // Negative weight means this signal favors static
        scores.static += Math.abs(signal.weight);
      }
    }
  }
  
  // Find highest scoring fetcher
  let recommended: FetcherType = 'static';
  let highestScore = scores.static;
  
  for (const [fetcher, score] of Object.entries(scores)) {
    if (score > highestScore) {
      highestScore = score;
      recommended = fetcher as FetcherType;
    }
  }
  
  // Determine confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? highestScore / totalScore : 0.5;
  
  // Determine if upgrade/downgrade is needed
  const currentFetcher = history?.fetcher_type || 'static';
  const fetcherRank: Record<FetcherType, number> = {
    static: 0,
    puppeteer: 1,
    playwright: 2,
    scrapingbee: 3
  };
  
  const should_upgrade = fetcherRank[recommended] > fetcherRank[currentFetcher];
  const should_downgrade = fetcherRank[recommended] < fetcherRank[currentFetcher] && 
                           confidence > 0.7;
  
  // Build reasoning
  const topSignals = signals
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 3)
    .map(s => s.detail);
  
  const reasoning = topSignals.length > 0 
    ? `Based on: ${topSignals.join('; ')}`
    : 'No strong signals detected, defaulting to static fetch';
  
  return {
    recommended_fetcher: recommended,
    confidence,
    signals,
    reasoning,
    should_upgrade,
    should_downgrade
  };
}

// ============================================================================
// QUICK CHECKS
// ============================================================================

/**
 * Quick check if HTML suggests JS-heavy content
 */
export function isJsHeavy(html: string): boolean {
  const signals: AnalyzerSignal[] = [];
  analyzeJsFrameworks(html, signals);
  analyzeResponseQuality(html, signals);
  
  const jsScore = signals.reduce((sum, s) => sum + (s.weight > 0 ? s.weight : 0), 0);
  return jsScore > 0.5;
}

/**
 * Quick check if source needs anti-bot handling
 */
export function needsAntiBot(html: string): boolean {
  const signals: AnalyzerSignal[] = [];
  analyzeAntiBotProtection(html, signals);
  return signals.length > 0;
}

/**
 * Check if static fetch is sufficient
 */
export function canUseStatic(html: string): boolean {
  const result = analyzeSource(html);
  return result.recommended_fetcher === 'static' && result.confidence > 0.6;
}

// ============================================================================
// FETCHER TYPE HELPERS
// ============================================================================

/** Order of fetcher types from cheapest to most expensive */
export const FETCHER_COST_ORDER: FetcherType[] = [
  'static',
  'puppeteer',
  'playwright',
  'scrapingbee'
];

/**
 * Get the next more capable fetcher
 */
export function upgradeFetcher(current: FetcherType): FetcherType {
  const idx = FETCHER_COST_ORDER.indexOf(current);
  if (idx < FETCHER_COST_ORDER.length - 1) {
    return FETCHER_COST_ORDER[idx + 1];
  }
  return current;
}

/**
 * Get the next cheaper fetcher
 */
export function downgradeFetcher(current: FetcherType): FetcherType {
  const idx = FETCHER_COST_ORDER.indexOf(current);
  if (idx > 0) {
    return FETCHER_COST_ORDER[idx - 1];
  }
  return current;
}

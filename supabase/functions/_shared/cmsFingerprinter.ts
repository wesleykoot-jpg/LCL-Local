/**
 * CMS Fingerprinter - Detects CMS/Framework and applies optimal extraction presets
 * 
 * Part of the Data-First Event Pipeline. Performs lightweight fingerprinting
 * to determine the best extraction strategy before scraping.
 * 
 * @module _shared/cmsFingerprinter
 */

// ============================================================================
// CMS/FRAMEWORK TYPES
// ============================================================================

export type CMSType = 
  | 'wordpress' 
  | 'wix' 
  | 'squarespace' 
  | 'next.js' 
  | 'nuxt' 
  | 'react' 
  | 'drupal' 
  | 'joomla'
  | 'shopify'
  | 'webflow'
  | 'unknown';

export type ExtractionPreset = 'hydration' | 'json_ld' | 'feed' | 'dom';

export interface CMSFingerprint {
  /** Detected CMS/framework type */
  cms: CMSType;
  /** Detected version if available */
  version: string | null;
  /** Confidence score 0-100 */
  confidence: number;
  /** Recommended extraction priority order */
  recommendedStrategies: ExtractionPreset[];
  /** Whether JS rendering is likely required */
  requiresJsRender: boolean;
  /** Detected data sources present in HTML */
  detectedDataSources: {
    hasHydrationData: boolean;
    hasJsonLd: boolean;
    hasRssFeed: boolean;
    hasIcsFeed: boolean;
    hasMicrodata: boolean;
  };
  /** Debug information */
  signals: string[];
}

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

const CMS_PATTERNS: Record<CMSType, {
  patterns: Array<{ regex: RegExp; weight: number; signal: string }>;
  requiresRender: boolean;
  preferredStrategies: ExtractionPreset[];
}> = {
  'next.js': {
    patterns: [
      { regex: /window\.__NEXT_DATA__\s*=/, weight: 95, signal: '__NEXT_DATA__ script found' },
      { regex: /_next\/static/, weight: 80, signal: '_next/static assets' },
      { regex: /<script\s+id="__NEXT_DATA__"/, weight: 95, signal: '__NEXT_DATA__ script tag' },
      { regex: /next\/router/, weight: 70, signal: 'next/router reference' },
      { regex: /"buildId"\s*:\s*"[^"]+"/, weight: 75, signal: 'Next.js buildId' },
    ],
    requiresRender: false, // Data is often in __NEXT_DATA__
    preferredStrategies: ['hydration', 'json_ld', 'dom'],
  },
  'nuxt': {
    patterns: [
      { regex: /window\.__NUXT__\s*=/, weight: 95, signal: '__NUXT__ script found' },
      { regex: /_nuxt\//, weight: 80, signal: '_nuxt/ assets' },
      { regex: /nuxt\.js/, weight: 70, signal: 'nuxt.js reference' },
    ],
    requiresRender: false,
    preferredStrategies: ['hydration', 'json_ld', 'dom'],
  },
  'react': {
    patterns: [
      { regex: /window\.__INITIAL_STATE__\s*=/, weight: 90, signal: '__INITIAL_STATE__ found' },
      { regex: /window\.__PRELOADED_STATE__\s*=/, weight: 90, signal: '__PRELOADED_STATE__ found' },
      { regex: /window\.__APP_DATA__\s*=/, weight: 85, signal: '__APP_DATA__ found' },
      { regex: /data-reactroot/, weight: 70, signal: 'data-reactroot attribute' },
      { regex: /react\.production\.min\.js/, weight: 65, signal: 'React production bundle' },
      { regex: /__react_/, weight: 60, signal: 'React internal references' },
    ],
    requiresRender: true, // Often needs JS
    preferredStrategies: ['hydration', 'dom'],
  },
  'wix': {
    patterns: [
      { regex: /wix\.com/, weight: 80, signal: 'wix.com domain reference' },
      { regex: /wixstatic\.com/, weight: 90, signal: 'wixstatic.com assets' },
      { regex: /window\.wixBiSession/, weight: 95, signal: 'Wix BI session' },
      { regex: /wix-code-sdk/, weight: 85, signal: 'Wix Code SDK' },
      { regex: /viewer\.wix/, weight: 90, signal: 'Wix Viewer' },
    ],
    requiresRender: false, // Wix often has good hydration data
    preferredStrategies: ['hydration', 'json_ld', 'dom'],
  },
  'squarespace': {
    patterns: [
      { regex: /squarespace\.com/, weight: 85, signal: 'squarespace.com reference' },
      { regex: /static\.squarespace\.com/, weight: 90, signal: 'Squarespace static assets' },
      { regex: /Squarespace\.Constants/, weight: 95, signal: 'Squarespace.Constants' },
      { regex: /sqs-/, weight: 70, signal: 'sqs- class prefix' },
    ],
    requiresRender: false,
    preferredStrategies: ['json_ld', 'hydration', 'dom'],
  },
  'wordpress': {
    patterns: [
      { regex: /<meta\s+name=["']generator["']\s+content=["']WordPress[^"']*["']/, weight: 95, signal: 'WordPress generator meta' },
      { regex: /wp-content\//, weight: 80, signal: 'wp-content/ directory' },
      { regex: /wp-includes\//, weight: 80, signal: 'wp-includes/ directory' },
      { regex: /wp-json\//, weight: 85, signal: 'WP REST API reference' },
      { regex: /\/feed\/?["'\s>]/, weight: 60, signal: 'RSS feed link' },
      { regex: /the-events-calendar/, weight: 75, signal: 'The Events Calendar plugin' },
      { regex: /tribe-events/, weight: 75, signal: 'Tribe Events reference' },
    ],
    requiresRender: false,
    preferredStrategies: ['feed', 'json_ld', 'dom'],
  },
  'drupal': {
    patterns: [
      { regex: /<meta\s+name=["']Generator["']\s+content=["']Drupal[^"']*["']/, weight: 95, signal: 'Drupal generator meta' },
      { regex: /\/sites\/default\/files\//, weight: 75, signal: 'Drupal files path' },
      { regex: /drupal\.js/, weight: 80, signal: 'drupal.js' },
      { regex: /Drupal\.settings/, weight: 90, signal: 'Drupal.settings' },
    ],
    requiresRender: false,
    preferredStrategies: ['json_ld', 'feed', 'dom'],
  },
  'joomla': {
    patterns: [
      { regex: /<meta\s+name=["']generator["']\s+content=["']Joomla[^"']*["']/, weight: 95, signal: 'Joomla generator meta' },
      { regex: /\/media\/jui\//, weight: 80, signal: 'Joomla UI assets' },
      { regex: /\/components\/com_/, weight: 75, signal: 'Joomla component path' },
    ],
    requiresRender: false,
    preferredStrategies: ['json_ld', 'feed', 'dom'],
  },
  'shopify': {
    patterns: [
      { regex: /cdn\.shopify\.com/, weight: 90, signal: 'Shopify CDN' },
      { regex: /Shopify\.theme/, weight: 95, signal: 'Shopify.theme' },
      { regex: /\/\/cdn\.shopify/, weight: 85, signal: 'Shopify CDN reference' },
    ],
    requiresRender: false,
    preferredStrategies: ['json_ld', 'dom'],
  },
  'webflow': {
    patterns: [
      { regex: /webflow\.com/, weight: 80, signal: 'webflow.com reference' },
      { regex: /assets\.website-files\.com/, weight: 90, signal: 'Webflow assets' },
      { regex: /w-webflow-badge/, weight: 85, signal: 'Webflow badge' },
    ],
    requiresRender: false,
    preferredStrategies: ['json_ld', 'dom'],
  },
  'unknown': {
    patterns: [],
    requiresRender: false,
    preferredStrategies: ['json_ld', 'feed', 'dom'],
  },
};

// Version extraction patterns
const VERSION_PATTERNS: Partial<Record<CMSType, RegExp>> = {
  'wordpress': /<meta\s+name=["']generator["']\s+content=["']WordPress\s*([\d.]+)?["']/i,
  'drupal': /<meta\s+name=["']Generator["']\s+content=["']Drupal\s*([\d.]+)?/i,
  'joomla': /<meta\s+name=["']generator["']\s+content=["']Joomla!\s*([\d.]+)?/i,
  'next.js': /"nextVersion"\s*:\s*"([\d.]+)"/,
};

// ============================================================================
// DATA SOURCE DETECTION
// ============================================================================

interface DataSourcePatterns {
  hydration: RegExp[];
  jsonLd: RegExp[];
  rss: RegExp[];
  ics: RegExp[];
  microdata: RegExp[];
}

const DATA_SOURCE_PATTERNS: DataSourcePatterns = {
  hydration: [
    /window\.__NEXT_DATA__/,
    /window\.__NUXT__/,
    /window\.__INITIAL_STATE__/,
    /window\.__PRELOADED_STATE__/,
    /window\.__APP_DATA__/,
    /window\.__REDUX_STATE__/,
    /<script[^>]+type=["']application\/json["'][^>]*>/,
  ],
  jsonLd: [
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>/,
  ],
  rss: [
    /<link[^>]+type=["']application\/rss\+xml["'][^>]*>/,
    /<link[^>]+type=["']application\/atom\+xml["'][^>]*>/,
    /href=["'][^"']*\/feed\/?["']/i,
  ],
  ics: [
    /href=["'][^"']*\.ics["']/i,
    /href=["'][^"']*\.ical["']/i,
    /webcal:\/\//i,
    /\/calendar\.ics/i,
  ],
  microdata: [
    /itemtype=["'][^"']*schema\.org[^"']*Event["']/i,
    /itemscope[^>]+itemtype/,
  ],
};

// ============================================================================
// FINGERPRINTING FUNCTION
// ============================================================================

/**
 * Analyzes HTML content to detect CMS/framework and recommend extraction strategies.
 * 
 * @param html - Raw HTML content to analyze
 * @returns CMSFingerprint with detected CMS, confidence, and recommendations
 */
export function fingerprintCMS(html: string): CMSFingerprint {
  const signals: string[] = [];
  const scores: Partial<Record<CMSType, number>> = {};
  
  // Check each CMS pattern
  for (const [cms, config] of Object.entries(CMS_PATTERNS)) {
    let cmsScore = 0;
    for (const pattern of config.patterns) {
      if (pattern.regex.test(html)) {
        cmsScore += pattern.weight;
        signals.push(`[${cms}] ${pattern.signal}`);
      }
    }
    if (cmsScore > 0) {
      scores[cms as CMSType] = cmsScore;
    }
  }
  
  // Find the best match
  let detectedCMS: CMSType = 'unknown';
  let maxScore = 0;
  
  for (const [cms, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedCMS = cms as CMSType;
    }
  }
  
  // Calculate confidence (normalize to 0-100)
  const confidence = Math.min(100, Math.round(maxScore * 0.5));
  
  // Extract version if possible
  let version: string | null = null;
  const versionPattern = VERSION_PATTERNS[detectedCMS];
  if (versionPattern) {
    const match = html.match(versionPattern);
    if (match && match[1]) {
      version = match[1];
    }
  }
  
  // Detect data sources
  const detectedDataSources = {
    hasHydrationData: DATA_SOURCE_PATTERNS.hydration.some(p => p.test(html)),
    hasJsonLd: DATA_SOURCE_PATTERNS.jsonLd.some(p => p.test(html)),
    hasRssFeed: DATA_SOURCE_PATTERNS.rss.some(p => p.test(html)),
    hasIcsFeed: DATA_SOURCE_PATTERNS.ics.some(p => p.test(html)),
    hasMicrodata: DATA_SOURCE_PATTERNS.microdata.some(p => p.test(html)),
  };
  
  // Build recommended strategies based on detected data sources
  let recommendedStrategies: ExtractionPreset[];
  
  if (detectedCMS !== 'unknown') {
    recommendedStrategies = [...CMS_PATTERNS[detectedCMS].preferredStrategies];
  } else {
    // Build strategy order based on what data sources are available
    recommendedStrategies = [];
    if (detectedDataSources.hasHydrationData) {
      recommendedStrategies.push('hydration');
      signals.push('[auto] Hydration data detected');
    }
    if (detectedDataSources.hasJsonLd || detectedDataSources.hasMicrodata) {
      recommendedStrategies.push('json_ld');
      signals.push('[auto] Structured data (JSON-LD/Microdata) detected');
    }
    if (detectedDataSources.hasRssFeed || detectedDataSources.hasIcsFeed) {
      recommendedStrategies.push('feed');
      signals.push('[auto] Feed (RSS/ICS) detected');
    }
    recommendedStrategies.push('dom'); // Always fallback to DOM
  }
  
  // Remove duplicates while preserving order
  recommendedStrategies = [...new Set(recommendedStrategies)];
  
  // Determine if JS rendering is required
  const requiresJsRender = detectedCMS !== 'unknown' 
    ? CMS_PATTERNS[detectedCMS].requiresRender
    : false;
  
  return {
    cms: detectedCMS,
    version,
    confidence,
    recommendedStrategies,
    requiresJsRender,
    detectedDataSources,
    signals,
  };
}

/**
 * Quick check for hydration data availability without full fingerprinting.
 * Use this for fast checks when you just need to know if hydration is available.
 */
export function hasHydrationData(html: string): boolean {
  return DATA_SOURCE_PATTERNS.hydration.some(p => p.test(html));
}

/**
 * Quick check for JSON-LD availability.
 */
export function hasJsonLd(html: string): boolean {
  return DATA_SOURCE_PATTERNS.jsonLd.some(p => p.test(html));
}

/**
 * Quick check for RSS/Atom feed availability.
 */
export function hasRssFeed(html: string): boolean {
  return DATA_SOURCE_PATTERNS.rss.some(p => p.test(html));
}

/**
 * Quick check for ICS/iCal feed availability.
 */
export function hasIcsFeed(html: string): boolean {
  return DATA_SOURCE_PATTERNS.ics.some(p => p.test(html));
}

/**
 * Gets tier-specific configuration for a source type.
 */
export function getTierConfig(tier: 'aggregator' | 'venue' | 'general'): {
  deepScrapeEnabled: boolean;
  strictness: 'high' | 'medium' | 'low';
  feedGuessing: boolean;
  runFrequencyHours: number;
} {
  switch (tier) {
    case 'aggregator':
      return {
        deepScrapeEnabled: false,  // List view usually has all data
        strictness: 'high',        // Discard partials
        feedGuessing: false,       // Don't guess feeds
        runFrequencyHours: 6,      // Every 6-12 hours
      };
    case 'venue':
      return {
        deepScrapeEnabled: true,   // Must click "Read More" for JSON-LD
        strictness: 'medium',      // Allow implicit location
        feedGuessing: true,        // Try /feed, .ics
        runFrequencyHours: 24,     // Every 24-48 hours
      };
    case 'general':
    default:
      return {
        deepScrapeEnabled: true,   // Standard behavior
        strictness: 'low',         // Quarantine for review
        feedGuessing: false,       // Don't guess
        runFrequencyHours: 168,    // Weekly
      };
  }
}

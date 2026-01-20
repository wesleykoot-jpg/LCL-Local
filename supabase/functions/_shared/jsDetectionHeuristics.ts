/**
 * JavaScript Detection & Auto-Rendering Heuristics
 * 
 * Detects if a page requires JavaScript rendering (Puppeteer/Playwright)
 * based on framework detection and empty body heuristics.
 * 
 * @module _shared/jsDetectionHeuristics
 */

// ============================================================================
// FRAMEWORK DETECTION PATTERNS
// ============================================================================

/**
 * Patterns for detecting JavaScript frameworks that typically require rendering
 */
const JS_FRAMEWORK_PATTERNS = {
  react: [
    /react\.production\.min\.js/i,
    /react\.development\.js/i,
    /react-dom\.production\.min\.js/i,
    /data-reactroot/i,
    /data-reactid/i,
    /__react_/i,
    /window\.__INITIAL_STATE__/,
    /window\.__PRELOADED_STATE__/,
  ],
  vue: [
    /vue\.js/i,
    /vue\.min\.js/i,
    /vue\.runtime/i,
    /nuxt\.js/i,
    /window\.__NUXT__/,
    /_nuxt\//,
    /v-cloak/i,
    /v-if=/i,
    /v-for=/i,
  ],
  angular: [
    /angular\.js/i,
    /angular\.min\.js/i,
    /ng-app=/i,
    /ng-controller=/i,
    /ng-repeat=/i,
    /\[ng-/i,
    /<ng-/i,
  ],
};

/**
 * Event-related keywords that indicate the page might have event content
 */
const EVENT_KEYWORDS = [
  'agenda',
  'evenement',
  'activiteit',
  'programma',
  'kalender',
  'event',
  'concert',
  'festival',
  'voorstelling',
  'wedstrijd',
  'workshop',
];

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

export interface JSDetectionResult {
  /** Whether JavaScript rendering is required */
  requiresRender: boolean;
  /** Recommended fetcher type */
  fetcherType: 'static' | 'puppeteer' | 'playwright';
  /** Detected frameworks */
  detectedFrameworks: string[];
  /** Whether body is mostly empty */
  hasEmptyBody: boolean;
  /** Whether event keywords are present */
  hasEventKeywords: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** Signals explaining the decision */
  signals: string[];
}

/**
 * Detects if a page has scripts with React/Vue/Angular
 */
export function detectJSFrameworks(html: string): {
  frameworks: string[];
  signals: string[];
} {
  const frameworks: string[] = [];
  const signals: string[] = [];

  for (const [framework, patterns] of Object.entries(JS_FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(html)) {
        if (!frameworks.includes(framework)) {
          frameworks.push(framework);
        }
        signals.push(`[${framework}] Detected: ${pattern.source.slice(0, 50)}...`);
      }
    }
  }

  return { frameworks, signals };
}

/**
 * Checks if HTML body is mostly empty but page has event keywords
 */
export function hasEmptyBodyWithEventKeywords(html: string): {
  isEmpty: boolean;
  hasKeywords: boolean;
  bodyTextLength: number;
  signals: string[];
} {
  const signals: string[] = [];

  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    signals.push('No body tag found');
    return { isEmpty: false, hasKeywords: false, bodyTextLength: 0, signals };
  }

  const bodyHtml = bodyMatch[1];

  // Remove script and style tags
  const bodyWithoutScripts = bodyHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Extract text content (remove HTML tags)
  const bodyText = bodyWithoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const bodyTextLength = bodyText.length;
  const isEmpty = bodyTextLength < 500; // Consider body "mostly empty" if < 500 chars

  signals.push(`Body text length: ${bodyTextLength} chars`);
  if (isEmpty) {
    signals.push('Body is mostly empty (< 500 chars)');
  }

  // Check for event keywords in full HTML (not just body)
  const lowerHtml = html.toLowerCase();
  const foundKeywords: string[] = [];
  for (const keyword of EVENT_KEYWORDS) {
    if (lowerHtml.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  const hasKeywords = foundKeywords.length > 0;
  if (hasKeywords) {
    signals.push(`Event keywords found: ${foundKeywords.slice(0, 5).join(', ')}`);
  }

  return {
    isEmpty,
    hasKeywords,
    bodyTextLength,
    signals,
  };
}

/**
 * Main heuristic function: determines if a page requires JavaScript rendering
 * 
 * Logic:
 * - If page has React/Vue/Angular scripts → requires rendering
 * - If HTML body is mostly empty BUT page has event keywords → requires rendering
 * - Otherwise → static fetching is fine
 */
export function detectRenderingRequirements(html: string): JSDetectionResult {
  const signals: string[] = [];
  let requiresRender = false;
  let confidence = 0;

  // Check for JavaScript frameworks
  const { frameworks, signals: frameworkSignals } = detectJSFrameworks(html);
  signals.push(...frameworkSignals);

  if (frameworks.length > 0) {
    requiresRender = true;
    confidence = 85;
    signals.push(`✓ Requires rendering: JavaScript framework detected (${frameworks.join(', ')})`);
  }

  // Check for empty body with event keywords
  const {
    isEmpty,
    hasKeywords,
    bodyTextLength,
    signals: bodySignals,
  } = hasEmptyBodyWithEventKeywords(html);
  signals.push(...bodySignals);

  if (isEmpty && hasKeywords && !requiresRender) {
    requiresRender = true;
    confidence = 75;
    signals.push('✓ Requires rendering: Empty body with event keywords');
  }

  // If both conditions are met, increase confidence
  if (frameworks.length > 0 && isEmpty && hasKeywords) {
    confidence = 95;
  }

  // If no rendering required but we have signals, lower confidence
  if (!requiresRender && bodyTextLength > 0) {
    confidence = 90;
    signals.push('✓ Static fetching sufficient: Body has content');
  }

  // Default confidence if nothing detected
  if (confidence === 0) {
    confidence = 60;
  }

  return {
    requiresRender,
    fetcherType: requiresRender ? 'puppeteer' : 'static',
    detectedFrameworks: frameworks,
    hasEmptyBody: isEmpty,
    hasEventKeywords: hasKeywords,
    confidence,
    signals,
  };
}

/**
 * Quick check: does page likely need rendering?
 */
export function needsRendering(html: string): boolean {
  const { requiresRender } = detectRenderingRequirements(html);
  return requiresRender;
}

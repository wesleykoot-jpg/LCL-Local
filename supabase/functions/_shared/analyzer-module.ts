/**
 * Analyzer Module: AI-driven JS-heavy detection and fetcher strategy selection
 * 
 * This module uses GPT-4o-mini with structured outputs to analyze HTML content
 * and determine the optimal fetching strategy for each source.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types
export interface AnalysisResult {
  isJsHeavy: boolean;
  confidence: number;
  recommendedStrategy: 'static' | 'playwright' | 'browserless' | 'scrapingbee';
  detectedFramework: string | null;
  detectedCms: string | null;
  reasoning: string;
  indicators: JsIndicator[];
}

interface JsIndicator {
  type: 'framework' | 'dynamic_content' | 'lazy_load' | 'spa_marker' | 'hydration';
  selector: string;
  description: string;
}

interface CachedAnalysis {
  result: AnalysisResult;
  htmlHash: string;
  analyzedAt: string;
}

// Framework detection patterns
const FRAMEWORK_PATTERNS: Record<string, RegExp[]> = {
  react: [
    /data-reactroot/i,
    /react-dom/i,
    /__NEXT_DATA__/i,
    /_next\/static/i,
    /react\.production\.min\.js/i,
  ],
  vue: [
    /data-v-[a-f0-9]+/i,
    /vue\.runtime/i,
    /__vue__/i,
    /nuxt/i,
  ],
  angular: [
    /ng-version/i,
    /angular\.js/i,
    /_angular_core/i,
  ],
  svelte: [
    /svelte-[a-z0-9]+/i,
    /__svelte/i,
  ],
};

// CMS detection patterns
const CMS_PATTERNS: Record<string, RegExp[]> = {
  wordpress: [
    /wp-content/i,
    /wp-includes/i,
    /wordpress/i,
  ],
  drupal: [
    /drupal\.js/i,
    /sites\/default\/files/i,
  ],
  ontdek_beleef: [
    /ontdek\./i,
    /beleef\./i,
    /bezoek\./i,
  ],
};

// JS-heavy indicators
const JS_HEAVY_INDICATORS = [
  { pattern: /__NUXT__/, weight: 0.9, type: 'hydration' },
  { pattern: /__NEXT_DATA__/, weight: 0.85, type: 'hydration' },
  { pattern: /window\.__INITIAL_STATE__/, weight: 0.8, type: 'hydration' },
  { pattern: /<div id="app"><\/div>/, weight: 0.7, type: 'spa_marker' },
  { pattern: /<div id="root"><\/div>/, weight: 0.7, type: 'spa_marker' },
  { pattern: /loading="lazy"/, weight: 0.3, type: 'lazy_load' },
  { pattern: /data-src=/, weight: 0.4, type: 'lazy_load' },
  { pattern: /IntersectionObserver/, weight: 0.5, type: 'lazy_load' },
];

/**
 * Quick heuristic analysis of HTML for JS-heavy patterns
 * This is used as a first pass before expensive AI analysis
 */
export function quickAnalyze(html: string): { isLikelyJsHeavy: boolean; score: number; detectedFramework: string | null } {
  let score = 0;
  let detectedFramework: string | null = null;

  // Check for framework patterns
  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(html)) {
        detectedFramework = framework;
        score += 0.3;
        break;
      }
    }
    if (detectedFramework) break;
  }

  // Check JS-heavy indicators
  for (const indicator of JS_HEAVY_INDICATORS) {
    if (indicator.pattern.test(html)) {
      score += indicator.weight;
    }
  }

  // Check for minimal content (likely SPA waiting for JS)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');
    const textContent = bodyContent.replace(/<[^>]+>/g, '').trim();
    if (textContent.length < 100) {
      score += 0.5;
    }
  }

  return {
    isLikelyJsHeavy: score >= 0.6,
    score: Math.min(score, 1),
    detectedFramework,
  };
}

/**
 * Detect CMS from HTML content
 */
export function detectCms(html: string): string | null {
  for (const [cms, patterns] of Object.entries(CMS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(html)) {
        return cms;
      }
    }
  }
  return null;
}

/**
 * Deep AI analysis using GPT-4o-mini with structured outputs
 */
export async function analyzeWithAI(html: string, url: string): Promise<AnalysisResult> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Truncate HTML for API limits
  const truncatedHtml = html.slice(0, 15000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert web scraping analyst. Analyze the HTML to determine if this page requires JavaScript rendering to access its full content, especially event listings.

Consider:
1. Is there hydration data (like __NEXT_DATA__, __NUXT__, __INITIAL_STATE__)?
2. Are there empty container divs waiting for JS to populate?
3. Is the page using a client-side framework (React, Vue, Angular)?
4. Are images/content lazy-loaded?
5. Does the visible text content appear incomplete?

Respond with a JSON object following the exact schema.`
        },
        {
          role: "user",
          content: `Analyze this HTML from ${url}:\n\n${truncatedHtml}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "js_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isJsHeavy: { type: "boolean", description: "Whether page requires JS rendering" },
              confidence: { type: "number", description: "Confidence score 0-1" },
              recommendedStrategy: { 
                type: "string", 
                enum: ["static", "playwright", "browserless", "scrapingbee"],
                description: "Recommended fetching strategy" 
              },
              detectedFramework: { type: ["string", "null"], description: "Detected JS framework" },
              detectedCms: { type: ["string", "null"], description: "Detected CMS" },
              reasoning: { type: "string", description: "Brief explanation" },
              indicators: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["framework", "dynamic_content", "lazy_load", "spa_marker", "hydration"] },
                    selector: { type: "string" },
                    description: { type: "string" }
                  },
                  required: ["type", "selector", "description"],
                  additionalProperties: false
                }
              }
            },
            required: ["isJsHeavy", "confidence", "recommendedStrategy", "detectedFramework", "detectedCms", "reasoning", "indicators"],
            additionalProperties: false
          }
        }
      },
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

/**
 * Full analysis pipeline: quick check + AI if needed
 */
export async function analyzePageStrategy(
  html: string, 
  url: string,
  forceAI: boolean = false
): Promise<AnalysisResult> {
  // Quick heuristic check first
  const quickResult = quickAnalyze(html);
  const detectedCms = detectCms(html);

  // If clearly static (score < 0.3) and not forcing AI, return quick result
  if (!forceAI && quickResult.score < 0.3) {
    return {
      isJsHeavy: false,
      confidence: 1 - quickResult.score,
      recommendedStrategy: 'static',
      detectedFramework: quickResult.detectedFramework,
      detectedCms,
      reasoning: "Quick analysis: no significant JS indicators found",
      indicators: [],
    };
  }

  // If clearly JS-heavy (score > 0.8) and not forcing AI
  if (!forceAI && quickResult.score > 0.8) {
    return {
      isJsHeavy: true,
      confidence: quickResult.score,
      recommendedStrategy: 'browserless',
      detectedFramework: quickResult.detectedFramework,
      detectedCms,
      reasoning: "Quick analysis: strong JS indicators detected",
      indicators: [],
    };
  }

  // Ambiguous cases: use AI analysis
  try {
    return await analyzeWithAI(html, url);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      throw error; // Re-throw for retry queue
    }
    // Fallback to heuristic on AI error
    console.warn(`AI analysis failed, using heuristic: ${error}`);
    return {
      isJsHeavy: quickResult.isLikelyJsHeavy,
      confidence: quickResult.score,
      recommendedStrategy: quickResult.isLikelyJsHeavy ? 'browserless' : 'static',
      detectedFramework: quickResult.detectedFramework,
      detectedCms,
      reasoning: `Heuristic fallback (AI error): score=${quickResult.score.toFixed(2)}`,
      indicators: [],
    };
  }
}

/**
 * Cache analysis result in the database
 */
export async function cacheAnalysisResult(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  result: AnalysisResult,
  htmlHash: string
): Promise<void> {
  await supabase
    .from('scraper_sources')
    .update({
      detected_render_strategy: result.recommendedStrategy,
      detected_cms: result.detectedCms,
      detected_framework_version: result.detectedFramework,
      fetcher_config: {
        ...result,
        htmlHash,
        analyzedAt: new Date().toISOString(),
      },
    })
    .eq('id', sourceId);
}

/**
 * Get cached analysis if HTML hasn't changed
 */
export async function getCachedAnalysis(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  currentHtmlHash: string
): Promise<AnalysisResult | null> {
  const { data } = await supabase
    .from('scraper_sources')
    .select('fetcher_config')
    .eq('id', sourceId)
    .single();

  if (!data?.fetcher_config) return null;

  const cached = data.fetcher_config as CachedAnalysis;
  if (cached.htmlHash !== currentHtmlHash) return null;

  return cached.result;
}

/**
 * Queue an analysis job for later processing (when rate limited)
 */
export async function queueAnalysisJob(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  url: string,
  html: string,
  priority: number = 100
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_job_queue')
    .insert({
      job_type: 'analyze_js_heavy',
      related_id: sourceId,
      payload: { url, html: html.slice(0, 50000) }, // Limit stored HTML
      priority,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

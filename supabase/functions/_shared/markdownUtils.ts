/**
 * Markdown Utilities
 * 
 * Converts HTML to clean Markdown for AI processing.
 * Strips noise while preserving event-relevant content.
 * 
 * @module _shared/markdownUtils
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HtmlToMarkdownOptions {
  /** Base URL for resolving relative links */
  baseUrl?: string;
  /** Maximum output length */
  maxLength?: number;
  /** Preserve links */
  preserveLinks?: boolean;
  /** Preserve images */
  preserveImages?: boolean;
}

// ============================================================================
// MAIN CONVERSION
// ============================================================================

/**
 * Convert HTML to clean Markdown suitable for AI processing
 */
export function htmlToMarkdown(
  html: string,
  options: HtmlToMarkdownOptions = {}
): string {
  const { 
    baseUrl = '', 
    maxLength = 8000, 
    preserveLinks = true,
    preserveImages = false
  } = options;
  
  if (!html) return '';
  
  let text = html;
  
  // Remove scripts and styles
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
  // Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove common noise elements
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  text = text.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '');
  
  // Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');
  
  // Convert paragraphs and line breaks
  text = text.replace(/<p[^>]*>/gi, '\n\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  
  // Convert lists
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  text = text.replace(/<\/li>/gi, '');
  text = text.replace(/<ul[^>]*>/gi, '\n');
  text = text.replace(/<\/ul>/gi, '\n');
  text = text.replace(/<ol[^>]*>/gi, '\n');
  text = text.replace(/<\/ol>/gi, '\n');
  
  // Convert links
  if (preserveLinks) {
    text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
      const resolvedUrl = resolveUrl(href, baseUrl);
      const cleanContent = content.replace(/<[^>]+>/g, '').trim();
      return cleanContent ? `[${cleanContent}](${resolvedUrl})` : '';
    });
  } else {
    text = text.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  }
  
  // Convert images
  if (preserveImages) {
    text = text.replace(/<img[^>]+alt=["']([^"']+)["'][^>]*>/gi, '![Image: $1]');
    text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, '![Image]($1)');
  } else {
    text = text.replace(/<img[^>]*>/gi, '');
  }
  
  // Convert emphasis
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');
  
  // Convert tables to simple format
  text = text.replace(/<table[^>]*>/gi, '\n');
  text = text.replace(/<\/table>/gi, '\n');
  text = text.replace(/<tr[^>]*>/gi, '\n| ');
  text = text.replace(/<\/tr>/gi, ' |');
  text = text.replace(/<t[hd][^>]*>/gi, ' ');
  text = text.replace(/<\/t[hd]>/gi, ' | ');
  
  // Convert divs and spans
  text = text.replace(/<div[^>]*>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<span[^>]*>/gi, '');
  text = text.replace(/<\/span>/gi, '');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = decodeHtmlEntities(text);
  
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single
  text = text.replace(/\n /g, '\n'); // Space after newline
  text = text.replace(/ \n/g, '\n'); // Space before newline
  text = text.trim();
  
  // Truncate if needed
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    // Try to end at sentence boundary
    const lastSentence = text.lastIndexOf('.');
    if (lastSentence > maxLength * 0.8) {
      text = text.slice(0, lastSentence + 1);
    }
    text += '\n\n[Content truncated...]';
  }
  
  return text;
}

// ============================================================================
// HTML ENTITY DECODING
// ============================================================================

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '\u2013',
  '&mdash;': '\u2014',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  '&bull;': '\u2022',
  '&hellip;': '\u2026',
  '&copy;': '\u00A9',
  '&reg;': '\u00AE',
  '&trade;': '\u2122',
  '&euro;': '\u20AC',
  '&pound;': '\u00A3',
  '&yen;': '\u00A5',
  '&cent;': '\u00A2',
  '&deg;': '\u00B0',
  '&plusmn;': '\u00B1',
  '&times;': '\u00D7',
  '&divide;': '\u00F7',
  '&frac12;': '\u00BD',
  '&frac14;': '\u00BC',
  '&frac34;': '¾'
};

function decodeHtmlEntities(text: string): string {
  // Named entities
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.replace(new RegExp(entity, 'g'), char);
  }
  
  // Numeric entities (decimal)
  text = text.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  // Numeric entities (hex)
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
  return text;
}

// ============================================================================
// URL UTILITIES
// ============================================================================

function resolveUrl(href: string, baseUrl: string): string {
  if (!href) return '';
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  if (href.startsWith('//')) {
    return 'https:' + href;
  }
  if (href.startsWith('/')) {
    try {
      const base = new URL(baseUrl);
      return base.origin + href;
    } catch {
      return href;
    }
  }
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

// ============================================================================
// EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract main content area from HTML (for event pages)
 */
export function extractMainContent(html: string): string {
  // Try to find main content areas
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]+class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*event[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>/i
  ];
  
  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match && match[1].length > 200) {
      return match[1];
    }
  }
  
  // Fall back to body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

/**
 * Clean and normalize text for comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Extract text from specific element by class or ID
 */
export function extractBySelector(
  html: string, 
  selector: { class?: string; id?: string; tag?: string }
): string | null {
  let pattern: RegExp;
  
  if (selector.id) {
    pattern = new RegExp(
      `<${selector.tag || '[a-z]+'
      }[^>]+id=["']${selector.id}["'][^>]*>([\\s\\S]*?)<\\/${selector.tag || '[a-z]+'}>`
      , 'i'
    );
  } else if (selector.class) {
    pattern = new RegExp(
      `<${selector.tag || '[a-z]+'
      }[^>]+class=["'][^"']*${selector.class}[^"']*["'][^>]*>([\\s\\S]*?)<\\/${selector.tag || '[a-z]+'}>`
      , 'i'
    );
  } else {
    return null;
  }
  
  const match = html.match(pattern);
  return match ? match[1] : null;
}

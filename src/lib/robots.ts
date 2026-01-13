/**
 * Simple robots.txt parser with caching.
 * Respects crawl-delay and disallow rules.
 */

import robotsParser from 'robots-parser';
import axios from 'axios';
import { DEFAULTS } from '../config/defaults';

interface RobotsCache {
  robots: any;
  fetchedAt: number;
  crawlDelay: number | null;
}

const cache = new Map<string, RobotsCache>();

/**
 * Get robots.txt parser for a domain with caching
 * @param domain Domain to fetch robots.txt for
 * @param userAgent User agent string to check rules against
 * @param ttlMs Cache TTL in milliseconds
 * @returns Robots parser instance and crawl delay
 */
export async function getRobots(
  domain: string,
  userAgent: string,
  ttlMs: number = DEFAULTS.ROBOTS_CACHE_TTL_MS
): Promise<{ robots: any; crawlDelay: number | null }> {
  const robotsUrl = `https://${domain}/robots.txt`;
  
  // Check cache
  const cached = cache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) {
    return { robots: cached.robots, crawlDelay: cached.crawlDelay };
  }

  // Fetch robots.txt
  let robotsTxt = '';
  try {
    const response = await axios.get(robotsUrl, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Accept 404 as empty robots.txt
    });
    
    if (response.status === 200) {
      robotsTxt = response.data;
    }
  } catch (error) {
    // If fetch fails, assume no robots.txt (permissive)
    console.warn(`Failed to fetch robots.txt for ${domain}:`, error instanceof Error ? error.message : 'unknown error');
  }

  // Parse robots.txt
  const robots = robotsParser(robotsUrl, robotsTxt);
  
  // Extract crawl-delay for our user agent
  const crawlDelay = extractCrawlDelay(robotsTxt, userAgent);

  // Cache result
  cache.set(domain, {
    robots,
    crawlDelay,
    fetchedAt: Date.now(),
  });

  return { robots, crawlDelay };
}

/**
 * Extract crawl-delay directive from robots.txt for specific user agent
 * @param robotsTxt Raw robots.txt content
 * @param userAgent User agent to check
 * @returns Crawl delay in seconds, or null if not specified
 */
function extractCrawlDelay(robotsTxt: string, userAgent: string): number | null {
  const lines = robotsTxt.split('\n');
  let currentAgent: string | null = null;
  let inRelevantSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for User-agent directive
    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      currentAgent = trimmed.substring(11).trim().toLowerCase();
      // Match if it's our UA or wildcard
      inRelevantSection = currentAgent === '*' || 
                          userAgent.toLowerCase().includes(currentAgent) ||
                          currentAgent.includes(userAgent.toLowerCase().split('/')[0].toLowerCase());
    }
    
    // Check for Crawl-delay in relevant section
    if (inRelevantSection && trimmed.toLowerCase().startsWith('crawl-delay:')) {
      const delayStr = trimmed.substring(12).trim();
      const delay = parseFloat(delayStr);
      if (!isNaN(delay) && delay > 0) {
        return delay;
      }
    }
    
    // Reset on new user-agent section
    if (trimmed.toLowerCase().startsWith('user-agent:') && !inRelevantSection) {
      currentAgent = null;
    }
  }

  return null;
}

/**
 * Check if a URL is allowed to be crawled
 * @param domain Domain to check
 * @param url Full URL to check
 * @param userAgent User agent string
 * @returns true if allowed, false if disallowed
 */
export async function isAllowed(
  domain: string,
  url: string,
  userAgent: string
): Promise<boolean> {
  try {
    const { robots } = await getRobots(domain, userAgent);
    return robots.isAllowed(url, userAgent);
  } catch (error) {
    // On error, be permissive
    console.warn(`Error checking robots.txt for ${domain}:`, error);
    return true;
  }
}

/**
 * Get the minimum delay required between requests for a domain
 * @param domain Domain to check
 * @param userAgent User agent string
 * @param defaultDelayMs Default delay if no crawl-delay specified
 * @returns Delay in milliseconds
 */
export async function getMinDelay(
  domain: string,
  userAgent: string,
  defaultDelayMs: number = DEFAULTS.BASE_REQUEST_DELAY_MS
): Promise<number> {
  try {
    const { crawlDelay } = await getRobots(domain, userAgent);
    if (crawlDelay !== null) {
      return crawlDelay * 1000; // Convert seconds to ms
    }
  } catch (error) {
    console.warn(`Error getting crawl-delay for ${domain}:`, error);
  }
  
  return defaultDelayMs;
}

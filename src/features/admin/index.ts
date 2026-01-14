// Admin Feature Module - Public API
// Contains scraper administration functionality (dev mode only)

// API / Services
export { 
  getSources, 
  toggleSource, 
  triggerScraper, 
  testSource,
  disableBrokenSources,
  resetSourceHealth,
  type ScraperSource,
  type ScrapeResult,
  type DryRunResult
} from './api/scraperService';

// Pages (for route usage)
export { default as AdminPage } from './Admin';

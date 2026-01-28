// Admin Feature Module - Public API
// LEGACY: Scraper administration disabled - see _legacy_archive/scraping-v1/
// Scraping functionality removed during architecture reboot (2026-01-27)

// API / Services
export { 
  getSources, 
  toggleSource, 
  triggerCoordinator,
  fetchLogs,
  type ScraperSource,
  type LogEntry,
  type LogsResult,
  type CoordinatorResult
} from './api/scraperService';

// Pages (for route usage)
export { default as AdminPage } from './Admin';

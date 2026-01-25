// Admin Feature Module - Public API
// Contains scraper administration functionality (dev mode only)

// API / Services
export { 
  getSources, 
  toggleSource, 
  triggerCoordinator,
  triggerWorker,
  fetchLogs,
  type ScraperSource,
  type LogEntry,
  type LogsResult,
  type CoordinatorResult
} from './api/scraperService';

// Pages (for route usage)
export { default as AdminPage } from './Admin';

# Scraper Pipeline Control - Implementation Guide

## Overview

The **Scraper Pipeline Control** section is a comprehensive admin interface for manually triggering and troubleshooting the scraper pipeline. It provides operators with direct control over the scraping process with multiple manual triggers and bulk operations.

## Location

The Pipeline Control section is located at `/admin` route, positioned prominently at the top of the admin page (right after the header, before Automation & Scheduling).

## Features

### 1. Source Selection Controls

Quick selection buttons for bulk operations:
- **Select All / Deselect All** - Toggle selection of all sources
- **Enabled (N)** - Select only enabled sources
- **Broken (N)** - Select only sources with error health status

Users can also manually check/uncheck individual sources in the source list below.

### 2. Pipeline Trigger Cards

Four main operation cards arranged in a 2x2 grid (responsive):

#### A. Run Selected Sources
- **Purpose**: Execute scraper immediately for selected sources
- **Behavior**: Bypasses queue, runs synchronously via `scrape-events` edge function
- **Use Case**: When you need immediate results for specific sources
- **Button**: Primary blue "Run N Source(s)" button
- **Disabled**: When no sources selected or operation in progress

#### B. Queue Selected Sources
- **Purpose**: Add selected sources to the scrape job queue
- **Behavior**: Creates pending jobs in `scrape_jobs` table for async processing
- **Use Case**: When you want to schedule sources for background processing
- **Button**: Outline "Queue N Source(s)" button
- **Disabled**: When no sources selected or operation in progress
- **Post-action**: Clears selection after successful queueing

#### C. Trigger run-scraper
- **Purpose**: Execute the `run-scraper` edge function
- **Behavior**: Runs all enabled sources through the run-scraper function
- **Use Case**: When you want to use the alternative scraper implementation
- **Button**: Outline "Trigger run-scraper" button
- **Icon**: Purple server icon

#### D. Retry Failed Jobs
- **Purpose**: Reset failed jobs to pending status
- **Behavior**: 
  - Finds all jobs with status='failed' and attempts < 3
  - Resets status to 'pending' and clears error_message
  - Jobs will be picked up by the scrape-worker on next poll
- **Use Case**: After fixing source issues or transient failures
- **Button**: Outline "Retry N Failed Job(s)" button
- **Icon**: Amber rotate icon
- **Disabled**: When no failed jobs exist or operation in progress

### 3. Pipeline Status Indicators

Four status cards showing real-time counts:
- **Selected**: Number of currently selected sources (blue)
- **Enabled**: Number of enabled, non-auto-disabled sources (green)
- **Warning**: Number of sources with warning health status (amber)
- **Broken**: Number of sources with error health status (red)

## API Functions

### New Functions in `scraperService.ts`

```typescript
// Trigger run-scraper edge function
triggerRunScraper(sourceIds?: string[]): Promise<ScrapeResult>

// Trigger scrape-worker for specific source
triggerScrapeWorker(sourceId: string): Promise<ScrapeResult>

// Retry all failed jobs with attempts < 3
retryFailedJobs(): Promise<{ success: boolean; retriedCount: number; error?: string }>

// Queue specific sources for scraping
queueSourcesForScraping(sourceIds: string[]): Promise<{ success: boolean; jobsCreated: number; error?: string }>

// Trigger scrape for selected sources (bypasses queue)
triggerSelectedSources(sourceIds: string[]): Promise<ScrapeResult>

// Get detailed job information (prepared for future use)
getJobDetails(jobId: string): Promise<JobDetails>
```

## User Workflows

### Workflow 1: Run a Specific Source Immediately

1. Navigate to `/admin`
2. Scroll to source list
3. Check the checkbox next to the desired source
4. Click "Run 1 Source" in the "Run Selected Sources" card
5. Wait for toast notification with results
6. View detailed results in the expandable results panel at bottom

### Workflow 2: Queue Multiple Sources for Background Processing

1. Navigate to `/admin`
2. Click "Enabled (N)" quick select button to select all enabled sources
3. Click "Queue N Sources" in the "Queue Selected Sources" card
4. Toast notification confirms jobs created
5. Monitor progress in the "Scrape Job Queue" section below
6. Selection is automatically cleared after successful queueing

### Workflow 3: Recover from Failed Jobs

1. Navigate to `/admin`
2. Check the "Scrape Job Queue" section for failed jobs
3. Click "Retry N Failed Jobs" in the "Retry Failed Jobs" card
4. Toast notification confirms jobs reset to pending
5. Jobs will be automatically picked up by scrape-worker
6. Monitor progress in the job queue

### Workflow 4: Run All Sources Through run-scraper Function

1. Navigate to `/admin`
2. Click "Trigger run-scraper" in the "Trigger run-scraper" card
3. All enabled sources will be scraped via run-scraper edge function
4. View results in the expandable panel at bottom

### Workflow 5: Test Broken Sources

1. Navigate to `/admin`
2. Click "Broken (N)" quick select button
3. Click "Run N Sources" to test all broken sources
4. Review results and errors
5. Fix source configurations or URLs as needed
6. Use "Reset Health" button on individual sources if issues resolved

## Visual Design

### Color Scheme
- **Pipeline Control Section**: Gradient background (blue → purple → pink)
- **Selection Controls**: Light background with border
- **Trigger Cards**: Semi-transparent background, distinct colored icons
  - Run Selected: Primary blue icon
  - Queue Selected: Blue icon
  - Run-scraper: Purple icon
  - Retry Failed: Amber icon
- **Status Indicators**: Color-coded by status type

### Layout
- **Responsive**: 2-column grid on desktop, stacks on mobile
- **Spacing**: Consistent padding and gaps for visual hierarchy
- **Typography**: Clear labels with descriptive subtitles
- **Icons**: Lucide React icons for visual clarity

## Technical Implementation

### State Management

```typescript
// Pipeline loading states (prevents double-clicks)
const [pipelineLoading, setPipelineLoading] = useState<Record<string, boolean>>({
  runScraper: false,
  scrapeWorker: false,
  selectedSources: false,
  queueSources: false,
  retryFailed: false,
});

// Selected sources (Set for O(1) operations)
const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
```

### Error Handling

All operations include:
- Try-catch blocks with detailed error messages
- Toast notifications for success/error/info states
- Loading state cleanup in finally blocks
- Validation before API calls (e.g., no sources selected)

### Loading States

All buttons show loading states:
- Disabled during operation
- Spinner icon replaces main icon
- Text changes to "Running..." / "Queueing..." / "Retrying..."

### Data Refresh

After operations complete successfully:
- `loadSources()` - Refresh source list and stats
- `loadJobs()` - Refresh job queue and stats
- Results panel shows detailed breakdown

## Integration Points

### Edge Functions
- `scrape-events` - Main scraper function
- `run-scraper` - Alternative scraper implementation
- `scrape-worker` - Individual source processor

### Database Tables
- `scraper_sources` - Source configurations and health
- `scrape_jobs` - Job queue for async processing
- `events` - Scraped events (populated by scraper)

### Existing Sections
- **Job Queue Section** - Shows jobs created/queued by pipeline controls
- **Source List** - Checkboxes for source selection
- **Results Panel** - Shows detailed scrape results at bottom

## Future Enhancements

### Potential Additions
1. **Test Selected Sources** - Dry-run mode for selected sources
2. **Schedule Selected** - Schedule sources for specific time
3. **View Job Logs** - Click on job to view detailed logs
4. **Bulk Configuration** - Edit config for multiple sources at once
5. **Health Dashboard** - Visual charts of source health over time
6. **Rate Limit Monitor** - Show rate limit status per source
7. **Scrape History** - Timeline of scraping activity
8. **Export Results** - Download scrape results as CSV/JSON

## Troubleshooting

### Issue: No sources selected
**Solution**: Click a quick select button or manually check sources

### Issue: Operation fails
**Solution**: Check toast message for details, verify edge functions are deployed

### Issue: Jobs not processing
**Solution**: Verify scrape-worker is running, check job queue section

### Issue: Sources stay in "processing" state
**Solution**: Check edge function logs, may need to reset job status manually

### Issue: Failed jobs not retrying
**Solution**: Check job attempts count (max 3), may need manual intervention

## Performance Considerations

- **Bulk Operations**: Selecting many sources may take time, progress shown in results panel
- **Queue vs Direct**: Queue is better for many sources, direct run for urgent/few sources
- **Rate Limiting**: Respect source rate limits, stagger operations if needed
- **Edge Function Timeout**: Large operations may timeout, use queue for reliability

## Security

- All operations require authentication
- Uses Supabase client with user session
- RLS policies enforced on database operations
- No direct SQL injection vectors

## Testing Checklist

- [ ] Select individual source and run
- [ ] Select multiple sources and queue
- [ ] Use quick select buttons (All, Enabled, Broken)
- [ ] Trigger run-scraper function
- [ ] Retry failed jobs (after creating some failures)
- [ ] Verify loading states work correctly
- [ ] Verify toast notifications appear
- [ ] Verify results panel updates
- [ ] Verify job queue updates after operations
- [ ] Test with no sources selected (should show error)
- [ ] Test with no failed jobs (retry button should be disabled)
- [ ] Test responsive layout on mobile

## Documentation

- This file: Implementation guide
- `AI_CONTEXT.md`: Overview of scraper architecture
- `SCRAPER_ARCHITECTURE.md`: Detailed scraper design
- `docs/runbook.md`: Operational procedures

## Support

For issues or questions:
1. Check edge function logs: "Edge Function Logs" section in admin
2. Check job queue: "Scrape Job Queue" section
3. Run integrity tests: "Scraper Integrity Tests" section
4. Review source health: Individual source cards at bottom

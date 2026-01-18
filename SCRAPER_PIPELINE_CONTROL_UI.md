# Scraper Pipeline Control - UI Layout

## Visual Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ADMIN HEADER                                │
│  [←] Scraper Admin                              [Run Legacy]         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  🔧 SCRAPER PIPELINE CONTROL              [Server] 2 selected        │
│  Manual triggers and troubleshooting tools for the scraper pipeline  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Source Selection                                             │   │
│  │ [Deselect All] [✓ Enabled (45)] [✗ Broken (3)]             │   │
│  │ Select sources from the list below, then use action buttons │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌────────────────────────────┬────────────────────────────────┐   │
│  │ ▶ Run Selected Sources     │ ☐ Queue Selected Sources       │   │
│  │ Execute scraper immediately│ Add to scrape job queue for    │   │
│  │ for selected sources       │ async processing               │   │
│  │ (bypasses queue)           │                                 │   │
│  │                            │                                 │   │
│  │ [▶ Run 2 Sources]          │ [☐ Queue 2 Sources]            │   │
│  └────────────────────────────┴────────────────────────────────┘   │
│                                                                       │
│  ┌────────────────────────────┬────────────────────────────────┐   │
│  │ 🖥 Trigger run-scraper     │ ⟲ Retry Failed Jobs            │   │
│  │ Execute run-scraper edge   │ Reset failed jobs to pending   │   │
│  │ function (all enabled      │ and retry them (max 3          │   │
│  │ sources)                   │ attempts)                      │   │
│  │                            │                                 │   │
│  │ [🖥 Trigger run-scraper]   │ [⟲ Retry 5 Failed Jobs]       │   │
│  └────────────────────────────┴────────────────────────────────┘   │
│                                                                       │
│  ┌──────────┬──────────┬──────────┬──────────┐                     │
│  │ Selected │ Enabled  │ Warning  │ Broken   │                     │
│  │    2     │   45     │    8     │    3     │                     │
│  └──────────┴──────────┴──────────┴──────────┘                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  🕐 AUTOMATION & SCHEDULING          Last Run: 2h ago               │
│  Trigger the daily scheduler and monitor automation                  │
│  [⚡ Trigger Daily Scheduler] [↻ Refresh Queue]                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  ☐ SCRAPE JOB QUEUE                   [↻] [Clear Done]             │
│                                                                       │
│  Progress: ████████░░░░░░░░░░░░░░░░░░░░░░░░░░ 35%                  │
│  35 / 100 jobs complete                                              │
│                                                                       │
│  ┌────────┬────────────┬───────────┬────────┐                      │
│  │Pending │Processing  │Completed  │Failed  │                      │
│  │   40   │     25     │    30     │   5    │                      │
│  └────────┴────────────┴───────────┴────────┘                      │
│                                                                       │
│  Total scraped: 1,234    New events: 456                            │
│                                                                       │
│  Recent Jobs:                                                        │
│  [↻] Amsterdam Events       - 45 scraped, 12 new                    │
│  [✓] Utrecht Cinema         - 23 scraped, 8 new                     │
│  [✗] Rotterdam Sports       - Error: Rate limit exceeded            │
└─────────────────────────────────────────────────────────────────────┘

... (other sections: Source Discovery, Logs, Integrity Tests, etc.)

┌─────────────────────────────────────────────────────────────────────┐
│  SOURCE LIST                                                         │
│                                                                       │
│  [✓] Amsterdam Events              [✓ Healthy] [⚡ Test] [⚙] [ON]   │
│      https://amsterdam.nl/events                                     │
│      Last: 2h ago | Total: 1,234 events                             │
│                                                                       │
│  [✓] Utrecht Cinema                [⚠ Warning] [⚡ Test] [⚙] [ON]   │
│      https://utrecht.nl/cinema                                       │
│      Last: 5h ago | Total: 456 events | 2 failures                  │
│                                                                       │
│  [ ] Rotterdam Sports              [✗ Error]   [⚡ Test] [⚙] [OFF]  │
│      https://rotterdam.nl/sport                                      │
│      Last: Never | Total: 0 events | Auto-disabled                  │
│      Error: Connection timeout after 30s                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Color Legend

- 🔧 Wrench icon = Pipeline Control section (gradient: blue → purple → pink)
- ▶ Play icon = Run action (primary blue)
- ☐ Checkbox icon = Queue action (blue)
- 🖥 Server icon = Run-scraper function (purple)
- ⟲ Rotate icon = Retry action (amber)
- ✓ Checkmark = Healthy status (green)
- ⚠ Warning = Warning status (amber)
- ✗ X mark = Error status (red)

## Interactive Elements

### Selection Controls
- **Checkboxes**: Click individual source checkboxes in source list
- **Quick Filters**: Click "Enabled" or "Broken" to auto-select
- **Select All Toggle**: Toggles between select/deselect all

### Trigger Buttons
- **Primary Button**: "Run Selected Sources" - most prominent action
- **Outline Buttons**: Other actions with less visual weight
- **Disabled State**: Grayed out when conditions not met
- **Loading State**: Shows spinner and "Running..." text

### Status Indicators
- **Real-time Counts**: Update as you select/deselect sources
- **Color Coded**: Blue/Green/Amber/Red for different statuses
- **Clickable**: (Future enhancement) Click to filter/navigate

## Responsive Behavior

### Desktop (> 768px)
- 2-column grid for trigger cards
- 4-column grid for status indicators
- Full-width source list with inline actions

### Mobile (< 768px)
- 1-column stack for trigger cards
- 2-column grid for status indicators
- Condensed source list with tap actions

## User Flow Example

```
User wants to re-scrape all broken sources:

1. Click "Broken (3)" button
   → 3 sources auto-selected
   → Status shows "Selected: 3"

2. Choose action:
   - Option A: Click "Run 3 Sources" (immediate)
   - Option B: Click "Queue 3 Sources" (background)

3. For immediate run:
   → Button shows "Running..." with spinner
   → Toast: "Running 3 sources..."
   → Results panel expands at bottom
   → Toast: "Ran 3 sources: 15 new events"
   → Source list updates with new stats

4. For queue:
   → Button shows "Queueing..." with spinner
   → Toast: "Queued 3 sources for scraping"
   → Job queue section updates (+3 pending)
   → Selection automatically cleared
   → Jobs process in background
```

## Toast Notifications

All operations show toast feedback:

- ✅ **Success**: "Ran 3 sources: 15 new events"
- ✅ **Success**: "Queued 5 sources for scraping"
- ✅ **Success**: "Retrying 8 failed job(s)"
- ℹ️ **Info**: "No failed jobs to retry"
- ❌ **Error**: "No sources selected"
- ❌ **Error**: "Failed to run sources: Connection timeout"

## Accessibility

- Clear labels for all buttons and inputs
- Icon + text for all actions (not icon-only)
- Color is not the only indicator (icons + text)
- Keyboard navigation supported
- Screen reader friendly

## Animation & Feedback

- **Loading States**: Spinner animation on buttons
- **Results Panel**: Smooth expand/collapse animation
- **Toast**: Slide in from top-right
- **Status Update**: Fade-in when values change
- **Selection**: Immediate checkbox response

## Integration with Existing Sections

The Pipeline Control section sits above existing sections:

1. **Pipeline Control** ← NEW (most prominent)
2. Automation & Scheduling
3. Job Queue
4. Source Discovery
5. Edge Function Logs
6. Scraper Integrity Tests
7. Source Stats
8. Action Buttons
9. Source List

This order prioritizes immediate manual control, followed by monitoring and configuration.

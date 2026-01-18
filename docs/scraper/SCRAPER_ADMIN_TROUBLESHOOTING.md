# Scraper Admin Page Troubleshooting Guide

## Overview

The Scraper Admin page (`/admin` or `/scraper-admin`) is a **development-only** interface for managing the event scraping system. It provides tools to:

- Trigger manual scrapes and schedule automated runs
- Monitor scrape job queue and execution status
- Discover new event sources automatically
- View Supabase edge function logs
- Run integrity tests on the scraper
- Manage source configurations and health

## Access Requirements

⚠️ **Important**: This page is only accessible in development mode (`import.meta.env.DEV === true`).

### Routes
- `/admin` - Primary route
- `/scraper-admin` - Alternative route (both point to same component)

## Common Issues and Solutions

### 1. API Connection Failed Error

**Symptoms:**
- Red error banner at top of page stating "API Connection Failed"
- Shows "0 sources" and "0 enabled" at bottom
- Console errors: `ERR_BLOCKED_BY_CLIENT` or `Failed to fetch`
- Data sections show empty states

**Causes:**
- Browser extension blocking Supabase API requests (ad blockers, privacy tools)
- Network firewall or VPN blocking `*.supabase.co` domain
- Missing or incorrect environment variables
- CORS issues (rare in development)

**Solutions:**

1. **Disable Browser Extensions**
   - Temporarily disable ad blockers (uBlock Origin, AdBlock Plus, etc.)
   - Disable privacy extensions (Privacy Badger, Ghostery, etc.)
   - Try in incognito/private mode to bypass extensions
   - Whitelist `*.supabase.co` in your ad blocker settings

2. **Check Environment Variables**
   ```bash
   # Verify .env file exists and contains:
   VITE_SUPABASE_URL="https://mlpefjsbriqgxcaqxhic.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key-here"
   ```
   - Copy `.env.example` to `.env` if missing
   - Restart dev server after changing `.env`

3. **Network Configuration**
   - Check if corporate firewall blocks Supabase
   - Try different network (mobile hotspot, different WiFi)
   - Disable VPN temporarily

4. **Browser Issues**
   - Try different browser (Chrome, Firefox, Safari)
   - Clear browser cache and cookies
   - Check browser console for specific error details

### 2. Page Shows "0 sources" Despite Configured Sources

**Symptoms:**
- Admin page loads but shows no sources
- "0 sources, 0 enabled" at bottom
- No error banner visible

**Causes:**
- Database has no scraper sources configured
- RLS (Row Level Security) policies blocking access
- User not authenticated

**Solutions:**

1. **Verify Database Has Sources**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT COUNT(*) FROM scraper_sources;
   ```

2. **Check RLS Policies**
   - Go to Supabase Dashboard > Database > scraper_sources
   - Verify RLS is enabled but policies allow read access
   - In dev mode, ensure anon key has sufficient permissions

3. **Authenticate User**
   - Log in via `/login` page
   - Admin features may require authenticated user

### 3. Buttons Not Responding

**Symptoms:**
- Clicking buttons shows no response
- Loading indicators appear briefly then disappear
- Toast notifications say "Failed to..."

**Causes:**
- API calls failing (see Issue #1)
- Edge functions not deployed or not responding
- Supabase project paused or offline

**Solutions:**

1. **Verify Supabase Project Status**
   - Check Supabase Dashboard for project status
   - Ensure project is not paused (free tier limitation)
   - Verify edge functions are deployed

2. **Check Edge Function Logs**
   - Use "Fetch Logs" button (if working) to see edge function errors
   - Check Supabase Dashboard > Edge Functions > Logs
   - Look for deployment or runtime errors

3. **Test Individual Features**
   - Click "Retry" in error banner to refresh data
   - Try "Refresh" buttons in each section
   - Check browser console for specific error messages

### 4. "Missing Trigger Daily Scheduler Button"

**Symptoms:**
- Button appears missing or invisible

**Causes:**
- Button is present but disabled due to active jobs
- CSS/styling issue hiding button
- Page not fully loaded

**Solutions:**

1. **Check Job Queue Status**
   - If jobs are pending/processing, scheduler button is disabled
   - Wait for jobs to complete or clear completed jobs

2. **Verify Page Load**
   - Refresh page (F5 or Cmd+R)
   - Clear browser cache
   - Check browser console for errors

3. **Scroll to Section**
   - "Trigger Daily Scheduler" button is in "Automation & Scheduling" section
   - Located near top of page, just below header

## Feature-Specific Troubleshooting

### Source Discovery

**Issue:** Discovery returns no results or times out

**Solutions:**
- Discovery can take 2-5 minutes for large municipality lists
- If timeout occurs, sources may still be discovered in background
- Check "Recently Discovered" section after a few minutes
- Reduce "Max Municipalities" parameter for faster results

### Edge Function Logs

**Issue:** Logs fetch fails or returns empty

**Solutions:**
- Requires valid Supabase auth token
- Free tier has log retention limits (~7 days)
- Select shorter time range (15 min, 1 hour) for better results
- Check Supabase Dashboard for log availability

### Scraper Integrity Tests

**Issue:** Tests fail or timeout

**Solutions:**
- Tests require active Supabase edge functions
- Some tests require external internet access
- Review test details in collapsed sections
- Tests are diagnostic - failures indicate scraper issues, not admin page issues

## Development Tips

### Enable Debug Mode

Add to `.env`:
```bash
VITE_SUPABASE_DEBUG="true"
```

This logs all Supabase requests/responses to browser console for debugging.

### Check Supabase Configuration

```javascript
// In browser console on admin page
import { getSupabaseConfig } from '@/integrations/supabase/client';
console.log(getSupabaseConfig());
```

### Monitor Network Traffic

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by `supabase.co`
4. Reload admin page
5. Check for failed requests and their error messages

## Getting Help

If issues persist:

1. **Check Browser Console**
   - Open DevTools (F12) > Console tab
   - Copy any error messages

2. **Check Supabase Logs**
   - Go to Supabase Dashboard > Logs
   - Filter by time period when issue occurred

3. **Verify Environment**
   - Node version: `node --version` (should be 18+)
   - Supabase connection: Check dashboard for project status
   - Network: Try different network/VPN settings

4. **Report Issue**
   - Include browser/version
   - Include error messages from console
   - Include steps to reproduce
   - Include screenshot of error banner if visible

## Related Documentation

- [SCRAPER_ARCHITECTURE.md](../SCRAPER_ARCHITECTURE.md) - Scraper system design
- [SCRAPER_E2E_GUIDE.md](../SCRAPER_E2E_GUIDE.md) - End-to-end testing guide
- [BACKEND_SETUP.md](../BACKEND_SETUP.md) - Database and Supabase setup
- [docs/runbook.md](./runbook.md) - Operational runbook for scraper

## Security Note

🔒 The admin page is **intentionally restricted to development mode only**. It is not accessible in production builds and should not be exposed to end users. Access to this page provides significant control over the scraping system and should be limited to developers and administrators.

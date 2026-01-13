#!/usr/bin/env node
/**
 * CLI entry point for defensive scheduled scraper.
 * Supports --dry-run, --run-id, and other configuration options.
 */

import { listSources } from './lib/supabase';
import { runScraper } from './scraper/worker';
import { getConfig } from './config/defaults';

interface CliArgs {
  dryRun: boolean;
  runId?: string;
  help: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  
  const parsed: CliArgs = {
    dryRun: false,
    help: false,
  };
  
  for (const arg of args) {
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg.startsWith('--run-id=')) {
      parsed.runId = arg.substring('--run-id='.length);
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }
  
  return parsed;
}

/**
 * Generate a run ID
 */
function generateRunId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  return `run_${timestamp}`;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
LCL Local Defensive Scraper
============================

Usage: node dist/cli.js [options]

Options:
  --dry-run           Simulate run without writing to Supabase or sending Slack alerts
  --run-id=<id>       Specify a custom run ID (default: auto-generated timestamp)
  --help, -h          Show this help message

Environment Variables:
  SUPABASE_URL              Supabase project URL (required)
  SUPABASE_KEY              Supabase anon/service key (required)
  SLACK_WEBHOOK_URL         Slack incoming webhook URL (required for alerts)
  SCRAPER_USER_AGENT        Custom user agent string (optional)
  MAX_CONSECUTIVE_FAILURES  Alert threshold (default: 3)
  ALERT_SUPPRESSION_MS      Alert suppression window in ms (default: 1800000 / 30 min)
  DRY_RUN                   Set to 'true' or '1' to enable dry run mode

Examples:
  # Normal run
  node dist/cli.js

  # Dry run (no writes, no alerts)
  node dist/cli.js --dry-run

  # With custom run ID
  node dist/cli.js --run-id=test-run-001

  # Dry run with environment variable
  DRY_RUN=true node dist/cli.js
`);
}

/**
 * Validate configuration
 */
function validateConfig(dryRun: boolean): boolean {
  const config = getConfig();
  const effectiveDryRun = dryRun || config.dryRun;
  const errors: string[] = [];
  const missingSupabaseCredentials = !config.supabaseUrl || !config.supabaseKey;
  
  if (missingSupabaseCredentials) {
    if (effectiveDryRun) {
      console.log('ℹ️  Running in dry-run without Supabase credentials; skipping Supabase writes.');
    } else {
      const supabaseErrors = [
        !config.supabaseUrl && 'SUPABASE_URL environment variable is required',
        !config.supabaseKey && 'SUPABASE_KEY environment variable is required',
      ].filter(Boolean) as string[];
      errors.push(...supabaseErrors);
    }
  }
  
  if (!config.slackWebhookUrl && !effectiveDryRun) {
    console.warn('⚠️  SLACK_WEBHOOK_URL not set - alerts will be skipped');
  }
  
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:');
    errors.forEach(err => console.error(`   - ${err}`));
    console.error('\nRun with --help for more information.\n');
    return false;
  }
  
  return true;
}

/**
 * Main function
 * Note: When using tsx, the file is always executed as the main module
 */
async function main(): Promise<void> {
  const args = parseArgs();
  
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  
  console.log('🤖 LCL Local Defensive Scraper\n');
  
  // Check for dry run from env or CLI
  const dryRun = args.dryRun || getConfig().dryRun;
  
  if (dryRun) {
    console.log('🏃 DRY RUN MODE - No writes will be performed\n');
  }
  
  // Validate configuration
  if (!validateConfig(dryRun)) {
    process.exit(1);
  }
  
  // Generate or use provided run ID
  const runId = args.runId || generateRunId();
  
  try {
    // Load sources
    console.log('📚 Loading sources...');
    const sources = listSources();
    
    if (sources.length === 0) {
      console.warn('⚠️  No sources found in src/config/sources.json');
      process.exit(0);
    }
    
    // Run scraper
    const results = await runScraper(sources, { runId, dryRun });
    
    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📋 Run Summary');
    console.log('='.repeat(60));
    console.log(`Run ID: ${runId}`);
    console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
    console.log(`Total Sources: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    console.log('');
    
    // Show failed sources
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('❌ Failed Sources:');
      failed.forEach(result => {
        console.log(`   - ${result.source_id}: ${result.error || 'Unknown error'} (${result.attempts} attempts)`);
      });
      console.log('');
    }
    
    // Exit with appropriate code
    const exitCode = failed.length > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n❌ Fatal error during scraper run:');
    console.error(error);
    process.exit(2);
  }
}

// Auto-execute when run directly with tsx or node
// This is the main entry point for the scraper CLI
if (process.env.VITEST !== 'true') {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(2);
  });
}

export { main, validateConfig };

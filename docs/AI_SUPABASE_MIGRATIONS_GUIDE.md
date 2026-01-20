# Supabase Migrations Auto-Push Workflow - AI Assistant Guide

## Overview

This repository has an automated GitHub Actions workflow that automatically pushes Supabase database migrations to the production database when changes are committed to the `main` or `master` branch.

## Workflow Location

**File:** `.github/workflows/deploy-migrations.yml`

## How It Works

The workflow automatically triggers when:
1. **Push to main/master branch** with changes to `supabase/migrations/**`
2. **Manual trigger** via `workflow_dispatch` (from GitHub Actions UI)

### What the Workflow Does

1. Checks out the repository
2. Sets up the Supabase CLI
3. Links to the Supabase project using credentials
4. Pushes all migrations to the production database
5. Retries up to 3 times if connection issues occur

## Instructions for AI Coding Assistants

### When Creating or Modifying Database Migrations

**✅ DO:**

1. **Create migration files in the correct location:**
   ```
   supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql
   ```
   
   Example: `supabase/migrations/20260120120000_add_user_roles.sql`

2. **Use proper migration naming convention:**
   - Start with timestamp: `YYYYMMDDHHMMSS` (20-digit format)
   - Followed by underscore and descriptive name
   - Use lowercase with underscores for spaces
   - End with `.sql` extension

3. **Write idempotent migrations (safe to run multiple times):**
   ```sql
   -- ✅ Good: Uses IF NOT EXISTS
   CREATE TABLE IF NOT EXISTS user_roles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL
   );
   
   -- ✅ Good: Checks before adding column
   DO $$ 
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns 
       WHERE table_name='profiles' AND column_name='role_id'
     ) THEN
       ALTER TABLE profiles ADD COLUMN role_id UUID REFERENCES user_roles(id);
     END IF;
   END $$;
   ```

4. **Include rollback instructions in comments when appropriate:**
   ```sql
   -- Migration: Add user_roles table
   -- Rollback: DROP TABLE IF EXISTS user_roles CASCADE;
   
   CREATE TABLE user_roles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL
   );
   ```

5. **Test migrations locally first (if possible):**
   ```bash
   # Link to a test project
   supabase link --project-ref YOUR_TEST_PROJECT_ID
   
   # Push migrations to test database
   supabase db push
   ```

6. **Commit and push to main/master branch:**
   ```bash
   git add supabase/migrations/20260120120000_add_user_roles.sql
   git commit -m "Add user roles migration"
   git push origin main
   ```

7. **The workflow will automatically:**
   - Detect your migration file changes
   - Push them to the production database
   - Report success or failure in the Actions tab

**❌ DON'T:**

1. Don't modify existing migration files that have already been deployed
2. Don't create migrations without timestamps
3. Don't use non-idempotent SQL that fails on re-run
4. Don't forget to enable necessary PostgreSQL extensions if needed
5. Don't push breaking changes without coordinating with the team

### Checking Migration Status

After pushing your changes, you can:

1. **View workflow run in GitHub Actions:**
   - Go to repository → Actions tab
   - Look for "Deploy Migrations" workflow
   - Check the latest run for your commit

2. **Look for these log outputs:**
   - `🔗 Linking to project...` - Connecting to Supabase
   - `📤 Pushing migrations...` - Deploying changes
   - `✅ Migrations pushed successfully!` - Success
   - `❌ All attempts failed.` - Failure (check errors)

### Required GitHub Secrets

The workflow requires these secrets to be configured in the repository:

- `SUPABASE_ACCESS_TOKEN` - Supabase personal access token
- `SUPABASE_PROJECT_ID` - Supabase project reference ID  
- `SUPABASE_DB_PASSWORD` - Database password for linking

**Note:** These secrets are already configured for this repository. You don't need to set them up.

### Manual Workflow Trigger

If you need to manually trigger the migration deployment:

1. Go to GitHub repository → Actions tab
2. Select "Deploy Migrations" workflow
3. Click "Run workflow" button
4. Select branch (usually `main`)
5. Click "Run workflow"

This is useful for:
- Re-running failed migrations after fixing infrastructure issues
- Deploying migrations from a feature branch for testing
- Force-pushing migrations when path-based trigger doesn't fire

### Migration File Structure

**Typical migration file structure:**

```sql
-- Migration: [Brief description]
-- Created: YYYY-MM-DD
-- Author: [Optional]

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create tables
CREATE TABLE IF NOT EXISTS table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_table_name_field 
ON table_name(field);

-- Row Level Security
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON table_name TO authenticated;
```

### Common Migration Patterns

#### Adding a Column

```sql
-- Add column with default value
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 50;

-- Update existing rows (optional)
UPDATE events SET capacity = 100 WHERE capacity IS NULL;
```

#### Adding an Index

```sql
-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_events_start_time 
ON events(start_time);

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_external_id 
ON events(external_id) WHERE external_id IS NOT NULL;
```

#### Adding RLS Policies

```sql
-- Enable RLS on table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if modifying
DROP POLICY IF EXISTS "users_can_view_events" ON events;

-- Create new policy
CREATE POLICY "users_can_view_events" ON events
  FOR SELECT
  TO authenticated
  USING (true);
```

#### Adding Foreign Keys

```sql
-- Add foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name='fk_events_creator'
  ) THEN
    ALTER TABLE events 
    ADD CONSTRAINT fk_events_creator 
    FOREIGN KEY (creator_id) REFERENCES profiles(id);
  END IF;
END $$;
```

### Troubleshooting

#### Migration Fails with "already exists" Error

Your migration is not idempotent. Add `IF NOT EXISTS` or similar checks:
```sql
-- ❌ Wrong
CREATE TABLE user_roles (...);

-- ✅ Right
CREATE TABLE IF NOT EXISTS user_roles (...);
```

#### Migration Fails with "column already exists"

Check if column exists before adding:
```sql
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='profiles' AND column_name='role_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role_id UUID;
  END IF;
END $$;
```

#### Workflow Doesn't Trigger

Check that:
1. You pushed to `main` or `master` branch
2. Your changes include files in `supabase/migrations/` directory
3. The workflow file exists at `.github/workflows/deploy-migrations.yml`

#### Need to Rollback a Migration

1. Create a new migration that reverses the changes:
   ```sql
   -- Migration: Rollback user_roles changes
   DROP TABLE IF EXISTS user_roles CASCADE;
   ```
2. Push the rollback migration to trigger deployment

**Never** delete or modify deployed migration files - always create new ones.

### Best Practices for AI Assistants

1. **Always check existing migrations first** to understand the current schema
   ```bash
   ls -la supabase/migrations/
   ```

2. **Generate timestamp correctly:**
   ```bash
   date +"%Y%m%d%H%M%S"
   # Example output: 20260120153045
   ```

3. **Review the latest migration** to maintain consistency:
   ```bash
   cat supabase/migrations/$(ls -t supabase/migrations/ | head -1)
   ```

4. **Use descriptive migration names:**
   - ✅ `20260120120000_add_user_roles_and_permissions.sql`
   - ✅ `20260120130000_enable_postgis_extension.sql`
   - ❌ `20260120120000_update.sql`
   - ❌ `migration.sql`

5. **Test SQL syntax before committing:**
   ```bash
   # If possible, validate SQL syntax
   psql -f supabase/migrations/20260120120000_new_migration.sql --dry-run
   ```

6. **Document complex migrations:**
   Add clear comments explaining what the migration does and why:
   ```sql
   -- Migration: Add capacity management for events
   -- 
   -- This migration adds capacity tracking to events to prevent
   -- overbooking. It includes:
   -- - capacity column (max attendees)
   -- - waitlist support
   -- - automatic status management
   --
   -- Related to issue: #123
   
   ALTER TABLE events ADD COLUMN capacity INTEGER;
   ```

7. **Consider data preservation:**
   When modifying existing tables, ensure existing data isn't lost:
   ```sql
   -- Safe: Adds nullable column
   ALTER TABLE events ADD COLUMN capacity INTEGER;
   
   -- Risky: Adds NOT NULL without default
   -- ALTER TABLE events ADD COLUMN capacity INTEGER NOT NULL; -- DON'T DO THIS
   
   -- Better: Add with default, then make required
   ALTER TABLE events ADD COLUMN capacity INTEGER DEFAULT 50;
   -- Later migration can make it NOT NULL if needed
   ```

## Summary

The automatic Supabase migrations workflow:
- ✅ **EXISTS** in this repository
- ✅ **AUTOMATICALLY DEPLOYS** on push to main/master
- ✅ **MONITORS** `supabase/migrations/` directory
- ✅ **RETRIES** on transient failures
- ✅ **REPORTS** status in GitHub Actions

**For AI Assistants:** When you need to modify the database schema, create properly formatted migration files in `supabase/migrations/`, ensure they're idempotent, commit them to the main branch, and the workflow will automatically deploy them to production.

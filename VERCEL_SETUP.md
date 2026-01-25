# Vercel Deployment Setup - Quick Start Guide

This guide will help you set up Vercel deployments for PRs in the LCL-Local repository.

## What Has Been Set Up

The following files have been added/modified to enable Vercel deployments:

1. **`.github/workflows/vercel-deploy.yml`** - GitHub Actions workflow for automated deployments
2. **`vercel.json`** - Vercel configuration file
3. **`.vercelignore`** - Files to exclude from deployment
4. **`docs/VERCEL_DEPLOYMENT.md`** - Comprehensive deployment documentation
5. **`package.json`** - Added `build:ci` script for CI builds without type checking
6. **`tsconfig.app.json`** - Updated to exclude test files from production build

## Required Setup Steps

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click "Add New..." → "Project"
3. Import the `wesleykoot-jpg/LCL-Local` repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Build Command**: Leave as default (will use vercel.json)
   - **Output Directory**: dist (will use vercel.json)
   - **Install Command**: npm install

### Step 2: Get Vercel Credentials

You need three credentials from Vercel:

#### 1. Vercel Token
- Go to [Vercel Account Settings → Tokens](https://vercel.com/account/tokens)
- Click "Create Token"
- Name: "GitHub Actions Deployment"
- Select scope: Full Access (or appropriate team scope)
- Copy the token immediately (you won't see it again!)

#### 2. Vercel Organization ID
- In Vercel dashboard, click your organization/team name
- Go to Settings → General
- Copy the "Organization ID" or "Team ID"

#### 3. Vercel Project ID
- Go to your project in Vercel
- Click Settings
- Find and copy the "Project ID"

### Step 3: Add GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to: `https://github.com/wesleykoot-jpg/LCL-Local/settings/secrets/actions`
2. Click "New repository secret" for each of these:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `VERCEL_TOKEN` | (token from Step 2.1) | Vercel API token for deployments |
| `VERCEL_ORG_ID` | (ID from Step 2.2) | Your Vercel organization/team ID |
| `VERCEL_PROJECT_ID` | (ID from Step 2.3) | Your Vercel project ID |
| `VITE_SUPABASE_URL` | Your Supabase URL | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase key | Supabase anonymous/public key |

**Note:** The Supabase credentials should match your production/staging environment.

### Step 4: Test the Deployment

1. Create a test branch:
   ```bash
   git checkout -b test-vercel-deployment
   echo "Test change for Vercel" >> README.md
   git add README.md
   git commit -m "Test Vercel deployment"
   git push origin test-vercel-deployment
   ```

2. Open a pull request on GitHub

3. Watch the "Vercel Preview Deployment" workflow run in the Actions tab

4. When complete, you'll see a comment on the PR with the deployment URL!

## How It Works

When you open or update a PR:
1. GitHub Actions workflow triggers automatically
2. It installs dependencies and builds the app
3. Deploys to a unique preview URL on Vercel
4. Posts the URL as a comment on your PR

Each PR gets its own isolated preview environment!

## Troubleshooting

### Workflow fails at "Pull Vercel Environment Information"
- **Problem**: Missing or incorrect Vercel credentials
- **Solution**: Verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are set correctly

### Build fails
- **Problem**: Missing environment variables
- **Solution**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in GitHub secrets

### Deployment works but app doesn't load
- **Problem**: Environment variables not available in browser
- **Solution**: Also add the VITE_* variables in Vercel project settings

## Next Steps

After setup is complete:
- Every new PR will automatically get a preview deployment
- The deployment URL will be posted as a comment on the PR
- Each commit to the PR will trigger a new deployment

For more details, see `docs/VERCEL_DEPLOYMENT.md`.

## Support

If you encounter issues:
1. Check the GitHub Actions workflow logs
2. Review the Vercel deployment logs in your Vercel dashboard
3. Ensure all secrets are set correctly
4. Refer to the comprehensive guide in `docs/VERCEL_DEPLOYMENT.md`

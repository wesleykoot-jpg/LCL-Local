# Vercel Deployment Setup

This guide explains how to set up automated Vercel preview deployments for pull requests in the LCL-Local repository.

## Overview

The repository is configured to automatically deploy preview environments to Vercel for every pull request. This allows team members to test changes in a production-like environment before merging.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Access to the GitHub repository settings
3. Admin access to configure secrets

## Initial Setup

### 1. Create a Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New..." → "Project"
3. Import the `wesleykoot-jpg/LCL-Local` repository
4. Configure project settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### 2. Get Vercel Credentials

You'll need the following credentials from Vercel:

#### Vercel Token
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name it "GitHub Actions Deployment"
4. Select appropriate scope (read/write)
5. Copy the token (you won't see it again!)

#### Vercel Organization ID
1. Go to your Vercel dashboard
2. Click on your organization/team name
3. Go to Settings
4. Copy the "Organization ID" (or "Team ID")

#### Vercel Project ID
1. Go to your Vercel project settings
2. Find the "Project ID" in the project settings
3. Copy the ID

### 3. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret" for each:

| Secret Name | Description | Where to Find |
|------------|-------------|---------------|
| `VERCEL_TOKEN` | Vercel API token | [Account Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Your Vercel organization/team ID | Organization Settings |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Project Settings |
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase project settings |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase project API settings |

## How It Works

### Workflow Trigger

The deployment workflow (`.github/workflows/vercel-deploy.yml`) automatically triggers when:
- A new pull request is opened
- Commits are pushed to an existing pull request
- A pull request is reopened

### Deployment Process

1. **Checkout**: Pulls the PR code
2. **Setup**: Installs Node.js and Vercel CLI
3. **Configure**: Pulls Vercel environment configuration
4. **Build**: Builds the project with environment variables
5. **Deploy**: Deploys to Vercel preview environment
6. **Comment**: Posts the preview URL as a PR comment

### Preview URLs

Each PR gets a unique preview URL like:
```
https://lcl-local-{random-id}.vercel.app
```

The URL is automatically posted as a comment on the PR.

## Configuration Files

### vercel.json

The `vercel.json` file configures:
- Build settings (output directory, framework)
- Routing (SPA fallback to index.html)
- Cache headers for static assets

### GitHub Workflow

The `.github/workflows/vercel-deploy.yml` file defines:
- When deployments trigger (PR events)
- Build and deployment steps
- PR commenting with deployment URLs

## Testing the Setup

1. Create a test branch:
   ```bash
   git checkout -b test-vercel-deployment
   ```

2. Make a small change (e.g., update README)
   ```bash
   echo "Test change" >> README.md
   git add README.md
   git commit -m "Test Vercel deployment"
   git push origin test-vercel-deployment
   ```

3. Open a pull request on GitHub

4. Watch the "Vercel Preview Deployment" workflow run in the Actions tab

5. Check for the deployment URL comment on your PR

## Troubleshooting

### Workflow Fails at "Pull Vercel Environment Information"

**Issue**: Missing or incorrect `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID`

**Solution**: 
- Verify all three secrets are set correctly in GitHub repository settings
- Ensure the Vercel token has not expired
- Check that the organization and project IDs match your Vercel dashboard

### Build Fails

**Issue**: Missing environment variables or build errors

**Solution**:
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in GitHub secrets
- Check build logs for specific errors
- Test the build locally: `npm run build`

### Deployment URL Not Posted

**Issue**: GitHub Actions bot cannot comment on PR

**Solution**:
- Ensure the workflow has `pull-requests: write` permission (already configured)
- Check that GitHub Actions is enabled for the repository

### Environment Variables Not Available in Preview

**Issue**: App shows errors about missing Supabase connection

**Solution**:
- Add environment variables in Vercel project settings
- They should start with `VITE_` for Vite to expose them
- Redeploy after adding variables

## Maintenance

### Updating Environment Variables

When environment variables change:

1. Update in Vercel project settings
2. Update in GitHub repository secrets
3. Redeploy existing PRs (push a new commit)

### Vercel Token Rotation

If you need to rotate the Vercel token:

1. Create a new token in Vercel
2. Update `VERCEL_TOKEN` secret in GitHub
3. Revoke the old token in Vercel

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [GitHub Actions for Vercel](https://github.com/vercel/vercel/tree/main/packages/cli)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

## Security Notes

- Never commit `.env` files or secrets to the repository
- Use GitHub Secrets for all sensitive credentials
- Vercel preview deployments are public by default
- Consider enabling Vercel password protection for sensitive previews

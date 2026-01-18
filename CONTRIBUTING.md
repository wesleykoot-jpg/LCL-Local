# Contributing Guide

## Documentation Best Practices

To keep the codebase clean and navigable, please follow these rules when adding or modifying documentation.

### 1. No Root Markdown Files
**Do not create new markdown files in the project root.**
- **Bad**: `ANALYZE_TASK_SUMMARY.md`, `MY_NEW_FEATURE_SPEC.md`
- **Good**: Update existing docs (e.g., `stragies/README.md`) or place new docs in `docs/archive/specs/` if they are temporary.

### 2. Updating Documentation
Instead of creating a new file to describe an update, **edit the canonical document**.
- If you change the architecture, update `ARCHITECTURE.md`.
- If you change the deployment process, update `docs/core/DEPLOYMENT_GUIDE.md`.

### 3. Archiving
If you generate temporary audit logs, task summaries, or findings:
1. Place them in `docs/archive/`.
2. Use specific subfolders: `docs/archive/audits/`, `docs/archive/summaries/`.

## Directory Structure

```
/
├── README.md               # Entry point
├── ARCHITECTURE.md         # System design (Keep up to date!)
├── docs/
│   ├── core/              # Permanent guides (Setup, Deployment, Concepts)
│   ├── scraper/           # Scraper-specific documentation
│   ├── design_system/     # Design tokens and guide
│   └── archive/           # Old/Temporary logs and specs
```

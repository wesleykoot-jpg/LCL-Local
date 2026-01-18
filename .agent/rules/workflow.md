# LCL Project Workflow (PMWesley Profile)

## Branching & Commits
- PROHIBITED: Do not commit directly to `main`.
- MANDATORY: Every task begins with: `git checkout -b feature/<description>`.
- COMMITS: Use "Conventional Commits" (e.g., `feat: implementation of forks logic`).

## PR Automation Protocol
- Once coding is complete, the agent must:
  1. Generate a bulleted "Metric-Driven Summary" of changes.
  2. Identify potential risks or owners for testing.
  3. Provide the terminal command: `gh pr create --title "..." --body "..."`.

## Tech Stack Compliance
- Frontend: React + TypeScript + Vite.
- Backend: Supabase (Schema in `supabase/schema.sql`).
- Native: Capacitor iOS optimizations.

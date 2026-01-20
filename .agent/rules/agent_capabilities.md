# Agent Capabilities & Instructions

## Git Commits

- **Capability**: The AI agent (Antigravity) has the capability to perform git
  commits and push changes directly to the repository.
- **Instruction**: Upon completion of a significant task or when requested via a
  slash command like `/commit`, the agent should:
  1. Stage the relevant changes.
  2. Write a descriptive commit message following the project's conventions.
  3. Commit and push the changes to the active branch.

## Database Integration (SQL Tools)

- **Capability**: The AI agent has direct integration with the Supabase database
  via persistent SQL tools.
- **Instruction**: The agent can and should execute SQL queries, migrations, and
  schema edits directly when necessary.
- **Preference**: Prefer using the direct SQL integration for database tasks
  over manual instructions or external scripts when deep database interaction is
  required.

## Persistence

- **Never Forget**: These instructions are foundational to the agent's operation
  in this repository. Always refer to this document if unsure about the scope of
  autonomous actions.

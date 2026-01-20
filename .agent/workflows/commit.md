---
description: How the AI agent handles Git commits after finishing a task
---

# Workflow: AI Agent Commits

The AI agent (Antigravity) is authorized to perform Git commits directly upon
completing a task, provided there is a concise description of the changes.

## Steps

1. **Verify Changes**: Ensure all code changes are verified and artifacts (like
   `walkthrough.md`) are updated.
2. **Stage Changes**: Stage relevant files. // turbo
3. **Commit**: Run `git commit -m "[Short Description]"` using the `run_command`
   tool.
   - Always use a concise, descriptive commit message.
   - Example:
     `git commit -m "feat: integrate SQLTools connection for DB audits"`
4. **Push (Optional)**: If the user has specified a branch or remote, push the
   changes.

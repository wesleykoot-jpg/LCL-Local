# Copilot / GPT MAX Prompts — Supabase Logs Analysis

Context:
- Repo: wesleykoot-jpg/LCL-Local
- Logs committed under logs/supabase/YYYY-MM-DD/*.jsonl
- Priority: events not being picked up by the "My Events" frontend; investigate scraping, insertion, and attendee linking.

PROMPT: Quick Triage
You are a Senior Data Engineer. Given the log files under logs/supabase/*/*.jsonl, identify the top 10 error signatures by frequency, list their counts, and show the most recent 3 occurrences for each. For each signature provide a one-line likely cause and one-line remediation.

PROMPT: Root-Cause Dive for "events not picking up"
Search logs for: "Insert failed", "Fingerprint lookup failed", "Missing SUPABASE", "Expected ~", "No embedding API key found". For each match return up to 10 relevant log entries with context and suggest exact SQL queries to run to validate the DB state, and a 3-step remediation plan.

PROMPT: Auto-Remediation PR Draft
Given the top error signature and sample logs, produce a minimal PR patch to:
- Add more detailed logging (persist error.message and response bodies where safe)
- Add a small retry/backoff around DB inserts for transient errors
- Add a migration SQL to repair the test profile UUID if missing
Return file diffs and a short commit message.

PROMPT: PII Audit
Scan logs and list keys or patterns that likely contain secrets (e.g. keys, tokens, long JSON bodies). For each, provide a one-line redaction rule and an implementation snippet to add to scripts/fetch_edge_logs.mjs.

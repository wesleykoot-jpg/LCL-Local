# Data-Flow Audit Status Dashboard

## Trace Analysis (Source → DB → UI)
- Serper candidates now map directly into discovered sources with canonical URLs and validated coordinates before insertion.
- Scraped events sanitize titles/descriptions and persist UTC timestamps, keeping the Sidecar (ANCHOR/FORK/SIGNAL) fields intact, including `source_id`.
- Event cards render from the same normalized schema (title, category, venue, event_type) without relying on source-specific branches.

## Coordinate Accuracy
- Default coordinates from discovery and scraper flows are converted to PostGIS using `POINT(lng lat)` with a guard against zero or missing values.
- UI map markers read the same coordinates; zeroed or absent points trigger a safe fallback instead of an invalid map render.

## UX Consistency
- Event detail cards now expose a Location Unknown badge when coordinates fail, preventing crashes and clarifying missing data.
- Time and title formatting is standardized (title case + 24h time), ensuring anchor and signal cards display aligned metadata.

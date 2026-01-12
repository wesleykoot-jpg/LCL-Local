-- Delete old seed events (created before the scraper ran)
DELETE FROM event_attendees 
WHERE event_id IN (
  SELECT id FROM events WHERE created_at < '2026-01-12 20:00:00+00'
);

DELETE FROM events 
WHERE created_at < '2026-01-12 20:00:00+00';
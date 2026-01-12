-- Delete existing events so scraper can re-fetch with better time extraction
DELETE FROM event_attendees;
DELETE FROM events;
-- Insert event attendees for Alex van Berg (first test profile)
-- Linking to multiple upcoming events at different dates

INSERT INTO event_attendees (profile_id, event_id, status, ticket_number) VALUES
-- Tomorrow (Jan 14) - Multiple events
('de595401-5c4f-40fc-8d3a-a627e49780ff', 'adb96d9e-60f5-49f0-a855-61ace082fc45', 'going', 'TKT-001'),
('de595401-5c4f-40fc-8d3a-a627e49780ff', '2a9aefb0-82a5-42b1-b715-819f48b5d362', 'going', 'TKT-002'),
('de595401-5c4f-40fc-8d3a-a627e49780ff', '5dd99a4a-9e15-4ac6-aa8b-89bed8fb7ec3', 'going', 'TKT-003'),

-- Day after (Jan 15)
('de595401-5c4f-40fc-8d3a-a627e49780ff', 'bbd9adcf-158e-49ae-b237-43a396ebeee8', 'going', 'TKT-004'),
('de595401-5c4f-40fc-8d3a-a627e49780ff', '71b39cff-d9a8-4f22-885d-5c2244f6f9c5', 'going', 'TKT-005');

-- Also add some other attendees to make it look realistic
INSERT INTO event_attendees (profile_id, event_id, status) VALUES
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'adb96d9e-60f5-49f0-a855-61ace082fc45', 'going'),
('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'adb96d9e-60f5-49f0-a855-61ace082fc45', 'going'),
('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', '2a9aefb0-82a5-42b1-b715-819f48b5d362', 'going'),
('d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', '5dd99a4a-9e15-4ac6-aa8b-89bed8fb7ec3', 'going');
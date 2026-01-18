-- Seed scraper sources from legacy config.ts
-- This file populates the scraper_sources table with targets defined in the old config.ts

INSERT INTO public.scraper_sources (id, name, url, enabled, strategy, config)
VALUES
    -- SPORTS
    ('eredivisie', 'Eredivisie', 'https://eredivisie.nl/programma', true, 'sports', '{
        "category": "active",
        "schedule": "0 3 * * 1",
        "matchDurationMinutes": 105,
        "league": "Eredivisie",
        "rate_limit_ms": 2000
    }'),
    ('keuken_kampioen', 'Keuken Kampioen Divisie', 'https://keukenkampioendivisie.nl/programma', true, 'sports', '{
        "category": "active",
        "schedule": "0 3 * * 1",
        "matchDurationMinutes": 105,
        "league": "Keuken Kampioen Divisie",
        "rate_limit_ms": 2000
    }'),

    -- MUSIC
    ('paradiso', 'Paradiso', 'https://paradiso.nl/agenda', true, 'music', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "paradiso",
        "rate_limit_ms": 1500
    }'),
    ('ziggo_dome', 'Ziggo Dome', 'https://ziggodome.nl/agenda', true, 'music', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "ziggo_dome",
        "rate_limit_ms": 1500
    }'),
    ('tivolivredenburg', 'TivoliVredenburg', 'https://tivolivredenburg.nl/agenda', true, 'music', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "tivolivredenburg",
        "rate_limit_ms": 1500
    }'),
    ('melkweg', 'Melkweg', 'https://melkweg.nl/agenda', true, 'music', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "melkweg",
        "rate_limit_ms": 1500
    }'),
    ('afas_live', 'AFAS Live', 'https://afaslive.nl/agenda', true, 'music', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "afas_live",
        "rate_limit_ms": 1500
    }'),

    -- NIGHTLIFE
    ('resident_advisor_amsterdam', 'Resident Advisor - Amsterdam', 'https://ra.co/events/nl/amsterdam', true, 'nightlife', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "type": "aggregator",
        "defaultEndTime": "06:00",
        "defaultDurationHours": 6,
        "rate_limit_ms": 3000
    }'),
    ('de_school', 'De School', 'https://deschoolamsterdam.nl/programma', true, 'nightlife', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "de_school",
        "defaultEndTime": "06:00",
        "rate_limit_ms": 3000
    }'),
    ('shelter', 'Shelter', 'https://shelteramsterdam.nl/events', true, 'nightlife', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "shelter",
        "defaultEndTime": "06:00",
        "rate_limit_ms": 3000
    }'),
    ('de_marktkantine', 'De Marktkantine', 'https://marktkantine.nl/programma', true, 'nightlife', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "de_marktkantine",
        "defaultEndTime": "05:00",
        "rate_limit_ms": 3000
    }'),

    -- CULTURE
    ('concertgebouw', 'Concertgebouw', 'https://concertgebouw.nl/agenda', true, 'culture', '{
        "category": "music",
        "schedule": "0 6 * * *",
        "venueKey": "concertgebouw",
        "rate_limit_ms": 1500
    }'),
    ('carre', 'Theater Carré', 'https://carre.nl/agenda', true, 'culture', '{
        "category": "entertainment",
        "schedule": "0 6 * * *",
        "venueKey": "carre",
        "rate_limit_ms": 1500
    }'),
    ('pathe_specials', 'Pathé Specials', 'https://pathe.nl/specials', true, 'culture', '{
        "category": "entertainment",
        "schedule": "0 6 * * *",
        "filterMode": "specials_only",
        "rate_limit_ms": 1500
    }'),

    -- DINING
    ('misset_horeca', 'Misset Horeca - New Openings', 'https://missethoreca.nl/nieuws/opening-restaurants', true, 'dining', '{
        "category": "foodie",
        "schedule": "0 3 * * 1",
        "listType": "new_openings",
        "rate_limit_ms": 2000
    }'),
    ('iens_top', 'Iens Top Lists', 'https://iens.nl/top-restaurants', true, 'dining', '{
        "category": "foodie",
        "schedule": "0 3 * * 1",
        "listType": "curated_list",
        "rate_limit_ms": 2000
    }')

ON CONFLICT (id) DO UPDATE SET
    url = EXCLUDED.url,
    config = public.scraper_sources.config || EXCLUDED.config,
    updated_at = NOW();

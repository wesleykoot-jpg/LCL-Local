-- Create cities table for global event discovery
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null, -- ISO 2-char
  admin1_code text, -- Region/State
  population int default 0,
  continent text, -- 'EU', 'NA', 'AS', 'AF', 'OC', 'SA'
  priority_tier int default 3, -- 1=Global Major, 2=Regional Major, 3=Local
  discovery_status text default 'pending', -- 'pending', 'processing', 'completed', 'failed'
  last_discovery_at timestamptz,
  latitude float,
  longitude float,
  timezone text,
  geoname_id int unique, -- Link to original data
  created_at timestamptz default now()
);

-- Indexes for efficient queue partitioning
create index if not exists cities_discovery_idx on cities (discovery_status, priority_tier, continent);
create index if not exists cities_geoname_id_idx on cities (geoname_id);

-- Enable RLS
alter table cities enable row level security;

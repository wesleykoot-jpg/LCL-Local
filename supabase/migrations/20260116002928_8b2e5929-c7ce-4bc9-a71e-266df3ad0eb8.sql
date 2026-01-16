-- Step 1: Drop the old constraint FIRST
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;

-- Step 2: Migrate existing events with legacy categories to modern categories
UPDATE events SET category = 'music' WHERE category = 'nightlife';
UPDATE events SET category = 'foodie' WHERE category = 'food';
UPDATE events SET category = 'entertainment' WHERE category IN ('culture', 'cinema');
UPDATE events SET category = 'active' WHERE category = 'sports';
UPDATE events SET category = 'workshops' WHERE category = 'crafts';
UPDATE events SET category = 'community' WHERE category = 'market';

-- Step 3: Add the new constraint with modern categories
ALTER TABLE events ADD CONSTRAINT events_category_check 
CHECK (category = ANY (ARRAY['active', 'gaming', 'entertainment', 'social', 'family', 'outdoors', 'music', 'workshops', 'foodie', 'community']::text[]));
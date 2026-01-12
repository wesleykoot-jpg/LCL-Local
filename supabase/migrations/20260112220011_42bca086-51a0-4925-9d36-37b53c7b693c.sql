-- Add all regional event sources for Northern Netherlands
-- Each source includes coordinates for its city center and Dutch language config

-- ============================================
-- DRENTHE PROVINCE (Meppel Expansion)
-- ============================================

INSERT INTO public.scraper_sources (name, url, enabled, config) VALUES
('Dit is Assen', 'https://ditisassen.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.9925, "lng": 6.5625}}'::jsonb),

('Ontdek Emmen', 'https://ontdekemmen.nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.7792, "lng": 6.8969}}'::jsonb),

('Beleef Nijstad Hoogeveen', 'https://beleefnijstad.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.7236, "lng": 6.4764}}'::jsonb),

('Ontdek Meppel', 'https://ontdekmeppel.nl/ontdek-meppel/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.6961, "lng": 6.1944}}'::jsonb),

('Magisch Coevorden', 'https://magischcoevorden.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.6617, "lng": 6.7411}}'::jsonb),

('Hunebed Nieuws Borger-Odoorn', 'https://www.hunebednieuwscafe.nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.9222, "lng": 6.8000}}'::jsonb),

('Brinkdorp Zuidlaren (Tynaarlo)', 'https://brinkdorpzuidlaren.nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.0917, "lng": 6.6833}}'::jsonb),

('Kop van Drenthe (Noordenveld)', 'https://www.kopvandrenthe.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1403, "lng": 6.4292}}'::jsonb),

('Natuurlijk Westerveld', 'https://www.natuurlijkwesterveld.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.8358, "lng": 6.3722}}'::jsonb),

('Drenthe Aa en Hunze', 'https://drenthe.nl/aa-en-hunze/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.0500, "lng": 6.7500}}'::jsonb),

('Belevend Midden-Drenthe', 'https://belevendmiddendrenthe.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.8500, "lng": 6.5167}}'::jsonb),

('Ontdek De Wolden', 'https://www.ontdekdewolden.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.6833, "lng": 6.3833}}'::jsonb);


-- ============================================
-- GRONINGEN PROVINCE
-- ============================================

INSERT INTO public.scraper_sources (name, url, enabled, config) VALUES
('Uit Groningen City', 'https://uit.groningen.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.2194, "lng": 6.5665}}'::jsonb),

('Beleef Eemsdelta', 'https://beleefeemsdelta.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.3167, "lng": 6.8667}}'::jsonb),

('Visit Westerwolde', 'https://visitwesterwolde.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.0083, "lng": 7.1917}}'::jsonb),

('Visit Oldambt', 'https://visitoldambt.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1431, "lng": 7.0347}}'::jsonb),

('Bezoek Het Hogeland', 'https://bezoekhethogeland.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.3667, "lng": 6.5000}}'::jsonb),

('Ontdek Midden-Groningen', 'https://www.ontdekmiddengroningen.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1500, "lng": 6.7500}}'::jsonb),

('RTV Stadskanaal Agenda', 'https://www.rtvstadskanaal.nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.9889, "lng": 6.9500}}'::jsonb),

('Veendam Agenda', 'https://www.veendam.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1081, "lng": 6.8792}}'::jsonb),

('Bezoek Het Westerkwartier', 'https://bezoekhetwesterkwartier.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.2167, "lng": 6.3167}}'::jsonb);


-- ============================================
-- FRIESLAND PROVINCE
-- ============================================

INSERT INTO public.scraper_sources (name, url, enabled, config) VALUES
('Visit Leeuwarden', 'https://www.visitleeuwarden.com/nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.2012, "lng": 5.7999}}'::jsonb),

('Sneek Agenda (Súdwest-Fryslân)', 'https://www.sneek.nl/nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.0333, "lng": 5.6667}}'::jsonb),

('Dokkum Agenda (Noardeast-Fryslân)', 'https://www.dokkum.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.3267, "lng": 5.9992}}'::jsonb),

('Een Gouden Plak (Heerenveen)', 'https://www.eengoudenplak.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.9597, "lng": 5.9250}}'::jsonb),

('Uit in Smallingerland (Drachten)', 'https://www.uitinsmallingerland.nl/nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1167, "lng": 6.1000}}'::jsonb),

('Visit Franeker (Waadhoeke)', 'https://www.visitfraneker.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1869, "lng": 5.5403}}'::jsonb),

('Harlingen Welkom aan Zee', 'https://www.harlingenwelkomaanzee.nl/nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1750, "lng": 5.4167}}'::jsonb),

('Waterland van Friesland (De Fryske Marren)', 'https://www.waterlandvanfriesland.nl/nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.9333, "lng": 5.8000}}'::jsonb),

('Uiteraard Opsterland', 'https://uiteraturopsterland.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.0833, "lng": 6.1167}}'::jsonb),

('Uit aan de Linge (Weststellingwerf)', 'https://uitaandelinge.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.8833, "lng": 5.9667}}'::jsonb),

('Appelscha Agenda (Ooststellingwerf)', 'https://www.appelscha.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 52.9500, "lng": 6.3500}}'::jsonb),

('Dantumadiel Agenda', 'https://www.dantumadiel.frl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.2833, "lng": 6.0333}}'::jsonb),

('Surhuisterveen Centrum (Achtkarspelen)', 'https://www.surhuisterveen-centrum.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1833, "lng": 6.1667}}'::jsonb),

('Burgum Agenda (Tytsjerksteradiel)', 'https://www.burgum.nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.1917, "lng": 5.9917}}'::jsonb);


-- ============================================
-- WADDEN ISLANDS
-- ============================================

INSERT INTO public.scraper_sources (name, url, enabled, config) VALUES
('Texel Agenda', 'https://www.texel.net/nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.0550, "lng": 4.7978}}'::jsonb),

('Vlieland Agenda', 'https://vlieland.net/nl/agenda', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.2500, "lng": 5.0667}}'::jsonb),

('VVV Terschelling Agenda', 'https://www.vvvterschelling.nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.3944, "lng": 5.3500}}'::jsonb),

('VVV Ameland Agenda', 'https://www.vvvameland.nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.4500, "lng": 5.7500}}'::jsonb),

('VVV Schiermonnikoog Agenda', 'https://www.vvvschiermonnikoog.nl/agenda/', true,
 '{"language": "nl", "country": "NL", "default_coordinates": {"lat": 53.4833, "lng": 6.2000}}'::jsonb);


-- Update any existing Meppel sources to have proper config
UPDATE public.scraper_sources 
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{default_coordinates}',
  '{"lat": 52.6961, "lng": 6.1944}'::jsonb
) || '{"language": "nl", "country": "NL"}'::jsonb
WHERE name ILIKE '%meppel%' AND config->>'default_coordinates' IS NULL;
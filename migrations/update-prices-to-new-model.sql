-- Update price settings to NEW pricing model (base = prázdný pokoj)
-- Date: 2025-11-06
--
-- OLD MODEL: base included first adult (base = 300 for small ÚTIA)
-- NEW MODEL: base is empty room, ALL guests pay surcharge
--
-- ÚTIA:
--   Small: 250 Kč (empty) + 50 Kč/adult + 25 Kč/child
--   Large: 350 Kč (empty) + 70 Kč/adult + 35 Kč/child
--
-- External:
--   Small: 400 Kč (empty) + 100 Kč/adult + 50 Kč/child
--   Large: 500 Kč (empty) + 120 Kč/adult + 60 Kč/child

UPDATE settings
SET value = json('{"utia":{"small":{"base":250,"adult":50,"child":25},"large":{"base":350,"adult":70,"child":35}},"external":{"small":{"base":400,"adult":100,"child":50},"large":{"base":500,"adult":120,"child":60}}}')
WHERE key = 'prices';

-- Verify the update
SELECT key, value FROM settings WHERE key = 'prices';

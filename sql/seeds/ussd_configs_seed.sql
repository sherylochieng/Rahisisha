-- =====================================================================
-- ussd_configs_seed.sql : two demo shops, two different USSD codes
-- =====================================================================
-- WHY THIS FILE EXISTS
--   The USSD endpoint needs at least two shops in the phone book to
--   prove that each code opens ITS OWN shop and no other.
--
-- WHY IMPORTANT
--   Without two different codes there is nothing to route, and the
--   cross-tenant test has nothing to attack.
--
-- DANGER
--   NEVER seed two shops with the same code (UNIQUE blocks it).
--   NEVER run this against the live (staging) database by accident:
--   it is for a laptop or CI.
--
-- WHAT IT SOLVES
--   Gives every developer the same two demo codes.
--
-- SYSTEM DESIGN PRINCIPLE
--   Idempotent: running it twice leaves the same result as running it
--   once. Shops are found by SLUG, because ids differ per database.
--
-- RULES
--   1. Look shops up by slug, never hard-code an id.
--   2. ON CONFLICT (tenant_id) DO UPDATE keeps it safe to re-run.
--   3. Keep welcome_text short (the table allows 100 characters).
--
-- PRACTICAL EXAMPLE
--   Dial *384*101#  ->  "Karibu Amina's Boutique" menu
--   Dial *384*102#  ->  "Welcome to Brio Hardware" menu
--
-- DECISIONS
--   * Codes *384*101# and *384*102# are demo values. Real codes come
--     from Africa's Talking.
--   * If a slug does not exist, the insert adds nothing. The check at
--     the bottom prints the rows so you can see it.
--
-- WHERE USED
--   Local development, the USSD tests, later the demo data script.
--
-- TRADEOFFS
--   + Safe to re-run, same on every machine.
--   - If a shop is renamed (slug changes), its row is silently skipped.
--
-- HOW TO USE
--   psql -h localhost -U rahisisha_user -d rahisisha -f sql/seeds/ussd_configs_seed.sql
-- =====================================================================

INSERT INTO ussd_configs (tenant_id, service_code, welcome_text)
SELECT id, '*384*101#', 'Karibu Amina''s Boutique'
FROM tenants WHERE slug = 'aminas-boutique'
ON CONFLICT (tenant_id) DO UPDATE
  SET service_code = EXCLUDED.service_code,
      welcome_text = EXCLUDED.welcome_text;

INSERT INTO ussd_configs (tenant_id, service_code, welcome_text)
SELECT id, '*384*102#', 'Welcome to Brio Hardware'
FROM tenants WHERE slug = 'brio-hardware'
ON CONFLICT (tenant_id) DO UPDATE
  SET service_code = EXCLUDED.service_code,
      welcome_text = EXCLUDED.welcome_text;

-- Show the result so you can check it by eye
SELECT t.slug, u.service_code, u.welcome_text
FROM ussd_configs u
JOIN tenants t ON t.id = u.tenant_id
ORDER BY u.service_code;
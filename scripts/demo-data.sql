-- ═══════════════════════════════════════════════════════════
-- FILE: scripts/demo-data.sql
-- ═══════════════════════════════════════════════════════════
--
-- WHY THIS FILE EXISTS
--   After reset-db.sh the database is empty. This file adds 3
--   demo shops (each with an owner, products, customers and some
--   wallet money) so a demo or review starts from a ready,
--   realistic app.
--
-- WHY IMPORTANT
--   Demos and reviews should never begin with an empty app or a
--   pile of "Happy Path Shop" test junk. This gives the same 3
--   shops every time.
--
-- DANGER (what breaks without it, or if misused)
--   - Without it: an empty app at every demo.
--   - Without the set_config lines: every insert into a locked
--     table fails with "row-level security policy" errors.
--   - If NOT idempotent: running it twice would fail on the
--     unique phone/slug, or create duplicates.
--   - On production: the demo owners have a PUBLIC password
--     (see below). NEVER load this file on a real database.
--
-- WHAT IT SOLVES
--   One file that creates 3 consistent demo shops, safely, and
--   can be run again without making a mess.
--
-- SYSTEM DESIGN PRINCIPLE
--   "Idempotent setup": running it once or ten times gives the
--   same result. Fixed IDs plus ON CONFLICT DO NOTHING.
--   Also "respect the locks": we do not bypass row-level
--   security. We stamp each shop (set_config) like the app does,
--   so this file proves the locks work with a legitimate writer.
--   And "atomic": BEGIN ... COMMIT makes the whole file
--   all-or-nothing.
--
-- RULES (never do this)
--   1. NEVER load this on production. The demo password is in
--      this file, so anyone can read it.
--   2. NEVER put real customer names, phones or money here.
--      All phones below are obviously fake.
--   3. NEVER remove a set_config line. Every locked table needs
--      its shop stamped first.
--   4. NEVER switch set_config's last argument to false. true
--      means the stamp ends with the transaction and cannot leak
--      to another connection user.
--   5. NEVER use random UUIDs here. Fixed IDs are what make a
--      second run skip instead of duplicate.
--
-- DEMO LOGINS (password for all three: Demo1234!)
--   0711000001  Amina Wanjiru  -> Amina's Boutique        (starter)
--   0711000002  Baraka Otieno  -> Baraka Electronics      (growth)
--   0711000003  Njeri Kamau    -> Mama Njeri Groceries    (starter)
--
-- PRACTICAL EXAMPLE
--   bash scripts/reset-db.sh          (loads this at step 5)
--   or by hand, any time:
--   psql -U rahisisha_user -h localhost -d rahisisha \
--        -v ON_ERROR_STOP=1 -f scripts/demo-data.sql
--   Then log in at /login with 0711000001 / Demo1234!
--
-- DECISIONS
--   - ON CONFLICT DO NOTHING (no target): skips on ANY unique
--     clash (id, phone, slug, sku). One rule for every table.
--   - Fixed UUIDs are readable on purpose:
--       aaaaaaaa = tenants    bbbbbbbb = users
--       cccccccc = memberships dddddddd = products
--       eeeeeeee = customers  ffffffff = wallet entries
--     and the last digits say which shop/row.
--   - The password hash is bcrypt (cost 12) of Demo1234!, the
--     same kind the API's login checks with bcrypt.compare.
--   - Wallet gets one 'sale' credit per shop so the dashboard
--     balance is not zero. wallet_entries is append-only, and
--     we only INSERT, never update or delete.
--   - No demo orders: an order needs items and a status story.
--     That can come later if the demo needs it.
--
-- WHERE YOU WILL USE THIS
--   - Called by scripts/reset-db.sh (step 5)
--   - By hand before a demo, to restore the 3 shops
--
-- TRADEOFFS
--   + Safe to run again, atomic, readable.
--   - "Do nothing on conflict" means a changed demo row (say a
--     price you edited) is NOT put back. For a true reset, run
--     reset-db.sh, which rebuilds everything.
--   - The demo password is public. Fine for dev, never for prod.
--
-- HOW TO USE
--   See PRACTICAL EXAMPLE. Always pass -v ON_ERROR_STOP=1 so it
--   stops at the first problem.
--
-- ═══════════════════════════════════════════════════════════
-- EXPLAINED PIECE BY PIECE (real life + where / when / how)
-- ═══════════════════════════════════════════════════════════
--
-- 1. BEGIN ... COMMIT  =  ONE ALL-OR-NOTHING BOX
--    Everything inside is saved together at COMMIT. If anything
--    fails before that, none of it is saved.
--
-- 2. Fixed IDs  =  A NAME TAG ON EVERY ITEM
--    The second time, the database sees the same tag and says
--    "already here".
--
-- 3. ON CONFLICT DO NOTHING  =  "IF IT'S ALREADY THERE, SKIP"
--    Like not setting a plate that is already on the table.
--
-- 4. set_config('app.current_tenant', id, true)
--    =  PUTTING ON THE SHOP'S STAFF BADGE
--    The database only lets you write rows for the shop on your
--    badge. 'true' means the badge comes off at COMMIT.
--
-- 5. tenants and users have no stamp
--    =  THE FRONT DESK AND THE VISITOR BOOK
--    They are global tables with no lock, so anyone allowed to
--    write may add to them.
--
-- 6. The three blocks (one per shop)
--    =  THREE ROOMS, EACH WITH ITS OWN BADGE
--    Same pattern three times, only the shop changes.
--
-- 7. Prices in cents: 350000 = KES 3,500.00
--    The app keeps money as whole numbers.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────
-- SHOP 1: Amina's Boutique  (dresses)
-- ───────────────────────────────────────────────────────────

-- Global tables first (no lock, no badge needed)
INSERT INTO tenants (id, name, slug, plan, status) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Amina''s Boutique', 'aminas-boutique', 'starter', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, phone, name, password_hash) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', '0711000001', 'Amina Wanjiru',
   '$2a$12$jC.mZpvBWUCCoDTL0Ms8tOgRu.mIkJRmf0F.a7VuMn.rLf05eTvM2')
ON CONFLICT DO NOTHING;

-- Put on Shop 1's badge. From here until the next set_config,
-- every locked table treats us as Amina's Boutique.
SELECT set_config('app.current_tenant', 'aaaaaaaa-0000-4000-8000-000000000001', true);

INSERT INTO memberships (id, tenant_id, user_id, role) VALUES
  ('cccccccc-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001',
   'bbbbbbbb-0000-4000-8000-000000000001', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO products (id, tenant_id, sku, name, description, price_cents, status) VALUES
  ('dddddddd-0000-4000-8000-000000000101', 'aaaaaaaa-0000-4000-8000-000000000001', 'AMN-1', 'Ankara Wrap Dress',   'Vibrant ankara print wrap dress', 350000, 'active'),
  ('dddddddd-0000-4000-8000-000000000102', 'aaaaaaaa-0000-4000-8000-000000000001', 'AMN-2', 'Linen Shift Dress',   'Lightweight linen shift dress',   280000, 'active'),
  ('dddddddd-0000-4000-8000-000000000103', 'aaaaaaaa-0000-4000-8000-000000000001', 'AMN-3', 'Beaded Evening Gown', 'Hand-beaded evening gown',        850000, 'active'),
  ('dddddddd-0000-4000-8000-000000000104', 'aaaaaaaa-0000-4000-8000-000000000001', 'AMN-4', 'Casual Sundress',     'Breathable cotton sundress',      180000, 'draft')
ON CONFLICT DO NOTHING;

INSERT INTO customers (id, tenant_id, phone, name, channel) VALUES
  ('eeeeeeee-0000-4000-8000-000000000101', 'aaaaaaaa-0000-4000-8000-000000000001', '0733000101', 'Demo Customer A1', 'whatsapp'),
  ('eeeeeeee-0000-4000-8000-000000000102', 'aaaaaaaa-0000-4000-8000-000000000001', '0733000102', 'Demo Customer A2', 'web')
ON CONFLICT DO NOTHING;

INSERT INTO wallet_entries (id, tenant_id, amount_cents, reason, reference) VALUES
  ('ffffffff-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 350000, 'sale', 'demo-seed')
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- SHOP 2: Baraka Electronics  (phone accessories)
-- ───────────────────────────────────────────────────────────

INSERT INTO tenants (id, name, slug, plan, status) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Baraka Electronics', 'baraka-electronics', 'growth', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, phone, name, password_hash) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000002', '0711000002', 'Baraka Otieno',
   '$2a$12$jC.mZpvBWUCCoDTL0Ms8tOgRu.mIkJRmf0F.a7VuMn.rLf05eTvM2')
ON CONFLICT DO NOTHING;

-- Change badge: now we are Shop 2
SELECT set_config('app.current_tenant', 'aaaaaaaa-0000-4000-8000-000000000002', true);

INSERT INTO memberships (id, tenant_id, user_id, role) VALUES
  ('cccccccc-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000002',
   'bbbbbbbb-0000-4000-8000-000000000002', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO products (id, tenant_id, sku, name, description, price_cents, status) VALUES
  ('dddddddd-0000-4000-8000-000000000201', 'aaaaaaaa-0000-4000-8000-000000000002', 'BRK-1', 'USB-C Fast Charger', '20W fast charger with cable',  120000, 'active'),
  ('dddddddd-0000-4000-8000-000000000202', 'aaaaaaaa-0000-4000-8000-000000000002', 'BRK-2', 'Wired Earphones',    'Earphones with microphone',    80000, 'active'),
  ('dddddddd-0000-4000-8000-000000000203', 'aaaaaaaa-0000-4000-8000-000000000002', 'BRK-3', 'Power Bank 10000mAh','Slim portable power bank',    250000, 'active'),
  ('dddddddd-0000-4000-8000-000000000204', 'aaaaaaaa-0000-4000-8000-000000000002', 'BRK-4', 'Phone Case',         'Shockproof phone case',        50000, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO customers (id, tenant_id, phone, name, channel) VALUES
  ('eeeeeeee-0000-4000-8000-000000000201', 'aaaaaaaa-0000-4000-8000-000000000002', '0733000201', 'Demo Customer B1', 'whatsapp'),
  ('eeeeeeee-0000-4000-8000-000000000202', 'aaaaaaaa-0000-4000-8000-000000000002', '0733000202', 'Demo Customer B2', 'ussd')
ON CONFLICT DO NOTHING;

INSERT INTO wallet_entries (id, tenant_id, amount_cents, reason, reference) VALUES
  ('ffffffff-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 250000, 'sale', 'demo-seed')
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────
-- SHOP 3: Mama Njeri Groceries  (everyday food)
-- ───────────────────────────────────────────────────────────

INSERT INTO tenants (id, name, slug, plan, status) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Mama Njeri Groceries', 'mama-njeri-groceries', 'starter', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, phone, name, password_hash) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000003', '0711000003', 'Njeri Kamau',
   '$2a$12$jC.mZpvBWUCCoDTL0Ms8tOgRu.mIkJRmf0F.a7VuMn.rLf05eTvM2')
ON CONFLICT DO NOTHING;

-- Change badge: now we are Shop 3
SELECT set_config('app.current_tenant', 'aaaaaaaa-0000-4000-8000-000000000003', true);

INSERT INTO memberships (id, tenant_id, user_id, role) VALUES
  ('cccccccc-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-000000000003',
   'bbbbbbbb-0000-4000-8000-000000000003', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO products (id, tenant_id, sku, name, description, price_cents, status) VALUES
  ('dddddddd-0000-4000-8000-000000000301', 'aaaaaaaa-0000-4000-8000-000000000003', 'NJR-1', 'Maize Flour 2kg', 'Sifted maize flour, 2kg pack', 18000, 'active'),
  ('dddddddd-0000-4000-8000-000000000302', 'aaaaaaaa-0000-4000-8000-000000000003', 'NJR-2', 'Cooking Oil 1L',   'Vegetable cooking oil, 1 litre', 32000, 'active'),
  ('dddddddd-0000-4000-8000-000000000303', 'aaaaaaaa-0000-4000-8000-000000000003', 'NJR-3', 'Sugar 1kg',       'White sugar, 1kg pack',          16000, 'active'),
  ('dddddddd-0000-4000-8000-000000000304', 'aaaaaaaa-0000-4000-8000-000000000003', 'NJR-4', 'Rice 2kg',        'Pishori rice, 2kg pack',         35000, 'archived')
ON CONFLICT DO NOTHING;

INSERT INTO customers (id, tenant_id, phone, name, channel) VALUES
  ('eeeeeeee-0000-4000-8000-000000000301', 'aaaaaaaa-0000-4000-8000-000000000003', '0733000301', 'Demo Customer C1', 'whatsapp'),
  ('eeeeeeee-0000-4000-8000-000000000302', 'aaaaaaaa-0000-4000-8000-000000000003', '0733000302', 'Demo Customer C2', 'web')
ON CONFLICT DO NOTHING;

INSERT INTO wallet_entries (id, tenant_id, amount_cents, reason, reference) VALUES
  ('ffffffff-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003', 120000, 'sale', 'demo-seed')
ON CONFLICT DO NOTHING;

COMMIT;
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
--   - On production: these are KNOWN demo logins (names and phones
--     are in this public repo). NEVER load this file on a real
--     database.
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
--   1. NEVER load this on production. The three demo logins are
--      listed in this public file, so anyone knows who they are.
--      (Since Week 30 Day 3 the PASSWORD is no longer in the file,
--      see the WEEK 30 DAY 3 CHANGE note below.)
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
-- DEMO LOGINS (password for all three: the one YOU pass when you run
--              the file, see HOW TO USE. It is not written here.)
--   0711000001  Amina Wanjiru  -> Amina's Boutique        (starter)
--   0711000002  Baraka Otieno  -> Baraka Electronics      (growth)
--   0711000003  Njeri Kamau    -> Mama Njeri Groceries    (starter)
--
-- PRACTICAL EXAMPLE
--   bash scripts/reset-db.sh          (loads this at step 5)
--   or by hand, any time:
--   psql -U rahisisha_user -h localhost -d rahisisha \
--        -v ON_ERROR_STOP=1 -v demo_password="your-own-12+-char-phrase" \
--        -f scripts/demo-data.sql
--   Then log in at /login with 0711000001 and your own phrase.
--
-- DECISIONS
--   - ON CONFLICT DO NOTHING (no target): skips on ANY unique
--     clash (id, phone, slug, sku). One rule for every table.
--   - Fixed UUIDs are readable on purpose:
--       aaaaaaaa = tenants    bbbbbbbb = users
--       cccccccc = memberships dddddddd = products
--       eeeeeeee = customers  ffffffff = wallet entries
--     and the last digits say which shop/row.
--   - The password hash is bcrypt (cost 12), the same kind the
--     API's login checks with bcrypt.compare. Since Week 30 Day 3 it
--     is made WHEN YOU RUN the file from the password you pass in
--     (crypt + gen_salt('bf', 12) from pgcrypto), so no hash of a
--     public password is stored in the repo.
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
--   - The demo logins are known. Fine for dev, never for prod. The
--     password is yours, but you must pass it each time you run the
--     file (reset-db.sh must pass it too).
--
-- HOW TO USE
--   See PRACTICAL EXAMPLE. Always pass -v ON_ERROR_STOP=1 so it
--   stops at the first problem, and -v demo_password="..." so the
--   demo owners get a password only you know.
--
-- WEEK 30 DAY 3 CHANGE (why the file now asks for a password)
--   This repo is PUBLIC. The file used to hold a ready-made scrambled
--   copy of the public demo password, so anyone could log in as these
--   three owners on any database where it was loaded. A staging
--   database had exactly that, and the three accounts had to be
--   locked on 27 November 2026.
--   Now the file refuses to run unless you pass demo_password (12 or
--   more characters, and not the old public one). It scrambles that
--   password itself, once, and uses the result for all three owners.
--   Real life: the shop gives you an empty till drawer, and YOU set the
--   PIN on the day you open, instead of everyone sharing one printed PIN.
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
--
-- 8. The password check at the top (Week 30 Day 3)  =  THE GATE GUARD
--    Before anything is written, three small checks run: a password
--    was passed, it is 12 or more characters, and it is not the old
--    public one. If a check fails, psql says why and quits. Nothing
--    has started, so nothing is saved.
--
-- 9. crypt(:'demo_password', gen_salt('bf', 12))  =  SETTING THE PIN
--    gen_salt makes a random "pinch of salt", crypt scrambles the
--    password with it one way (bcrypt, cost 12). The result is kept in
--    the psql variable demo_hash and used for all three owners. The
--    database never stores the real password.
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- GATE GUARD (Week 30 Day 3): the demo password must be passed in.
-- Real life: the guard checks your pass before opening the gate.
-- These lines run BEFORE "BEGIN", so a refusal writes nothing.
-- \if :{?demo_password} asks: "did the person pass -v demo_password=?"
-- ───────────────────────────────────────────────────────────
\if :{?demo_password}
\else
  \echo 'Stopped: pass a password, for example: -v demo_password="your-own-12+-char-phrase"'
  \echo 'Nothing was written to the database.'
  \quit
\endif

-- Is it long enough? (12 or more characters.) \gset saves the true/false
-- answer into a psql variable called pw_long_enough.
SELECT (length(:'demo_password') >= 12) AS pw_long_enough \gset
\if :pw_long_enough
\else
  \echo 'Stopped: demo_password must be 12 or more characters.'
  \echo 'Nothing was written to the database.'
  \quit
\endif

-- Is it the OLD public password? That one is in the repo history for good,
-- so it must never protect an account again. lower() ignores capital letters.
SELECT (lower(:'demo_password') LIKE 'demo1234%') AS pw_is_old \gset
\if :pw_is_old
  \echo 'Stopped: that is the old public demo password. Choose a new one.'
  \echo 'Nothing was written to the database.'
  \quit
\endif

-- Scramble the password ONE WAY (bcrypt, cost 12) and keep the result in
-- the psql variable demo_hash. It is used for the three owners below.
-- pgcrypto was already installed by SCHEMA.sql (CREATE EXTENSION pgcrypto).
SELECT crypt(:'demo_password', gen_salt('bf', 12)) AS demo_hash \gset

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
   :'demo_hash')
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
   :'demo_hash')
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
   :'demo_hash')
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
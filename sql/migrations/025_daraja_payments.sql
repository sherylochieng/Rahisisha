-- FILE: sql/migrations/025_daraja_payments.sql
--
-- WHY THIS FILE EXISTS
--   Week 29 Day 3 (M-Pesa per tenant). Every shop gets paid into its OWN
--   M-Pesa till, so every shop needs its own Daraja keys. We also need a
--   notebook of every payment we asked for, so that when Safaricom calls us
--   back we can check "yes, I really asked for this one".
--
-- WHY IMPORTANT
--   This is MONEY. A wrong row here means a shop is paid for something that
--   was never paid, or a real payment is lost. Two small tables, written
--   slowly, are far easier to audit than payment code scattered everywhere.
--
-- DANGER
--   - The three secret columns (consumer key, consumer secret, passkey) must
--     NEVER hold plain text. Encrypt first (utils/kms.js), store the
--     scrambled text only. The repo is public: never commit a real key.
--   - payment_attempts is the proof that WE started a payment. Never insert
--     a row with status 'paid' from anywhere except the verified callback.
--   - Never UPDATE a paid attempt back to pending, and never delete one.
--     It is the paper trail.
--
-- WHAT IT SOLVES
--   1. daraja_configs   : shop <-> its Daraja env, shortcode, encrypted keys
--   2. payment_attempts : one row per STK push; pending -> paid / failed
--
-- SYSTEM DESIGN PRINCIPLE
--   Per-tenant credentials, plus idempotency enforced by the DATABASE: even
--   if the code has a bug, the same M-Pesa receipt can be saved only once
--   and one order can be marked paid only once.
--
-- RULES
--   1. One config row per shop (tenant_id is the primary key).
--   2. checkout_request_id is UNIQUE: it is Safaricom's id for ONE push, and
--      it is how a callback is matched to the push we really started.
--   3. The same M-Pesa receipt cannot be saved twice for a shop
--      (partial unique index on mpesa_reference).
--   4. An order can have only ONE paid attempt (partial unique index).
--   5. Both tables have RLS like every other shop table.
--
-- PRACTICAL EXAMPLE
--   Amina's customer taps Pay on order O1 (KES 1,500). We write a pending
--   row (amount_cents 150000, checkout_request_id "ws_CO_123"). Safaricom
--   calls back "ws_CO_123 paid, receipt QGH7XYZ123". We find the pending row,
--   credit Amina's wallet once, mark order O1 paid and the attempt paid.
--   Safaricom calls back AGAIN with the same receipt: the row is no longer
--   pending, so nothing happens. Amina is credited ONCE.
--
-- DECISIONS (and WHY)
--   - Unlike whatsapp_configs, daraja_configs HAS RLS. Both the pay route
--     (logged-in owner) and the callback route (shop id in the URL) know the
--     shop BEFORE they read the config, so the lock works and the secrets
--     are protected from other shops by the database itself.
--   - amount_cents is copied from the order at the time of the push, so the
--     callback can compare the amount Safaricom reports with what we asked.
--   - phone is stored for reconciliation. It is personal data: never log it.
--   - callback_url is stored per shop so each shop's push points back to
--     /callbacks/mpesa/<its own tenant id>.
--   - Policies use NULLIF(...,'') so an empty setting returns no rows
--     instead of a cast error (same as migrations 022 and 024).
--   - ON DELETE RESTRICT on order_id: an order with payment history cannot
--     be deleted by accident.
--
-- WHERE USED / FUTURE USES
--   POST /v1/orders/:id/pay, POST /callbacks/mpesa/:tenantId, a nightly
--   reconciliation job (stretch), refunds (stretch).
--
-- TRADEOFFS
--   + The database refuses duplicates even if the code is wrong.
--   - One key for all secrets (KMS_KEY): if it leaks together with a copy of
--     daraja_configs, every shop's keys are readable. Key rotation is a
--     later step (the stored format is versioned for it).
--   - payment_attempts grows forever; archive old rows later.
--
-- HOW TO USE
--   Local DB, as postgres (rahisisha_user cannot create in schema public):
--     psql -U postgres -d rahisisha
--     \i sql/migrations/025_daraja_payments.sql
--   The ALTER OWNER lines at the end give the tables back to rahisisha_user.

BEGIN;

CREATE TABLE daraja_configs (
  tenant_id                 UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  env                       TEXT NOT NULL CHECK (env IN ('sandbox','production')),
  consumer_key_encrypted    TEXT NOT NULL,
  consumer_secret_encrypted TEXT NOT NULL,
  shortcode                 TEXT NOT NULL,
  passkey_encrypted         TEXT NOT NULL,
  callback_url              TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id            UUID NOT NULL REFERENCES orders(id)  ON DELETE RESTRICT,
  amount_cents        BIGINT NOT NULL CHECK (amount_cents > 0),
  phone               TEXT NOT NULL,
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','failed')),
  mpesa_reference     TEXT,
  result_code         INTEGER,
  result_desc         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rule 3: the same receipt can be saved only once per shop.
CREATE UNIQUE INDEX payment_attempts_receipt_uniq
  ON payment_attempts (tenant_id, mpesa_reference)
  WHERE mpesa_reference IS NOT NULL;

-- Rule 4: an order can be paid only once.
CREATE UNIQUE INDEX payment_attempts_one_paid_per_order
  ON payment_attempts (order_id)
  WHERE status = 'paid';

CREATE INDEX payment_attempts_tenant_idx
  ON payment_attempts (tenant_id, created_at DESC);

ALTER TABLE daraja_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE daraja_configs   FORCE  ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON daraja_configs
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

CREATE POLICY tenant_isolation ON payment_attempts
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

ALTER TABLE daraja_configs   OWNER TO rahisisha_user;
ALTER TABLE payment_attempts OWNER TO rahisisha_user;

COMMIT;
-- FILE: sql/migrations/024_whatsapp_configs.sql
--
-- WHY THIS FILE EXISTS
--   Week 29 Day 2 (WhatsApp per tenant). Every shop has its own WhatsApp
--   number and its own Meta token. We need a place to keep them, and a place
--   to remember which messages we already handled.
--
-- WHY IMPORTANT
--   The webhook is ONE public door for all shops. Meta only tells us a
--   phone_number_id. This table is how we turn that id into a shop.
--
-- DANGER
--   - access_token_encrypted must NEVER hold a plain token. Encrypt first
--     (AES-GCM helper), store the scrambled text only.
--   - whatsapp_configs has NO RLS (see DECISIONS). Never SELECT * from it in
--     a route a shop owner can reach. Only the webhook code reads it.
--   - Never put a real token in a seed or a commit. The repo is public.
--
-- WHAT IT SOLVES
--   1. whatsapp_configs : shop <-> phone_number_id + encrypted token
--   2. whatsapp_dedupe  : Meta retries; same message_id must run only once
--
-- SYSTEM DESIGN PRINCIPLE
--   Per-tenant credentials (one shop's key opens only that shop's door) and
--   idempotency (doing the same message twice has the same result as once).
--
-- RULES
--   1. One WhatsApp number belongs to ONE shop (UNIQUE phone_number_id).
--   2. Dedupe key is (tenant_id, message_id), never the message text.
--   3. whatsapp_dedupe has RLS like every other shop table.
--
-- PRACTICAL EXAMPLE
--   Meta sends a message for phone_number_id "1234". We look up 1234 ->
--   Amina's shop. We lock the database to Amina. Meta retries the same
--   message_id "wamid.X": the insert into whatsapp_dedupe hits the primary
--   key, so we skip it. Amina's customer gets ONE reply, not two.
--
-- DECISIONS (and WHY)
--   - whatsapp_configs has no RLS: the webhook reads it BEFORE it knows the
--     shop, so an RLS rule on app.current_tenant would hide every row.
--     Same reason as ussd_configs (migration 023). The token column is
--     encrypted, so a leak of this table alone does not reveal tokens.
--   - webhook_verify_token is UNIQUE: Meta's GET verify call carries only
--     the verify token, so that is how we find the shop for that call.
--   - ON DELETE CASCADE: deleting a shop removes its config and dedupe rows.
--
-- WHERE USED / FUTURE USES
--   POST/GET /webhooks/whatsapp (tenant resolution), sendWhatsApp(),
--   key rotation (stretch), template messages (stretch).
--
-- TRADEOFFS
--   + Simple lookup by one indexed column.
--   - whatsapp_configs sits outside RLS; protection is encryption + only the
--     webhook code reads it. whatsapp_dedupe grows forever (clean old rows
--     later with a scheduled job).
--
-- HOW TO USE
--   Local DB, as postgres (rahisisha_user cannot create in schema public):
--     psql -U postgres -d rahisisha
--     \i sql/migrations/024_whatsapp_configs.sql
--   The ALTER OWNER lines at the end give the tables back to rahisisha_user.

BEGIN;

CREATE TABLE whatsapp_configs (
  tenant_id              UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id        TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  webhook_verify_token   TEXT NOT NULL UNIQUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE whatsapp_dedupe (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id  TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, message_id)
);

ALTER TABLE whatsapp_dedupe ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_dedupe FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON whatsapp_dedupe
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID);

ALTER TABLE whatsapp_configs OWNER TO rahisisha_user;
ALTER TABLE whatsapp_dedupe  OWNER TO rahisisha_user;

COMMIT;
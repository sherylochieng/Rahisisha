<!-- FILE: apps/api/docs/AI_AUDIT_week_29_day2.md -->
<!-- WHY: Week 29 Day 2 submission requires an AI audit. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 29 Day 2 (WhatsApp Per Tenant)

**Author:** Sheryl
**Date:** 13 November 2026
**Week 29 rule:** 25% manual / 75% AI. AI **allowed** for webhook boilerplate. AI **NOT allowed** for token handling and tenant resolution. Audit required.

This audit says what actually happened, including where the AI help went beyond what the rule allows.

---

## 1. The most important lines in this audit

**Token handling and tenant resolution were written by the AI.** The assignment says AI is NOT allowed for them.

- The AI flagged the rule before starting, and offered two choices: Sheryl types them herself, or the AI writes them and the audit says so.
- Sheryl chose to have the AI write them (time pressure). This is the same choice as Week 29 Day 1.
- AI-written, manual-only areas:
  - `apps/api/src/utils/kms.js`: AES-256-GCM encrypt and decrypt of tokens (token handling).
  - `apps/api/src/services/whatsapp.service.js`: finds the shop's token, decrypts it, calls Meta, never logs it (token handling).
  - `apps/api/src/middleware/resolveWhatsappTenant.js`: finds the shop from Meta's `phone_number_id` (tenant resolution).
- `whatsapp-security.md` (the 5 to 7 sentences "in your own words") was also **written by the AI**. Sheryl read it before committing. It is not in her own words.

**Sheryl's part in it:**

- **Decision (SELF):** chose that the AI writes token handling and tenant resolution (declared here).
- **Design input (SELF):** asked for the intros of the USSD and WhatsApp tables in `SCHEMA.sql` to be clear and noticeable like the other tables, and asked for explanations of the code inside the files (test files and the controller). The files were changed on her request.
- **Applying (SELF):** created and saved every file, applied each edit, and ran `node --check` on every file herself.
- **Database (SELF):** ran migration 024 as `postgres` herself and checked both tables with `\d`.
- **Checking (SELF):** checked every file change with `git diff --stat` (SCHEMA.sql, isolation.test.js, reset-db.sh, ci.yml, app.js, .env.example) to confirm nothing important was removed.
- **Testing (SELF):** ran every test file herself. Results: kms 9 passed, cross-tenant 11 passed, sender 10 passed, isolation suite 89 passed after the guard change.
- **Secrets (SELF):** made her own encryption key, put it only in her local `.env`, and checked it with a length test that does not print it. No key or token was pasted in chat or committed.
- **Git (SELF):** every commit is tagged `[Week 29 Day 2]`, one commit per file.
- **Not SELF:** she did not type the lines in `kms.js`, `whatsapp.service.js` or `resolveWhatsappTenant.js`.

---

## 2. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | `whatsapp_configs` and `whatsapp_dedupe` tables | `sql/migrations/024_whatsapp_configs.sql`, `sql/SCHEMA.sql` | AI wrote the SQL (shape from the assignment, plus a few additions, see section 4). Sheryl ran it as `postgres` and checked it. |
| 1 | Encryption at rest | `apps/api/src/utils/kms.js`, `apps/api/.env.example` | **AI wrote all of it (see section 1).** Sheryl made the key and tested it. |
| 2 | Webhook, tenant by `phone_number_id` | `middleware/resolveWhatsappTenant.js`, `routes/whatsapp.routes.js`, `app.js` | **AI wrote the tenant resolution (see section 1).** Routes and mount are boilerplate (allowed). |
| 2 | Verify challenge, inbound handling | `controllers/whatsapp.controller.js` | AI wrote it (webhook boilerplate, allowed). |
| 3 | Shared sender | `services/whatsapp.service.js` | **AI wrote all of it (see section 1).** |
| 4 | Dedupe per shop | `whatsapp_dedupe` + `whatsapp.controller.js` | AI wrote it. Proven by the cross-tenant test. |
| 5 | Security notes | `whatsapp-security.md` | **AI wrote the 7 sentences.** The assignment says "your own words". |
| - | Tests | `tests/kms.test.js`, `tests/whatsapp.service.test.js`, `tests/isolation/whatsapp.cross-tenant.test.js`, `tests/isolation.test.js` (guard) | AI wrote them (tests, allowed). Sheryl ran them. |
| - | Count updates | `scripts/reset-db.sh`, `.github/workflows/ci.yml` | AI gave the 3 + 3 one-line edits (17 policies to 18). Sheryl applied them. |
| - | Guides | `docs/src/utils/kms.md`, `docs/tests/kms.test.md`, this audit | AI wrote them (documentation). |

---

## 3. Security-sensitive lines

**AI** = AI wrote it. **SELF** = Sheryl wrote it. **MIXED** = AI wrote the shape, Sheryl supplied the value.

The "Re-read" column is for Sheryl to tick after she has genuinely re-read that line. **Nobody but Sheryl ticks these boxes.** Sheryl confirmed she re-read all of them on 13 November 2026 and asked for them to be ticked.

### `apps/api/src/middleware/resolveWhatsappTenant.js` (tenant resolution)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id` | Reads the number that was messaged (never the customer's number) | AI | ☑ |
| `typeof phoneNumberId !== 'string' \|\| ...length === 0` then `200 { ignored: true }` | A missing or odd value is ignored, nothing else is read | AI | ☑ |
| `SELECT tenant_id FROM whatsapp_configs WHERE phone_number_id = $1` | Finds the shop, with a safe `$1` slot. Selects only `tenant_id`, never the token | AI | ☑ |
| `if (!rows[0]) ... 200 { ignored: true }` | Unknown number: answer 200 so Meta stops retrying | AI | ☑ |
| `req.tenantId = rows[0].tenant_id` | Stamps the shop on the request | AI | ☑ |
| `catch (err) { return next(err) }` | Database error goes to the error handler | AI | ☑ |

### `apps/api/src/utils/kms.js` (token handling)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `process.env.KMS_KEY` read at call time, must be 32 bytes | Key comes from the environment, never from code. Wrong or missing key throws | AI | ☑ |
| `crypto.randomBytes(12)` for every encryption | A fresh random IV every time | AI | ☑ |
| `cipher.setAAD(Buffer.from(context))` and the same on decrypt | Locks the token to its shop. A token copied to another shop will not decrypt | AI | ☑ |
| Stored format `v1.<iv>.<tag>.<ciphertext>` | Versioned, with a tamper seal | AI | ☑ |
| `throw new Error('Could not decrypt the stored secret')` | One generic error, no details that could leak the key or data | AI | ☑ |

### `apps/api/src/services/whatsapp.service.js` (token handling)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `WHERE tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID` | `whatsapp_configs` has no RLS, so the query itself filters by the shop the lock is set to. No lock means no row, never "all rows" | AI | ☑ |
| `decryptSecret(access_token_encrypted, tenant_id)` | Decrypts at the last moment, in memory only | AI | ☑ |
| No `console.*` anywhere in the file | The token cannot be logged by this file | AI | ☑ |
| `throw new Error(\`WhatsApp send failed (status ${res.status})\`)` | Errors carry only the status, never the token, number or Meta's reply | AI | ☑ |
| `/^\d{7,15}$/` on the number and `body.length <= 4096` | Input checked before any database or Meta call | AI | ☑ |
| `AbortSignal.timeout(10000)` | A slow Meta cannot hang the server | AI | ☑ |

### `apps/api/src/controllers/whatsapp.controller.js` and `routes/whatsapp.routes.js` (webhook, allowed for AI)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `INSERT INTO whatsapp_dedupe ... ON CONFLICT DO NOTHING` and `rowCount === 0` | Dedupe on Meta's message id, per shop | AI | ☑ |
| `BEGIN` ... `COMMIT` / `ROLLBACK` around the whole loop | Dedupe row and message saved together, or neither. Meta's retry then works | AI | ☑ |
| Queries on `req.db` with no `WHERE tenant_id` | RLS filters by shop; the cross-tenant test proves it | AI | ☑ |
| `SAFE_CHALLENGE` and the `403` | The verify challenge is echoed only for a known verify token and a plain challenge | AI | ☑ |
| `router.post('/', resolveWhatsappTenant, withTenant, ...)` | Guard first, then the RLS lock. No `requireAuth` on purpose (Meta has no cookie) | AI | ☑ |

### Database, guard test and config

| Change | Who | Re-read |
|---|---|---|
| `whatsapp_configs` has **no RLS**, on purpose: the shop must be read before it is known (same trap as `ussd_configs`) | AI suggested, Sheryl approved | ☑ |
| `whatsapp_dedupe` **has RLS**, with `USING` and `WITH CHECK` (so one shop cannot even insert a row for another) | AI | ☑ |
| `KNOWN_EXCEPTIONS = ['audit_logs', 'ussd_configs', 'whatsapp_configs']`; `whatsapp_dedupe` added to `TENANT_TABLES` | AI | ☑ |
| `EXPECTED_POLICIES` 17 to 18 in `reset-db.sh` | AI | ☑ |
| `KMS_KEY=put-your-own-44-character-key-here` in `.env.example` (placeholder only) | AI | ☑ |

---

## 4. Contract differences from the assignment sheet

- The assignment's `whatsapp_configs` has 4 columns. Ours adds `created_at`, `updated_at`, `ON DELETE CASCADE`, a `UNIQUE` on `phone_number_id` and a `UNIQUE` on `webhook_verify_token`. The unique verify token is how the GET handshake finds the shop (it has no `phone_number_id`).
- The assignment's `whatsapp_dedupe` has 2 columns. Ours adds a foreign key to `tenants`, `received_at`, and the RLS policy.
- The tenant is set by the existing `withTenant` middleware (the `app.current_tenant` setting our policies read), not by new `set_config` code in the webhook.
- `sendWhatsApp(db, to, body)` takes the shop from the database lock, not from an argument, because `whatsapp_configs` has no RLS.
- Unknown `phone_number_id` answers `200 { ignored: true }`, not an error, so Meta does not retry for days.
- Dedupe and message saving happen in one transaction, so a failed save cannot leave a "seen" row behind.

---

## 5. Honest assessment against the 25/75 rule

- The AI wrote **nearly all the code**, including the parts that were NOT allowed (token handling, tenant resolution) and the security notes.
- **What Sheryl did herself:** every run, check and test listed in section 1, the database migration, the key, all git work, and deciding what to submit.
- **Tenant isolation:** the new test proves it (11 checks), but the AI wrote the test.
- **Not done (stretch goals):** key rotation without re-encrypting every row (only the `v1.` prefix is ready for it), template messages through config, the Meta business verification walkthrough.
- **Known gaps:**
  - Meta's `X-Hub-Signature-256` signature is not checked yet.
  - Nothing tells a shop owner to reconnect when Meta rejects the token (the error code `whatsapp_token_rejected` exists, nothing uses it yet).
  - There is no endpoint or screen to save a shop's WhatsApp config; rows can only be created by SQL or a script.
  - The webhook saves messages but does not yet reply with `sendWhatsApp`.
  - Not tested against Meta's real sandbox, only with a fake `fetch`.


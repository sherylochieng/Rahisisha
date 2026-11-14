# Isolation Proof — Week 28 (Day 4, updated on Day 5)

**Location:** `apps/api/docs/tests/isolation-proof.md`
**Date of evidence:** Evidence A and the first run of Evidence C: 2 November 2026. Evidence B and the first re-run of Evidence C: 5 November 2026, after migration 022. Evidence 0 (table list): 7 November 2026. Latest test re-run: 6 November 2026.
**Database:** `rahisisha` (PostgreSQL), connected as `rahisisha_user`
**Update, Week 29 Day 1 (13 November 2026):** migration 023 added the table `ussd_configs` (no RLS, on purpose). See "ADDED ON WEEK 29 DAY 1 (USSD)" and "TABLES WITHOUT RLS" below. The dated evidence above that section was not rewritten.
**Update, Week 29 Day 2 (13 and 14 November 2026):** migration 024 added `whatsapp_configs` (no RLS, on purpose, token stored encrypted) and `whatsapp_dedupe` (RLS on and forced). The database now has **23 tables**: **17** with RLS and **6** without, and **18** rules (17 `tenant_isolation` plus `login_lookup`). See "ADDED ON WEEK 29 DAY 2 (WHATSAPP)" and "TABLES WITHOUT RLS" below. The dated evidence above that section was not rewritten.

---

## WHY THIS FILE EXISTS

Rahisisha is multi-tenant: many shops share one database, and each shop must only ever see its own rows.

Saying "it is secure" is a claim. This file is the **evidence**. It shows, using the database's own records and a real test run, that every table holding shop data is locked.

## WHY IMPORTANT

- A customer, investor or reviewer can check the evidence instead of trusting us.
- It gives us a repeatable routine, so we can re-run the same checks after any change.

## DANGER (if this file does not exist)

- Nobody can show that RLS is really on. A table can lose its lock after a migration and no one notices.
- Security becomes "we think so" instead of "here is the proof".

## WHAT IT SOLVES

It answers three questions with evidence:

1. Is RLS **on** for every tenant table? (Evidence A)
2. Does every table have the **correct rule**? (Evidence B)
3. Does the lock **actually hold** when another shop attacks? (Evidence C)

## SYSTEM DESIGN PRINCIPLE

**Trust, but verify.** The locks are built in the migrations. The checks below ask the database what is really there, and then try to break it.

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Every project where users must not see each other's data: invoicing, booking, school systems, CRMs. Keep the same three-part routine: **lock every table, try every lock, write it down.**

---

## THE ROUTINE IN ONE PICTURE

```
  1. LOCK every table     RLS in each migration (003 to 019, plus 022)
          │
  2. CHECK the locks      Evidence 0 + A + B  (ask the database)
          │
  3. TRY the locks        Evidence C      (isolation.test.js attacks all 16)
          │
  4. WRITE IT DOWN        this file
```

---

## EVIDENCE 0: the list of tables (the assignment's own query)

### The query

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

### What it means

It lists every table in our database. It is the starting point: every table must be accounted for in Evidence A (is RLS on?) and Evidence B (what is the rule?).

### Result (run on 7 November 2026)

```
      tablename
---------------------
 audit_logs
 brand_profiles
 content_posts
 conversations
 customers
 inventory_movements
 memberships
 messages
 order_items
 orders
 product_media
 product_variants
 products
 stock_reservations
 subscriptions
 tenants
 usage_counters
 users
 wallet_entries
 webhook_events
(20 rows)
```

### What it shows

- **20 tables** in total.
- **16** are tenant-owned and have RLS on and forced (Evidence A).
- **4** have no RLS by design: `audit_logs`, `tenants`, `users`, `webhook_events` (see "Tables without RLS").

Evidence A is a stronger check than `\d` on each table: one query shows `relrowsecurity` and `relforcerowsecurity` for all 20 tables at once.

> **Update, 13 November 2026 (Week 29 Day 1):** migration 023 added `ussd_configs`. The list above was taken on 7 November, so it still shows 20. Today the database has **21 tables**: **16** with RLS on and forced, and **5** without RLS by design (`audit_logs`, `tenants`, `users`, `webhook_events`, `ussd_configs`).

---

## EVIDENCE A: RLS is on and forced for every tenant table

### The query

```sql
SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

### What the query means

| Part | Meaning |
|---|---|
| `pg_class` | PostgreSQL's own list of every table |
| `relname` | The table's name |
| `relrowsecurity AS rls` | `t` = the lock is **on** |
| `relforcerowsecurity AS forced` | `t` = the lock applies **even to the table's owner** |
| `n.nspname = 'public'` | Only our tables, not PostgreSQL's internal ones |
| `relkind = 'r'` | Only ordinary tables |

### Where and how to use it

- **Where:** in `psql`, connected to the `rahisisha` database. It only reads, so it is safe to run any time.
- **When:** after every new migration, before a release, and whenever someone asks "is it safe?".

### Expected result

- `rls = t` and `forced = t` for every table that has a `tenant_id` and is not a documented exception.
- `f` and `f` only for the documented exceptions (see "Tables without RLS").

### Result (run on 2 November 2026)

```
       relname       | rls | forced
---------------------+-----+--------
 audit_logs          | f   | f
 brand_profiles      | t   | t
 content_posts       | t   | t
 conversations       | t   | t
 customers           | t   | t
 inventory_movements | t   | t
 memberships         | t   | t
 messages            | t   | t
 order_items         | t   | t
 orders              | t   | t
 product_media       | t   | t
 product_variants    | t   | t
 products            | t   | t
 stock_reservations  | t   | t
 subscriptions       | t   | t
 tenants             | f   | f
 usage_counters      | t   | t
 users               | f   | f
 wallet_entries      | t   | t
 webhook_events      | f   | f
(20 rows)
```

### Note on dates

This result is from 2 November 2026. Migration 022 (5 November) only changed policies. It did not enable or disable RLS on any table. Re-run Query A after any migration to refresh this evidence.

### What it shows

- **16 tables** have RLS on **and** forced: brand_profiles, content_posts, conversations, customers, inventory_movements, memberships, messages, order_items, orders, product_media, product_variants, products, stock_reservations, subscriptions, usage_counters, wallet_entries.
- **4 tables** have it off: audit_logs, tenants, users, webhook_events. Each is explained in "Tables without RLS" below.

---

## EVIDENCE B: every lock has the correct rule

### The query

```sql
SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
```

### What the query means

| Part | Meaning |
|---|---|
| `pg_policies` | PostgreSQL's own list of every RLS rule |
| `tablename` | The table the rule protects |
| `policyname` | The rule's name (`tenant_isolation` on every table; `login_lookup` as well on `memberships`) |
| `cmd` | Which commands the rule covers. `ALL` = read and write. `SELECT` = read only |
| `qual` | The rule itself: the condition a row must meet to be visible |

### Where and how to use it

- **Where:** in `psql`, connected to `rahisisha`. Read-only.
- **When:** together with Evidence A. Evidence A shows the lock is on. This shows the lock has the right rule.
- **Why both:** a lock turned on with a wrong or missing rule would hide everything or nothing. A typo in the setting name (for example `app.tenant_id` instead of `app.current_tenant`) would silently break isolation.

### Expected result (updated for migration 022)

**17 rows.**

- 15 tables: one `tenant_isolation` rule (`ALL`) with this exact text:

```
(tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
```

- `memberships`: **two** rules.
  - `tenant_isolation` (`ALL`): the same rule, made safe against an empty setting with `NULLIF`.
  - `login_lookup` (`SELECT` only): a user may read their own membership rows, only while `app.login_user` is set.

### Result (run on 5 November 2026)

```
      tablename      |    policyname    |  cmd   |                                           qual
---------------------+------------------+--------+-------------------------------------------------------------------------------------------
 brand_profiles      | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 content_posts       | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 conversations       | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 customers           | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 inventory_movements | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 memberships         | login_lookup     | SELECT | (user_id = (NULLIF(current_setting('app.login_user'::text, true), ''::text))::uuid)
 memberships         | tenant_isolation | ALL    | (tenant_id = (NULLIF(current_setting('app.current_tenant'::text, true), ''::text))::uuid)
 messages            | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 order_items         | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 orders              | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 product_media       | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 product_variants    | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 products            | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 stock_reservations  | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 subscriptions       | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 usage_counters      | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 wallet_entries      | tenant_isolation | ALL    | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
(17 rows)
```

### What it shows

- **17 rules**: 16 `tenant_isolation` (one per tenant table) plus the one extra `login_lookup` on `memberships`.
- 15 tables still use the **same name** and the **same rule**, reading `app.current_tenant`, the setting that `withTenant.js` writes on every request.
- `memberships` is the only table with a different rule text. `NULLIF(..., '')` turns an empty setting into NULL. A reused database connection leaves an empty string behind, and an empty string cannot be read as a uuid, so without `NULLIF` the lock would crash instead of hiding rows.
- `login_lookup` is `SELECT` only. It cannot be used to insert, update or delete a membership.

### Why `login_lookup` exists

At login, nobody has a shop stamped on the connection yet, because login is how we find out which shop a person belongs to. The shop rule therefore hid every membership row, and correct passwords were refused with 403. After the password is verified, `login.js` opens a short transaction and sets `app.login_user` to that user (transaction-only). The new rule then shows that one person's own rows and nothing else.

---

## EVIDENCE C: the isolation test suite

### The test

File: `apps/api/tests/isolation.test.js` (guide: `docs/tests/isolation.test.md`)

### How to run it

```
cd apps/api
npm test -- tests/isolation.test.js
```

### What it does, for each of the 16 tables

1. Acme gets one row.
2. Brio tries to **read** it by id: must find 0 rows.
3. Brio tries to **update** it by id: must change 0 rows.
4. Brio tries to **delete** it by id: must remove 0 rows.
5. Acme checks her row is **still there** (so "0 rows" means hidden, not missing).

Two guard tests also fail if a new tenant table is not covered, or if RLS is not enabled and forced on a covered table. Everything runs in one transaction that is rolled back, so no test data is left behind.

### Expected result

`Tests: 66 passed, 66 total` (2 guards + 16 tables x 4 checks).

### Result (run on 2 November 2026)

```
 PASS  tests/isolation.test.js
  Coverage guards
    √ every tenant-owned table is covered by this suite (170 ms)
    √ RLS is enabled AND forced on every covered table (8 ms)
  Isolation — brand_profiles
    √ Brio cannot READ an Acme row by id (2 ms)
    √ Brio cannot UPDATE an Acme row by id (10 ms)
    √ Brio cannot DELETE an Acme row by id (2 ms)
    √ Acme still sees her own row afterwards (2 ms)
  ... the same four checks passed for each of the other 15 tables:
  content_posts, conversations, customers, inventory_movements, memberships,
  messages, order_items, orders, product_media, product_variants, products,
  stock_reservations, subscriptions, usage_counters, wallet_entries

Test Suites: 1 passed, 1 total
Tests:       66 passed, 66 total
Snapshots:   0 total
Time:        3.619 s
```

### What it shows

All 16 tables: a second shop found nothing, changed nothing and deleted nothing, and the owner's row was intact afterwards.

### Re-run on 5 November 2026 (after migration 022 and the login change)

```
Isolation tests only (npm run test:isolation):
Test Suites: 3 passed, 3 total
Tests:       74 passed, 74 total

Whole project (npm test):
Test Suites: 6 passed, 6 total
Tests:       100 passed, 100 total
```

`tests/isolation.test.js` (the 66-test suite, which includes `memberships`) was among the passing suites. Changing the `memberships` rules did not break isolation for any of the 16 tables.

### Re-run on 6 November 2026 (after adding the login_lookup test)

```
Isolation tests only (npm run test:isolation):
Test Suites: 4 passed, 4 total
Tests:       81 passed, 81 total

Whole project (npm test):
Test Suites: 7 passed, 7 total
Tests:       107 passed, 107 total
```

The 7 new tests come from `tests/isolation/login-lookup.isolation.test.js` (74 + 7 = 81 isolation tests, 100 + 7 = 107 in total).

### Manual check on 5 November 2026 (live, through the website)

- Shop "skirt Shirt" had two products. Its dashboard listed them.
- A second shop, "Brio Hardware", signed up and logged in. Its dashboard showed "No products yet" and zero for orders and wallet. It never showed the other shop's products.
- This was done through the real login, so it also exercised `login_lookup`.

### Related earlier evidence (Day 3, through the HTTP API)

- `tests/isolation/products.cross-tenant.test.js`: Brio gets **404** when reading, updating or deleting an Acme product.
- `tests/isolation/orders.isolation.test.js`: Brio gets **404** on an Acme order.

### Added on Day 5 (directly at the database)

- `tests/isolation/login-lookup.isolation.test.js`: attacks the `login_lookup` rule directly (7 checks: nothing visible without a login name, only the named person's row with one, and UPDATE, DELETE and INSERT all fail).

### ADDED ON WEEK 29 DAY 1 (USSD)

USSD adds a new way into the system: a phone request with **no login cookie**. The shop is found from the dialled service code, then `withTenant` sets the same `app.current_tenant` lock as every other route. So the isolation proof now has a third door to attack.

- `tests/isolation/ussd.cross-tenant.test.js` (8 checks, run on 13 November 2026: **8 passed**). It creates its own two shops, so it also runs in CI. It proves:
  1. Dialling shop A shows shop A's welcome, never shop B's.
  2. Option 1 (products) shows only the dialled shop's products, in both directions.
  3. Option 2 (balance) shows each shop its own balance (KSh 1,000 and KSh 2,000, never added together).
  4. An unknown service code gets `END Service unavailable`.
  5. The **same phone number** dialling both codes gets two different shops (the phone is never the tenant).
  6. Every reply is 182 characters or less.
  7. With shop A's lock on, shop B's products (by tenant id **and** by product id) and wallet entries return **0 rows**.
  8. Control: with shop B's lock on, shop B's product **is** visible, so check 7 did not pass on an empty table.
- `tests/isolation.test.js` has a guard that fails when a table has no RLS and is not listed as an exception. `ussd_configs` was added to its `KNOWN_EXCEPTIONS` list (with `audit_logs`), with a written reason.
- Isolation suite on 13 November 2026: **5 suites, 89 tests passed**. Full suite the same day: 17 suites, 163 tests passed.
- Manual check on 13 November 2026 (curl against a local server): the same phone number dialled Amina's Boutique and Brio Hardware. Option 1 showed only Amina's products for Amina's code and only Brio's for Brio's code. Option 2 showed a different balance for each shop.

### ADDED ON WEEK 29 DAY 2 (WHATSAPP)

WhatsApp adds a fourth way into the system: Meta's servers post customer messages to **one shared webhook** with **no login cookie**. The shop is found from the `phone_number_id` in the message (`middleware/resolveWhatsappTenant.js`), then `withTenant` sets the same `app.current_tenant` lock as every other route.

- **Migration 024** added two tables:
  - `whatsapp_configs`: shop, `phone_number_id`, the access token **stored encrypted** (AES-256-GCM, `utils/kms.js`) and a verify token. **No RLS, on purpose**: the shop is looked up before it is known.
  - `whatsapp_dedupe`: `(tenant_id, message_id)` primary key, so a repeated Meta message is skipped **per shop**. It **has RLS** (`tenant_isolation` with both `USING` and `WITH CHECK`, forced).
- **The guard test was updated** (`tests/isolation.test.js`): `whatsapp_dedupe` was added to `TENANT_TABLES`, and `whatsapp_configs` to `KNOWN_EXCEPTIONS`, with written reasons. `whatsapp_dedupe` has **no `id` column** (its key is the pair), so the generic read/update/delete loop cannot attack it. It is still covered by both coverage guards (it exists, RLS is on and forced), and it is attacked in its own test (below). The loop now runs over `TABLES_WITH_ID`.
- **The policy count went from 17 to 18.** `scripts/reset-db.sh` (`EXPECTED_POLICIES=18`) and the CI comments were updated, and a fresh database built in CI passed.
- `tests/isolation/whatsapp.cross-tenant.test.js` (11 checks, **11 passed**). It creates its own two shops and a throw-away encryption key, so it also runs in CI. It proves:
  1. The verify handshake returns the challenge for a real shop token.
  2. A wrong token, wrong mode, odd challenge or missing token gets 403.
  3. A message for shop A's number is saved for A and is invisible to B.
  4. The same message id again is skipped (duplicate).
  5. The same message id on shop B's number is still processed (dedupe is per shop).
  6. An unknown `phone_number_id` gets 200 `ignored` and nothing is saved.
  7. Different message ids with the same text are both saved (dedupe is on the id, not the text).
  8. A payload with no `phone_number_id` gets 200 `ignored`.
  9. `whatsapp_dedupe`: with shop A's lock, shop B's rows are invisible.
  10. `whatsapp_dedupe`: shop A cannot **insert** a row for shop B (`WITH CHECK` refuses it).
  11. Control: with shop B's lock, shop B's row is visible, so check 9 did not pass on an empty table.
- `tests/whatsapp.service.test.js` (10 checks, **10 passed**) proves the shared sender uses the right shop's token (never another shop's), never logs it, never puts it in an error, and that the stored token is encrypted. `tests/kms.test.js` (9 checks, **9 passed**) proves the encryption: a token copied into another shop's row will not decrypt.
- Isolation suite on 13 November 2026: **6 suites, 100 tests passed**. Full suite the same day: **22 suites, 198 tests passed**. CI green.
- Manual check on 14 November 2026 (local server and `psql`): a pretend Meta message for Amina's number was saved once, and sending it again answered `duplicates: 1`. With Amina's lock in `psql`, the message and its `whatsapp_dedupe` row were visible. With Brio's lock, both queries returned **0 rows**.

---

## TABLES WITHOUT RLS (and why)

| Table | Why it has no RLS | Risk |
|---|---|---|
| `tenants` | It is the list of shops itself. No `tenant_id` column. | Low. Not shop data. |
| `users` | A person can belong to several shops (through `memberships`). No `tenant_id` column. | Low. Access to shop data goes through `memberships`, which has RLS. |
| `webhook_events` | System table written before any shop is known (migration 015: "NO RLS, system table"). No `tenant_id`. | Low. Must not be exposed through any endpoint. |
| `audit_logs` | Has a `tenant_id`, but migration 020 says "NO RLS: platform admin needs full access". | **Known exception.** The app's database user can read all shops' audit rows. No endpoint exposes the table today. |
| `ussd_configs` (migration 023, Week 29 Day 1) | The shop must be found **from the service code before the shop is known**, so a shop-based lock would hide every row (the same trap that broke login before migration 022). It has a `tenant_id`, but it is a phone book: service code, shop id and a welcome line. | **Known exception, low risk.** Service codes are public numbers. Never add private columns to this table. Shop data is only ever read **after** `withTenant` sets the lock. |
| `whatsapp_configs` (migration 024, Week 29 Day 2) | The shop must be found **from Meta's `phone_number_id` before the shop is known**, so a shop-based lock would hide every row (same trap as `ussd_configs` and login). It has a `tenant_id`, and it holds each shop's **access token**. | **Known exception, higher risk than `ussd_configs`.** The token column is stored **encrypted** (AES-256-GCM, key in `KMS_KEY`, token locked to its shop id), so a copy of the table alone reveals no token. Never `SELECT *` from it, never log a row, and only the webhook guard (`tenant_id` only) and the shared sender (filters by the shop lock) read it. |

---

## KNOWN LIMITATIONS (honest)

1. **`audit_logs` exception.** Before any endpoint exposes it, add RLS or use a separate admin role.
2. **The app's database user owns the tables.** `rahisisha_user` owns them, so in theory it could run `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` or edit wallet rows. Guard 2 in the test would catch a disabled RLS. A future hardening step: run the app as a non-owner role with only the permissions it needs (for the wallet: read and insert only).
3. **Attacks are tested "by id".** Policies without a `WITH CHECK` clause use the same rule for writes. A dedicated test that Brio cannot insert a row with Acme's `tenant_id` is a good next addition.
4. **`login_lookup` is now tested, but only at the database level.** `tests/isolation/login-lookup.isolation.test.js` (7 checks, added 6 November 2026) proves that with no login name nothing is visible, with a login name only that person's row is visible, and UPDATE, DELETE and INSERT all fail. It does not test `login.js` itself. `login_lookup` is only as safe as the code that sets `app.login_user`: it must be set only after the password is verified, inside a transaction, with `set_config(..., true)`. A test of the real login endpoint is still a good next addition.
5. **`ussd_configs` exception (Week 29 Day 1).** It has no RLS, so any code that uses the plain pool can read every shop's service code and welcome text. That is acceptable because the data is public by nature. The risks are (a) someone adding a sensitive column later, and (b) someone querying shop data with the plain pool in a USSD route. The cross-tenant test covers (b) through the real endpoint. A future step is to protect (a) with a database comment and a review rule.
6. **`whatsapp_configs` exception (Week 29 Day 2).** It has no RLS, so any code using the plain pool could read every shop's **encrypted** token and verify token. The tokens are useless without `KMS_KEY`, but that is one key for all shops: if `KMS_KEY` leaks together with a copy of the table, every token is readable. The shared sender filters by the shop lock, and a test proves it never uses another shop's token. Future steps: a database comment and a review rule on this table, key rotation (the stored format is versioned `v1.` for this), and a real cloud KMS.
7. **Older rules cannot read an empty setting.** Found on 14 November 2026: after `RESET app.current_tenant` in `psql`, a query on `messages` fails with `invalid input syntax for type uuid: ""`, because only `memberships` and `whatsapp_dedupe` use `NULLIF(..., '')` in their rule (migration 022 and 024). The app is not affected (`withTenant` always sets a real shop first), but a reused connection with an empty setting would make those 15 tables error instead of returning nothing. A future migration can add `NULLIF` to the other rules.
8. **`whatsapp_dedupe` grows forever.** Old message ids are never deleted. A scheduled clean-up of rows older than a few days is a future step.

---

## CONCLUSION

### Day 4 conclusion (2 November 2026, written by the AI)

On 2 November 2026: all 16 tenant-owned tables have Row Level Security enabled and forced (Evidence A), each with the identical `tenant_isolation` rule reading `app.current_tenant` (Evidence B), and a 66-test suite showed that a second shop could neither read, change nor delete another shop's row in any of them (Evidence C). Four tables have no RLS by design, and each is documented above. The two main things to improve next are the `audit_logs` exception and running the app as a non-owner database role.

### Day 5 update (6 November 2026)

On 5 November 2026 I found that login refused correct passwords, because the shop rule on `memberships` hid every row before the shop was known. I fixed it with migration 022, which adds a second rule, `login_lookup`. It is read-only (`SELECT` only), and it shows a person only their own rows, only while `app.login_user` is set after the password is verified, inside a short transaction. The other 15 tables were not changed. Evidence B now shows 17 rules, and on 6 November 2026 the full suite passed (7 suites, 107 tests), including 7 new checks that attack `login_lookup` directly: nothing is visible without a login name, only the named person's row is visible with one, and update, delete and insert all fail. One gap remains: these tests check the database rule, not `login.js`, so the rule is only as safe as the code that sets `app.login_user`.

### Week 29 Day 1 update (13 November 2026)

Migration 023 added `ussd_configs`, a small phone book that maps a USSD service code to a shop. It has **no RLS on purpose**: the shop has to be found from the code before the shop is known. The 16 tenant tables were not changed. Everything that reads shop data (products, wallet) runs after `withTenant` sets `app.current_tenant`, exactly like the web routes. A new test, `tests/isolation/ussd.cross-tenant.test.js` (8 checks), proves through the real `POST /ussd` endpoint and directly at the database that dialling shop A never shows shop B's welcome, products or money, even by product id, and that the phone number is never used to pick the shop. The isolation suite now has 5 suites and 89 tests, all passing. One gap remains: the tenant lookup itself (`middleware/resolveUssdTenant.js`) was AI-written at the student's request and is declared in `AI_AUDIT_week_29_day1.md`.

### Week 29 Day 2 update (13 and 14 November 2026)

Migration 024 added two WhatsApp tables. `whatsapp_configs` has **no RLS on purpose** (the shop is found from Meta's `phone_number_id` before it is known) and stores each shop's access token **encrypted**. `whatsapp_dedupe` **has RLS**, so there are now 17 shop tables and 18 rules. The generic attack loop cannot test `whatsapp_dedupe` (no `id` column), so it is covered by both coverage guards and attacked in its own test. A new test, `tests/isolation/whatsapp.cross-tenant.test.js` (11 checks), proves through the real webhook and directly at the database that a message for shop A never reaches shop B, that repeated messages are skipped per shop, and that shop A cannot write a dedupe row for shop B. The isolation suite now has 6 suites and 100 tests, and the full suite 22 suites and 198 tests, all passing, with CI green. Gaps that remain: `whatsapp_configs` sits outside RLS and is protected by encryption and code rules, one key protects all tokens, and the tenant lookup and the token code (`resolveWhatsappTenant.js`, `kms.js`, `whatsapp.service.js`) were AI-written at the student's request and are declared in `AI_AUDIT_week_29_day2.md`.

---

## HOW TO REPEAT THIS PROOF

1. Run Query A and Query B in `psql`. Query B should return 18 rows (it returned 17 until migration 024 added the `whatsapp_dedupe` rule).
2. Run `npm test` (all suites) or `npm test -- tests/isolation.test.js` (the isolation suite).
3. Compare with the expected results above.
4. Any difference is a finding. Fix it before shipping.
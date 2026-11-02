# Isolation Proof — Week 28 Day 4

**Location:** `apps/api/tests/isolation-proof.md`
**Date of evidence:** 2 November 2026
**Database:** `rahisisha` (PostgreSQL), connected as `rahisisha_user`

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
  1. LOCK every table     RLS in each migration (003 to 019)
          │
  2. CHECK the locks      Evidence A + B  (ask the database)
          │
  3. TRY the locks        Evidence C      (isolation.test.js attacks all 16)
          │
  4. WRITE IT DOWN        this file
```

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

### What it shows

- **16 tables** have RLS on **and** forced: brand_profiles, content_posts, conversations, customers, inventory_movements, memberships, messages, order_items, orders, product_media, product_variants, products, stock_reservations, subscriptions, usage_counters, wallet_entries.
- **4 tables** have it off: audit_logs, tenants, users, webhook_events. Each is explained in "Tables without RLS" below.

---

## EVIDENCE B: every lock has the correct rule

### The query

```sql
SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
```

### What the query means

| Part | Meaning |
|---|---|
| `pg_policies` | PostgreSQL's own list of every RLS rule |
| `tablename` | The table the rule protects |
| `policyname` | The rule's name (ours is `tenant_isolation`) |
| `qual` | The rule itself: the condition a row must meet to be visible |

### Where and how to use it

- **Where:** in `psql`, connected to `rahisisha`. Read-only.
- **When:** together with Evidence A. Evidence A shows the lock is on. This shows the lock has the right rule.
- **Why both:** a lock turned on with a wrong or missing rule would hide everything or nothing. A typo in the setting name (for example `app.tenant_id` instead of `app.current_tenant`) would silently break isolation.

### Expected result

One row per tenant table, each with the policy `tenant_isolation` and this exact rule:

```
(tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
```

### Result (run on 2 November 2026)

```
      tablename      |    policyname    |                                  qual
---------------------+------------------+-------------------------------------------------------------------------
 brand_profiles      | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 content_posts       | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 conversations       | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 customers           | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 inventory_movements | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 memberships         | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 messages            | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 order_items         | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 orders              | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 product_media       | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 product_variants    | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 products            | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 stock_reservations  | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 subscriptions       | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 usage_counters      | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
 wallet_entries      | tenant_isolation | (tenant_id = (current_setting('app.current_tenant'::text, true))::uuid)
(16 rows)
```

### What it shows

- Exactly **16 policies**, matching the 16 tables in Evidence A.
- Every policy has the **same name** and the **same rule**, reading `app.current_tenant`, the setting that `withTenant.js` writes on every request.
- The `true` inside `current_setting(..., true)` means "if no tenant is set, return nothing instead of crashing".

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

### Related earlier evidence (Day 3, through the HTTP API)

- `tests/isolation/products.cross-tenant.test.js`: Brio gets **404** when reading, updating or deleting an Acme product.
- `tests/isolation/orders.isolation.test.js`: Brio gets **404** on an Acme order.

---

## TABLES WITHOUT RLS (and why)

| Table | Why it has no RLS | Risk |
|---|---|---|
| `tenants` | It is the list of shops itself. No `tenant_id` column. | Low. Not shop data. |
| `users` | A person can belong to several shops (through `memberships`). No `tenant_id` column. | Low. Access to shop data goes through `memberships`, which has RLS. |
| `webhook_events` | System table written before any shop is known (migration 015: "NO RLS, system table"). No `tenant_id`. | Low. Must not be exposed through any endpoint. |
| `audit_logs` | Has a `tenant_id`, but migration 020 says "NO RLS: platform admin needs full access". | **Known exception.** The app's database user can read all shops' audit rows. No endpoint exposes the table today. |

---

## KNOWN LIMITATIONS (honest)

1. **`audit_logs` exception.** Before any endpoint exposes it, add RLS or use a separate admin role.
2. **The app's database user owns the tables.** `rahisisha_user` owns them, so in theory it could run `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` or edit wallet rows. Guard 2 in the test would catch a disabled RLS. A future hardening step: run the app as a non-owner role with only the permissions it needs (for the wallet: read and insert only).
3. **Attacks are tested "by id".** Policies without a `WITH CHECK` clause use the same rule for writes. A dedicated test that Brio cannot insert a row with Acme's `tenant_id` is a good next addition.

---

## CONCLUSION

On 2 November 2026: all 16 tenant-owned tables have Row Level Security enabled and forced (Evidence A), each with the identical `tenant_isolation` rule reading `app.current_tenant` (Evidence B), and a 66-test suite showed that a second shop could neither read, change nor delete another shop's row in any of them (Evidence C). Four tables have no RLS by design, and each is documented above. The two main things to improve next are the `audit_logs` exception and running the app as a non-owner database role.

---

## HOW TO REPEAT THIS PROOF

1. Run Query A and Query B in `psql`.
2. Run `npm test -- tests/isolation.test.js`.
3. Compare with the expected results above.
4. Any difference is a finding. Fix it before shipping.
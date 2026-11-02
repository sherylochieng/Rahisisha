# isolation.test.js

**Location of the test:** `apps/api/tests/isolation.test.js`
**Location of this guide:** `apps/api/docs/tests/isolation.test.md`

---

## WHY THIS FILE EXISTS

Rahisisha is an apartment building. Many shops share one database, and each shop must only ever see **its own** rows.

On Day 3 we tested **2** doors: products and orders.

But the database has **16 tables** that hold shop data. This test checks **all 16**, including the ones with no web address (customers, messages, wallet_entries).

---

## WHY IMPORTANT

If one table is unlocked, one shop can read another shop's data. Nothing crashes and nobody notices, so it is a silent data breach.

This test is the **inspector** that walks past every door and tries the handle.

---

## DANGER (if this file does not exist)

- A new table is added and nobody turns on RLS. Brian can read Amina's rows.
- Someone runs `DISABLE ROW LEVEL SECURITY` while debugging and forgets to switch it back.
- The wallet has no URL, so no API test could ever notice money records leaking.

---

## WHAT IT SOLVES

- Proves isolation for **every** tenant table, not just two.
- Fails **loudly** if a new tenant table is added and not tested.
- Fails if RLS is switched off or not forced on a covered table.
- Leaves **no test data** behind.

---

## SYSTEM DESIGN PRINCIPLE

- **Trust but verify:** the locks (RLS) are built in migrations. This test checks they hold.
- **Make forgetting impossible:** the coverage guard is an alarm for new tables.
- **Tests must not pollute:** everything is rolled back.

---

## WHERE YOU WILL USE THIS IN FUTURE PROJECTS

Any multi-tenant SaaS: invoicing, booking, school software, a CRM. Keep **one** suite that loops over every tenant table.

---

## TRADEOFFS

- (+) One place covers every table. No leftovers.
- (-) Each new tenant table needs a seed insert added to the file.
- (-) It tests "by id". A table could still have a subtle policy flaw that only other kinds of attacks would reveal.

---

## HOW TO USE

```
cd apps/api
npm test -- tests/isolation.test.js
```

**Expected result:** `Tests: 66 passed, 66 total`

---

## THE CAST

| Name                  | Role                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| **Acme (Amina)**      | The owner. Her rows are the target. First shop in the `tenants` table. |
| **Brio (Brian)**      | The attacker. Second shop in the `tenants` table.                      |
| **testPool / client** | One database connection that plays both people, one at a time.         |

---

## THE WHOLE TEST IN ONE PICTURE

```
 BEGIN  (open the whiteboard)
   │
   ├─ SETUP        Acme gets one row in each of the 16 tables
   │
   ├─ GUARD 1      "Does this file cover every tenant table?"
   ├─ GUARD 2      "Is RLS ON and FORCED on every covered table?"
   │
   ├─ FOR EACH OF THE 16 TABLES:
   │     ATTACK 1  Brio tries to READ   Acme's row     → must find 0
   │     ATTACK 2  Brio tries to UPDATE Acme's row     → must change 0
   │     ATTACK 3  Brio tries to DELETE Acme's row     → must remove 0
   │     CONTROL   Acme looks again                    → must find 1
   │
 ROLLBACK (wipe the whiteboard: nothing is saved)
```

---

## PART 1: THE SETUP (`beforeAll`)

**What happens, in order:**

1. Borrow one database connection.
2. Find two real shops (`SELECT id FROM tenants ORDER BY created_at LIMIT 2`). If fewer than two exist, stop with a clear message.
3. `BEGIN`: open a transaction that will be undone at the end.
4. Tell Postgres "the current shop is **Acme**" (`asTenant`).
5. Insert one row per table, **parents before children**.

**Why parents first?** A variant needs a product, and an order needs a customer. You can't put a page in a book that doesn't exist.

```
 products ──► product_variants ──► stock_reservations
    │                 └──────────► inventory_movements
    └────► product_media

 customers ──► conversations ──► messages
    └───────► orders ──► order_items

 standalone: wallet_entries, content_posts, usage_counters
 needs a user: memberships
 one-per-shop: brand_profiles, subscriptions
```

**What each seeded row is** (all belong to Acme):

| Table               | The row we create                                            |
| ------------------- | ------------------------------------------------------------ |
| products            | a product called "iso", price 100                            |
| product_variants    | a variant of that product                                    |
| product_media       | an image link for that product                               |
| customers           | a customer with a unique test phone                          |
| conversations       | a chat with that customer                                    |
| messages            | an inbound message "hi"                                      |
| stock_reservations  | a 1-item hold that expires in an hour                        |
| inventory_movements | a stock adjustment of 1                                      |
| orders              | an order of 100 cents for that customer                      |
| order_items         | one line on that order                                       |
| wallet_entries      | a +100 cents "sale" line                                     |
| content_posts       | an empty draft post                                          |
| usage_counters      | a counter for January 2026                                   |
| memberships         | links a throwaway test user to Acme                          |
| brand_profiles      | Acme's brand profile (uses her existing one if there is one) |
| subscriptions       | Acme's subscription (uses her existing one if there is one)  |

**Two tables are special:** `brand_profiles` and `subscriptions` allow only **one row per shop**, and Acme may already have one. So the test says `ON CONFLICT DO NOTHING` (skip if it exists) and then reads the row back.

**The notebook `ids`:** after each insert, the test saves the new row's id as `ids.tableName`. The attacks need that exact id.

---

## PART 2: THE TWO COVERAGE GUARDS

### Guard 1: "every tenant-owned table is covered by this suite"

- **What it does:** asks Postgres for every table that has a `tenant_id` column, removes the known exceptions (`audit_logs`), and compares with the list `TENANT_TABLES`.
- **Expected:** the two lists are identical.
- **If it fails:** somebody added a tenant table but did not add it to this test. The alarm rings.

### Guard 2: "RLS is enabled AND forced on every covered table"

- **What it does:** reads `relrowsecurity` and `relforcerowsecurity` for each of the 16 tables.
- **Expected:** both are `true` for every table.
- **If it fails:** a table has its lock off. This is a real security hole.

**Enabled vs forced:** _enabled_ turns the lock on. _Forced_ makes it apply to the table's **owner** too. Without FORCE, the owner walks straight past the lock.

---

## PART 3: THE ATTACKS (repeated for all 16 tables)

### Attack 1: READ

```sql
SELECT id FROM <table> WHERE id = <Acme's row id>
```

Run as **Brio**. **Expected: 0 rows** (`rows.length` is 0).

**Why:** RLS adds a hidden filter `tenant_id = Brio`. Acme's row doesn't match, so it is invisible.
**If it fails:** Brian can read Amina's data.

### Attack 2: UPDATE

```sql
UPDATE <table> SET tenant_id = tenant_id WHERE id = <Acme's row id>
```

Run as **Brio**. **Expected: 0 rows changed** (`rowCount` is 0).

**Why that odd `SET`?** `tenant_id = tenant_id` changes nothing, but the database still has to **find** the row first. It works on every table with no table-specific column.
**If it fails:** Brian can change Amina's data.

### Attack 3: DELETE

```sql
DELETE FROM <table> WHERE id = <Acme's row id>
```

Run as **Brio**. **Expected: 0 rows removed** (`rowCount` is 0).

**If it fails:** Brian can destroy Amina's data.

### Control: Acme checks again

```sql
SELECT id FROM <table> WHERE id = <Acme's row id>
```

Run as **Acme**. **Expected: 1 row.**

**Why it matters:** if the row had never existed, Brian's "found nothing" would prove nothing. The control proves the row **is there** and the attacks **changed nothing**.

---

## PART 4: THE ENDING (`afterAll`)

1. `ROLLBACK`: undo every fake row.
2. Give the connection back to the pool.
3. Close the test pool.

**Result:** your real data is untouched and Jest exits cleanly.

---

## THE COUNT: WHY 66 TESTS

```
 2  coverage guards
 + 16 tables × 4 checks (read, update, delete, control) = 64
 ─────────
 66 tests
```

---

## YOUR REAL RESULT

```
Test Suites: 1 passed, 1 total
Tests:       66 passed, 66 total
Time:        3.619 s
```

Every attack found nothing and every control found the row, for all 16 tables.

---

## WHAT EACH OUTCOME MEANS

| You see              | It means                                      | What to do                                      |
| -------------------- | --------------------------------------------- | ----------------------------------------------- |
| 66 passed            | Every covered table is isolated               | Nothing                                         |
| Guard 1 fails        | A tenant table is missing from the test list  | Add it to `TENANT_TABLES` and add a seed insert |
| Guard 2 fails        | RLS is off or not forced on a table           | Fix the migration (enable and force RLS)        |
| An attack test fails | **A real leak**                               | Stop and fix the policy before anything else    |
| A control test fails | The row vanished (maybe an attack deleted it) | Look at the attack tests before it              |
| Error in setup       | A seed insert does not match the live table   | Read the error; compare with `\d tablename`     |

---

## TWO SETTINGS THAT LOOK THE SAME BUT AREN'T

| Place                     | `set_config(..., ?)` | Why                                                                       |
| ------------------------- | -------------------- | ------------------------------------------------------------------------- |
| `withTenant.js` (the app) | `false`              | No transaction is open, so the setting must last for the whole connection |
| this test                 | `true`               | A transaction **is** open, so it only needs to last until the end         |

---

## NOT COVERED (and why)

| Table              | Reason                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `tenants`, `users` | No `tenant_id` column                                                  |
| `webhook_events`   | System table, no RLS by design                                         |
| `audit_logs`       | Has `tenant_id` but no RLS by design (platform admin). Known exception |

---

## WORDS TO KNOW

| Word                 | Meaning                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| **RLS**              | A rule inside the database that hides rows belonging to another shop   |
| **Policy**           | The exact rule: "show a row only if its tenant_id is the current shop" |
| **Enabled / Forced** | Lock turned on / lock applies even to the table's owner                |
| **Transaction**      | A group of steps treated as one unit                                   |
| **ROLLBACK**         | Undo everything done since BEGIN                                       |
| **Seed row**         | A fake row we create so there is something to attack                   |
| **Control**          | A check that proves the other checks mean something                    |
| **Coverage guard**   | A test that fails if something is left out of the other tests          |
| **Attacker**         | Brio, playing a shop that tries to touch another shop's data           |

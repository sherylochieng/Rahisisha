# Transaction Rollback Test

**File:** `apps/api/src/routes/auth/signup.js`
**Tested:** 2026-10-19
**Base URL:** `http://localhost:3000/v1`

---

## What a transaction is and why it matters

When a new user signs up, three things must happen:

1. A new row is created in `tenants`
2. A new row is created in `users`
3. A new row is created in `memberships` linking the two

These three inserts are wrapped in a **transaction** — a block of database work that is treated as a single unit. The rule is ALL or NOTHING. If insert 1 succeeds but insert 2 fails, insert 1 must be undone. If you don't do this, you end up with a tenant row in the database that has no user and no membership attached to it — a ghost record. Ghost records corrupt your data and are very hard to clean up later.

The technical name for undoing the work is **ROLLBACK**.

In the code it looks like this:

```javascript
try {
  await client.query('BEGIN');        // open the transaction

  // insert 1 — tenants
  // insert 2 — users
  // insert 3 — memberships

  await client.query('COMMIT');       // make it permanent
} catch (err) {
  await client.query('ROLLBACK');     // undo everything if anything failed
} finally {
  client.release();                   // always return the connection
}
```

`BEGIN` tells PostgreSQL: hold everything I am about to do, do not make it permanent yet.

`COMMIT` tells PostgreSQL: all three inserts succeeded, make them permanent now.

`ROLLBACK` tells PostgreSQL: something went wrong, throw away everything since BEGIN as if none of it happened.

`finally` runs whether the try succeeded or the catch fired. It always returns the database connection to the pool. If you skip this, the pool runs out of connections and the server stops working.

---

## How to trigger a mid-transaction failure

To prove ROLLBACK works, we need to make insert 2 (users) fail while insert 1 (tenants) has already succeeded.

The easiest way: send a phone number that already exists in the database. PostgreSQL has a UNIQUE constraint on `users.phone`. When we try to insert a duplicate phone, it throws error code `23505` (unique constraint violation). Insert 1 already ran. Now the catch block fires ROLLBACK and insert 1 must be undone.

---

## Tenant count before the test

```sql
SELECT COUNT(*) FROM tenants;
SELECT slug FROM tenants;
```

Result:

```
 aminas-boutique
 sheryl-shop
 test-shop
 mctaba-shop
 admin-corp
(5 rows)
```

---

## The test — send a signup that will fail mid-transaction

Use a brand new slug `ghost-shop` (does not exist yet) but a phone number that already exists `0712345678`.

What will happen inside the code step by step:

- `INSERT INTO tenants` with slug `ghost-shop` → succeeds
- `INSERT INTO users` with phone `0712345678` → FAILS — duplicate, error `23505`
- `catch` fires `ROLLBACK` → tenant insert is undone
- `finally` releases the connection back to the pool

```powershell
Invoke-WebRequest -Uri http://localhost:3000/v1/signup `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"phone":"0712345678","name":"Test User","password":"password123","tenant_name":"Ghost Shop","slug":"ghost-shop"}'
```

Expected response — HTTP 409:

```json
{ "error": "An account with that phone number already exists" }
```

Result (confirmed 2026-10-19): ✅ 409 as expected

---

## Tenant count after the test

```sql
SELECT COUNT(*) FROM tenants;
SELECT slug FROM tenants;
```

Result:

```
 aminas-boutique
 sheryl-shop
 test-shop
 mctaba-shop
 admin-corp
(5 rows)
```

Count is still 5. `ghost-shop` does not appear anywhere.

Result (confirmed 2026-10-19): ✅ ROLLBACK verified — the tenant insert was undone even though it succeeded before the failure

---

## What this proves

Even though the tenant insert ran and succeeded, PostgreSQL never committed it permanently because `COMMIT` was never reached. When `ROLLBACK` fired, PostgreSQL discarded that insert entirely as if it never happened.

The database is clean. No ghost records. No orphaned tenant rows. The ALL or NOTHING guarantee held.

---

## Why this matters for a multi-tenant SaaS

In Rahisisha Biashara, every tenant is a business. If a ghost tenant row existed — a business with no owner — it would block that slug forever (the unique constraint still applies), appear in any future admin queries as a real business with no users, and potentially cause errors in any route that joins tenants to users.

The transaction and rollback pattern means this can never happen. Every tenant in the database has exactly one owner. Always.
# AI Audit — Week 28 Day 4 (Wallets and Isolation Testing)

**Author:** Sheryl
**Date:** 2 November 2026
**Week 28 rule:** 40% manual / 60% AI. AI allowed for test scaffolding. NOT allowed for ledger logic or tenant isolation proofs. Money audit and isolation audit required.

This audit says what actually happened, including where the AI help went beyond what the rule allows.

---

## 1. Summary

| Area | File | Who did what |
|---|---|---|
| Ledger table fix | `sql/migrations/021_fix_wallet_entries.sql` | AI wrote the shape and comments. Sheryl filled in `BIGINT` and `TEXT` and typed the file. Sheryl's first attempt at the reason list was `credit, debit`; the AI corrected it to `sale, refund, commission, payout`. |
| Schema sync | `sql/SCHEMA.sql` (wallet section) | AI described the three changes. Sheryl typed them. |
| Wallet helpers | `apps/api/src/wallet/wallet.js` | AI wrote the headers, comments, function structure and SQL text. Sheryl filled in the money rules (see the Money Audit). |
| Isolation test suite | `apps/api/tests/isolation.test.js` | AI wrote it: setup, seed inserts, coverage guards, the attack queries, and the expected values (0, 0, 0, 1). Sheryl explained in her own words what each attack must find before the values were supplied. |
| Isolation proof | `apps/api/docs/tests/isolation-proof.md` | AI wrote the document, including the explanations and the conclusion. Sheryl ran both queries and the test run; the results in the document are her real output. |
| Guides | `apps/api/docs/tests/isolation.test.md` | AI wrote it (documentation, allowed). |
| Understanding the live database | `\d wallet_entries`, `\dp`, `pg_class`, `pg_policies` | AI chose the queries. Sheryl ran them and read the results. |

---

## 2. Honest assessment against the 40/60 rule

- The manual share on Day 4 is **clearly below 40%**.
- **Ledger logic (not allowed for AI):** the AI wrote the structure, comments and SQL text of `wallet.js`. Sheryl wrote the six money-rule values. The rule says ledger logic should be hand-written, so this is only partly within the rule.
- **Isolation proof (not allowed for AI):** the AI wrote the test suite and the proof document. Sheryl ran everything and supplied the real results, but did not write the proof herself. This is outside the rule.
- Where Sheryl understood the idea and where she did not is recorded in section 5.

---

## 3. Money Audit: every line that touches `wallet_entries`

**SELF** = Sheryl wrote it. **AI** = AI wrote it. **MIXED** = AI wrote the shape, Sheryl filled the value.

The "Re-read" column is for Sheryl to tick (✔) after she has genuinely re-read that line. It is left unticked on purpose, because only she can say it is true.

### `sql/migrations/021_fix_wallet_entries.sql`

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `BEGIN;` and `COMMIT;` | All four changes apply together or none do | AI | ☐ |
| `ALTER COLUMN amount_cents TYPE BIGINT` | Widens the money column so it cannot overflow near KES 21 million | MIXED (AI shape, `BIGINT` by Sheryl) | ☐ |
| `ALTER COLUMN reference_id TYPE TEXT USING reference_id::text` | Lets M-Pesa receipt codes fit | MIXED (AI shape, `TEXT` by Sheryl) | ☐ |
| `RENAME COLUMN reference_id TO reference` | Matches the Day 4 spec | AI | ☐ |
| `ADD CONSTRAINT wallet_entries_reason_check CHECK (reason IN ('sale', 'refund', 'commission', 'payout'))` | Only four allowed reasons | AI (Sheryl's attempt was corrected) | ☐ |

### `sql/SCHEMA.sql` (wallet_entries section)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `amount_cents BIGINT` | Fresh databases match migration 021 | SELF (typed from AI instruction) | ☐ |
| `reason TEXT NOT NULL CHECK (reason IN (...))` | Same four-reason rule | SELF (typed from AI instruction) | ☐ |
| `reference TEXT` | Same as 021 | SELF (typed from AI instruction) | ☐ |

### `apps/api/src/services/wallet.service.js`

| Lines | What it does | Who | Re-read |
|---|---|---|---|
| 1-59 header comments | Documentation | AI | ☐ |
| `credit`: `Number.isInteger(amountCents) \|\| ...` | Rejects decimals and text | AI | ☐ |
| `credit`: `amountCents <= 0` | Rejects zero and negatives | SELF | ☐ |
| `credit`: `INSERT INTO wallet_entries ... current_setting('app.current_tenant', TRUE)::uuid` | Tenant comes from the connection, never from the caller | AI | ☐ |
| `credit`: `[amountCents, reason, reference]` | Passes the amount into the insert | SELF | ☐ |
| `debit`: `Number.isInteger(...)` structure | Same safety check as credit | AI | ☐ |
| `debit`: `amountCents <= 0` | Rejects zero and negatives | SELF | ☐ |
| `debit`: `INSERT INTO wallet_entries ...` | Same insert as credit | AI | ☐ |
| `debit`: `[-amountCents, reason, reference]` | Stores a debit as a negative line | SELF | ☐ |
| `balance`: `SELECT COALESCE(... , 0) AS balance FROM wallet_entries` | Sum, with 0 when there are no lines | AI | ☐ |
| `balance`: `SUM(amount_cents)` | Adds every line up | SELF | ☐ |
| `balance`: `Number(rows[0].balance)` | Converts Postgres text to a number | MIXED (AI shape, `.balance` by Sheryl) | ☐ |

### `apps/api/tests/isolation.test.js` (lines that touch `wallet_entries`)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `'wallet_entries'` in `TENANT_TABLES` | Includes the wallet in every check | AI | ☐ |
| `INSERT INTO wallet_entries (tenant_id, amount_cents, reason) VALUES ($1, 100, 'sale')` | Gives Acme one wallet row to attack | AI | ☐ |
| `SELECT id FROM wallet_entries WHERE id = $1` (as Brio) | Attack 1: read | AI | ☐ |
| `UPDATE wallet_entries SET tenant_id = tenant_id WHERE id = $1` (as Brio) | Attack 2: update | AI | ☐ |
| `DELETE FROM wallet_entries WHERE id = $1` (as Brio) | Attack 3: delete | AI | ☐ |
| `SELECT id FROM wallet_entries WHERE id = $1` (as Acme) | Control: Acme's row is intact | AI | ☐ |
| Expected values `0`, `0`, `0`, `1` | What a safe table must return | AI (Sheryl described the idea first) | ☐ |

Note: the attack queries are written once and run for all 16 tables. The wallet lines above are the same code, applied to `wallet_entries`.

---

## 4. Isolation Audit

**Where the isolation lives (written before Day 4, unchanged today):**

| Piece | File | Who |
|---|---|---|
| Tenant read from the signed login token | `src/middleware/requireAuth.js` | Sheryl (Week 27), not touched today |
| Tenant written on the database connection | `src/middleware/withTenant.js` | Sheryl's original logic; AI-assisted release, borrow and RESET parts recorded in the Day 3 audit; not touched today |
| The lock on every table | Migrations 003-019 (`ENABLE` + `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy) | Sheryl (Week 27), not touched today |

**Evidence from Day 4:**

| Check | Result |
|---|---|
| Query: RLS enabled and forced | 16 tables `t` / `t`. 4 tables `f` / `f` by design (`tenants`, `users`, `webhook_events`, `audit_logs`) |
| Query: policies | 16 policies, all `tenant_isolation`, all reading `app.current_tenant` |
| Isolation suite (`npm test -- tests/isolation.test.js`) | 66 passed, 66 total, 3.619 s |
| Day 3 HTTP tests (still passing) | Products: 404 on read, update, delete. Orders: 404 on read |

**Wallet specifics:**

- `wallet_entries` has `ENABLE` and `FORCE ROW LEVEL SECURITY` and the standard policy. Migration 021 did not change them.
- `wallet.js` takes the tenant from the connection's `app.current_tenant`, never from a caller or a request body.
- Day 4 changed **no** isolation or authentication code.

**Known exceptions and risks (also in the proof document):**

- `audit_logs` has a `tenant_id` but no RLS by design. The app's database user can read all shops' rows. No endpoint exposes it today.
- The app's database user owns the tables, so it could in theory disable RLS or edit wallet rows. The guard test would catch disabled RLS.
- `debit` does not stop a balance going below zero (stretch goal; needs a lock to be safe).

---

## 5. What Sheryl understood and what to study

| Topic | Status |
|---|---|
| Why a ledger instead of a stored balance | Explained and understood |
| Why `amount_cents` is BIGINT and the reference is TEXT | Explained and understood |
| Difference between the column `amount_cents` and the variable `amountCents` | Learned after a mistake in the money blanks |
| Locks (RLS in migrations) vs the inspector (the test) | Explained in her own words |
| Why the test uses `BEGIN ... ROLLBACK` | Explained; first answer confused it with `BEGIN ... COMMIT` |
| How the seed inserts and parent-first order work | Explained in outline; to study again |
| Why 66 tests (2 guards + 16 x 4) | Explained |

---

## 6. What would raise the manual share (next steps)

1. Re-type the two `INSERT` statements in `wallet.js` by hand, then update the table above.
2. Write the proof document's conclusion in her own words.
3. Write the helper tests for `credit`, `debit` and `balance` by hand.
4. Tick the "Re-read" boxes only after genuinely re-reading each line.

---

## 7. Still open

- Helper tests for `credit`, `debit`, `balance` (not written yet).
- `INDEX.md` and file guides for the wallet (not updated yet).
- Fix or formally accept the `audit_logs` exception.
- Use a non-owner database role for the app so wallet rows are truly append-only.
- Replace the development `JWT_SECRET` and database password with strong values before deployment.
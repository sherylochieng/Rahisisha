# AI Audit Log — Rahisisha Biashara API

This file records what AI assisted with and what was written by hand
on each day of the capstone project. Required by Week 28 assignment rules.

**AI Boundary Rule:** 40% manual / 60% AI assisted
**Hard Rule:** All auth, tenant isolation, and RLS logic is ALWAYS hand-written.
AI is never used for cross-tenant guarantees.

---

## Week 28 Day 3 — Products & Orders CRUD, Pagination, Isolation Tests

### What AI (Claude) helped with

| File | What AI did |
|---|---|
| `src/controllers/products.controller.js` | Scaffolded CRUD structure, Zod schema, cursor pagination logic |
| `src/controllers/orders.controller.js` | Scaffolded CRUD structure, state machine object, transaction pattern |
| `src/routes/products.routes.js` | Generated route wiring |
| `src/routes/orders.routes.js` | Generated route wiring |
| `src/app.js` | Generated app/server split pattern |
| `src/index.js` | Generated slim server entry point |
| `tests/pagination/products.pagination.test.js` | Generated full pagination test suite |
| `tests/isolation/orders.isolation.test.js` | Generated test structure and assertions (file was originally named `products.isolation.test.js`) |
| `docs/INDEX.md` | Generated API documentation |
| `jest.config.js` | Generated Jest ES module config |
| `CLAUDE.md` | Generated standing instructions file |

### What was written by hand (NOT AI)

| Code | Why it must be hand-written |
|---|---|
| `src/middleware/requireAuth.js` | Auth logic — AI cannot be trusted with authentication |
| `src/middleware/withTenant.js` | Tenant isolation — the most critical security boundary in the app (see the 2026-10-28 and 2026-10-29 entries below for disclosed AI-written parts) |
| All `req.db` usage in controllers | Every query must use the scoped connection — hand-verified line by line |
| Cross-tenant test assertions | The human must understand and own what isolation means — not delegate it (see 2026-10-29 entry: the products cross-tenant assertions were AI-written and are disclosed there) |
| All RLS policies in SQL migrations | Row Level Security is the last line of defence — always hand-written |

### Engineering decisions made by hand

- Chose separation of concerns (controllers + routes split) over single router files
- Chose soft delete (`deleted_at`) over hard delete for products
- Chose cursor pagination over offset pagination — understood the tradeoff
- Chose `--runInBand` for Jest — understood why parallel tests break on shared DB
- Chose to split tests into `pagination/` and `isolation/` folders for clarity

### What I learned building this

- Cursor pagination: why it is safer than page numbers (no skipped rows when data changes)
- State machines: orders can only move forward, never backwards
- Database transactions: BEGIN/COMMIT/ROLLBACK protects order creation
- app.js / index.js split: why tests need the app without the server
- Cross-tenant isolation: 404 from RLS scope is not deletion — it is invisibility

### AI Boundary Compliance

- Auth middleware: ✅ hand-written
- Tenant isolation middleware: ✅ hand-written originally (see later disclosures)
- RLS policies: ✅ hand-written in SQL migrations
- CRUD scaffolding: ✅ AI assisted (allowed per assignment)
- Test structure: ✅ AI assisted, isolation assertions reviewed and understood by hand

---

## 2026-10-28 — Debugging: 7 failing tests (tenant context lost)

**Area:** `withTenant` middleware (tenant isolation) + test setup/cleanup
**Boundary class:** Isolation logic: AI allowed to DIAGNOSE only; code must be hand-written.

### What was wrong

- `withTenant` called `set_config('app.current_tenant', $1, true)`. The third
  argument `true` scopes the setting to the current transaction. No transaction
  was open, so the setting vanished after that one query. The next query (the
  INSERT) hit the RLS policy with an empty tenant, and `''::UUID` threw
  `invalid input syntax for type uuid: ""`.
- The controller then threw without responding, so `res 'finish'` never fired,
  the pool connection was never released, the pool filled up, and every later
  hook timed out. The timeouts were a symptom, not the cause.
- Separately: the test pool (`rahisisha_user`, now non-superuser so RLS applies)
  had no tenant set, so cleanup `DELETE`s matched 0 rows and test data piled up
  (126 products), breaking the pagination assertions.
- Earlier in the session `rahisisha_user` was a superuser, which bypasses RLS
  entirely. Fixed with `ALTER USER rahisisha_user WITH NOSUPERUSER` plus explicit
  table grants.

### What AI did

- Claude diagnosed the root cause and explained why.
- Claude's earlier suggestions (Jest timeout, larger pool) did NOT fix the issue.
- Claude suggested a `released` guard in `withTenant` (release once, on
  `finish` or `close`). I typed it myself. It was not the cause of the bug.
  DISCLOSURE: this is AI-suggested code inside middleware. I reviewed it and
  understand that it only prevents releasing a connection twice.
- Claude suggested the `deleteAsTenant` test helper and the loop-through-pages
  pagination test. Test code only; no production isolation logic.

### What I did by hand

- Changed `true` to `false` in the `set_config` call (the actual fix).
- Typed all code changes and ran every command myself.
- Added `tenant_id` to the INSERTs in the products and orders controllers.

### Verification

- `npm test` twice in a row: 2 suites, 6 tests passing both times.
- Product count for Acme back to the 5 seed products after the runs, so the
  cleanup leaves nothing behind.
- Cross-tenant isolation tests pass (Brio cannot read Acme's order).

### AI Boundary Compliance (2026-10-28)

- Root cause found by AI diagnosis; the one-word fix in `withTenant`
  (`true` → `false`) was made by hand: ✅
- `released` guard in `withTenant`: ⚠️ AI-suggested, typed by me, disclosed
  above. Not the cause of the bug.
- RLS policies: ✅ untouched, hand-written in SQL migrations
- Test helper and loop test: ✅ AI assisted (tests only, allowed per assignment)

---

## 2026-10-29 — Assignment gap review and hardening

**Area:** orders controller and routes, error handling, products cross-tenant
test, `withTenant` middleware, docs
**Boundary class:** CRUD, tests and docs: AI allowed. Isolation middleware:
AI-written parts disclosed below.

### What was found

- `PATCH /v1/orders/:id/status` did not match the assignment's
  `PATCH /v1/orders/:id`.
- `updateOrderStatus` validated the status with
  `!STATUS_TRANSITIONS[nextStatus] === undefined`, which compares a boolean to
  `undefined` and is always false. Unknown statuses skipped the validation
  check and returned 409 from the state machine instead of a 400 validation
  error.
- Task 5 asks for a cross-tenant test on products AND orders. Only orders was
  covered (`products.isolation.test.js` actually tested `/v1/orders`).
- Express 4 does not catch errors thrown in async handlers. A malformed ID such
  as `/v1/orders/not-a-uuid` made the query throw, the request hung, and the
  pooled connection was never released.
- In `withTenant`, `pool.connect()` sat outside the `try`, so a failed borrow
  could also hang the request.
- A connection returned to the pool still carried the previous request's
  `app.current_tenant`.

### What AI did

- Claude found the validation bug by tracing the line with a sample input, and
  explained it. Claude recommended `Object.hasOwn` over `in` because `in` also
  matches inherited names such as `constructor`.
- Claude wrote `tests/isolation/products.cross-tenant.test.js` and
  `tests/errors/error-handling.test.js`, including all assertions.
  DISCLOSURE: this deviates from the hard rule that cross-tenant test
  assertions are hand-written. The tests only VERIFY isolation and error
  behaviour; they do not implement it.
-
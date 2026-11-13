# ussd.cross-tenant.test.js — Proof That USSD Shops Cannot See Each Other

**File:** `apps/api/tests/isolation/ussd.cross-tenant.test.js`
**Doc:** `apps/api/docs/tests/ussd.cross-tenant.test.md`
**Added:** Week 29 Day 1 — Task 4 (cross-tenant test)
**Run with:** `cd apps/api` then `npm run test:isolation`

---

## WHY THIS FILE EXISTS

Many shops share ONE USSD phone line (`POST /ussd`). Each shop has its own
service code. This test proves that a caller who dials shop A **only ever
sees shop A's** welcome, products and money, never shop B's, even when:

- the same phone number dials both shops, and
- someone knows shop B's product id.

Real-life picture: two M-Pesa agents share one till number system. Each
agent must see only their own float.

## WHY IMPORTANT

USSD shows prices and balances. A leak here shows one shop's money to another
shop's customers. Manual curl tests only prove the menu *works*. Only an
automatic test proves it *stays safe* every time somebody changes the code.

## DANGER (if this file does not exist)

- Someone adds menu option 4 and queries with the plain `pool` instead of
  `req.db`. Every manual test looks fine, but it silently shows everybody's
  data. Nobody notices until a customer does.
- Someone "fixes" the guard to use the phone number as the shop. Nothing
  crashes. The test fails at once (check 5).
- The Husky pre-push hook runs this suite, so a leak blocks the push.

## WHAT IT SOLVES (the 8 checks)

| # | Check | What it proves |
|---|-------|----------------|
| 1 | Dial A: welcome is A's, never B's | Guard picks the right shop |
| 2 | Option 1 on A and on B | Product lists never mix |
| 3 | Option 2 on A and on B | Balances never mix |
| 4 | Unknown code | `END Service unavailable`, nothing leaks |
| 5 | Same phone on both codes | The phone number is NEVER the tenant |
| 6 | Every reply <= 182 chars | The USSD length rule holds |
| 7 | With A's lock, B's rows by tenant id, product id and wallet | RLS hides B completely (Task 4) |
| 8 | With B's lock, B's product IS visible | Control: check 7 passed because of RLS, not because the table was empty |

## SYSTEM DESIGN PRINCIPLE

**Every new door needs a test that tries to break it.** `/ussd` is a new door
that has no login cookie. Its only protection is the guard + RLS, so both are
attacked here.

## RULES

1. Connect as `rahisisha_user` (never a superuser). A superuser skips RLS and
   the test would prove nothing.
2. The test creates its OWN two shops, so it also runs in GitHub CI, where the
   demo shops (Amina, Brio) do not exist.
3. Clean up everything created, even when a test fails.
4. Never change a test only to make it pass. A failing test is information.

---

## THE CODE, PIECE BY PIECE

```js
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
```
Our own connection as `rahisisha_user`, so RLS applies exactly like the real
app. *Real life:* test the lock with a normal key, not the master key.

```js
const rand = Math.floor(Math.random() * 900000) + 100000;
const CODE_A = `*384*7${rand}#`;
const CODE_B = `*384*8${rand}#`;
```
Random service codes. If an old failed run left junk behind, it cannot clash
(`service_code` is UNIQUE). *Example:* `*384*7482913#`.

```js
const PHONE = '+254799999999';
```
ONE phone dials BOTH shops. If the app wrongly used the phone as the shop,
check 5 would fail. (Assignment "common mistake" number 1.)

```js
async function asTenant(tenantId, fn) { BEGIN; set_config(..., true); fn; COMMIT }
```
Runs SQL holding ONE shop's key. `true` = the key lasts only for this
transaction, then it is dropped. *Real life:* a bank clerk who can open your
box only while you are standing at the counter.

```js
function dial(serviceCode, text = '') { request(app).post('/ussd').type('form')... }
```
Pretends to be Africa's Talking: it posts **form data** (not JSON) to the real
app, through the real guard and the real RLS lock.

```js
beforeAll(...)
```
Creates two fresh shops (A, B), their `ussd_configs` rows, one product each
and one wallet entry each (A = KSh 1,000, B = KSh 2,000). Different data on
purpose: if they ever mix, we can SEE it.

```js
afterAll(...)
```
Deletes in a safe order: wallet and products (RLS tables, need the lock), then
`ussd_configs`, then `tenants`. Then closes both pools so Jest can exit.

```js
test('With shop A lock, shop B data is invisible even by id', ...)
```
This is Task 4. We look up the shop from service code A (like the guard
does), hold A's key, then ask for B's rows by tenant id, product id and
wallet. We expect **0 rows** every time.

```js
test('Control: with shop B lock, shop B product IS visible', ...)
```
Without this, check 7 could pass because the table is simply empty. The
control proves the row really exists and only the lock was hiding it.

---

## PRACTICAL EXAMPLES

- Caller dials A, presses 2 -> `END Balance: KSh 1,000`. Dials B, presses 2 ->
  `END Balance: KSh 2,000`. Never swapped.
- New developer adds `SELECT * FROM products` through `pool` -> check 2 fails
  the moment it shows both shops' products.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Own two shops instead of Amina and Brio | Works in CI and on any machine |
| Random service codes | No clash with leftovers from failed runs |
| Different data per shop | Any mix-up is obvious |
| `set_config(..., true)` inside BEGIN/COMMIT | Same safe pattern as the other isolation tests |
| Test through the real endpoint AND directly on the DB | Endpoint proves the whole chain; direct proves RLS alone |
| Control test (check 8) | Stops a false pass on an empty table |

## WHERE USED / FUTURE USES

- `npm test` and `npm run test:isolation`, the Husky pre-push hook and CI.
- Copy this shape for any channel that finds the shop from a key instead of a
  login cookie: WhatsApp webhook, SMS callback, M-Pesa callback.
- Stretch goal later: add checks for `ussd_events` rows (a shop must not read
  another shop's events).

## TRADEOFFS

| Good | Cost |
|------|------|
| Self-contained, runs anywhere | More setup lines than reusing demo shops |
| Proves the full chain | Slightly slower (real DB, real requests) |
| Catches silent leaks | Needs the local Postgres running before a push |

## COMMON MISTAKES

- Running as a superuser (RLS skipped, test proves nothing).
- Forgetting the `.type('form')`: the body arrives empty and every call says
  "Service unavailable".
- Forgetting `pool.end()` / `testPool.end()`: Jest hangs after the tests.
- Reusing leftover rows with fixed service codes: UNIQUE clash.

## AI AUDIT NOTE

Test written by AI (allowed: tests/menu boilerplate). The tenant resolution it
checks (middleware/resolveUssdTenant.js) was AI-written at Sheryl's request and
declared in `AI_AUDIT.md` (Week 29 Day 1).

## TEST LOG (fill in as we go)

| Run | Expected | Result |
|-----|----------|--------|
| `node --check` | no output | (fill in) |
| `npm run test:isolation` | all pass | (fill in) |
| Full `npm test` | all pass | (fill in) |
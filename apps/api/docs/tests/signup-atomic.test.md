# signup-atomic.test.js — Signup Is All-or-Nothing

**File:** `apps/api/tests/signup-atomic.test.js`
**Doc:** `apps/api/docs/tests/signup-atomic.test.md`
**Protects:** the transaction in `apps/api/src/routes/auth/signup.js`
**Run with:** `cd apps/api` then `npm test -- tests/signup-atomic.test.js`

---

## WHY THIS FILE EXISTS

Reviewer check: "seeding runs in one transaction". Signup does four jobs:

1. make the shop (`tenants`)
2. make the owner (`users`)
3. link them (`memberships`)
4. fill the shop with 3 sample products and 2 sample customers (`seedSampleData`)

The code already runs all four between `BEGIN` and `COMMIT`, on the same
`client`. But nothing PROVED it. This test does.

Real-life picture: moving house. Either everything arrives in the new house, or
you stay in the old one. You never want half your furniture in each.

## WHY IMPORTANT

If seeding ever ran on the plain `pool` instead of the transaction's `client`,
a failed seeding would leave a half-made shop behind, and the owner could never
sign up again ("phone already exists") although they have no working shop.

## DANGER (if this file does not exist)

- Someone changes `seedSampleData(client, ...)` to use `pool`. Every other test
  stays green. The bug appears in production, one unlucky signup at a time.
- Someone moves the `COMMIT` above the seeding. Same silent result.

## WHAT IT SOLVES (the checks)

| # | Check | What it proves |
|---|-------|----------------|
| 1 | Signup answers 500 | A clean failure, no crash and no hang |
| 2 | The seeding mock was called once | Control: the failure came AFTER the shop and owner were inserted |
| 3 | No user with that phone exists | The owner was rolled back |
| 4 | No shop with that name exists | The shop was rolled back |

## SYSTEM DESIGN PRINCIPLE

**Atomicity** (the A in ACID): a group of writes either all happen or none do.

## RULES

1. Mock ONLY the sample data service. The database and the transaction are real.
2. Mock BEFORE importing the app (the app grabs its imports once, at load time).
3. Always clean up anything left behind, even when the test fails.

---

## THE CODE, PIECE BY PIECE

```js
const seedMock = jest.fn().mockRejectedValue(new Error('seeding exploded'));
jest.unstable_mockModule('../src/services/sampleData.service.js', () => ({
  seedSampleData: seedMock,
}));
```
Swap the "add sample products" helper for one that always breaks.
`jest.fn()` also remembers how many times it was called (used by check 2).
*Real life:* put a broken part in the machine, then switch it on.

```js
const { default: app } = await import('../src/app.js');
```
Import the app AFTER the swap. A normal `import` at the top would load the real
helper first and the swap would do nothing. (Same pattern as `db-down.test.js`.)

```js
const PHONE = `0799${rand}`;
const SHOP  = `Atomic Test ${rand}`;
```
Random values so old leftovers can never clash with this run. The phone has 10
digits, so it passes the "10 to 20 characters" rule.

```js
errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
```
The route logs "[signup] transaction failed" on purpose. We keep the test output
quiet.

```js
const res = await request(app).post('/v1/signup').send({ phone, name, password, tenant_name });
expect(res.status).toBe(500);
```
Really sign up through the real route. The seeding blows up, the `catch` runs
`ROLLBACK`, and the route answers 500.

```js
expect(seedMock).toHaveBeenCalledTimes(1);
```
The control. If signup had failed earlier for another reason, the rollback checks
below would pass for the wrong reason.

```js
SELECT id FROM users WHERE phone = $1      -> expect 0 rows
SELECT id FROM tenants WHERE name = $1     -> expect 0 rows
```
`users` and `tenants` have no RLS, so a plain query can see them. Zero rows
means the rollback worked.

```js
afterAll(...)
```
Safety net. If a bug left rows behind, delete them (`memberships` first, using
the shop's key because it has RLS), then the shop, then the user. If the code is
right there is nothing to clean. Then close both pools so Jest can exit.

---

## PRACTICAL EXAMPLES

- Amina signs up. The server fails while adding sample products. She tries again
  with the same phone. It must work, not say "already exists". This test is what
  guarantees it.
- Future: orders + order items + stock changes. Copy this shape: make the last
  step explode and check the first steps were undone.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Mock only the sample data service | Everything else stays real, so the rollback is the real rollback |
| `unstable_mockModule` before a dynamic import | Same proven pattern as `db-down.test.js` |
| Random phone and shop name | No clash with other tests or old runs |
| Control check on the mock call count | Stops a false pass |
| Cleanup in `afterAll` | The database stays clean even if the code has a bug |

## WHERE USED / FUTURE USES

- `npm test` and CI.
- Any multi-step write: orders + items + stock, M-Pesa payment + wallet entry.

## TRADEOFFS

| Good | Cost |
|------|------|
| Proves the real rollback with the real database | Needs Postgres running, like the other API tests |
| Tiny: one test | Only covers a failure in seeding, not in the other steps |

## COMMON MISTAKES

- Importing the app at the top of the file (the mock is then ignored).
- Mocking the database pool as well (then there is no real rollback to prove).
- Forgetting the control check, so the test passes when signup fails early.
- Forgetting `pool.end()` and `testPool.end()`: Jest hangs.

## AI AUDIT NOTE

Test written by AI (test scaffolding, allowed). No change to the signup code was
needed: the transaction was already correct. No tenant isolation or ledger logic
touched.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check signup-atomic.test.js` | no output | passed |
| `npm test -- tests/signup-atomic.test.js` | 1 passing | 1 passed |
| Full `npm test` | all pass | (fill in) |
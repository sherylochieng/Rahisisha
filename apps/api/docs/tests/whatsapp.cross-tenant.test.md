# whatsapp.cross-tenant.test.js — Proof That WhatsApp Shops Cannot See Each Other

**File:** `apps/api/tests/isolation/whatsapp.cross-tenant.test.js`
**Doc:** `apps/api/docs/tests/whatsapp.cross-tenant.test.md`
**Added:** Week 29 Day 2 (webhook, dedupe, `whatsapp_dedupe` isolation)
**Run with:** `cd apps/api` then `npm run test:isolation`

---

## WHY THIS FILE EXISTS

Many shops share ONE WhatsApp webhook (`/webhooks/whatsapp`). Each shop has its
own WhatsApp number (`phone_number_id`). This test proves that:

- a message for shop A lands ONLY in shop A,
- repeats are skipped PER SHOP,
- the verify handshake only works for a real shop's token,
- the `whatsapp_dedupe` table is locked per shop. (This is the one RLS table the
  generic loop in `isolation.test.js` cannot test, because it has no `id` column.)

Real-life picture: one post office box area. A parcel for box 12 must only ever
reach box 12's owner, and a repeat delivery slip must not be mistaken for a
neighbour's.

## WHY IMPORTANT

A leak here shows one shop's customer messages to another shop. Manual tests only
prove the webhook WORKS. An automatic test proves it STAYS SAFE every time
somebody changes the code.

## DANGER (if this file does not exist)

- Someone dedupes on message text. Two customers who both say "ok" lose a
  message. Check 7 fails at once.
- Someone dedupes on message id ALONE (without the shop). Shop B's message is
  dropped because shop A saw the same id. Check 5 fails.
- Someone queries with the plain pool instead of `req.db`. Messages leak across
  shops. Check 3 fails.
- The Husky pre-push hook runs this suite, so a leak blocks the push.

## WHAT IT SOLVES (the 11 checks)

| # | Check | What it proves |
|---|-------|----------------|
| 1 | Verify with the right token returns the challenge | The handshake works for a real shop |
| 2 | Wrong token, wrong mode, odd challenge, missing token all give 403 | The handshake reveals nothing to strangers |
| 3 | A message for A's number is saved for A and invisible to B | Tenant resolution + RLS |
| 4 | The same message id again is skipped | Dedupe (Meta retries) |
| 5 | The same message id on B's number is still processed | Dedupe is per shop |
| 6 | An unknown `phone_number_id` gets 200 `ignored`, nothing saved | Unknown numbers are harmless |
| 7 | Different ids with the same text are BOTH saved | Dedupe is on id, not text |
| 8 | A payload with no `phone_number_id` gets 200 `ignored` | Odd shapes never crash |
| 9 | `whatsapp_dedupe`: with A's lock, B's rows are invisible | RLS on the dedupe table |
| 10 | `whatsapp_dedupe`: A cannot INSERT a row for B | `WITH CHECK` blocks writing into another shop |
| 11 | Control: with B's lock, B's dedupe row IS visible | Check 9 did not pass on an empty table |

## SYSTEM DESIGN PRINCIPLE

**Every new door needs a test that tries to break it.** The webhook is a public
door with no login cookie. Its only protection is the guard + RLS, so both are
attacked here.

## RULES

1. Connect as `rahisisha_user` (never a superuser): a superuser skips RLS.
2. The test creates its OWN two shops and a random throw-away KMS key, so it also
   runs on GitHub CI where the demo shops do not exist.
3. Fake tokens only. Clean up everything, even when a check fails.

---

## THE CODE, PIECE BY PIECE

```js
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
```
Our own connection as `rahisisha_user`, so RLS applies exactly like the real app.
*Real life:* test the lock with a normal key, not the master key.

```js
const rand = crypto.randomBytes(4).toString('hex');
const PHONE_ID_A = `pid-a-${rand}`; ... const VERIFY_A = `verify-a-${rand}`;
```
Random values so leftovers from an old failed run can never clash (`phone_number_id`
and the verify token are UNIQUE).

```js
const CUSTOMER = '254711000111';
```
ONE customer messages BOTH shops. If the app wrongly used the customer's number as
the shop, the checks would fail.

```js
async function inTenant(tenantId, fn) { BEGIN; set_config('app.current_tenant', id, true); fn; COMMIT }
```
Runs SQL holding ONE shop's key. `true` means the key lasts only for this
transaction, then it is dropped. *Real life:* a clerk who opens your box only while
you stand at the counter.

```js
function payload(phoneNumberId, messages) { ... }   function textMsg(id, text) { ... }
```
Build the shape Meta really sends (`entry`, `changes`, `value`, `messages`).

```js
beforeAll(...)
```
Sets a throw-away `KMS_KEY`, creates two fresh shops (the `tenants` table has no
RLS) and gives each a `whatsapp_configs` row with a FAKE token stored ENCRYPTED.

```js
afterAll(...)
```
Deletes in a safe order: messages, conversations, customers and dedupe rows under
each shop's lock, then the configs, then the shops. Puts your real `KMS_KEY` back
and closes both pools so Jest can exit.

```js
await request(app).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', ... })
```
Checks 1 and 2: pretend to be Meta doing the handshake, with good and bad values.

```js
const res = await request(app).post('/webhooks/whatsapp').send(payload(PHONE_ID_A, [textMsg(...)]))
expect(res.body.data).toEqual({ received: 1, duplicates: 0 });
```
Checks 3 to 8: pretend to be Meta delivering a message through the real app, real
guard and real RLS lock, then count rows as each shop.

```js
await expect(inTenant(tenantA, (c) => c.query("INSERT INTO whatsapp_dedupe ... VALUES ($1, 'wamid.sneaky')", [tenantB])))
  .rejects.toThrow(/row-level security/i);
```
Check 10: with A's key, try to write a row that belongs to B. Postgres refuses.

---

## PRACTICAL EXAMPLES

- Customer messages Amina: saved for Amina, 0 rows visible to Brio.
- Meta retries: `{ received: 0, duplicates: 1 }`.
- Same message id for Brio's number: still saved, because dedupe is per shop.
- New developer adds `SELECT * FROM messages` through the plain pool: check 3 fails.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Own two shops, not Amina and Brio | Works in CI and on any machine |
| Random ids and tokens | No clash with leftovers |
| Throw-away KMS key | CI has no `KMS_KEY`; never touches your real key |
| Test through the real endpoint AND directly on the database | The endpoint proves the whole chain; direct SQL proves RLS alone |
| Control check (11) | Stops a false pass on an empty table |
| Lives in `tests/isolation/` | The pre-push hook and `npm run test:isolation` run it |

## WHERE USED / FUTURE USES

- `npm test`, `npm run test:isolation`, the Husky pre-push hook and CI.
- Copy this shape for any channel that finds the shop from a key instead of a
  login: SMS callbacks, M-Pesa callbacks.

## TRADEOFFS

| Good | Cost |
|------|------|
| Self-contained, runs anywhere | More setup lines than reusing demo shops |
| Proves the whole chain | Needs Postgres running before a push |

## COMMON MISTAKES

- Running as a superuser (RLS skipped, test proves nothing).
- Forgetting `testPool.end()` and `pool.end()`: Jest hangs.
- Reusing fixed ids (UNIQUE clash on a second run).
- Sending the verify values in the body instead of the query string.

## AI AUDIT NOTE

Test written by AI (allowed). The tenant resolution it checks was AI-written at
Sheryl's request, declared in `apps/api/docs/AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check` | no output | passed |
| `npm test -- tests/isolation/whatsapp.cross-tenant.test.js` | 11 passing | 11 passed |
| `npm run test:isolation` (pre-push) | all pass | 100 passed |
| Full `npm test` | all pass | 198 passed (22 suites); CI green |
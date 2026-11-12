# resolveUssdTenant.js — The Door Guard for USSD

**File:** `apps/api/src/middleware/resolveUssdTenant.js`
**Doc:** `apps/api/docs/src/middleware/resolveUssdTenant.md`
**Added:** Week 29 Day 1 — "USSD Per Tenant, Shared Code, Per-Tenant Config"

---

## WHY THIS FILE EXISTS

Many shops share ONE USSD endpoint (`POST /ussd`). Each shop has its own
service code (Amina's Boutique = `*384*101#`, Brio Hardware = `*384*102#`).

When a phone request arrives, the server must answer one question first:
**"Which shop is this for?"** This file answers it, once, at the door,
and writes the answer on the request as `req.tenantId`.

Real-life picture: a block of flats with one main gate. The guard asks
"Which flat?" and sends you to the right door. Without the guard, every
visitor would walk into any flat.

## WHY IMPORTANT

Everything after this guard trusts `req.tenantId`. If the guard picks the
wrong shop, the menu shows the wrong shop's name, products and balance.
That is a data leak between customers. It is the most important line in
the whole USSD feature.

## DANGER

- **Never** pick the shop from the **phone number**. One phone can shop at
  many tenants, and numbers can be faked. (This is the first "common
  mistake" in the assignment.)
- **Never** pick the shop from what the caller **types** (`text`).
- The **service code** is the trusted key: the telecom routes it to us,
  the caller cannot change it from the handset.
- Never return shop data before `req.tenantId` is set and the RLS lock is on.

## WHAT IT SOLVES

- One endpoint, many shops. No copy-pasted code per shop.
- A new shop = one new row in `ussd_configs`. No code change, no deploy.
- Unknown codes get a safe, short goodbye instead of a crash or a leak.

## SYSTEM DESIGN PRINCIPLE

**Separation of concerns.**

| Piece | Job | Real-life role |
|-------|-----|----------------|
| `resolveUssdTenant` (middleware) | WHO is this? | Security guard |
| `withTenant` (middleware) | Lock the database to that shop | Key-holder |
| `handleUssd` (controller) | WHAT do we show? | Waiter |
| `ussd.routes.js` | The ORDER of the above | The map |

If the wrong shop appears, look in the guard. If the menu text is wrong,
look in the controller. Easy to debug.

It also follows the same **"stamp, then lock"** pattern as the dashboard:

```
Dashboard:  requireAuth        -> withTenant -> controller
USSD:       resolveUssdTenant  -> withTenant -> handleUssd
            (stamp tenant)        (RLS lock)
```

## RULES

1. Unknown service code -> reply `END Service unavailable`, stop.
2. Only set `req.tenantId` from the `ussd_configs` table.
3. Never trust the phone number or typed text as the shop.
4. Do not put `requireAuth` on `/ussd` — phones have no login cookie.
5. Always run `withTenant` AFTER this guard, before any shop-data query.

---

## THE CODE, PIECE BY PIECE

```js
import { pool } from '../db/pool.js';
```
Use the shared database pool. **Why the plain pool?** `ussd_configs` has no
RLS lock on purpose: we have to read it BEFORE we know the shop (the same
chicken-and-egg trap that broke login before migration 022).

```js
async function resolveUssdTenant(req, res, next) {
  try {
```
A middleware has three inputs: `req` (what came in), `res` (what goes
out), `next` (open the next door). `try` is there because Express 4 does
**not** catch errors from async functions by itself.

```js
const { serviceCode } = req.body || {};
```
Read the dialled code. `|| {}` is a safety net: if the body is empty we do
not crash, we just find no shop. *Example:* Africa's Talking posts
`serviceCode=*384*101#`.

```js
const { rows } = await pool.query(
  'SELECT tenant_id FROM ussd_configs WHERE service_code = $1',
  [serviceCode]
);
```
Ask the phone book: who owns this code? `$1` is a **safe slot**, so a
hacker cannot sneak SQL into `serviceCode` (SQL injection).

```js
if (!rows[0]) {
  return res.type('text/plain').send('END Service unavailable');
}
```
No owner means a polite goodbye. `END` closes the USSD session.
`text/plain` because Africa's Talking wants plain text, not JSON.
`return` makes sure nothing below runs.

```js
req.tenantId = rows[0].tenant_id;
return next();
```
Stick the note on the request, then open the next door
(`withTenant`). The name `req.tenantId` is deliberately the same as in
`requireAuth`, so `withTenant` works without any change.

```js
} catch (err) {
  return next(err);
}
```
If the database breaks, tell Express's error handler instead of leaving
the caller's phone hanging.

---

## PRACTICAL EXAMPLES

**Example 1 — a real shop**
Dial `*384*101#` -> guard finds Amina's Boutique -> `req.tenantId` set ->
menu says "Karibu Amina's Boutique".

**Example 2 — unknown code**
Dial `*384*999#` -> no row -> `END Service unavailable`. Nothing leaks.

**Example 3 — attacker**
Phone number belongs to Brio's owner but dials Amina's code. The guard
only looks at the code, so the caller sees Amina's menu and Amina's data
only. Cross-tenant test (Task 4) proves RLS blocks the rest.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Lookup is a middleware, not inside the controller | Separation of concerns; easy to test and debug on its own |
| Plain `pool`, not `req.db` | The shop is not known yet; `ussd_configs` has no RLS by design |
| `try/catch` + `next(err)` | Express 4 does not catch async errors |
| Name is `req.tenantId` | Same name as `requireAuth`, so `withTenant` is reused untouched |
| Reuse `withTenant`, no new transaction code | Same lock as the whole app; less code, fewer bugs |
| Do NOT copy the assignment's `app.tenant_id` | Our policies read `app.current_tenant` |

## WHERE USED

- `apps/api/src/routes/ussd.routes.js` (next step):
  `router.post('/ussd', resolveUssdTenant, withTenant, handleUssd)`

## FUTURE USES

- Menu options 1 (products) and 2 (balance) read `req.db`, already locked.
- Language per tenant (stretch): add a `language` column to `ussd_configs`.
- `ussd_events` audit table (stretch): log `req.tenantId` + option chosen.
- Other integrations (SMS callbacks, M-Pesa callbacks) can copy this
  "resolve tenant from a trusted key" pattern.

## TRADEOFFS

| Good | Cost |
|------|------|
| Simple, one query | One extra DB query per USSD request |
| Fully tenant-agnostic code | `ussd_configs` has no RLS (it must be readable before the shop is known) |
| Easy to test | Cache would be needed at high traffic (service_code -> tenant_id in memory) |

## HOW TO USE

```js
import { resolveUssdTenant } from '../middleware/resolveUssdTenant.js';
import { withTenant } from '../middleware/withTenant.js';

router.post('/ussd', resolveUssdTenant, withTenant, handleUssd);
```
Order matters: guard first, then lock, then waiter.

## COMMON MISTAKES

- Putting `withTenant` BEFORE this guard (no tenant to lock to yet).
- Adding `requireAuth` to `/ussd` (every call would be 401).
- Forgetting `express.urlencoded({ extended: false })` in `app.js`:
  Africa's Talking sends form data, so `req.body` would be empty and every
  call would say "Service unavailable".
- Looking up the shop by phone number.

## AI AUDIT NOTE

The assignment lists tenant resolution as **NOT ALLOWED for AI**. This
lookup was written by AI at Sheryl's request, then reviewed by Sheryl.
Declared in `AI_AUDIT.md` (Week 29 Day 1).

## TEST LOG (fill in as we go)

| Test | Expected | Result |
|------|----------|--------|
| `node --check` | no output | (fill in) |
| Dial `*384*101#` | `CON Karibu Amina's Boutique ...` | (fill in) |
| Dial `*384*102#` | `CON Welcome to Brio Hardware ...` | (fill in) |
| Dial unknown code | `END Service unavailable` | (fill in) |
| Cross-tenant test | Tenant B data returns nothing | (fill in) |
# resolveMpesaTenant.js — Finding the Shop From the Callback Address

**File:** `apps/api/src/middleware/resolveMpesaTenant.js`
**Doc:** `apps/api/docs/src/middleware/resolveMpesaTenant.md`
**Added:** Week 29 Day 3
**Tests:** `apps/api/tests/mpesa.callback.test.js` (checks 1 and 17)

---

## WHY THIS FILE EXISTS

Safaricom has no login cookie, so `requireAuth` cannot run on the callback. This guard reads the shop id from the URL and stamps `req.tenantId` so `withTenant` can lock the database to that shop.

## WHY IMPORTANT

Everything after trusts `req.tenantId`. It comes only from the URL, never from the message body.

## DANGER

- The shop id in the URL is not a secret and proves nothing. The real proof is the attempt match and Safaricom's confirmation.
- An unknown shop must get the same 200 Accepted as a real one.
- Never log the URL or body.

## WHAT IT SOLVES

One callback address pattern for many shops.

## SYSTEM DESIGN PRINCIPLE

Stamp, then lock, then work (same as the USSD and WhatsApp guards).

## RULES

1. The id must be a valid UUID, else ignore.
2. The shop must exist and not be deleted, else ignore.
3. Ignore means 200 Accepted, nothing else.
4. Only `req.tenantId` is set.

## PRACTICAL EXAMPLE

POST `/callbacks/mpesa/6549a72d-...` for a real shop: `req.tenantId` is set. POST `/callbacks/mpesa/not-a-uuid`: 200 Accepted, nothing happens.

## DECISIONS (and WHY)

- Uses the plain pool and the `tenants` table (no RLS), because the shop must be found before it is known.
- A suspended shop is accepted (a real payment must be recorded); a deleted one is ignored.

## WHERE USED / FUTURE USES

`routes/mpesa.routes.js`, before `withTenant`.

## TRADEOFFS

+ Tiny and easy to audit.
- One extra query per callback.

## HOW TO USE

`router.post('/:tenantId', resolveMpesaTenant, withTenant, asyncHandler(handler))`.

## PIECE BY PIECE (simple words, real-life examples)

### `ACCEPTED`

The one answer given to everything that is not for a real shop.

### `UUID` pattern

Stops text like `abc` before Postgres can throw a bad-id error.

### The query

`SELECT id FROM tenants WHERE id = $1 AND status <> 'deleted'` with a safe `$1` slot.

### `req.tenantId = rows[0].id`

The stamp. Real life: the doorman writes the flat number on the parcel before passing it on.

### `catch (err) { return next(err) }`

Express 4 does not catch async errors, so they are sent to the error handler by hand.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day3.md`). Last updated 16 November 2026.*

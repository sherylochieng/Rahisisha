# whatsapp.routes.js — Putting the Guard and the Lock in Order

**File:** `apps/api/src/routes/whatsapp.routes.js`
**Doc:** `apps/api/docs/src/routes/whatsapp.routes.md`
**Added:** Week 29 Day 2, Task 2
**Mounted in:** `apps/api/src/app.js` at `/webhooks/whatsapp`

---

## WHY THIS FILE EXISTS

Connects the two WhatsApp webhook doors to their handlers, and puts the guard
and the lock in the right ORDER on the POST door.

## WHY IMPORTANT

Order is the security here. If `withTenant` ran before `resolveWhatsappTenant`,
there would be no shop to lock to. If the handler ran without `withTenant`, its
queries would not be filtered by the shop.

## DANGER

- Do NOT add `requireAuth`: Meta's servers have no login cookie. (Later: check
  Meta's `X-Hub-Signature-256` header instead.)
- Do NOT put the guard or the lock on the GET door: the handshake carries no
  `phone_number_id` and must work before any shop is known.
- Keep `resolveWhatsappTenant` BEFORE `withTenant` on the POST door.

## WHAT IT SOLVES

"POST /webhooks/whatsapp resolves the tenant by `phone_number_id`, sets the RLS
tenant, then processes."

## SYSTEM DESIGN PRINCIPLE

"Stamp, then lock, then work": the same pattern as `/v1/products`
(`requireAuth` then `withTenant`) and `/ussd` (`resolveUssdTenant` then
`withTenant`).

## RULES

1. `GET /` : `handleVerify` only.
2. `POST /` : `resolveWhatsappTenant`, then `withTenant`, then `handleInbound`.
3. Mounted in `app.js` ABOVE the JSON 404 catch-all.

---

## THE CODE, PIECE BY PIECE

```js
router.get('/', asyncHandler(handleVerify));
```
The handshake door. No guard, no lock: no shop is known yet, and the handler
checks the verify token itself. `asyncHandler` passes any error to the central
error handler (Express 4 does not do it by itself).

```js
router.post('/', resolveWhatsappTenant, withTenant, asyncHandler(handleInbound));
```
The message door. Three steps in order: 1) find the shop, 2) lock the database to
that shop, 3) do the work. *Real life:* the doorman finds the flat, the lift is
set to that floor only, then the parcel goes up.

## PRACTICAL EXAMPLE

A customer messages Amina's number. Meta POSTs. The guard finds Amina, the lock
fixes the database to Amina, the handler saves the message in her inbox.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Guard and lock live on the router, not in `app.js` | GET and POST need different rules. USSD put them in `app.js` because it has one door |
| `asyncHandler` on both handlers | Express 4 does not catch async errors |

## WHERE USED / FUTURE USES

`app.js`: `app.use('/webhooks/whatsapp', whatsappRouter)`. Later: a signature
check middleware before the guard.

## TRADEOFFS

Guard plus lock is two steps per message, and they are exactly what keeps shops
apart.

## COMMON MISTAKES

- Adding `requireAuth` (Meta can never log in).
- Swapping the order of the guard and the lock.
- Mounting the router below the 404 catch-all (every webhook call answers 404).

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check` | no output | passed |
| `whatsapp.cross-tenant.test.js` | 11 passing | 11 passed |
| Manual: GET with demo verify token | `12345` | passed |
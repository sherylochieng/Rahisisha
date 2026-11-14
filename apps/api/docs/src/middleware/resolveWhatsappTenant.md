# resolveWhatsappTenant.js — Finding the Shop From Meta's Message

**File:** `apps/api/src/middleware/resolveWhatsappTenant.js`
**Doc:** `apps/api/docs/src/middleware/resolveWhatsappTenant.md`
**Added:** Week 29 Day 2, Task 2 (tenant resolution)
**Tests:** `apps/api/tests/isolation/whatsapp.cross-tenant.test.js`

---

## WHY THIS FILE EXISTS

Every WhatsApp message from every shop arrives on ONE shared address
(`POST /webhooks/whatsapp`). Meta's message says which WhatsApp number was
messaged (`metadata.phone_number_id`). This file is the guard at the door: it
finds the shop that owns that number and stamps it on the request
(`req.tenantId`).

Real-life picture: a block of flats with one front door and one doorman. A
parcel arrives addressed to "flat 12". The doorman looks up who lives in flat 12
and sends the parcel to them.

## WHY IMPORTANT

Everything after this guard trusts `req.tenantId`. A wrong shop here means one
shop's customer messages land in another shop's inbox.

## DANGER

- NEVER find the shop from the customer's phone number, the message text, or a
  header a caller can fake. Only the `phone_number_id` that we stored ourselves
  in `whatsapp_configs` decides.
- NEVER log the payload or the config row. This file reads ONLY `tenant_id`.
- Do not answer an unknown number with an error status: Meta retries failures
  for days. Answer 200 and ignore it.

## WHAT IT SOLVES

"One endpoint, many shops": no copy of the code per shop.

## SYSTEM DESIGN PRINCIPLE

Resolve identity once, early, in one place. Then lock the database to that shop
(`withTenant`). The same **stamp, then lock** pattern as `requireAuth` and
`resolveUssdTenant`.

## RULES

1. The key is `entry[0].changes[0].value.metadata.phone_number_id`.
2. It must be a non-empty string, or we ignore the request.
3. Unknown number: `200 { data: { ignored: true }, error: null }`, nothing else.
4. Only `SELECT tenant_id`. Never select the token column here.
5. Only `req.tenantId` is set.

---

## THE CODE, PIECE BY PIECE

```js
const phoneNumberId =
  req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
```
Dig into Meta's nested message. Each `?.` means "if this part is missing, give
up quietly instead of crashing". Meta also sends status updates and odd shapes,
so a missing field must never crash us.

```js
if (typeof phoneNumberId !== 'string' || phoneNumberId.length === 0) {
  return res.status(200).json({ data: { ignored: true }, error: null });
}
```
Not a real text value: nothing to look up. Say OK so Meta stops retrying.

```js
const { rows } = await pool.query(
  'SELECT tenant_id FROM whatsapp_configs WHERE phone_number_id = $1',
  [phoneNumberId]
);
```
Ask the phone book who owns this number. `$1` is a safe slot, so nobody can
sneak bad text into the query. We select only `tenant_id`.
*Real life:* the doorman reads only the flat number, not the tenant's diary.

```js
if (!rows[0]) { return res.status(200).json({ data: { ignored: true }, error: null }); }
```
Nobody owns the number: say OK and stop.

```js
req.tenantId = rows[0].tenant_id;
return next();
```
Stamp the shop on the request, then pass it on to `withTenant`, which locks the
database to that shop.

```js
catch (err) { return next(err); }
```
Express 4 does not catch errors from async code by itself, so we hand any
database error to the error handler.

---

## PRACTICAL EXAMPLES

- A customer messages Amina's number. Meta posts `phone_number_id: "1000001"`.
  The guard finds Amina, stamps her id, and the message is saved in her inbox.
- A payload for a number nobody owns gets `200 { ignored: true }`.
- A payload with no `phone_number_id` at all also gets `200 { ignored: true }`.

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Plain `pool`, no RLS on `whatsapp_configs` | The shop must be found BEFORE we know the shop (same trap as `ussd_configs` and login before migration 022) |
| 200 for unknown numbers | Meta retries failures for days; ignoring is safe |
| Optional chaining everywhere | Odd payload shapes must never crash the request |
| Runs BEFORE `withTenant` | `withTenant` needs `req.tenantId` to set the lock |

## WHERE USED / FUTURE USES

- `routes/whatsapp.routes.js` (POST only). The GET verify handshake has no
  `phone_number_id`, so it does not use this guard.
- Later: check Meta's `X-Hub-Signature-256` header before this step.

## TRADEOFFS

| Good | Cost |
|------|------|
| One small query per message | One extra database call per webhook call |
| Easy to cache later | A cache must be cleared when a shop changes its number |

## COMMON MISTAKES

- Using the customer's number as the shop key (anyone can fake it).
- Returning 4xx/5xx for an unknown number (Meta retries for days).
- Selecting `*` from `whatsapp_configs` (pulls the encrypted token into memory).
- Putting `withTenant` before this guard.

## AI AUDIT NOTE

Tenant resolution written by AI at Sheryl's request (the assignment lists it as
manual-only). Declared in `apps/api/docs/AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check` | no output | passed |
| `whatsapp.cross-tenant.test.js` (checks 3, 6, 8) | passing | 11 passed |
| Manual: POST for `demo-pid-amina` | `received: 1` | passed |
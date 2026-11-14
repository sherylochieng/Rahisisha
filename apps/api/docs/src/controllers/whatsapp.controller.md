# whatsapp.controller.js — The Two Doors of the WhatsApp Webhook

**File:** `apps/api/src/controllers/whatsapp.controller.js`
**Doc:** `apps/api/docs/src/controllers/whatsapp.controller.md`
**Added:** Week 29 Day 2, Tasks 2 and 4
**Tests:** `apps/api/tests/isolation/whatsapp.cross-tenant.test.js` (11 checks)

---

## WHY THIS FILE EXISTS

- `GET /webhooks/whatsapp` : Meta's **verify challenge** handshake (`handleVerify`).
- `POST /webhooks/whatsapp` : incoming customer messages (`handleInbound`).

This is where a customer's WhatsApp message becomes a row in the right shop's
inbox, exactly once.

## WHY IMPORTANT

Meta retries when it does not hear a quick 200. Without dedupe a customer's
message would appear two or three times. Without the shop lock it could appear in
the wrong shop.

## DANGER

- When `handleInbound` runs, `resolveWhatsappTenant` has stamped the shop and
  `withTenant` has locked the database. Use ONLY `req.db`. Never import the plain
  pool for shop data.
- NEVER log the payload, the token or customer phone numbers.
- Dedupe by Meta's message id, NEVER by the message text ("ok" and "ok" from two
  customers are two different messages).
- Dedupe and processing must be in ONE transaction, or a crash after the dedupe
  row is saved would make Meta's retry look like a duplicate and the message
  would be lost forever.

## WHAT IT SOLVES

Day 2 Task 2 (process inside the shop's lock) and Task 4 (skip repeats per shop).

## SYSTEM DESIGN PRINCIPLE

**Idempotency:** receiving the same message twice has the same result as once.
Also: answer 200 when it worked, fail with 500 so Meta retries.

## RULES

1. Verify: answer the challenge ONLY when `hub.mode` is `subscribe` and the verify
   token belongs to one of our shops. Otherwise 403.
2. Inbound: for each message, first `INSERT` into `whatsapp_dedupe`. Zero rows
   inserted = duplicate = skip.
3. Save the customer, the open conversation and the message with `req.db` only.
4. Any error: `ROLLBACK` and pass it to the error handler (500). Meta retries.
5. Message types we do not handle (image, audio...) are saved as `[image]` etc.

---

## THE CODE, PIECE BY PIECE

### handleVerify (the handshake)

```js
const mode = req.query['hub.mode'];
const token = req.query['hub.verify_token'];
const challenge = req.query['hub.challenge'];
```
Meta sends three values in the address. Express keeps the dots in the names.
*Real life:* a courier phones: "I have a parcel. What is the code word?"

```js
if (mode === 'subscribe' && typeof token === 'string' && token.length > 0
    && typeof challenge === 'string' && SAFE_CHALLENGE.test(challenge)) { ... }
```
All conditions must hold. The `typeof` checks stop tricks like `?hub.mode[]=x`.
`SAFE_CHALLENGE` only allows letters, digits, `-` and `_` (1 to 200), so the
endpoint cannot be used to echo back arbitrary text.

```js
const { rows } = await pool.query('SELECT 1 FROM whatsapp_configs WHERE webhook_verify_token = $1', [token]);
if (rows[0]) return res.status(200).type('text/plain').send(challenge);
```
Does any shop own this verify token? If yes, send back exactly the challenge.
We select `1`, never the token column.

```js
return res.status(403).json({ data: null, error: { code: 'forbidden', message: 'Verification failed' } });
```
Anything else: refuse and reveal nothing.

### handleInbound (a customer message)

```js
await db.query('BEGIN');
```
Start ONE transaction around everything. *Real life:* a bank transfer: the debit
and the credit both happen, or neither does.

```js
for (const entry of req.body?.entry ?? []) { for (const change of entry?.changes ?? []) {
  const value = change?.value ?? {}; ... for (const msg of value.messages ?? []) { ...
```
Meta's payload is nested: entry, changes, value, messages. `?? []` means "if it is
missing, treat it as an empty list". Status updates (delivered, read) have no
`messages`, so the loop does nothing for them.

```js
const fresh = await db.query(`INSERT INTO whatsapp_dedupe (tenant_id, message_id)
  VALUES ($1, $2) ON CONFLICT DO NOTHING`, [tenantId, messageId]);
if (fresh.rowCount === 0) { duplicates += 1; continue; }
```
**Dedupe first.** The primary key is `(tenant_id, message_id)`, so two different
shops never block each other. `rowCount === 0` means the row already existed:
we handled this message before. *Real life:* the stamp on a delivered parcel; a
second delivery attempt sees the stamp and goes home.

```js
INSERT INTO customers (tenant_id, phone, name, channel) VALUES (...)
ON CONFLICT (tenant_id, phone) DO UPDATE SET name = COALESCE(customers.name, EXCLUDED.name), updated_at = NOW()
RETURNING id
```
One customer row per phone number per shop. The first message creates it; later
ones keep the old name (`COALESCE`) and just touch `updated_at`.

```js
SELECT id FROM conversations WHERE customer_id = $1 AND channel = 'whatsapp' AND status = 'open'
ORDER BY created_at DESC LIMIT 1
```
Find the customer's open chat (no `WHERE tenant_id`: RLS already limits us to this
shop). If there is none, insert a new conversation.

```js
INSERT INTO messages (tenant_id, conversation_id, direction, body, sender, channel_message_id, raw_payload)
VALUES ($1, $2, 'inbound', $3, 'customer', $4, $5)
```
Save the message as inbound from the customer. `channel_message_id` is Meta's id
(a second dedupe safety net via the unique index on `messages`). Only the single
message object is kept as `raw_payload`, not the whole envelope.

```js
await db.query('COMMIT');
return res.status(200).json({ data: { received, duplicates }, error: null });
```
Everything worked: make it permanent and tell Meta "got it".

```js
catch (err) { try { await db.query('ROLLBACK'); } catch {} return next(err); }
```
Something failed: undo EVERYTHING, including the dedupe rows. That is what lets
Meta's retry be processed instead of skipped. The inner `try/catch` covers the
rare case where the connection is already gone.

---

## PRACTICAL EXAMPLES

- Customer texts Amina: dedupe row, customer, conversation, message saved. Answer
  `{ received: 1, duplicates: 0 }`.
- Meta retries: `{ received: 0, duplicates: 1 }`, nothing saved twice.
- A customer sends a photo: saved as `[image]`.
- Two different customers both say "ok": both saved (different message ids).

## DECISIONS (and WHY)

| Decision | Why |
|----------|-----|
| Dedupe row and message in one transaction | A failed save must not leave a "seen" row behind |
| Dedupe key is `(tenant_id, message_id)` | One shop's ids can never block another shop's |
| Verify uses the plain pool | No shop is known yet during the handshake |
| Challenge pattern check | Never reflect arbitrary text |
| Process inside the request (no queue yet) | Simple for now; move to a worker later |

## WHERE USED / FUTURE USES

- `routes/whatsapp.routes.js`.
- Later: AI replies via `sendWhatsApp`, delivered/read status updates, media.

## TRADEOFFS

| Good | Cost |
|------|------|
| Correct on retries, no queue needed | A slow step delays the 200 answer |
| Uses existing tables | Image/audio content is only a label for now |

## COMMON MISTAKES

- Dedupe on message text instead of message id.
- Saving the dedupe row outside the transaction.
- Using the plain pool for the customer or message insert (leaks across shops).
- Logging the payload.

## AI AUDIT NOTE

Webhook boilerplate (allowed for AI). The tenant resolution it relies on is AI-
written at Sheryl's request, declared in `apps/api/docs/AI_AUDIT_week_29_day2.md`.

## TEST LOG

| Run | Expected | Result |
|-----|----------|--------|
| `node --check` | no output | passed |
| `whatsapp.cross-tenant.test.js` | 11 passing | 11 passed |
| Manual: send once, send again | `received 1`, then `duplicates 1` | passed |
| Manual: Amina sees 1 message, Brio sees 0 | as expected | passed |
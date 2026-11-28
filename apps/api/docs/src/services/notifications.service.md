# src/services/notifications.service.js

**FILE:** `apps/api/src/services/notifications.service.js` (Week 30 Day 3, Batch 3b-1, step 2)

## WHY THIS FILE EXISTS

One small door for "queue a message". Any part of the system that wants to tell someone something calls `enqueueNotification()`. Today that is the four admin actions. Tomorrow it could be "your order was paid" or "stock is low". It **writes a row** in the outbox table (migration 031). It **sends nothing**.

## WHY IMPORTANT

The row is written on the **caller's transaction**. "Suspend the shop", "write the receipt" and "queue the owner's message" succeed together or roll back together. Real life: the clerk writes the letter, stamps the register and drops it in the tray in one go. No register entry without a letter, no letter without a register entry.

## DANGER (what breaks without it)

1. It needs the caller's client already inside `withAdminLock`. On the plain pool the database refuses the insert (only head office writes).
2. Never add network calls here. A slow WhatsApp call inside a transaction would hold the shop's row locked while waiting.
3. `recipient_phone` and `payload` are personal data. Do not log them. Use `maskPhone()`.
4. The words of the message do **not** live here. Templates are names; the channel adds the words when it sends (next batch).

## WHAT IT SOLVES

"Remember to tell this person, reliably" without slowing or breaking the action that caused it.

## SYSTEM DESIGN PRINCIPLE

**Transactional outbox + separation of concerns.** *What* happened (template + payload) is separate from *how* it is delivered (channel). Adding WhatsApp or SMS later changes the worker, not the callers.

## RULES

1. `template` must be one of `NOTIFICATION_TEMPLATES` (a typo cannot create a message nobody can word).
2. `channel` is `test` (default), `whatsapp` or `sms`.
3. `payload` is a plain object, at most 2000 characters as JSON.
4. `recipientPhone` may be empty. The row is still written, with an empty phone.
5. Errors carry `.code = 'validation'`.

## PRACTICAL EXAMPLE

```js
await enqueueNotification(client, {
  tenantId,
  template: NOTIFICATION_TEMPLATES.SHOP_SUSPENDED,
  recipientPhone: shop.owner?.phone,
  payload: { shopName: shop.name, reason },
  auditLogId: receipt.id,
});
```

## DECISIONS

- Takes a **client**, not the pool: the caller owns the transaction.
- `DEFAULT_CHANNEL = 'test'` is one line in one place (DRY). When WhatsApp is ready, one change flips it.
- Template names are a fixed list and the payload has a size cap, so a bug cannot fill the table with random or huge rows.

## WHERE USED

`apps/api/src/services/adminShops.service.js`.

## TRADEOFFS

+ Atomic, simple, easy to test. - Nothing is delivered until the worker exists.

## HOW TO USE

```js
import { enqueueNotification, NOTIFICATION_TEMPLATES } from './notifications.service.js';
```

**Reuse in future projects:** any system that must tell people things (orders, invoices, reminders, password resets) can use the same two pieces: an outbox table and one `enqueue` function. Examples: a school app queuing "fees due" SMS to parents, a boda-boda app queuing "your rider is here", a chama app queuing "contribution received".

---

## LINE BY LINE

**`NOTIFICATION_TEMPLATES`**
A frozen (cannot be changed) list of the message names we know: suspended, reinstated, verified, unverified.

**`CHANNELS` and `DEFAULT_CHANNEL`**
The ways a message may travel, and today's choice (`test`). It matches the database `CHECK`.

**`UUID_RE`, `PAYLOAD_MAX`**
The shape of a real id, and the biggest payload we accept.

**`fail(code, message)`**
Makes an error with a short `.code`, the same style as the other services.

**`maskPhone(phone)`**
Hides the middle of a number for logs: `254712345678` becomes `2547*****678`. Too short or not text gives `****`.

**`enqueueNotification(client, input)`**
1. Pulls the fields out of `input` and fills the defaults (no phone, empty payload, `test` channel, no receipt).
2. Checks the shop id looks real.
3. Checks the template is on the list.
4. Checks the channel is on the list.
5. Checks the payload is an object (not a list, not null) and not too big.
6. Turns a blank phone into `NULL`.
7. Checks the receipt id, if given, looks real.
8. Runs one `INSERT ... RETURNING` on the caller's connection and hands back the new row.

Every check happens **before** any SQL runs, so bad input never reaches the database.

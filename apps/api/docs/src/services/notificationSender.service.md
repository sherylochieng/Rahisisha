# src/services/notificationSender.service.js

**FILE:** `apps/api/src/services/notificationSender.service.js` (Week 30 Day 3, Batch 3b-2a, step 4)

## WHY THIS FILE EXISTS

The **postman**. It takes queued lines out of the outbox, writes the words, hands each one to its channel, and records what happened: sent, retry later, or failed for good.

## WHY IMPORTANT

Without it the outbox is a tray nobody empties. With it, an owner is told about a suspension even if the network was down at the moment of the action.

## DANGER

1. **Sending happens outside any database transaction.** A slow WhatsApp call must never hold rows locked. Pick-up and result-writing are two short transactions with the send between them.
2. A picked-up line is **on loan for 5 minutes** (`send_after` is pushed forward). If the server dies mid-send, the line comes back by itself. The price: after a crash a message could be sent **twice** (at-least-once delivery). Real channels should send an idempotency key later.
3. A line whose channel has no working code is **failed**, never marked sent.
4. Never log the message text or the full phone number.
5. A line marked `sent` with channel `test` was **not** delivered to a human.

## WHAT IT SOLVES

"Send what is waiting, retry what failed, never lose or double-pick a line."

## SYSTEM DESIGN PRINCIPLE

**Outbox consumer:** claim (`FOR UPDATE SKIP LOCKED`) -> slow work outside the transaction -> record the result. Retries with growing waits. At-least-once delivery.

## RULES

1. Only lines with `status = 'queued'` and `send_after <= now()` are picked.
2. Each pick-up counts as one attempt.
3. A failure waits 1, 5, 15 then 60 minutes. After 5 attempts the line is `failed`.
4. A permanent error, or a missing phone, fails the line at once.
5. Two senders at the same moment never take the same line.

## PRACTICAL EXAMPLE

```js
const result = await processDueNotifications(pool);
// { claimed: 3, sent: 2, retried: 1, failed: 0 }
```

## DECISIONS

- The 5-minute loan is stored in `send_after`, so no new column is needed.
- `last_error` keeps only a short reason (never the phone or the text).
- The options `channels` and `tenantId` exist so tests can plug in fake channels and look at one shop only. `tenantId` could also power a "retry this shop's messages now" button.
- **Bug found by test 10:** the first version used `WHERE id IN (SELECT ... LIMIT n FOR UPDATE SKIP LOCKED)`. Postgres may re-run that subquery and take more than `n` lines (it took 3 when asked for 2). The fix is a `WITH picked AS MATERIALIZED (...)` shortlist: write the list down first, then work only from it.

## WHERE USED

`jobs/notificationLoop.js`.

## TRADEOFFS

+ Simple, restart-safe, no extra servers. - Polling the database every few seconds keeps a sleeping Neon database awake while the API is awake.

## HOW TO USE

```js
import { processDueNotifications } from './notificationSender.service.js';
await processDueNotifications(pool, { batchSize: 10 });
```

**Reuse:** the same three phases fit any "do slow work for rows in a table" job: sending invoices, resizing photos, syncing to another system.

---

## LINE BY LINE

**`MAX_ATTEMPTS = 5`, `BACKOFF_MINUTES = [1, 5, 15, 60]`, `LEASE_MINUTES = 5`** The rules in numbers.

**`backoffMinutes(attempts)`** How long to wait after failed attempt N (1-based), kept inside the list.

**`shortError(err)`** Turns any error into a short safe note (hidden characters removed, 300 characters at most).

**`claimDue` (transaction 1)** Inside `withAdminLock`: a shortlist `picked` = queued, due lines (optionally one shop), oldest first, `LIMIT n`, `FOR UPDATE SKIP LOCKED` (skip lines another sender is holding). Then `UPDATE ... FROM picked`: add 1 to `attempts` and push `send_after` 5 minutes ahead (the loan). Returns the lines. Then the transaction ends, so nothing stays locked during sending.

**`deliverOne` (outside any transaction)** Never throws. No phone: permanent `no_recipient`. No channel code: permanent `channel_unavailable`. Otherwise write the words (`renderMessage`) and `channel.send`. Any error becomes `{ ok: false, permanent, error }`.

**`recordResult` (transaction 2)** Success: `status = 'sent'`, `sent_at = now()`, error cleared. Permanent error, or attempt number at the maximum: `status = 'failed'` with the reason. Otherwise: stay queued, save the reason and set `send_after` to now plus the backoff.

**`processDueNotifications`** Cleans the options (batch 1 to 50, default 10; optional shop id; optional fake channels), then: claim, deliver each line one after another, record all results in one short transaction, and return the counts.

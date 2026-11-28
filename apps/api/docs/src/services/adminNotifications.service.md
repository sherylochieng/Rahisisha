# src/services/adminNotifications.service.js

**FILE:** `apps/api/src/services/adminNotifications.service.js` (Week 30 Day 3, Batch 3b-2b, step 1)

## WHY THIS FILE EXISTS

Head office's **window onto the outbox**: "how many messages are waiting, sent or failed, and which ones?" It is read-only. It never queues, sends, retries or edits.

## WHY IMPORTANT

Without a window a failing sender is invisible: owners are not told and nobody knows. This is how a failed WhatsApp shows up on a screen, not in a customer complaint.

## DANGER

1. Runs only inside `withAdminLock`, behind `requirePlatformAdmin`. Never call it from a shop owner's route.
2. It **does not return the phone number or the payload** (the payload can hold a suspension reason). It returns only `hasPhone`, yes or no.
3. `last_error` is a short note from our sender (never a phone or message text). Show it as text only.

## WHAT IT SOLVES

"Is the sender working? What failed and why?"

## SYSTEM DESIGN PRINCIPLE

A **read model** separate from the write path (`notifications.service.js` writes, `notificationSender.service.js` sends, this file only reads). Keyset pagination like the shops list.

## RULES

1. Status filter: `queued`, `sent`, `failed` or none.
2. Newest first (`created_at`, then `id`). Page 1 to 100, default 25.
3. Errors carry `.code = 'validation'`.

## PRACTICAL EXAMPLE

```js
const page = await listNotifications(pool, { status: 'failed' });
const counts = await getNotificationSummary(pool);  // { queued: 2, sent: 40, failed: 1 }
```

## DECISIONS

- A separate summary query (three counts in one pass) so the page can show numbers on its filter buttons without loading rows.
- The shop's name is joined in (`tenants` has no row level security), so the screen says "Mama Njeri Groceries", not an id.

## WHERE USED

`controllers/adminNotifications.controller.js`.

## TRADEOFFS

+ Fast (indexes from migration 031) and safe (no personal data). - Ordered by `created_at`, so a retried line does not jump to the top.

## HOW TO USE

```js
import { listNotifications, getNotificationSummary } from './adminNotifications.service.js';
```

**Reuse:** every "queue + worker" system needs this window: payments to retry, emails to send, imports to process.

---

## LINE BY LINE

**`STATUSES`, `LIST_DEFAULT`, `LIST_MAX`** The three allowed words and the page size limits.

**`fail(code, message)`** An error with a short `.code`.

**`shapeNotification(r)`** Turns a database row into the clean answer: id, shop id and name, template, channel, status, attempts, last error, `sendAfter`, `sentAt`, `createdAt`, `hasPhone`. The phone and payload are simply not in the list.

**`listNotifications`** Checks the status word (unknown gives `validation`), clamps the page size, decodes the bookmark (bad gives `validation`). One query: join each line to its shop's name, filter by status if given, `(created_at, id) < bookmark`, newest first, `LIMIT limit + 1`. The extra row tells us there is a next page, and the bookmark is built from the last row of this page. `(n.recipient_phone IS NOT NULL) AS has_phone` turns the number into yes or no inside the database, so the number never leaves it.

**`getNotificationSummary`** One query with `COUNT(*) FILTER (WHERE status = ...)::int` three times: queued, sent, failed.

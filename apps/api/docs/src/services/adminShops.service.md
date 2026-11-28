# src/services/adminShops.service.js

**FILE:** `apps/api/src/services/adminShops.service.js` (Week 30 Day 3, Batch 1, step 3)

## WHY THIS FILE EXISTS

The platform admin's powers over shops live here: list the shops, open one, **suspend** it, **reinstate** it, **verify** it and **un-verify** it. Every power that changes something needs a written reason, runs in one transaction with its receipt, and is checked against the shop's current state first.

## WHY IMPORTANT

This is head office's remote control. A bug can close an honest trader's shop or leave a cheating shop open. So every rule is strict, and every change leaves a trace of who, when and why.

## DANGER (what breaks without it)

1. Nothing here decides **who** may act. The route's admin guard does that before this code runs. Never call these functions from a shop owner's route.
2. The admin lock is opened only by `withAdminLock`, inside a transaction. Never run these queries on the plain pool.
3. The admin must never read customer, order, payment or wallet data. This file reads only `tenants`, the owner's name and phone, and audit receipts.
4. The reason is saved word for word. Show it as text only, never as HTML.
5. Suspending marks the shop. It does not by itself log the owner out or stop USSD and WhatsApp. The doors that obey the mark are the next steps of this batch.

## WHAT IT SOLVES

"Show me all shops, find Wanjiku's, close it with a reason, and keep proof."

## SYSTEM DESIGN PRINCIPLE

- **Service layer:** rules live here, so they can be tested without a web server.
- **Atomicity:** shop change plus receipt is one transaction.
- **Pessimistic locking:** `SELECT ... FOR UPDATE` stops two admins changing the same shop at the same moment.
- **Keyset pagination:** bookmarks, not page numbers, so the list stays fast and stable with 100,000 shops.

## RULES

1. A reason is required for suspend, reinstate, verify and un-verify: 5 to 500 characters.
2. Suspend only when the status is `active`.
3. Reinstate only when the status is `suspended`.
4. Verify only when the shop is not deleted and not already verified.
5. Un-verify only when the shop is verified.
6. A deleted shop can never be changed.
7. Error codes: `validation`, `shop_not_found`, `shop_deleted`, `already_suspended`, `not_suspended`, `already_verified`, `not_verified`.

## PRACTICAL EXAMPLE

Customers report fake M-Pesa messages from "Wanjiku Fashions". `suspendShop(pool, { adminId, tenantId, reason: 'customers reported fake M-Pesa messages', ip })` closes it and writes the receipt. When Wanjiku proves she fixed it, `reinstateShop(...)` opens it again with its own reason and receipt.

## DECISIONS

- Statuses reuse the existing `tenants.status` values. `resolveShopBySlug` already shows only `active` shops, so the storefront closes the moment status becomes `suspended`.
- The three `suspended_*` columns are filled on suspend and **cleared** on reinstate. The history stays in the receipts.
- The list hides `deleted` shops unless you ask for `status=deleted`.
- The owner's phone is shown to the admin so support can call the owner. The password hash is never selected.
- The reason length is counted in real characters (`Array.from`), the way Postgres counts them, so an emoji cannot slip past 500.

## WHERE USED

`apps/api/src/controllers/adminShops.controller.js` (next file).

## TRADEOFFS

+ All rules in one place, tested against the real database.
- Locking the shop row makes two actions on the same shop wait for each other. That is what we want. Different shops never wait.

## HOW TO USE

```js
const page = await listShops(pool, { status: 'active', q: 'wanjiku' });
await suspendShop(pool, { adminId: req.admin.id, tenantId, reason, ip: req.ip });
```

---

## LINE BY LINE

**Imports**
`withAdminLock` opens the admin lock for one transaction. `recordAdminAudit` and `ADMIN_AUDIT_ACTIONS` write the receipt. `CURSOR_TS_SQL`, `decodeCursor` and `encodeCursor` are the bookmark helpers your wallet and inbox lists already use.

**Constants** (`UUID_RE`, `REASON_MIN`, `REASON_MAX`, `LIST_DEFAULT`, `LIST_MAX`, `STATUSES`, `SEARCH_MAX`)
The limits in one place. A reason is 5 to 500 characters. A page is 25 shops by default and at most 100. The only statuses are `active`, `suspended` and `deleted`. A search word is cut at 80 characters.

**`fail(code, message)`**
Makes an error with a short `code` the controller can turn into a clean answer.

**`checkId(id)`**
Checks a shop id has the right shape before any SQL runs. Like the clerk checking the file number has the right number of digits before walking to the cabinet.

**`cleanReason(reason)`**
The clerk will not file a form with an empty "why" box. It requires text, removes hidden control characters (the null character would crash Postgres), trims spaces, then counts real characters and refuses fewer than 5 or more than 500.

**`SHOP_COLUMNS_SQL` and `SHOP_FROM_SQL`**
The one list of fields shown for a shop. `LEFT JOIN LATERAL` means "for each shop, look up its owner": the oldest membership with role `owner`, then that user's name and phone. This works only because migration 029 lets the admin read `memberships`. The password hash is never selected. `LEFT JOIN` keeps a shop even if it has no owner row.

**`shapeShop(r)`**
Turns a database row into the clean answer: camelCase names, a ready-made `verified` yes/no, and an `owner` object (or `null`).

**`readShop(client, tenantId)`**
Fetches one shop in that shape on the caller's connection.

**`escapeLike(text)`**
In a search, `%` means "anything" and `_` means "any one letter". We put a backslash before them, so a search for `50%` looks for the text `50%`. Without this, anyone could type `%` and read every shop at once.

**`listShops(db, options)`**
- Validates `status`, `verified` and the bookmark. Anything odd gives `validation`.
- Cuts the page size to between 1 and 100.
- One query: filter by status (hiding `deleted` unless asked), search name or slug, filter verified, then `(created_at, id) < bookmark` and `ORDER BY created_at DESC, id DESC`.
- It asks for **one extra row** (`limit + 1`). If the extra row exists, there is a next page, and the bookmark is built from the last row of this page.

**`getShop(db, tenantId)`**
One shop's file. It reads the shop, then its latest 20 receipts with the admin's name (`LEFT JOIN platform_admins`, readable because the admin lock is on). Unknown shop gives `shop_not_found`.

**`lockShop(client, tenantId)`**
`SELECT ... FOR UPDATE` takes the shop's file out of the cabinet. Nobody else can change it until we `COMMIT`. It refuses unknown shops (`shop_not_found`) and deleted shops (`shop_deleted`).

**`suspendShop`**
Check the id and the reason, open the admin lock, lock the shop, refuse if it is already suspended. Then `UPDATE` to `suspended` with the time, the reason and the admin. Then write the receipt (before `{status}`, after `{status, reason}`), and return the updated shop. All one transaction.

**`reinstateShop`**
Refuses unless the shop is `suspended`. Sets it back to `active` and clears the three suspended fields. The receipt keeps what the suspension looked like in `before`, so the history is never lost.

**`verifyShop`**
Refuses if already verified. Stamps `verified_at = NOW()` and `verified_by`. `RETURNING verified_at` brings back the exact stamped time for the receipt.

**`unverifyShop`**
Refuses unless the shop is verified. Clears both fields. The receipt keeps who verified it and when.


---

## ADDED IN BATCH 3b-1: telling the owner (the outbox)

Every one of the four actions now also **queues a message for the owner**, in the same transaction. Nothing is sent here.

**New import:** `enqueueNotification` and `NOTIFICATION_TEMPLATES` from `notifications.service.js`.

**New rule 8 and two decisions** (in the file header): the message is queued, never sent, inside the action. A shop with no owner row still gets a queued line with an empty phone, so the action never fails because nobody can be told. Only the **suspend** message carries the admin's reason (the owner must know why the shop closed). The reasons for reinstate, verify and un-verify are internal notes and stay in the receipt only.

**New helper `queueOwnerNotice(client, { shop, template, receipt, extra })`**
Real life: after the clerk stamps the register, a slip "tell the owner" goes in the tray. It builds the payload `{ shopName, ...extra }`, uses the owner's phone (or nothing if there is no owner), and links the message to the receipt (`receipt.id`).

**What changed in each action** (the same three steps in all four):
1. `recordAdminAudit(...)` is now kept as `const receipt = ...` (it already returned the receipt's `id`).
2. The updated shop is read: `const updated = await readShop(client, tenantId);`.
3. `queueOwnerNotice(...)` is called, and `updated` is returned (it used to be `return readShop(...)`, so the answer to the screen is the same).

Suspend passes `extra: { reason: cleanText }`. The other three pass nothing extra.

# src/services/adminAudit.service.js

**FILE:** `apps/api/src/services/adminAudit.service.js` (Week 30 Day 3, Batch 1, step 2)

## WHY THIS FILE EXISTS

Every powerful thing the platform admin does to a shop (suspend, reinstate, verify) must leave a **receipt**: who did it, to which shop, what it looked like before and after, and from which network address. This file is the one place that writes that receipt into `audit_logs`.

## WHY IMPORTANT

Without receipts nobody can answer "who closed Wanjiku's shop and why?". With them, a dispute takes two minutes, and a stolen admin account can be traced and undone. Licensed payment providers will also expect this trail.

## DANGER (what breaks without it)

1. The receipt is written on the caller's **open transaction**, never on its own connection. So the change and its receipt both happen or neither does. Using the pool instead would allow a suspended shop with no receipt.
2. Only a short list of fields is stored. A password hash, token or phone number can never leak into the log by accident.
3. Only the actions on the printed list are accepted. A typo is refused instead of creating a receipt nobody can find.
4. This file never decides who may act. The admin guard and the admin lock do that before this code runs.

## WHAT IT SOLVES

One safe, tested way to write an admin receipt, used by the shop service now and by other admin tools later.

## SYSTEM DESIGN PRINCIPLE

Audit by design and atomicity: the receipt is part of the same unit of work as the action. One job per file: this file only writes receipts. Shop rules live in `adminShops.service.js` (next file).

## RULES

1. `recordAdminAudit(client, { adminId, tenantId, action, before, after, ip })`.
2. `client` must already be inside `BEGIN ... COMMIT`.
3. `action` must be one of `ADMIN_AUDIT_ACTIONS`.
4. `before` and `after` are plain objects or `null`. Unknown keys are dropped.
5. Errors carry `.code = 'bad_audit_input'`.

## PRACTICAL EXAMPLE

Sheryl suspends Wanjiku Fashions with the reason "customers reported fake M-Pesa messages". In the same transaction as the suspend, the receipt records `shop.suspended`, before `{status: 'active'}`, after `{status: 'suspended', reason: ...}`, actor = Sheryl.

## DECISIONS

- `resource` is always `'tenants'` and `resource_id` is the shop id. Later admin tools can add their own resources.
- The reason is saved inside `after` as well as on the shop, so the receipt stays complete even if the shop row changes later.
- `audit_logs` has no row level security (migration 028 only added `actor_admin_id`), so no admin lock is needed to insert. The caller already holds it for the shop update.

## WHERE USED

`apps/api/src/services/adminShops.service.js` (next file of this batch).

## TRADEOFFS

+ Very small, easy to test, hard to misuse.
- A new admin action needs one line added to `ADMIN_AUDIT_ACTIONS`. That is a feature: a reviewer sees every new kind of receipt.

## HOW TO USE

```js
await withAdminLock(pool, async (client) => {
  // ... change the shop with client.query(...) ...
  await recordAdminAudit(client, {
    adminId: req.admin.id, tenantId, action: ADMIN_AUDIT_ACTIONS.SHOP_SUSPENDED,
    before: { status: 'active' }, after: { status: 'suspended', reason }, ip: req.ip,
  });
});
```

---

## LINE BY LINE

**`export const ADMIN_AUDIT_ACTIONS = Object.freeze({...})`**
The printed tick-boxes at the top of a receipt book: `shop.suspended`, `shop.reinstated`, `shop.verified`, `shop.unverified`. `Object.freeze` means nobody can add a new box while the program runs.

**`const ALLOWED_SNAPSHOT_KEYS = Object.freeze([...])`**
The boxes allowed on the form: status, the suspend and verify fields, and `reason`. A bank slip shows "amount" and "date" but never your PIN. Anything not on this list is not copied.

**`const UUID_RE = /^[0-9a-f]{8}-...$/i`**
The shape of an id like `5bc6d791-ad88-41ad-93c2-4663c1d0507f`. We check the shape before any SQL runs, so garbage is refused early.

**`function fail(code, message)`**
Makes an error with a short `code` the caller can read. Same style as `platformAdmin.service.js`.

**`function pickSnapshot(snapshot, label)`**
Copies the allowed boxes onto the receipt.
- `null` or `undefined` returns `null`: "no picture", for example before a first verify.
- A text, number or list throws `bad_audit_input`, because a receipt picture must be an object.
- The `for` loop walks the allowed list and copies a key only if it was really given (`hasOwnProperty`), so `password_hash` is never copied.

**`function cleanIp(ip)`**
Writes the network address trimmed and cut at 64 characters. An empty address becomes `NULL`. A strange header cannot fill the table with junk.

**`export async function recordAdminAudit(client, {...} = {})`**
Checks the form, then stamps the receipt.
- No connection: refused. The receipt must join the caller's transaction.
- `adminId` and `tenantId` must be real id shapes. `action` must be on the list.
- The `INSERT INTO audit_logs` fills tenant, admin, action, resource `'tenants'`, resource id (the shop id again), before, after and address. The values go in as `$1..$6`, filled safely by the driver, so SQL injection is impossible.
- `JSON.stringify` turns the picture into JSON text for the JSONB columns. `NULL` stays `NULL`.
- It returns the new receipt's `id` and `created_at`.

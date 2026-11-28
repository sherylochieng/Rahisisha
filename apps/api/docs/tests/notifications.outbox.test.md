# tests/notifications.outbox.test.js

**FILE:** `apps/api/tests/notifications.outbox.test.js` (Week 30 Day 3, Batch 3b-1, step 4)

## WHY THIS FILE EXISTS

Proves the outbox does its job: each admin action queues exactly one message for the owner, with the right template and payload, in the **same transaction** as the shop change.

## WHY IMPORTANT

A lost message leaves an owner with a closed shop and no word. A message queued for a change that was rolled back tells an owner something that never happened. Both break trust.

## DANGER

It makes its own throw-away admin, shops and owners with random names and removes them after. Never use real phones or passwords. Never run it against a database whose shops you care about.

## WHAT IT SOLVES

Confidence in: queueing on every action, the reason only in the suspend message, "no owner" not breaking the action, a refused action queueing nothing, and a rollback removing the queued message.

## SYSTEM DESIGN PRINCIPLE

Test the promises: "one change = one message", "no message without the change", "a message problem never blocks head office".

## RULES

1. Random names per run.
2. Clean up everything (receipts, shops with their messages, owners, admin).
3. Read the outbox only inside `withAdminLock` (head-office-only table).

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- notifications.outbox
```

## DECISIONS

Real pool, real services, no fakes. The database rules (RLS, CHECKs, transactions) are exactly what is being tested.

## WHERE USED

The normal full test run (GitHub CI). The pre-push hook runs only the isolation suites.

## TRADEOFFS

+ End to end at service level. - Needs migration 031 applied first.

## HOW TO USE

`npm test -- notifications.outbox`

---

## LINE BY LINE (the ten checks)

**Setup (`beforeAll`)**: hires a test admin and opens three shops: `alpha` (with owner), `bravo` (**no owner row**), `charlie` (with owner).

**Helpers**: `makeShop` opens a shop (and owner if asked). `outboxFor` reads a shop's queued messages inside the admin lock. `latestReceipt` finds the newest receipt for a shop.

1. **Suspend queues one message** with template `shop.suspended`, channel `test`, status `queued`, 0 attempts, the owner's phone, payload `{shopName, reason}`, and `audit_log_id` equal to the receipt of that very action.
2. **Reinstate** queues `shop.reinstated` with only `{shopName}`. The internal reason does not leak.
3. **Verify** queues `shop.verified` with only `{shopName}`.
4. **Un-verify** queues `shop.unverified` with only `{shopName}`.
5. **No owner**: suspending `bravo` still works; the message has `recipient_phone = NULL`.
6. **Refused actions queue nothing**: an already-suspended shop and a too-short reason both leave the outbox unchanged.
7. **Rollback**: a message queued inside a transaction that then fails is gone afterwards.
8. **Bad input** to `enqueueNotification` (bad id, unknown template, unknown channel, list or null payload, huge payload, bad receipt id) is refused with `validation` and queues nothing.
9. **No admin lock, no write**: the plain pool cannot insert (the database refuses).
10. **`maskPhone`** hides the middle digits and handles empty or short input.

**Cleanup (`afterAll`)**: deletes receipts, then shops (their messages go with them), then owners, then the admin, then closes the pool.

**How I know the checks have teeth:** removing the reason from the suspend payload made check 1 fail, and adding a shop-side INSERT policy made the isolation write check fail. Both were put back.

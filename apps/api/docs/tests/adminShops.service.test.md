# tests/adminShops.service.test.js

**FILE:** `apps/api/tests/adminShops.service.test.js` (Week 30 Day 3, Batch 1, step 3)

## WHY THIS FILE EXISTS

Proves that the admin's shop powers work and stay safe: list and search, one shop's file, suspend, reinstate, verify and un-verify, the required reason, the state checks, and that every change leaves a receipt.

## WHY IMPORTANT

These functions can close a real trader's shop. A wrong rule (suspending a deleted shop, a change with no receipt, a missing reason) would hurt a real person or break trust in the platform.

## DANGER (what breaks without it)

The test makes its own throw-away admin, owners and shops with random names and removes them afterwards. Never put a real phone or password in it. Never run it against a database whose shops you care about.

## WHAT IT SOLVES

Confidence that `adminShops.service.js`, the audit receipts and the database rules from migrations 028, 029 and 030 work together.

## SYSTEM DESIGN PRINCIPLE

Test the promises: "no change without a reason", "no change without a receipt", "a bad request changes nothing".

## RULES

1. Every run uses its own random names, so tests never collide.
2. Clean up everything made: receipts, shops, owners, admin.
3. Never print passwords.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- adminShops
```

## DECISIONS

- Uses the real pool and the real services, with no fakes, because the real database rules are exactly what we test.
- A random `tag` is put in every shop name, so the search finds only our shops even if the database holds others.

## WHERE USED

Part of the normal test run and the pre-push hook.

## TRADEOFFS

+ Tests the real thing end to end at the service level.
- Slower than fakes: one bcrypt hash and a few database calls.

## HOW TO USE

```
cd apps/api ; npm test -- adminShops
```

---

## LINE BY LINE

**Helpers: `randomPhone`, `randomPassword`, `tag`**
Made-up details, new each run. The `tag` is a random word in every shop name.

**`makeShop(label, { status })`**
Opens a throw-away shop with an owner: inserts the shop, inserts a user, then inserts a `memberships` row linking them. `memberships` is locked per shop, so the helper first stamps the shop on its connection inside a transaction, exactly like a real shop request. Remembers the ids for cleanup.

**`readRow(id)` and `receipts(id)`**
Look straight at a shop's row, and read the receipt book for one shop.

**`beforeAll`**
Hires the test admin and opens five shops: alpha, bravo, charlie, delta, and `gone` (already `deleted`).

**`afterAll`**
Deletes the receipts, then the shops (their memberships go with them), then the owners, then the admin (inside the admin lock).

**Test 1: list, newest first, with the owner, hiding deleted, no secrets**
The four live shops come back newest first. The owner's name and phone are shown. The response contains no password or hash text. The deleted shop appears only when you ask for `status: 'deleted'`. Showing the owner also proves migration 029 works.

**Test 2: pages and bookmark**
Asks for 3, gets 3 and a bookmark; the next page has the last 1 and no bookmark; no repeats. A made-up bookmark is refused.

**Test 3: filters and wildcards are plain letters**
`<tag>%alpha` and `<tag>_alpha` must find **nothing**. If `%` or `_` kept their special meaning, they would match. The plain words still find the shop. Bad `status` or `verified` values are refused. I checked this test by breaking the escaping on purpose: the test failed, as it should.

**Test 4: one shop's file**
Returns the shop, its owner and an empty receipt list. An unknown id gives `shop_not_found`. A badly formed id gives `validation`.

**Test 5: the reason is required and a bad request changes nothing**
Eight bad reasons (missing, `null`, a number, empty, spaces only, 4 characters, 501 characters, only hidden characters). Each is refused, and the shop's row is identical afterwards with no receipt.

**Test 6: suspend**
The answer shows `suspended`, the trimmed reason, who and when. The database agrees. The receipt has the action, admin, before, after and address. The list can filter it, and the storefront rule (`status = 'active'`) no longer sees the shop.

**Test 7: state rules**
Cannot suspend twice, cannot reinstate an active shop, cannot un-verify an unverified shop. The deleted shop is refused by all four powers. Unknown and malformed ids are refused.

**Test 8: reinstate**
Back to `active`, the three suspended fields cleared. Two receipts, newest first. The old reason survives in the earlier receipt. The shop's file lists both with the admin's name.

**Test 9: verify and un-verify**
Verify stamps the time and the admin. A second verify is refused. The list can find verified shops. Un-verify clears it. Two receipts.

**Test 10: all or nothing**
Uses a valid-looking admin id that does not exist. The database refuses, and the shop is identical afterwards with no receipt.

**Test 11: the 500-character limit counts real characters**
500 emoji (1000 in JavaScript's eyes) are accepted, 501 are refused.

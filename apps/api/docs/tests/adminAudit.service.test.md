# tests/adminAudit.service.test.js

**FILE:** `apps/api/tests/adminAudit.service.test.js` (Week 30 Day 3, Batch 1, step 2)

## WHY THIS FILE EXISTS

Proves that admin receipts are written correctly and safely: the right fields, no secrets, no made-up actions, and, most important, that the receipt disappears together with the change if the transaction fails.

## WHY IMPORTANT

The audit trail is only worth something if it is trustworthy. A receipt that survives a failed change, or a missing receipt for a real change, would make the trail useless in a dispute.

## DANGER (what breaks without it)

The test uses made-up phones, random passwords and its own throw-away shop, and removes everything it made. Never point it at a real database with shops you care about.

## WHAT IT SOLVES

Confidence that `adminAudit.service.js` and the `audit_logs` table work together as promised.

## SYSTEM DESIGN PRINCIPLE

Test the promise, not the code. "The receipt and the change stand or fall together" is tested by really failing a transaction.

## RULES

1. Each run makes its own admin and shop with random names.
2. Clean up every row made: receipts first, then the shop, then the admin.
3. Never print passwords.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- adminAudit
```

## DECISIONS

- Uses the app's real pool, because the real admin code will use it.
- Reads receipts back with a plain pool query (`audit_logs` has no row level security), the way a support person would.

## WHERE USED

Part of the normal test run and the pre-push hook.

## TRADEOFFS

+ Fast: the only slow part is one bcrypt hash for the test admin.
- Does not test the shop actions yet. They come in the next files.

## HOW TO USE

```
cd apps/api ; npm test -- adminAudit
```

---

## LINE BY LINE

**`randomPhone()` and `randomPassword()`**
A made-up valid Kenyan number and a random long password, new each run, so no test ever uses real details.

**`beforeAll`**
Hires a test admin with the real `createPlatformAdmin` (so the real rules apply) and opens a throw-away shop with a random slug (so runs never collide).

**`afterAll`**
Deletes the receipts, then the shop, then the admin (inside the admin lock, because that table is locked), then closes the pool.

**`receiptsFor(id)`**
"Open the receipt book and read this shop's lines."

**Test 1: writes a receipt with who, what, which shop, before, after and address**
Writes a `shop.suspended` receipt and reads it back. Checks the admin id, that no shop user is recorded, the shop id, the action, the resource, the before and after pictures, and that the address `'  41.90.1.1  '` was trimmed.

**Test 2: drops fields that are not on the allowed list**
Tries to sneak `password_hash` and `phone` into the picture. Only `verified_at` survives. No before picture and no address were given, so both are `NULL`.

**Test 3: refuses bad input and writes nothing**
Six bad calls (a typo in the action, no action, a bad admin id, a bad shop id, a text picture, a list picture) plus a missing connection. Each fails with `bad_audit_input`, and the book has exactly as many lines as before.

**Test 4: the receipt disappears if the transaction fails**
Writes a receipt, then throws an error inside the same transaction. Afterwards the receipt is gone. This is the big promise: no receipt for something that never happened.

**Test 5: a long or empty address is handled safely**
A 500-character address is cut to 64. A blank address becomes `NULL`. Both receipts share one transaction and so one timestamp, so the test checks the pair, not their order.

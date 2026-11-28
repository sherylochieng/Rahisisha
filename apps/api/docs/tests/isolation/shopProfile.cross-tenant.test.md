# shopProfile.cross-tenant.test.js

**FILE:** `apps/api/tests/isolation/shopProfile.cross-tenant.test.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Proves one shop can never read or change another shop's business card.

## WHY IMPORTANT

The card holds a private WhatsApp number. A leak between shops would be a
privacy failure, the worst kind for a platform that serves many owners.

## DANGER

Needs the real database. Leaves two throw-away shops behind (the reset script
clears them). Part of the pre-push isolation suite.

## WHAT IT SOLVES

Catches a missing tenant lock on brand_profiles or a controller that trusts an
id from the request.

## SYSTEM DESIGN PRINCIPLE

Defence in depth: the database lock (forced row level security) is the wall; this
test proves the wall is really there.

## RULES

1. Both shops save a card. Each must see only its own, and saving must never touch
   the other's.
2. Sending another shop's id in the body must change nothing (the form is strict).

## PRACTICAL EXAMPLE

```
Shop A saves "Nairobi". Shop B saves "Mombasa". A reads Nairobi. B reads Mombasa.
```

## WHERE USED

npm run test:isolation

## HOW TO USE

```
cd apps/api && npm test -- isolation/shopProfile   Expect: 3 passed.
```

## PIECE BY PIECE

```
1. A saves, B saves     = TWO SHOPS WRITE THEIR OWN CARDS.
2. each reads its own   = EACH DRAWER HOLDS ONLY ITS OWN CARD.
3. tenantId in body     = TRYING TO WRITE ON SOMEONE ELSE'S CARD: refused or ignored.
4. afterAll pool.end()  = LOCKING THE DOOR ON THE WAY OUT, so the test run can finish.
```

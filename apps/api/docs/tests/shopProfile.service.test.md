# shopProfile.service.test.js

**FILE:** `apps/api/tests/shopProfile.service.test.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Fast checks of the profile service with a pretend database (no real database
needed): a blank card for a shop with no row, the merge rule on save, and that the
public card never carries the WhatsApp number.

## WHY IMPORTANT

These run in milliseconds and pin down the rules that the route tests rely on.

## DANGER

The pretend database only answers what these tests ask. If the SQL in the service
changes shape, update the pretend answers too.

## WHAT IT SOLVES

Catches a broken merge (a save wiping other boxes) or a leak in readPublicCard.

## SYSTEM DESIGN PRINCIPLE

Unit tests for rules, route tests for wiring.

## RULES

1. No real database here.
2. One rule per test.

## PRACTICAL EXAMPLE

```
A shop with no row: readProfile gives a blank card with the marketplace OFF.
```

## WHERE USED

npm test -- shopProfile.service

## HOW TO USE

```
cd apps/api && npm test -- shopProfile.service   Expect: 4 passed.
```

## PIECE BY PIECE

```
fakeDb(rows)  = A PRETEND DRAWER that always answers with the rows we hand it and
                remembers the last question and answers it was given.
```

# shopProfile.routes.test.js

**FILE:** `apps/api/tests/shopProfile.routes.test.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Proves the owner's Shop profile works end to end: reading a blank card, saving,
partial saves, the Kenyan phone check, the marketplace switch (off by default),
refusal of bad input, and what a stranger can see on the public shop page.

## WHY IMPORTANT

The marketplace will trust list_in_marketplace. If a shop could be listed
without saying yes, or if a private WhatsApp number leaked to the public page,
owners would lose trust on day one.

## DANGER

Needs the real database (migration 033 applied). Creates throw-away test shops
and leaves them behind; the reset script clears them.

## WHAT IT SOLVES

Catches a broken save, a missing default, a wrong phone shape, an unknown field
being ignored, and a public leak of the private number.

## SYSTEM DESIGN PRINCIPLE

Test the behaviour a user would see, through the real HTTP door, with a real
database. The tests share one shop and run in order on purpose.

## RULES

1. Never read the database directly to "prove" a save; ask the API.
2. A public page test must check the PRIVATE number is absent.

## PRACTICAL EXAMPLE

```
Mama Njeri saves town "Kitengela" and 0712 345 678. Her card shows 254712345678.
A stranger opening her shop page sees "Kitengela" and no number.
```

## DECISIONS

- Unknown fields give 400 (the form is strict), with details.
- The wrong phone gives details.whatsappNumber so the form can mark that box.

## WHERE USED

npm test -- shopProfile.routes

## TRADEOFFS

+ Real DB. - Leaves one test shop behind.

## HOW TO USE

```
cd apps/api && npm test -- shopProfile.routes   Expect: 10 passed.
```

## PIECE BY PIECE

```
1. no cookie            = A STRANGER AT THE BACK DOOR: refused (401).
2. blank card           = A NEW SHOP: everything empty, marketplace OFF.
3. save + read back     = WRITE THE CARD, THEN LOOK AT IT AGAIN.
4. partial save         = CHANGING ONE BOX LEAVES THE REST ALONE.
5. phone shapes         = 0712..., +254712... and 712... all become 254712345678.
6. bad phone / too long / unknown box = THE CLERK POINTING AT THE WRONG BOX.
7. clearing a box       = EMPTY TEXT BECOMES "NOTHING WRITTEN".
8. public page          = THE SHOP WINDOW: town and line shown, number never.
```

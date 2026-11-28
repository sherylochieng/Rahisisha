# shopParams.js

**FILE:** `apps/web/src/lib/shopParams.js` (Week 30 Day 3, Batch 4a-2 DRY pass)

## WHY THIS FILE EXISTS
The vocabulary of a public shop address: which aisle and where in the list. It holds the two rules: how to READ an aisle word safely (`parseCategory`) and how to WRITE the `?category=...&cursor=...` tail (`shopQuery`). Real life: the post office's rule for how an address is written.

## WHY IMPORTANT
The page that reads the address, the link builder and the API call all need the same rules. Before this file the tail was built in two places.

## DANGER
One place accepting an aisle word the other would reject, or links written differently from API calls.

## WHAT IT SOLVES
`parseCategory('shoes')` gives `'shoes'`; a bad word gives `null` (shown as All). `shopQuery({category:'shoes', cursor:'abc'})` gives `?category=shoes&cursor=abc`; empty gives `''`.

## SYSTEM DESIGN PRINCIPLE
DRY and separation of concerns: pure functions, no React, no network. Same slug rule as the API (lowercase words joined by dashes, up to 60).

## RULES
Never trust an aisle word from the address: parseCategory it. Never build `?category=` text by hand: use shopQuery.

## WHERE USED
`lib/shopHref.js`, `lib/publicApi.js`, `app/shop/[slug]/page.js`.

## TRADEOFFS
+ One place to change. - The slug rule also exists in the API and database (other programs, so it cannot be shared directly).

## HOW TO USE
`import { parseCategory, shopQuery } from '../lib/shopParams';`

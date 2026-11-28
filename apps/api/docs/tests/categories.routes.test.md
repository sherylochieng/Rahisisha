# categories.routes.test.js

**FILE:** `apps/api/tests/categories.routes.test.js` (Week 30 Day 3, Batch 4a-1)

## WHY THIS FILE EXISTS
Proves the public category list and that shops cannot write categories (6 tests).

## WHY IMPORTANT
Categories feed the product form, the shop window and the marketplace. A silent break here puts goods in the wrong aisle or leaks them.

## DANGER
Without it, a typo in the SQL (for example the CASE that keeps or clears the category) goes unnoticed until a real owner loses an aisle.

## WHAT IT SOLVES
Doors AND locks: the right things work, the wrong things are refused.

## SYSTEM DESIGN PRINCIPLE
Each test file builds its own world (fresh shop, own products, own test category with a random slug, removed in afterAll). Checks products by name, never by counting a list.

## RULES
Never switch off a real category (suites run in parallel). Never hard-code a phone. Never edit a test just to pass it.

## WHERE USED
`npm test -- categories.routes` and CI on every push.

## TRADEOFFS
+ Real database and real RLS. - Leaves a test shop behind (the reset script clears it).

## HOW TO USE
`cd apps/api` then `npm test -- categories.routes`

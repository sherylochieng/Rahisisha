# products.category.test.js

**FILE:** `apps/api/tests/products.category.test.js` (Week 30 Day 3, Batch 4a-1)

## WHY THIS FILE EXISTS
Proves a product can be created, kept, moved and cleared of its category, and bad ids are refused (9 tests).

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
`npm test -- products.category` and CI on every push.

## TRADEOFFS
+ Real database and real RLS. - Leaves a test shop behind (the reset script clears it).

## HOW TO USE
`cd apps/api` then `npm test -- products.category`

## ADDED IN THE DRY PASS
Setup chores (head-office switch, opening a test shop, finding aisle ids, reading a shop slug) now come from `tests/helpers/categoryKit.js`. The tests themselves are unchanged. Nothing removed.

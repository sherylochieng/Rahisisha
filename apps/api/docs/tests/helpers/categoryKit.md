# categoryKit.js

**FILE:** `apps/api/tests/helpers/categoryKit.js` (Week 30 Day 3, DRY pass)

## WHY THIS FILE EXISTS
The three category test files all needed the same four chores. They now share one copy: `asAdmin` (run SQL as head office), `signupTestShop` (a fresh shop, returns cookie and tenant id), `categoryIdBySlug` (a real aisle id via the public list) and `readShopSlug` (a shop's address word).

## WHY IMPORTANT
If the way a test shop is opened changes, you change it here once.

## DANGER
Copies drift apart and one test fails for a reason unrelated to what it tests.

## WHAT IT SOLVES
Test files say WHAT they check; this file knows HOW to set the scene.

## SYSTEM DESIGN PRINCIPLE
DRY and separation of concerns. It is not a test (no `.test.js` in the name), so Jest does not run it by itself.

## RULES
Never export anything that changes a REAL category (suites share one database). Phones are unique per call (clock plus counter). Never log cookies or passwords.

## WHERE USED
`categories.routes.test.js`, `products.category.test.js`, `storefront.category.test.js`.

## TRADEOFFS
+ One place to change. - One more small file to read.

## HOW TO USE
`import { asAdmin, signupTestShop } from './helpers/categoryKit.js';`

# sampleData.service.js

**FILE:** `apps/api/src/services/sampleData.service.js` (Week 30 Day 3, Batch 4a-3)

## WHY THIS FILE EXISTS
Fills a brand new shop with 3 sample products and 2 sample customers, inside the signup transaction, so the owner sees a working shop at once.

## WHY IMPORTANT
A new owner learns by seeing: samples show how a product, a price and (now) a category look.

## DANGER
It runs in the signup transaction: if it fails, the whole signup is undone. Keep it simple and safe.

## WHAT IT SOLVES
Batch 4a-3: every sample product is filed under the `food-groceries` aisle (looked up by slug inside the INSERT). If head office ever removed that aisle, the product just has no category and signup still works.

## SYSTEM DESIGN PRINCIPLE
Seeds belong in one service, not inside the signup route.

## RULES
Prices are in cents. Sample names start with `Sample:` so owners recognise and delete them. Never use real phone numbers for sample customers.

## WHERE USED
`routes/auth/signup.js` calls `seedSampleData(client, tenantId)`.

## TRADEOFFS
+ Instant, friendly start. - Existing shops keep their old, uncategorised samples (new signups only).

## HOW TO USE
Called once per signup; returns `{ products, customers }` counts.

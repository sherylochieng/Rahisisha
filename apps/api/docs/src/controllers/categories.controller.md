# categories.controller.js

**FILE:** `apps/api/src/controllers/categories.controller.js` (Week 30 Day 3, Batch 4a-1)

## WHY THIS FILE EXISTS
Answers `GET /v1/categories` with the list of aisles. Real life: the sign at the entrance listing every aisle.

## WHY IMPORTANT
The product form and the shop page both depend on it, and shoppers (not logged in) must be able to read it.

## DANGER
It uses the plain `pool` because the list is public and has no shop. Do not mount it behind login, and never add write handlers here.

## WHAT IT SOLVES
Returns `{ data: [{id, slug, name}], error: null }` with `Cache-Control: public, max-age=300`, so browsers do not ask again for five minutes.

## SYSTEM DESIGN PRINCIPLE
Thin controller: ask the service, wrap in the standard envelope, send.

## RULES
Public and read-only. Same envelope as every other route.

## WHERE USED
`routes/categories.routes.js`, mounted in `app.js` at `/v1/categories`.

## TRADEOFFS
+ Cheap for the server. - A head-office change can take up to 5 minutes to show in a browser.

## HOW TO USE
`curl http://localhost:3000/v1/categories`

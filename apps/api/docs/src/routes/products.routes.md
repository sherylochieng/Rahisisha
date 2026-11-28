# products.routes.js

**FILE:** `apps/api/src/routes/products.routes.js` (Week 30 Day 3, Batch 4a-3)

## WHY THIS FILE EXISTS
Maps the product URLs to their handlers: list, create, get one, change, delete, and (Batch 4a-3) `GET /categories`. Real life: the signboard listing every door of the products department.

## WHY IMPORTANT
One small file shows every product door in the API.

## DANGER
Express matches routes top to bottom. `GET /categories` MUST stay above `GET /:id`, or the word `categories` is read as a product id. Test 14 in `products.category.test.js` fails if it is moved (proven by moving it).

## WHAT IT SOLVES
The owner's Products page needs the aisles its own products use, so `GET /v1/products/categories` was added next to the list.

## SYSTEM DESIGN PRINCIPLE
One router per resource, mounted behind login and the shop connection in `app.js`.

## RULES
Fixed paths go above parameter paths (`/:id`). Wrap every handler in `asyncHandler`.

## WHERE USED
`app.js`: `app.use('/v1/products', requireAuth, withTenant, blockWritesWhenSuspended, productsRouter)`.

## TRADEOFFS
+ Easy to read. - The order rule is easy to break when adding routes (the test guards it).

## HOW TO USE
Add new fixed paths above `/:id`.

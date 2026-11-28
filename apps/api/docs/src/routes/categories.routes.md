# categories.routes.js

**FILE:** `apps/api/src/routes/categories.routes.js` (Week 30 Day 3, Batch 4a-1)

## WHY THIS FILE EXISTS
Maps `GET /` to the list handler. Real life: the door to the information desk.

## WHY IMPORTANT
Keeps the "which URL does what" in one small file (separation of concerns).

## DANGER
Only GET exists. If a POST is ever added, it must go behind the admin guard, never here without it.

## WHAT IT SOLVES
Public door `/v1/categories` with no login and no tenant.

## SYSTEM DESIGN PRINCIPLE
One router per resource, mounted by `app.js`.

## RULES
No auth middleware on purpose (public data). Wrap handlers in `asyncHandler`.

## WHERE USED
`app.js`: `app.use('/v1/categories', categoriesRouter);`

## TRADEOFFS
+ Simple. - Any future admin editing lives in the admin router, not here.

## HOW TO USE
Import in `app.js` and mount before the authenticated routers.

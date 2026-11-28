# shopProfile.routes.js

**FILE:** `apps/api/src/routes/shopProfile.routes.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Connects the addresses GET and PUT /v1/shop/profile to the functions that answer
them. A route only wires; it does no work itself.

## WHY IMPORTANT

Without it the owner's Shop profile page gets "404 not found".

## DANGER

Mounted in app.js BEHIND requireAuth, withTenant and blockWritesWhenSuspended.
Never mount it without them, or one shop could read another's card.

## WHAT IT SOLVES

Wiring: GET -> getProfile, PUT -> updateProfile.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: routes wire, controllers decide, services touch the database.

## RULES

No logic here. If you want an "if", it belongs in the controller.

## PRACTICAL EXAMPLE

```
app.js mounts this at /v1/shop/profile, so router.get('/') answers GET /v1/shop/profile.
```

## WHERE USED

app.js

## HOW TO USE

```
import shopProfileRouter from './routes/shopProfile.routes.js';
```

## PIECE BY PIECE

```
asyncHandler = A SAFETY NET: if the function crashes, the error goes to the error
               handler instead of leaving the request hanging.
```

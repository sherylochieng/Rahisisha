# src/controllers/adminShops.controller.js

**FILE:** `apps/api/src/controllers/adminShops.controller.js` (Week 30 Day 3, Batch 1, step 4)

## WHY THIS FILE EXISTS

It turns web requests into calls to the shops service, and turns the service's answers and refusals into clean web replies. It is the **front desk**: it reads what the admin sent, hands it to the service, and writes the reply. It holds no shop rules. Those live in `adminShops.service.js`.

## WHY IMPORTANT

A reply must be safe and predictable. A refusal must be a small clear message with the right status number, never a crash page or a leaked database error.

## DANGER (what breaks without it)

1. It must only be reached through the router that runs `requirePlatformAdmin` first. `req.admin` exists only because that guard ran.
2. Only five query words are passed on: `status`, `q`, `verified`, `limit`, `cursor`. Nothing else from the address is trusted.
3. The admin id comes from the signed admin cookie (`req.admin.id`), **never** from the body. A body containing `adminId` is ignored.
4. Unknown errors are not shown to the user. They go to the global error handler, so database details never leak.

## WHAT IT SOLVES

One tidy HTTP layer for the six admin shop actions, with the same envelope as the rest of your API: `{ data, nextCursor, error }`.

## SYSTEM DESIGN PRINCIPLE

Thin controller, fat service. The controller only translates HTTP in and HTTP out. One table (`ERROR_STATUS`) maps each service error code to a status number in one place.

## RULES

1. `GET /v1/admin/shops?status=&q=&verified=&limit=&cursor=`
2. `GET /v1/admin/shops/:id`
3. `POST /v1/admin/shops/:id/(suspend|reinstate|verify|unverify)` with `{ "reason": "..." }`
4. Status numbers: 200 ok, 400 validation, 404 shop not found, 409 "not allowed in the shop's current state".

## PRACTICAL EXAMPLE

`POST /v1/admin/shops/<id>/suspend` with `{ "reason": "fake M-Pesa messages" }` gives `200 { "data": { ...status "suspended"... }, "error": null }`. The same call again gives `409 { "data": null, "error": { "code": "already_suspended", ... } }`.

## DECISIONS

- Actions are POST (they change things), never GET.
- 409 Conflict for state problems, 404 for a missing shop, 400 for bad input.
- `req.ip` goes into the receipt. Until the "trust proxy" step is done, behind Render this may be Render's own address. The receipt is still correct about who and what.

## WHERE USED

`apps/api/src/routes/adminShops.routes.js`

## TRADEOFFS

+ Very small and easy to read. All rules stay testable in the service.
- One more file than putting everything in the route. That is the price of one job per file.

## HOW TO USE

Do not import it anywhere except `adminShops.routes.js`.

---

## LINE BY LINE

**`ERROR_STATUS`**
The front desk's card: `validation` is 400, `shop_not_found` is 404, and the five state problems (`shop_deleted`, `already_suspended`, `not_suspended`, `already_verified`, `not_verified`) are 409. `Object.freeze` stops anyone changing the card while the program runs.

**`answerKnownError(err, res)`**
If the error's `code` is on the card, it sends the clean reply `{ data: null, error: { code, message } }` and returns `true` ("I handled it"). If not (for example a database error), it returns `false` so the caller passes it to the global handler. Database error codes are numbers such as `23503`, so they can never be mistaken for our words.

**`listShopsHandler`**
Reads only the five known query words and calls `listShops`. Replies `200` with `{ data: [shops], nextCursor, error: null }`, the same shape as your inbox and wallet lists.

**`getShopHandler`**
Calls `getShop` with the id from the address and replies `200` with the shop and its receipts.

**`makeActionHandler(action)`**
Prints one form and changes only the stamp. It builds a handler that calls the service with:
- `adminId` from `req.admin.id` (the signed cookie, set by the guard),
- `tenantId` from the address,
- `reason` from the body (or `undefined` if there is no body, which the service refuses),
- `ip` from `req.ip`.

On success it replies `200` with the updated shop. On a known refusal it sends the clean reply, and on anything else it throws to the global handler.

**The four exports**
`suspendShopHandler`, `reinstateShopHandler`, `verifyShopHandler`, `unverifyShopHandler`. They are built from the same pattern, so they can never drift apart.

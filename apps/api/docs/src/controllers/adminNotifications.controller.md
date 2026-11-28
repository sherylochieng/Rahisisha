# src/controllers/adminNotifications.controller.js

**FILE:** `apps/api/src/controllers/adminNotifications.controller.js` (Week 30 Day 3, Batch 3b-2b, step 2)

## WHY THIS FILE EXISTS

The thin layer between the web address and the service: read the allowed words from the address, call the service, answer in the project's envelope.

## WHY IMPORTANT

Rules stay out of the HTTP layer. Only the words we know are passed on, so anything extra in the address is ignored.

## DANGER

1. The guard `requirePlatformAdmin` is in the router, not here. Never mount these handlers without it.
2. Do not add fields to the answer here. What may be shown is decided in the service.

## WHAT IT SOLVES

"Turn `GET /v1/admin/notifications` into a call to the service."

## SYSTEM DESIGN PRINCIPLE

Route / controller / service layering, with the same envelope as the other admin lists.

## RULES

1. List success: `{ data, nextCursor, error: null }`. Summary success: `{ data, error: null }`.
2. A `validation` error becomes 400 `{ data: null, error: { code, message } }`.
3. Unknown errors are re-thrown for the global error handler.

## PRACTICAL EXAMPLE

`GET /v1/admin/notifications?status=failed&limit=10`

## DECISIONS

Same shape as `adminShops.controller.js`, so the web code treats both lists alike.

## WHERE USED / TRADEOFFS / HOW TO USE

Used by `routes/adminNotifications.routes.js`. + Small and predictable. - A small repeated error helper, kept local so each controller reads on its own.

---

## LINE BY LINE

**`ERROR_STATUS`** Error code to HTTP status. Only `validation` (400).

**`answerKnownError`** If the error has a known code, send the answer and return true. Otherwise false, so the caller re-throws.

**`listNotificationsHandler`** Takes only `status`, `limit` and `cursor` from the address, calls `listNotifications`, answers 200 with the lines and the next bookmark.

**`getNotificationSummaryHandler`** Calls `getNotificationSummary` and answers 200 with `{ queued, sent, failed }`. It has no input, so it has no known errors.

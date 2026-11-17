# wallet.routes.js: The Payments Door

**File:** `apps/api/src/routes/wallet.routes.js`
**Doc:** `apps/api/docs/src/routes/wallet.routes.md`
**Added:** Week 29 Day 4
**Mounted in:** `apps/api/src/app.js` as `/v1/wallet` behind `requireAuth` and `withTenant`

---

## WHY THIS FILE EXISTS

Wires `GET /v1/wallet/entries` to `listWalletEntries`.

## WHY IMPORTANT

Same guard story as every private route.

## DANGER

Never mount without `requireAuth` and `withTenant`. Never add a write route here: the ledger is changed only by the payment callback.

## WHAT IT SOLVES

Day 4 Task 3 wiring.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns.

## RULES

GET only, no logic. A test proves POST/PUT/DELETE answer 404.

## PRACTICAL EXAMPLE

The Payments page calls `GET /v1/wallet/entries?limit=50`.

## TRADEOFFS

+ Tiny. - Lives at `/entries` so a future `/summary` can sit beside it.

## PIECE BY PIECE (simple words, real-life examples)

### `router.get('/entries', asyncHandler(listWalletEntries))`

One read-only route.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*

# storefront.cross-tenant.test.js: Proof The Public Shop Door Cannot Leak

**File:** `apps/api/tests/isolation/storefront.cross-tenant.test.js`
**Doc:** `apps/api/docs/tests/isolation/storefront.cross-tenant.test.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

Proves the PUBLIC shop door (`GET /v1/storefront/:slug`) is safe: a stranger sees only the active products of the shop whose address they opened, never another shop's, never drafts, never private fields.

## WHY IMPORTANT

This is the first endpoint that needs NO login. Every protection a login used to give now rests on the address word and the database lock. If this test is green, shop A's window can never show shop B's goods.

## DANGER

- Never use "now" for product times: the expected order would change from run to run. Fixed times only.
- It writes real rows to the test database for a moment. Teardown deletes only the rows it created.
- Never add a login cookie to the main calls. The whole point is that the door works for strangers.

## WHAT IT SOLVES

Proof for the public door: right shop, only active products, only four fields, paging that loses nothing, closed and unknown shops give the same 404, and the door is read-only.

## SYSTEM DESIGN PRINCIPLE

"Test the attacker's view". Try to get B's goods through A's door by every route we can think of: the address, the bookmark, a cookie, and other HTTP methods.

## RULES

1. Fixed timestamps only.
2. Every row the file creates is deleted in `afterAll`.
3. Test names and data are fake.
4. Lives in `tests/isolation` so the Husky pre-push hook runs it.

## THE DATA

- **Shop A:** 3 active products (Prod-1, Prod-2, Prod-3), plus a draft, an archived one and a deleted one.
- **Shop B:** 1 active product with a secret name (it must never appear on A's page), plus a draft.
- **Shop E:** no products at all.
- **Shop S:** suspended, with one product, to prove it is hidden because it is suspended and not because it is empty.

Real life: four practice shops, where you already know exactly what is on each shelf.

## THE 11 CHECKS, PIECE BY PIECE

1. **A stranger with no login sees the shop name and ONLY its active products, newest first.** Real life: someone walks up to the window.
2. **Drafts, archived and deleted products never appear.** The back room stays the back room.
3. **Only four fields are public.** `id`, `name`, `description`, `price_cents`. No SKU, status, dates or shop ids anywhere in the answer.
4. **Shop A never shows shop B's goods, on any page size** (1, 2, 3 and 48). Each product appears once, in order.
5. **A's bookmark used on B's address** still shows only B's goods. Real life: handing shop A's receipt to shop B's cashier.
6. **A login cookie from shop B does not change which shop's window you see.** The address decides, not the cookie.
7. **Unknown, badly shaped and suspended shops all get the SAME 404** with the same body. Nothing extra leaks.
8. **A shop with no active products is a normal 200 with an empty list.**
9. **A made-up bookmark is a 400** with the message `Invalid cursor`.
10. **limit stays between 1 and 48** (`0` and `-5` give 1; `100000` and `abc` fall back sensibly).
11. **The door is read-only.** POST, PATCH, PUT and DELETE all get 404, and nothing named "Hacked" appears afterwards.

## PRACTICAL EXAMPLE

Check 4: `GET /v1/storefront/<shop-a>?limit=2`, then follow `nextCursor` until it is null. The names that came back are exactly Prod-3, Prod-2, Prod-1, once each, and never B's secret product.

## TRADEOFFS

+ Real database and real lock: no mocks to drift from reality. - Slower than a unit test (about a second).

## HOW TO RUN

```
cd apps/api
npm test -- storefront
```

## AI AUDIT NOTE

Written by AI at Sheryl's request. Declared in `AI_AUDIT_week_29_day4.md` (follow-up section).

## TEST LOG

- 18 November 2026: 11 of 11 passed in the AI's sandbox and on Sheryl's machine.
- Checked by sabotage in the sandbox: showing drafts failed 6 checks; leaking the SKU failed check 3; ignoring the suspended status failed check 7. After each, the code was put back and the test passed again.

# tests/adminNotifications.routes.test.js

**FILE:** `apps/api/tests/adminNotifications.routes.test.js` (Week 30 Day 3, Batch 3b-2b, step 5)

## WHY THIS FILE EXISTS

Proves the doors of the notifications window: no cookie means no entry, a forged cookie is refused, a signed-in admin gets the right shape, and nothing is cached.

## WHY IMPORTANT

The list shows how the platform talks to shop owners. It must never be open to the public or to a shop owner.

## DANGER

Makes its own throw-away admin and removes it. Never use a real admin here.

## WHAT IT SOLVES

Confidence in the HTTP layer: guard, envelope, headers, error answers.

## SYSTEM DESIGN PRINCIPLE

Test the lock first, then the contents.

## RULES

Random phone and password per run. Remove the admin afterwards.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- adminNotifications.routes
```

## DECISIONS / WHERE USED / TRADEOFFS / HOW TO USE

Same layout as `adminStats.routes.test.js`. Normal test run. + End to end through Express. - One bcrypt login per run.

---

## LINE BY LINE

**Setup.** Hire a test admin and sign in with a supertest agent (it keeps the cookie).

1. **No cookie, no entry:** both addresses answer 401 with the standard "Not signed in" answer.
2. **Forged cookie:** a cookie signed with the shop secret, not the admin key, is refused.
3. **The list:** 200, `no-store`, `error: null`, an array in `data`, a `nextCursor` key, and no phone or payload fields on any item.
4. **Bad input:** an unknown status or a nonsense bookmark answers 400 with code `validation`.
5. **The filter** works through the door: every returned line has the chosen status.
6. **The summary:** exactly three keys (`queued`, `sent`, `failed`), whole numbers, `no-store`.

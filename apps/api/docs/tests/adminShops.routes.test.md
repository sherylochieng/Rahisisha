# tests/adminShops.routes.test.js

**FILE:** `apps/api/tests/adminShops.routes.test.js` (Week 30 Day 3, Batch 1, step 4)

## WHY THIS FILE EXISTS

Proves the admin shop **doors** work and are locked: nobody without an admin cookie gets in, a signed-in admin can list, open, suspend, reinstate, verify and un-verify, and every refusal has the right status number.

## WHY IMPORTANT

The service rules are tested elsewhere. This file proves the door itself: the guard really covers every address, the admin id comes from the cookie and not the body, and errors never leak details.

## DANGER (what breaks without it)

It makes its own throw-away admin, owner and shop with random names and removes them afterwards. Never put a real phone or password in it.

## WHAT IT SOLVES

Confidence that `app.js`, the guard, the router, the controller and the service fit together.

## SYSTEM DESIGN PRINCIPLE

Test at every layer. The service tests prove the rules, this file proves the wiring. A correct rule that is not connected protects nobody.

## RULES

1. Each run makes its own admin, owner and shop with random names.
2. Clean up everything made.
3. Never print passwords.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- adminShops.routes
```

## DECISIONS

- `supertest` with a cookie jar (`request.agent`) plays the part of the admin's browser.
- It signs in through the real login door, so the real cookie is used.

## WHERE USED

Part of the normal test run and the pre-push hook.

## TRADEOFFS

+ Tests the real wiring end to end without opening a port.
- Needs the database, like the other route tests.

## HOW TO USE

```
cd apps/api ; npm test -- adminShops.routes
```

---

## LINE BY LINE

**Setup (`beforeAll`)**
Hires an admin with the real service, signs in through `/v1/admin/auth/login` with a cookie-keeping browser (`admin`), then opens one throw-away shop with an owner (the membership is inserted with the shop stamped on the connection, like a real shop request).

**Cleanup (`afterAll`)**
Removes the receipts, the shop, the owner and the admin.

**Test 1: the lock**
Six requests with no cookie, one for each address. Each must be `401` with the standard "Not signed in" body, and the shop must still be `active`. If you delete `router.use(requirePlatformAdmin)`, this test fails (I checked).

**Test 2: a forged badge**
A cookie signed with the shop secret instead of the admin's own key is refused with `401`.

**Test 3: list and one shop**
The list returns the standard envelope, the owner's name, `no-store` in the headers, and no password text. The single-shop call returns the shop and an empty receipt list.

**Test 4: bad input at the door**
A malformed id gives `400`, an unknown shop `404`, a bad status filter `400`, a bad bookmark `400`, and a repeated word (`?status=active&status=suspended`) `400`, not a crash.

**Test 5: the reason is required**
Six bad bodies (none, empty object, empty text, 4 characters, a number, 501 characters). Each is `400`, and the shop is unchanged.

**Test 6: suspend and reinstate**
Suspend gives `200`, suspending again gives `409 already_suspended`, reinstate gives `200`, reinstating again gives `409 not_suspended`.

**Test 7: verify and un-verify**
The same four-step pattern, with `already_verified` and `not_verified`.

**Test 8: the body cannot pick the admin**
Sends a fake `adminId` and `tenantId` in the body. The address decides the shop, the cookie decides the admin. The shop's file then lists five receipts in the right order, all naming the real admin, and the newest has a network address. If you change the controller to read `adminId` from the body, this test fails (I checked).

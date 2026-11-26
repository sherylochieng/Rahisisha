# adminAuth.routes.test.js — testing the admin door

*Week 30 (26 Nov 2026) — platform admin, step 4*

## FILE

`apps/api/tests/adminAuth.routes.test.js`

## WHY THIS FILE EXISTS

Proves the admin sign-in **door** works end to end, through the real web app (supertest sends real requests, no browser needed): login, the cookie, 'who am I', logout, the brake, and refusal of every wrong kind of badge.

*Real life: instead of asking the clerk how the door should work, a tester walks up to the real door and tries every key.*

## WHY IMPORTANT

The service tests prove the rules. These prove the rules are actually wired to the web addresses. A rule that is not wired in protects nobody.

## DANGER

Uses random made-up admins on your **local** database only. Every admin created is deleted afterwards. No real secrets are printed.

## WHAT IT SOLVES

Confidence that `/v1/admin/auth/*` behaves exactly as designed.

## SYSTEM DESIGN PRINCIPLE

Test the door from the outside, the way a visitor would use it.

## RULES

1. Each test starts with an empty brake notepad (`resetAdminLoginLimiter`).
2. Every pretend admin is removed in `afterAll`.
3. A cookie jar (a supertest *agent*) plays the part of the browser.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- adminAuth.routes
```

## DECISIONS

- Uses the real app and real database, not fakes, so wiring mistakes show up.

## WHERE USED

The normal test run.

## TRADEOFFS

+ Catches wiring mistakes the service tests cannot.
- Slower (real bcrypt, real database): a few seconds.

## HOW TO USE

Run it after any change to the admin door: `cd apps/api ; npm test -- adminAuth.routes`.

---

## PIECE BY PIECE (real life, in simple terms)

**makeAdmin()**  
Add a pretend staff member to the book and remember them for clean-up.

**agent**  
A pretend browser that remembers cookies between requests.

**cookieOf(res)**  
Reads the admin cookie line out of a reply.

**Check 1**  
Right phone and password: signed in, the cookie is safe (httpOnly, SameSite=Strict, no Domain), the reply is not cached, and /me names the admin. No hash, token or password in the body.

**Check 2**  
Wrong password and unknown phone give word-for-word identical 401 answers, and no cookie.

**Check 3**  
Missing phone or password gives 400, not a crash.

**Check 4**  
/me refuses: no cookie, a garbage badge, a shop owner's cookie, a badge forged with the shop-owner key, and an expired badge.

**Check 5**  
After 5 wrong tries even the CORRECT password gets 429 with a Retry-After header.

**Check 6**  
A disabled admin with a still-valid badge is locked out at once.

**Check 7**  
Logout clears the cookie, /me then refuses, and logging out when nobody is signed in is a harmless 200.

---

## LINE BY LINE (the real code, explained)

### The tools

`supertest` sends fake web requests straight into the app (no real server or port). `jsonwebtoken` lets the test forge wrong-kind badges. `app` is the real Express app; `pool` is the real database connection. `dotenv.config()` loads `JWT_SECRET` and the database settings, the same as the other tests.

### The constants and helpers

```js
const LOGIN = '/v1/admin/auth/login';  const LOGOUT = ...;  const ME = ...;
```
The three addresses, written once. `randomPhone` and `randomPassword` make fresh made-up values every time so tests never clash. `made` collects every pretend admin for clean-up. `makeAdmin()` creates one with the real `createPlatformAdmin`. `lockedQuery()` opens the head-office lock for one query.

```js
const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('admin_token='));
```
A reply can carry several `Set-Cookie` lines; this finds the admin one (or `undefined`).

### `beforeEach` and `afterAll`

`beforeEach` wipes the brake's notepad so one test's wrong tries never block the next test. `afterAll` deletes the pretend admins and closes the database connection (otherwise Jest hangs waiting).

### Check 1: correct login

- `request.agent(app)` is the pretend browser: it keeps the cookie from login and sends it on `/me`.
- `expect(login.body).toEqual({ data: { admin: { id, name } }, error: null })` proves the **exact** body.
- `not.toMatch(/hash|token|password/i)` on the JSON text proves nothing sensitive leaked.
- The cookie line must contain `HttpOnly` and `SameSite=Strict`, and must **not** contain `Domain=`.
- `cache-control` must contain `no-store`.

### Check 2: identical answers

Wrong password and unknown phone must give the same status **and** the same body (`toEqual`), so an attacker cannot tell which phones are admins. No cookie on failure.

### Check 3: validation

An empty body, and a body with no password, give 400 `validation`.

### Check 4: refusing badges

Five bad doors tried at `/me`: no cookie; `admin_token=not-a-real-badge`; a real-style shop-owner badge in the `token` cookie; a badge **signed with the shop-owner key** that claims to be an admin, placed in the admin cookie; and an expired real admin badge (`signAdminToken(admin, '-1s')`). All must be 401. The first also checks the exact refusal body.

### Check 5: the brake

Five wrong tries (each 401), then the sixth with the **right** password must be 429 `too_many_attempts`, with a `Retry-After` between 1 and 900 seconds and no cookie.

### Check 6: disabled admin

Sign in, confirm `/me` is 200, then run `UPDATE ... SET status = 'disabled'`. The same unexpired cookie now gets 401.

### Check 7: logout

Logout gives 200 and a `Set-Cookie` that blanks `admin_token` with an `Expires` date in the past, so the browser deletes it. `/me` then gives 401. A logout with nobody signed in is still 200.

---

## Related documents
- The code: `apps/api/src/routes/adminAuth.routes.js`, `controllers/adminAuth.controller.js`, `middleware/requirePlatformAdmin.js`
- Their guides: `apps/api/docs/src/routes/adminAuth.routes.md`, `apps/api/docs/src/controllers/adminAuth.controller.md`, `apps/api/docs/src/middleware/requirePlatformAdmin.md`
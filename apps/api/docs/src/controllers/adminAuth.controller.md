# adminAuth.controller.js — the admin sign-in desk

*Week 30 (26 Nov 2026) — platform admin, step 4*

## FILE

`apps/api/src/controllers/adminAuth.controller.js`

## WHY THIS FILE EXISTS

Handles the three things a platform admin does at the door:

- `loginAdmin` = sign in (phone + password), which sets the admin cookie
- `logoutAdmin` = sign out, which clears the admin cookie
- `getAdminMe` = 'who am I?', which the web app uses to know whether the admin is still signed in

The rules (password check, badge, brake) live in services. This file only joins them together and shapes the answer.

*Real life: the sign-in desk at head office. The desk clerk asks the brake guard if you may try, checks your password with the security office, and hands you a badge.*

## WHY IMPORTANT

This is where a visitor's request turns into 'yes, come in' or 'no'. The wrong word here (for example 'that phone is not an admin') would help an attacker.

## DANGER

1. Wrong phone and wrong password give the **same** answer: 401 `invalid_credentials`. Never say which one was wrong.
2. The brake is asked **before** the password is checked, and every failure is written down **after**. A blocked visitor gets 429 and a `Retry-After` header.
3. Never log or return the password, the hash, or the token.
4. The token goes **only** in the httpOnly cookie, never in the response body.

## WHAT IT SOLVES

A safe, boring, predictable admin sign-in.

## SYSTEM DESIGN PRINCIPLE

Thin controller, fat service. Decisions live in services (testable without a web server); the controller only translates between the web and the services.

## RULES

1. Missing phone or password: 400 `validation`.
2. Blocked by the brake: 429 `too_many_attempts` + `Retry-After` seconds.
3. Wrong credentials, disabled admin, unknown phone: 401 `invalid_credentials`.
4. Success: 200, cookie set, body `{ data: { admin: { id, name } }, error: null }`.
5. Logout always answers 200 and always clears the cookie (even if you were not signed in), so it can never reveal anything.

## PRACTICAL EXAMPLE

```
POST /v1/admin/auth/login   { "phone": "0712345678", "password": "..." }
-> 200 + Set-Cookie: admin_token=...; HttpOnly; SameSite=Strict
```

## DECISIONS

- The brake is keyed by the normalised phone (`0712...` and `+254712...` count as the same person) and by the visitor's address (`req.ip`).
- Only `{ id, name }` is returned. The phone is not echoed back.

## WHERE USED

`routes/adminAuth.routes.js`

## TRADEOFFS

+ Very little code, easy to read.
- The brake is in memory (see `adminLoginLimiter.md`), so a server restart forgets it.

## HOW TO USE

```js
import { loginAdmin, logoutAdmin, getAdminMe } from '../controllers/adminAuth.controller.js';
```

---

## PIECE BY PIECE (real life, in simple terms)

**loginSchema**  
The clerk checking the visitor filled the form in.

**limiterKey()**  
Writing the visitor's phone the same way every time, so the brake counts one person once.

**loginAdmin**  
The whole sign-in desk: form check, brake, password, badge, cookie.

**logoutAdmin**  
Handing the badge back at the desk.

**getAdminMe**  
'Show me my own badge.' The guard already checked it.

---

## LINE BY LINE (the real code, explained)

### The imports

`zod` checks the shape of the form. `pool` is the database connection. `normalizePhone` tidies phones (`0712...` becomes `254712...`). The three brake functions come from `adminLoginLimiter.js`. The password check, badge printer and cookie settings come from `platformAdminAuth.service.js`.

### `loginSchema`

```js
const loginSchema = z.object({ phone: z.string().min(1).max(30), password: z.string().min(1).max(200) });
```
The form must have a phone and a password, as text, with sane maximum sizes (so nobody posts a million characters). We do **not** repeat the password rules (like "at least 12") here, because a wrong-length password is just a failed login and the answer must not hint at the rules.

### `limiterKey(phone)`

```js
try { return normalizePhone(phone); } catch { return `raw:${String(phone).trim().slice(0, 30)}`; }
```
Writes the phone the same way every time for the brake. If it is not even a phone, we use the cleaned raw text with `raw:` in front, so garbage still counts against the brake.

### `loginAdmin`, step by step

1. **Form check.** `safeParse` does not throw; it tells us `success` or not. Bad form: 400 `validation`.
2. **Ask the brake first.** `checkAdminLoginAllowed(key, req.ip)` runs before any password work. If blocked: `res.set('Retry-After', ...)` and 429 `too_many_attempts`.
3. **Check the password.** `verifyAdminLogin(pool, { phone, password })` returns the admin or `null`.
4. **Failed?** `recordAdminLoginFailure(key, req.ip)` writes it on the notepad, then 401 `invalid_credentials`, the same words for every kind of failure.
5. **Success.** `clearAdminLoginFailures(key)` forgives this phone. `signAdminToken(admin)` prints the badge. `res.cookie(ADMIN_COOKIE_NAME, token, adminCookieOptions())` hands it over in the cookie (never in the body).
6. **Answer.** 200 with only `{ id, name }`.

### `logoutAdmin`

```js
const { maxAge: _ignored, ...settings } = adminCookieOptions();
res.clearCookie(ADMIN_COOKIE_NAME, settings);
```
To remove a cookie the browser needs the **same** settings it was set with (path, sameSite and so on). We take the cookie settings, drop `maxAge`, and clear it. It always answers 200, even if nobody was signed in.

### `getAdminMe`

Runs only after `requirePlatformAdmin`, so `req.admin` is already filled in. It returns `{ id, name }`.

---

## Related documents
- The code: `apps/api/src/controllers/adminAuth.controller.js`
- The brake: `apps/api/docs/src/services/adminLoginLimiter.md`
- The password and badge rules: `apps/api/docs/src/services/platformAdminAuth.service.md`
- The guard: `apps/api/docs/src/middleware/requirePlatformAdmin.md`
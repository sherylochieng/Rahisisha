# requirePlatformAdmin.js — the guard on the admin door

*Week 30 (26 Nov 2026) — platform admin, step 4*

## FILE

`apps/api/src/middleware/requirePlatformAdmin.js`

## WHY THIS FILE EXISTS

The guard on the head-office door. Every admin address (except login and logout) goes through it first. It answers one question: *is this visitor a real, still-active platform admin?* If yes, it writes who they are on the request (`req.admin`) and lets them through. If no, it stops them with 401.

*Real life: the guard at head office who looks at your badge, phones the staff book to confirm you still work there, and only then opens the door.*

## WHY IMPORTANT

Everything an admin can do (see every shop, suspend a shop) sits behind this one guard. If it is weak, a stranger or an ordinary shop owner could act as the platform owner.

## DANGER

1. It reads **only** the admin cookie (`admin_token`). A shop owner's cookie (`token`) is never looked at, so it can never open this door.
2. It re-checks the database on **every** request (`loadActiveAdmin`). A badge is only a claim; a disabled or deleted admin is locked out at once.
3. All refusals give the same vague answer, so a visitor learns nothing about why they were refused.
4. It must **never** use `withTenant` or `req.db`. Admin work is not tied to one shop.

## WHAT IT SOLVES

One place that decides 'admin or not', instead of every admin route repeating the check (and one of them forgetting).

## SYSTEM DESIGN PRINCIPLE

Authenticate at the door, once, in a guard (middleware). Business code later can trust `req.admin` because nothing reaches it without passing here.

## RULES

1. No cookie, a fake badge, an expired badge, or a shop-owner badge: 401.
2. A valid badge for an admin who is deleted or disabled: 401.
3. A database failure is passed on with `next(err)`, so the app answers 503 (service unavailable) instead of wrongly saying 'not signed in'.
4. On success: `req.admin = { id, phone, name }`. Never the password hash.

## PRACTICAL EXAMPLE

```js
router.get('/me', requirePlatformAdmin, getAdminMe);
// inside getAdminMe, req.admin.name is "Sheryl"
```

## DECISIONS

- Answer shape follows the API envelope: `{ data: null, error: { code, message } }`.
- Code `unauthorized` and message `Not signed in` for every refusal.

## WHERE USED

`routes/adminAuth.routes.js` (the `/me` address), and every admin route added later (shop list, suspend, reinstate).

## TRADEOFFS

+ A disabled admin is out immediately.
- One tiny database query per admin request. Admin traffic is very low, so that is fine.

## HOW TO USE

```js
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
router.get('/something', requirePlatformAdmin, handler);
```

---

## PIECE BY PIECE (real life, in simple terms)

**refuse(res)**  
The guard saying 'not today' in one fixed way, whatever the reason.

**requirePlatformAdmin**  
The guard: reads the badge, checks the stamp, then phones the staff book to confirm the person still works here, and writes their name on the request.

---

## LINE BY LINE (the real code, explained)

### The imports

```js
import { pool } from '../db/pool.js';
import { ADMIN_COOKIE_NAME, readAdminToken, loadActiveAdmin } from '../services/platformAdminAuth.service.js';
```
`pool` is the connection to the database (the staff book lives there). The other three are the cookie's name, the badge reader and the staff-book check, all written in Part 1.

### `refuse(res)`

```js
return res.status(401).json({ data: null, error: { code: 'unauthorized', message: 'Not signed in' } });
```
One fixed answer for every reason. Status 401 means "not signed in". The body follows the API's usual envelope (`data` is `null`, `error` has a code and a message).

### Step 1: take the badge

```js
const badge = req.cookies?.[ADMIN_COOKIE_NAME];
```
`req.cookies` is filled in by `cookie-parser` in `app.js`. We read **only** `admin_token`. The `?.` stops a crash if cookies are missing altogether.

### Step 2: read the badge

```js
const who = readAdminToken(badge);
if (!who) return refuse(res);
```
Checks the stamp, the expiry and the badge type. A fake, old or shop-owner badge gives `null` and the visitor is refused.

### Step 3: ask the staff book

```js
const admin = await loadActiveAdmin(pool, who.adminId);
if (!admin) return refuse(res);
```
A badge is only a claim. This checks the person still exists and has `status = 'active'`. `await` means "wait for the database to answer".

### Step 4 and 5: write on the request, open the door

```js
req.admin = { id: admin.id, phone: admin.phone, name: admin.name };
return next();
```
`req.admin` is a note stuck on the request for the next function. `next()` means "pass the visitor on to the next function". We never copy the password hash.

### The `catch`

```js
} catch (err) { return next(err); }
```
If something unexpected breaks (for example the database is down), it is not the visitor's fault. We hand the problem to the app's error handler, which answers 503 or 500, rather than wrongly saying 'not signed in'.

---

## Related documents
- The code: `apps/api/src/middleware/requirePlatformAdmin.js`
- The badge rules: `apps/api/docs/src/services/platformAdminAuth.service.md`
- Its tests: `apps/api/docs/tests/adminAuth.routes.test.md`
# adminAuth.routes.js — the map of the admin door

*Week 30 (26 Nov 2026) — platform admin, step 4*

## FILE

`apps/api/src/routes/adminAuth.routes.js`

## WHY THIS FILE EXISTS

Lists the three web addresses of the admin door and says which guard and which handler serves each one. Nothing else: no logic lives here.

*Real life: the signboard at head office. 'Sign-in desk: straight ahead. Hand the badge back: here. Show your badge: guard first.'*

## WHY IMPORTANT

A route file is the map of the door. One missing guard here would leave an address open to the world, so it is kept tiny and easy to read.

## DANGER

1. `/me` **must** keep `requirePlatformAdmin`. Login and logout are the only addresses that may be open.
2. Every answer from this door must say `Cache-Control: no-store`, so a browser or a proxy never keeps an admin's answer.
3. Do **not** put `withTenant` here. Admin work is not tied to one shop.

## WHAT IT SOLVES

One readable map of the admin sign-in addresses.

## SYSTEM DESIGN PRINCIPLE

Routes only wire things together (address, then guard, then handler).

## RULES

- `POST /v1/admin/auth/login` is open (the brake protects it)
- `POST /v1/admin/auth/logout` is open (it only clears a cookie)
- `GET /v1/admin/auth/me` needs `requirePlatformAdmin`

## PRACTICAL EXAMPLE

```
GET /v1/admin/auth/me   (no cookie)
-> 401 { data: null, error: { code: 'unauthorized', message: 'Not signed in' } }
```

## DECISIONS

- Mounted at `/v1/admin/auth` in `app.js`, which leaves `/v1/admin/...` free for the shop list and suspend actions later.
- `asyncHandler` wraps the login so any error goes to the app's error handler.

## WHERE USED

`app.js`: `app.use('/v1/admin/auth', adminAuthRouter)` (added in the next file).

## TRADEOFFS

+ Tiny and obvious.
- Login has no CSRF token; the cookie's `sameSite: 'strict'` setting covers it.

## HOW TO USE

Import it in `app.js` and mount it. Add new admin addresses in their own route files (for example `admin.shops.routes.js`), not here.

---

## PIECE BY PIECE (real life, in simple terms)

**noStore sign**  
A sign on every reply: 'do not photocopy this'.

**/login**  
The sign-in desk. Open to everyone; the brake guard stands behind it.

**/logout**  
Hand the badge back. Open, because it only clears a cookie.

**/me**  
'Show me my badge.' The guard checks it first.

---

## LINE BY LINE (the real code, explained)

### The imports

`Router` makes a small group of addresses. `asyncHandler` catches errors from `async` functions and passes them to the app's error handler (so a database problem becomes a clean 503, not a hanging request). `requirePlatformAdmin` is the guard. The three handlers come from the controller.

### The no-store sign

```js
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
```
`router.use` runs for **every** address in this router. `no-store` tells browsers and proxies: never keep a copy of this answer. `next()` passes the request on to the matching address below.

### The three addresses

```js
router.post('/login', asyncHandler(loginAdmin));
router.post('/logout', logoutAdmin);
router.get('/me', requirePlatformAdmin, getAdminMe);
```
- Login is a `POST` because it carries a password in the body (never in the web address).
- Logout is a `POST` too, so a stray link or image on another site cannot sign an admin out.
- `/me` lists `requirePlatformAdmin` **before** the handler, so the guard runs first. Order matters: guard, then handler.
- The full address is the mount point in `app.js` plus the path here: `/v1/admin/auth` + `/login`.

### `export default router`

Hands the finished map to `app.js`.

---

## Related documents
- The code: `apps/api/src/routes/adminAuth.routes.js`
- The guard: `apps/api/docs/src/middleware/requirePlatformAdmin.md`
- The handlers: `apps/api/docs/src/controllers/adminAuth.controller.md`
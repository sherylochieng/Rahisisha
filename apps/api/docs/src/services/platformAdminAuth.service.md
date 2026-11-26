# platformAdminAuth.service.js: the rules of admin sign-in

**FILE:** `apps/api/docs/src/services/platformAdminAuth.service.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains `apps/api/src/services/platformAdminAuth.service.js`: checking an admin's phone and password, making the login badge, reading it back, and confirming on every visit that the admin is still allowed in.

## WHY IMPORTANT

This is the lock on the master key. A weak check here would expose every shop.

## DANGER (what breaks without it)

1. Every failure looks the same to the caller (`null`). The caller must answer with one vague message, never 'no such admin' or 'wrong password'.
2. When the phone is not an admin, we still run a password check against a dummy hash. Otherwise 'unknown phone' answers faster than 'wrong password', and the speed difference reveals which numbers are admins.
3. Admin badges are signed with a **different key** from shop-owner badges (derived from `JWT_SECRET`) and carry `typ = 'platform_admin'`. A shop owner's badge can never pass as an admin badge, and the other way round.
4. Admin badges last 8 hours (shop owners get 7 days).
5. Never log the password, the hash or the token.

## WHAT IT SOLVES

Safe admin sign-in that cannot be confused with shop-owner sign-in.

## SYSTEM DESIGN PRINCIPLE

Separate identities need separate keys. And re-check on every request: a badge is a claim, the database is the truth, so a disabled admin is locked out immediately, not when the badge expires.

## RULES

1. The phone is normalised (`0712...` to `254712...`). A badly shaped phone is just a failed login.
2. Only admins with status `active` can sign in.
3. A successful sign-in updates `last_login_at`.
4. The admin table is always read through the database lock (`withAdminLock`).

## PRACTICAL EXAMPLE

```js
const admin = await verifyAdminLogin(pool, { phone, password });
if (!admin) { /* 401 'Invalid credentials', vague on purpose */ }
const token = signAdminToken(admin);   // goes into the admin cookie
```

## DECISIONS

- Signing key = HMAC-SHA256 of `JWT_SECRET` with the label `platform-admin-v1`: no new secret to manage, yet different from the shop-owner key.
- Cookie name `admin_token` (shop owners use `token`).
- The cookie has **no shared domain**: it stays on the API's own address and is never sent to shop sub-addresses.

## WHERE USED

`controllers/adminAuth.controller.js` and `middleware/requirePlatformAdmin.js` (next sub-step), and `tests/platformAdminAuth.service.test.js`.

## TRADEOFFS

+ A stolen shop-owner badge is useless at the admin door.
- One tiny database check on every admin request. Admin traffic is very low, so that is fine.

## HOW TO USE

Import the functions you need. The login route calls `verifyAdminLogin` then `signAdminToken`; the guard calls `readAdminToken` then `loadActiveAdmin`.

---

## PIECE BY PIECE (real life, in simple terms)

**DUMMY_HASH / getDummyHash**  
A pretend staff member's scrambled password. When nobody matches the phone, the guard still checks against it, so she takes the same time either way.

**adminSigningKey()**  
The head-office stamp. A different stamp from the shop kiosks' stamp, made from the same master secret.

**verifyAdminLogin**  
The guard at the head-office door. She checks name and password and only ever says yes or no.

**signAdminToken**  
Prints a badge that says 'admin, valid 8 hours'.

**readAdminToken**  
A quick look at a badge: real stamp? head-office type? not expired?

**loadActiveAdmin**  
Phoning the staff book on every visit to ask 'is this person still working here?'

**adminCookieOptions**  
How the badge is carried: out of reach of page scripts, same-site only, secure when live, and not shared with shop addresses.

---

---

## LINE BY LINE (the real code, explained)

### The settings

```js
export const ADMIN_COOKIE_NAME = 'admin_token';
const TOKEN_LIFETIME = '8h';
const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000;
```
- The cookie is named `admin_token`; shop owners use `token`, so the browser can never mix the two.
- The badge lives 8 hours. The jwt library wants the word `8h`; the cookie wants milliseconds: 8 hours x 60 minutes x 60 seconds x 1000. *Real life: a day pass for head office that stops working in the evening.*

### `getDummyHash()`

```js
if (!dummyHash) dummyHash = await bcrypt.hash(`dummy-${crypto.randomUUID()}`, 12);
```
- Made once, then reused. `bcrypt` at cost 12 is slow on purpose, so we do not rebuild it on every login.
- `crypto.randomUUID()` is random text, so nobody can ever know the "password" behind this hash. *Real life: a pretend staff member nobody can impersonate.*

### `adminSigningKey()`

```js
crypto.createHmac('sha256', process.env.JWT_SECRET).update('platform-admin-v1').digest('hex');
```
Mixes the master secret with a private word to make a **different** key. A badge stamped with the shop-owner stamp fails the head-office stamp, and the other way round. *Real life: the kiosks' stamp and head office's stamp look alike but never match.*

### `verifyAdminLogin(db, { phone, password })`

- **Step 1** `normalizePhone(phone)` inside `try/catch`: a badly shaped phone throws, and we treat that as a normal failed login, so the error reveals nothing.
- **Step 2** looks the admin up through `withAdminLock` (the database safe). `[msisdn]` is filled in safely by the driver, so nobody can sneak SQL in. `rows[0] || null` = first match or nothing.
- **Step 3** `const hash = admin ? admin.password_hash : await getDummyHash();` then `bcrypt.compare(...)`. We **always** run one slow password check, so "unknown phone" is not faster than "wrong password". `String(password ?? '')` turns a missing password into empty text instead of a crash.
- **Step 4** `if (!admin || admin.status !== 'active' || !passwordOk) return null;` all three must be true. Every failure is the same plain `null`.
- **Step 5** updates `last_login_at`, so you can spot a visit at 3 a.m.
- **Step 6** returns only `id`, `phone`, `name`. The password hash never leaves this function.

### `signAdminToken(admin, lifetime)`

```js
jwt.sign({ admin_id: admin.id, typ: 'platform_admin' }, adminSigningKey(), { expiresIn: lifetime });
```
Prints a badge that says who (`admin_id`) and what kind (`typ`), stamped with the head-office stamp, and expiring after `lifetime`. Tests pass `'-1s'` to make an already expired badge.

### `readAdminToken(token)`

- No token: `null`.
- `jwt.verify(...)` checks the stamp **and** the expiry; a wrong stamp or an old badge makes it throw, and the `catch` turns that into `null`.
- Second check: the badge must say `typ: 'platform_admin'` and name an admin. A shop owner's badge fails at the first check already, and this is the second lock.

### `loadActiveAdmin(db, adminId)`

A badge is only a claim. This asks the staff book: does this person still exist and is `status = 'active'`? A disabled admin is locked out at once, even if their badge has hours left.

### `adminCookieOptions()`

- `httpOnly: true` page scripts cannot read it.
- `secure: process.env.NODE_ENV === 'production'` https only when live.
- `sameSite: 'strict'` sent only for requests that start on our own site.
- **no `domain`** the cookie stays on the API's own address and never reaches shop sub-addresses.
- `maxAge` the browser forgets it after 8 hours; `path: '/'` valid for the whole API.

## Related documents
- Its tests: `apps/api/docs/tests/platformAdminAuth.service.test.md`
- The brake: `apps/api/docs/src/services/adminLoginLimiter.md`
- Creating admins: `apps/api/docs/src/services/platformAdmin.service.md`
# platformAdminAuth.service.test.js: proving the sign-in rules

**FILE:** `apps/api/docs/tests/platformAdminAuth.service.test.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains the six checks in `apps/api/tests/platformAdminAuth.service.test.js`.

## WHY IMPORTANT

Each check is a way someone could otherwise get into every shop.

## DANGER (what breaks without it)

Uses made-up phones and random passwords, and removes every admin it makes. Never put a real admin phone or password here.

## WHAT IT SOLVES

Confidence in `platformAdminAuth.service.js`.

## SYSTEM DESIGN PRINCIPLE

Test each way in, and each way that must stay shut.

## RULES

1. Random phone and password for every admin made.
2. Cleanup in `afterAll`, through the same database lock the real code uses.
3. Never print passwords or tokens.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- platformAdminAuth
```
Expected: 6 passed.

## DECISIONS

Real database and real bcrypt. Expired badges are made with `signAdminToken(admin, '-1s')`.

## WHERE USED

Normal test run and the pre-push hook.

## TRADEOFFS

+ Tests the real lock and the real hashing.
- The login route (cookie, 401, 429) is tested in the next sub-step.

## HOW TO USE

Run it after any change to the auth service.

---

## PIECE BY PIECE (real life, in simple terms)

**makeAdmin()**  
Add a pretend staff member to the book and remember them, so they are removed at closing time.

**lockedQuery()**  
Open the head-office drawer for one look, like the real code does.

**Check 1**  
The right phone and password get in, only id, phone and name come back, and the arrival time is recorded.

**Check 2**  
A wrong password, an unknown phone, a badly shaped phone and missing values all give the same plain no.

**Check 3**  
A disabled admin is locked out even with the right password, and is no longer found as active.

**Check 4**  
A badge is made and read back, and names the right admin.

**Check 5**  
A badge signed the shop-owner way, a real shop-owner token, an expired badge, a tampered badge and no badge are all refused.

**Check 6**  
The cookie is httpOnly, same-site strict, lasts 8 hours and has no shared domain.

---

## LINE BY LINE (the real test code, explained)

### The imports

- `crypto` makes random phones and passwords so tests never clash with each other or with real data.
- `jsonwebtoken` lets the test **forge wrong-kind badges on purpose** (check 5).
- `pool` is the real connection to your **local** test database.
- `createPlatformAdmin` and `withAdminLock` add a pretend admin and open the head-office safe.
- The last import is the four jobs and the cookie settings we are testing.

### `randomPhone()` and `randomPassword()`

```js
const randomPhone = () => `07${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
```
`07` plus 8 random digits. `padStart(8, '0')` keeps the length right when the random number is small (for example `42` becomes `00000042`). The password is `pw-` plus random letters and digits, long enough for the 12-character rule.

### `made` and `makeAdmin()`

- `made` is a list of every pretend admin we create, so we can delete them at the end.
- `makeAdmin()` creates fresh credentials, writes them into the staff book with the real `createPlatformAdmin`, remembers the id, and returns the plain password too (the database only keeps the scramble).

### `lockedQuery(sql, params)`

Runs one query with the head-office lock open, the same way the real code does. Tests use it to peek at `last_login_at` and to disable an admin.

### `afterAll`

At closing time, deletes every pretend admin and closes the database connection (otherwise the test run would hang waiting).

### Check 1: right phone and password

Signs in a fresh admin. `toEqual({ id, phone, name })` proves **only** those three fields come back (no hash, no status). Then it reads `last_login_at` and expects it is not null.

### Check 2: every "no" looks the same

Four failing cases: wrong password, unknown phone, `'abc'` as phone, and missing phone and password. All must be exactly `null`, so the login route can answer with one vague message.

### Check 3: disabled admin

Signs in and loads while active (both work). Then runs `UPDATE ... SET status = 'disabled'` through the lock. Now `verifyAdminLogin` and `loadActiveAdmin` both give `null`, even though the password is still right.

### Check 4: badge round trip

`signAdminToken(admin)` then `readAdminToken(token)` must give back `{ adminId }` with the right id.

### Check 5: badges that must fail

- A badge signed with the **plain** `JWT_SECRET` (the shop-owner way), even if it claims `typ: 'platform_admin'`: the stamp differs, so it is refused.
- A real-looking shop-owner token (`user_id`, `tenant_id`, `role`): refused.
- `signAdminToken(admin, '-1s')`: valid stamp but already expired, refused.
- A real badge with its last two characters changed to `xx`: tampered, refused.
- `undefined` and `''`: no badge, refused.

### Check 6: cookie settings

Reads `adminCookieOptions()` (no database needed) and expects `httpOnly: true`, `sameSite: 'strict'`, `maxAge` of 8 hours, and `domain` undefined so the cookie is never shared with shop sub-addresses.

## What the experiments showed
Turning off the active-status check made check 3 fail. Using the shop-owner key to read badges made checks 4 and 5 fail. So these tests really guard those rules.

## Related documents
- The code: `apps/api/src/services/platformAdminAuth.service.js` and `apps/api/docs/src/services/platformAdminAuth.service.md`
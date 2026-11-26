# adminLoginLimiter.test.js: proving the brake works

**FILE:** `apps/api/docs/tests/adminLoginLimiter.test.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains the five checks in `apps/api/tests/adminLoginLimiter.test.js`.

## WHY IMPORTANT

If the brake is broken, the admin password can be guessed at machine speed.

## DANGER (what breaks without it)

Uses only made-up phones and addresses. No database and no secrets.

## WHAT IT SOLVES

Confidence in the limiter without waiting 15 real minutes, because time is passed in as a number.

## SYSTEM DESIGN PRINCIPLE

Make time a parameter so time-based rules are testable.

## RULES

1. Each test starts with an empty notepad.
2. Time is simulated with plain numbers.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- adminLoginLimiter
```
Expected: 5 passed.

## DECISIONS

No fake timers: passing `now` is simpler and clearer.

## WHERE USED

Normal test run and the pre-push hook.

## TRADEOFFS

+ Instant and exact.
- Does not test the memory sweep with 2000+ keys (it is simple code).

## HOW TO USE

Run it after any change to the limiter.

---

## PIECE BY PIECE (real life, in simple terms)

**T0 and WINDOW**  
A pretend 'now' and the 15 minute length, so we control the clock.

**fail(phone, ip, n)**  
The guard writes n wrong tries on the notepad, one second apart.

**Check 1**  
Four wrong tries are fine. The fifth blocks that phone, and the answer says how long to wait (up to 15 minutes).

**Check 2**  
Another phone is not punished for this phone's failures.

**Check 3**  
A correct login clears that phone's failures.

**Check 4**  
After 15 minutes the old failures are forgotten.

**Check 5**  
20 failures from one address block that address, even for brand-new phones. The same new phone from another address is fine.

---

---

## LINE BY LINE (the real test code, explained)

### The imports

```js
import { checkAdminLoginAllowed, recordAdminLoginFailure, clearAdminLoginFailures, resetAdminLoginLimiter } from '../src/services/adminLoginLimiter.js';
```
The four functions we are testing, brought in from the limiter file. No database and no server are needed.

### The pretend clock

```js
const T0 = 1_000_000;
const WINDOW = 15 * 60 * 1000;
```
- `T0` is a made-up "now" in milliseconds. The underscores in `1_000_000` are only for readability.
- `WINDOW` is 15 minutes in milliseconds, the same length the real limiter uses.
- Every function takes `now` as an input, so we move the clock by passing a bigger number. *Real life: instead of waiting 15 minutes, we flip the calendar forward.*

### `fail(phone, ip, n, start)`

```js
for (let i = 0; i < n; i += 1) recordAdminLoginFailure(phone, ip, start + i * 1000);
```
Writes `n` wrong tries, one second apart. A helper so each test reads like a story instead of a pile of calls.

### `beforeEach(() => resetAdminLoginLimiter())`

Wipes the notepad before **every** test, so one test's failures never leak into the next.

### Check 1: four allowed, fifth blocks

- 4 failures: `allowed` is `true` (under the limit of 5).
- One more failure: `allowed` is `false`.
- `retryAfterSeconds` is more than 0 and at most 900 (15 minutes). That number is what the login route will later put in the `Retry-After` header.

### Check 2: another phone is fine

Five failures on phone `...01` block that phone even from a new address (the phone line is full), while phone `...02` from the same new address is allowed. The guard punishes the guesser, not the next visitor.

### Check 3: success clears the phone

Four failures, then `clearAdminLoginFailures`, then four more from another address. If the first four were still counted we would be at 8 and blocked. Because they were cleared we are at 4 and allowed. A different address is used so the address count stays out of the way.

### Check 4: time heals

Five failures block the phone. Asking again with `now = T0 + WINDOW + 10_000` (more than 15 minutes later) says allowed. No real waiting happens, only a bigger number is passed.

### Check 5: the address brake

```js
`2547000001${String(i).padStart(2, '0')}`
```
Builds 20 **different** phones (`...0100` to `...0119`); `padStart(2, '0')` turns `5` into `05` so every phone has the same length. All 20 fail from `3.3.3.3`. A brand-new phone from `3.3.3.3` is blocked, but from `4.4.4.4` it is fine. *Real life: one stranger trying many staff names from one spot gets stopped at the gate.*

## Related documents
- The code: `apps/api/src/services/adminLoginLimiter.js` and `apps/api/docs/src/services/adminLoginLimiter.md`
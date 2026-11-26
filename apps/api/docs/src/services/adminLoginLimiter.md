# adminLoginLimiter.js: the brake on admin password guessing

**FILE:** `apps/api/docs/src/services/adminLoginLimiter.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains `apps/api/src/services/adminLoginLimiter.js`: after too many wrong tries, the admin login says 'wait' before even checking the password.

## WHY IMPORTANT

The admin login is the most valuable door in the system. Without a brake, a program could try thousands of passwords a minute.

## DANGER (what breaks without it)

1. The counts live in this server's memory. They reset when the server restarts and are not shared between servers (fine for one server, move to a shared store if we ever run several).
2. Locking by phone means someone who knows your number can lock **you** out for 15 minutes by failing on purpose. For an admin door we accept that. The terminal script can always reset the password.
3. Behind a hosting proxy, many visitors can look like one address, so the address limit is generous and acts as a global brake. The phone limit is the sharp one.

## WHAT IT SOLVES

Brute-force guessing of the admin password.

## SYSTEM DESIGN PRINCIPLE

Fail closed and cheap: refuse before the expensive password check (bcrypt), so an attacker cannot also use up server time.

## RULES

1. A failed try is remembered for 15 minutes.
2. At most 5 failures per phone, and 20 per address, inside that window.
3. A correct login clears that phone's failures.
4. Old entries are swept so memory never grows without limit.

## PRACTICAL EXAMPLE

```js
const gate = checkAdminLoginAllowed(phone, ip);
if (!gate.allowed) { /* answer 429, tell them to wait gate.retryAfterSeconds */ }
// password wrong:  recordAdminLoginFailure(phone, ip);
// password right:  clearAdminLoginFailures(phone);
```

## DECISIONS

The clock is a parameter (`now`) so tests can move time without waiting. Only failures count.

## WHERE USED

`controllers/adminAuth.controller.js` (next sub-step) and `tests/adminLoginLimiter.test.js`.

## TRADEOFFS

+ Tiny, no new dependency, easy to test.
- Memory only (see the danger notes).

## HOW TO USE

Import the four functions and call them around the password check.

---

## PIECE BY PIECE (real life, in simple terms)

**failures (a Map)**  
The guard's notepad. For each phone and each address, the times of recent wrong tries.

**recent(list, now)**  
Tearing off the old lines: only the last 15 minutes count.

**checkAdminLoginAllowed**  
The guard looks at the notepad before opening the door: 'you tried 5 times, come back in N minutes'.

**recordAdminLoginFailure**  
She writes one more line when a try fails, for the phone and for the address.

**clearAdminLoginFailures**  
After a correct password she rubs out your lines.

---

## Related documents
- Its tests: `apps/api/docs/tests/adminLoginLimiter.test.md`
- The sign-in rules: `apps/api/docs/src/services/platformAdminAuth.service.md`
- Overview: `docs/guides/platform-admin.md`

---

## LINE BY LINE (the real code, explained)

### The settings

```js
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_PHONE = 5;
const MAX_PER_IP = 20;
```
- `15 * 60 * 1000` is 15 minutes written in **milliseconds** (15 minutes x 60 seconds x 1000 milliseconds). Computers count time in milliseconds.
- 5 wrong tries per phone: a real person who mistypes will never reach 5.
- 20 per address: generous, because behind a hosting proxy many visitors can look like one address, so this one is only a global brake. *Real life: the guard watches both "this staff name" and "this doorway".*

### The notepad

```js
const failures = new Map();
```
A `Map` is a list of "label to value" pairs. Here the label is `phone:254712345678` or `ip:41.90.1.2`, and the value is a list of the times of recent wrong tries. Putting `phone:` or `ip:` in front means a phone and an address can never be mixed up. It lives in the server's memory, so it is wiped when the server restarts.

### `recent(list, now)`

```js
return (list || []).filter((at) => now - at < WINDOW_MS);
```
- `list || []` means "if this label has no lines yet, use an empty list instead of crashing".
- `.filter(...)` keeps only the failures that happened less than 15 minutes ago. Older ones are forgiven. *Real life: tearing the old lines off the notepad.*

### `secondsUntilFree(list, now)`

```js
const oldest = Math.min(...list);
return Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
```
The door opens again when the **oldest** remembered failure turns 15 minutes old. `Math.min` finds the oldest time, we add the window and subtract now, divide by 1000 to get seconds, and `Math.ceil` rounds **up**, so we never say "0 seconds" while still blocked. `Math.max(1, ...)` makes the answer at least 1 second. *Real life: "your first wrong try was at 9:00, come back at 9:15."*

### `checkAdminLoginAllowed(phone, ip, now = Date.now())`

```js
if (byPhone.length >= MAX_PER_PHONE) return { allowed: false, retryAfterSeconds: ... };
if (byIp.length >= MAX_PER_IP)       return { allowed: false, retryAfterSeconds: ... };
return { allowed: true, retryAfterSeconds: 0 };
```
- Called **before** checking the password, so a blocked attacker also cannot use up our server's time on the slow password check.
- `now = Date.now()` means "use the real clock unless the caller gives a time". Tests give their own time, so they do not have to wait 15 real minutes.

### `recordAdminLoginFailure(phone, ip, now)`

```js
for (const key of [`phone:${phone}`, `ip:${ip}`]) {
  const list = recent(failures.get(key), now);
  list.push(now);
  failures.set(key, list);
}
```
For each failure we write **two** lines: one under the phone, one under the address. First we drop old lines, then add the new time, then put the list back.

```js
if (failures.size > 2000) { ... delete labels whose failures all expired ... }
```
Housekeeping: if the notepad becomes huge, throw away labels with no recent failures. This stops a flood of fake phone numbers from slowly filling the server's memory.

### `clearAdminLoginFailures(phone)`

Only the **phone's** line is removed after a correct password. The address's line stays, because it counts every failed try from that doorway, from all phones.

### `resetAdminLoginLimiter()`

Wipes the whole notepad. It exists only for the tests, so each test starts clean.
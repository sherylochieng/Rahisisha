# platformAdmin.service.test.js: proving admin accounts are safe

**FILE:** `apps/api/docs/tests/platformAdmin.service.test.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains the five checks in `apps/api/tests/platformAdmin.service.test.js`, what each one proves, and how to run them.

## WHY IMPORTANT

The admin account is the master key to every shop. These tests prove the account is created safely and, most important, that the admin table stays locked to everyone except the admin code.

## DANGER (what breaks without it)

Without these tests a plain-text password, a duplicate admin, or an unlocked admin table could go unnoticed until it mattered.

## WHAT IT SOLVES

Confidence that the service and the database lock (migration 028) really work together.

## SYSTEM DESIGN PRINCIPLE

Test the walls separately: the code's own rules (validation) and the database's own lock (row level security).

## RULES

1. Each test uses its own random phone and random password, so tests never collide and no real secret is used.
2. Every admin the tests make is removed in `afterAll`, through the same lock the real code uses.
3. Passwords are never printed.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- platformAdmin
```
Expected: 5 passed.

## DECISIONS

- Uses the app's real database pool, because that is what the admin code will use.
- A helper `readAdmins` looks inside the table the way the admin code does (lock opened for one transaction), so the tests can inspect what was stored.

## WHERE USED

Part of the normal test run and the pre-push hook.

## TRADEOFFS

+ Fast; the only slow part is bcrypt.
- The admin login is not tested here yet; it will have its own tests.

## HOW TO USE

Run `npm test -- platformAdmin` from `apps/api` after any change to `platformAdmin.service.js` or migration 028.

---

## PIECE BY PIECE (real life, in simple terms)

**randomPhone / randomPassword**  
A pretend new staff member and a pretend password for every test, so no real person or secret is ever involved.

**readAdmins(sql)**  
The manager opening the locked drawer for one look, then locking it again. The tests use it to see what was really written.

**afterAll**  
At closing time we remove every pretend staff member we added, so the book is left exactly as we found it.

**Check 1: created and scrambled**  
Add a person. The book must hold the phone in the 254 shape and only a scrambled password. The real password must not appear anywhere in the row, and must still match the scramble (so a later login will work).

**Check 2: duplicates**  
The same person written as `0712...` and `+254712...` is one person. The second attempt is refused and the first line is untouched.

**Check 3: bad input**  
A bad phone, an empty name, a password of 11 characters, and a password of 73 are all refused, and the staff book has the same number of lines as before.

**Check 4: THE LOCK**  
A shop owner walks up to the locked drawer. She sees an empty shelf and cannot write a line. After the admin code finished, the drawer is locked again.

**Check 5: reset**  
A forgotten password gets a new scramble. The new password works and the old one no longer does. A stranger who is not in the book is refused, and a weak new password is refused.

---

## What each check proves

| Check | Proves |
|---|---|
| 1 | The password is stored scrambled, the phone in one shape, the status starts `active`, and the answer contains only `id`, `phone`, `name` |
| 2 | A phone cannot be an admin twice, however it is written |
| 3 | Bad input never reaches the database |
| 4 | A normal request sees the admin table as empty and cannot write to it; the lock does not stay open |
| 5 | Reset works for an existing admin only and applies the same password rules |

When the lock-opening line in the service was switched off as an experiment, checks 1, 2, 4 and 5 failed. That is how we know the tests really test the lock.

## Related documents

- The code: `apps/api/src/services/platformAdmin.service.js` and its guide `apps/api/docs/src/services/platformAdmin.service.md`
- Overview: `docs/guides/platform-admin.md`

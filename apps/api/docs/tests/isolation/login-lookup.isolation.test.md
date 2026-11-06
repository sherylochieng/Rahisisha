# Guide: login-lookup.isolation.test.js

**Code file:** `apps/api/tests/isolation/login-lookup.isolation.test.js`
**Added:** 6 November 2026 (Week 28 Day 5)
**Run it:** `cd apps/api` then `npm test -- tests/isolation/login-lookup.isolation.test.js`
**Expected:** `Tests: 7 passed, 7 total`

---

## WHY THIS FILE EXISTS

Migration 022 added a second rule on `memberships`, called `login_lookup`, so login can find which shop a person belongs to. A new door in the wall needs a test that tries to break it. This test is that attempt.

## WHY IMPORTANT

If `login_lookup` is too wide, one person can read who works in other shops. If it allows writes, a person can add themselves to someone else's shop and then see its orders and money.

## DANGER (if this test does not exist)

- Someone removes the `user_id` check from the rule. Login would show every membership of every shop, and no other test would fail.
- Someone changes `FOR SELECT` to `FOR ALL`. A logged-in person could then insert, update or delete memberships.
- The empty-string trap: a reused connection leaves `''` in the setting, and `''` cannot be read as a uuid. Without `NULLIF` the lock would crash.

## THE STORY

A hotel with two key cards:

- **Shop card** (`app.current_tenant`): opens every room of one shop.
- **Login pass** (`app.login_user`): opens only one named person's rooms, and only to **look**.

```
   memberships table
   ┌──────────────────────────────────┐
   │ row mA (shop A, userA)           │
   │ row mB (shop B, userB)           │
   └──────────────────────────────────┘
   shop card A    opens mA
   login pass A   opens mA, look only
   no card        opens nothing
```

## THE 7 CHECKS

| # | Situation | Must happen | What it proves |
|---|---|---|---|
| 1 | No shop card, no login pass | 0 rows, no crash | Nobody gets in with no card; `NULLIF` works |
| 2 | Login pass for userA | Only userA's row | The pass shows only that person |
| 3 | Login pass for userA, asks for B's row by id | 0 rows | Knowing an id is not enough |
| 4 | Login pass for userA, UPDATE | 0 rows changed | The pass cannot change data |
| 5 | Login pass for userA, DELETE | 0 rows removed | The pass cannot remove data |
| 6 | Login pass for userA, INSERT into shop B | Refused with a row-level security error | The pass cannot add data |
| 7 | Shop card A, no login pass (control) | Sees shop A's row | The original rule still works, so checks 1 to 6 are not passing by accident |

## HOW THE CODE WORKS

1. **`testPool`** connects as `rahisisha_user`, so RLS applies exactly like the real app. A superuser would skip RLS and prove nothing.
2. **`setContext(tenant, loginUser)`** writes both cards on the connection. `''` means "no card". It writes both every time, so an old card never leaks into the next test.
3. **`beforeAll`** opens a transaction (`BEGIN`), finds two real shops, makes one person per shop, and links each person to their shop. It holds the shop's card first, because `memberships` has RLS.
4. **`afterAll`** runs `ROLLBACK`, so the real database is untouched.
5. **Check 6 uses a `SAVEPOINT`.** An error inside a transaction cancels everything after it. The savepoint is a checkpoint: try the forbidden insert, catch the error, return to the checkpoint.
6. **Why UPDATE and DELETE give 0 rows but INSERT gives an error.** RLS hides existing rows silently. A new row has nothing to hide, so the database refuses it loudly.

## RULES

- Connect as `rahisisha_user`, never as a superuser.
- Keep everything inside one transaction that is rolled back.
- Never edit a test just to make it pass. A failing test is information about the rule.

## PRACTICAL EXAMPLES

- A bank teller can look at your account when you show ID, but cannot move your money with only that ID.
- A school lets a parent look at their own child's results, but not other children's, and not edit them.
- In this project: `login.js` sets `app.login_user` after the password is correct, reads the membership, and the setting disappears at `COMMIT`.

## DECISIONS

- Own pool as `rahisisha_user`, so RLS applies.
- One transaction with `ROLLBACK`, so nothing is left behind.
- `SAVEPOINT` around the one expected error.
- Two real shops from the database, like `isolation.test.js`.

## WHERE YOU WILL USE THIS

Any time you add a second RLS rule or a special case: an admin role, a support-staff view, a public read-only page.

## TRADEOFFS

- Fast (about 3 seconds) and runs on every push through the pre-push hook.
- It tests the **database rule only**. It does not test `login.js`, so it cannot catch `login.js` setting `app.login_user` too early.

## RELATED

- `sql/migrations/022_login_membership_lookup.sql` (the rule)
- `docs/tests/isolation-proof.md` (limitation 4 and Evidence B)
- `docs/endpoints/login.md` (how login uses the rule)
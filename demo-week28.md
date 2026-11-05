# Week 28 Demo: Rahisisha Biashara

**Presenter:** Sheryl Ochieng
**Date:** 5 November 2026
**Length:** about 3 minutes
**Story:** Brio Hardware is a new shop that signs up, logs in, and gets its own private dashboard. Another shop (Jane's) exists in the same database, and Brio can never see her data.

---

## WHY THIS FILE EXISTS

A demo shows that the app really works, using a story anyone can follow. This is the script I follow when I present, plus the evidence behind each claim.

---

## PART 1: Signup and the shop's own address (0:00 to 0:45)

**Say:** "Rahisisha lets a small shop owner sign up in one step. When Brio Hardware signs up, three things are created together: the shop, the owner's account, and the link between them."

**Show:**
1. Open the signup page.
2. Sign up as **Brio Hardware**, phone **0700000001**.
3. The app creates the shop and logs the owner in.

**Why it is safe:** signup stamps the new shop's id on the database connection before it writes the owner's membership. Without that stamp, the database lock (RLS) refuses the write. The fix is in `signup.js`.

**Honest note:** on my laptop the dashboard runs at plain `localhost:3001`, because browsers do not share login cookies between `shop.localhost` subdomains. The subdomain resolver (`proxy.js`) is built. Checking the subdomain against the login token is deferred to real-domain deployment.

---

## PART 2: Login (0:45 to 1:15)

**Say:** "Login first checks the password. Only after the password is correct does it look up which shop the person belongs to."

**Show:**
1. Log out, then log in as Brio (phone 0700000001).
2. The browser is sent to the dashboard.

**What happens inside:**
- The password is checked first.
- A short database transaction then sets `app.login_user` to that one verified person.
- The `login_lookup` rule (migration 022) lets the database show only that person's own membership rows.
- The setting disappears when the transaction ends.

**A bug I fixed:** before migration 022, correct passwords were refused with 403, because the shop lock hid every membership row at login. The fix is migration 022 plus the `login.js` change.

---

## PART 3: The cross-tenant leak test (1:15 to 2:15)

**Say:** "The most important promise is that one shop never sees another shop's data. I prove it twice: live, and with automated tests."

**Live proof:**
- Jane's shop has products "shirt" and "Red Maxi Skirt".
- Brio's dashboard shows "No products yet" and zero for orders and wallet.
- Brio never sees Jane's products.

**Automated proof (run on 5 November 2026):**

```
npm run test:isolation
Test Suites: 3 passed, 3 total
Tests:       74 passed, 74 total

npm test (whole project)
Test Suites: 6 passed, 6 total
Tests:       100 passed, 100 total
```

**What the tests do:** for each of the 16 shop tables, a second shop tries to read, update and delete the first shop's row. It must find or change nothing.

**Database evidence** (full detail in `apps/api/docs/tests/isolation-proof.md`):
- 16 tables have RLS enabled and forced.
- 17 rules exist: 16 `tenant_isolation` rules, plus the read-only `login_lookup` on `memberships`.

**The pre-push hook (Husky):** every `git push` first runs the 74 isolation tests. If one fails, the push is blocked.
- Pushing `e27b789` ran the hook and it passed: 3 suites, 74 tests.
- Blocked-push proof: **YOU FILL** (paste the earlier output where a failing test stopped a push, or delete this line).

---

## PART 4: The dashboard shell (2:15 to 3:00)

**Say:** "After login, every page has the same frame: a sidebar and a header. The numbers on the home page are real, read from the database."

**Show:**
- The sidebar. Products, Orders, Wallet and Settings are marked "soon".
- Three real values: today's orders (in Nairobi time), wallet balance (from the append-only ledger), and the latest 5 products.
- The empty state for a new shop: "No products yet".

**How it is built:**
- `proxy.js` works out which shop the visitor wants.
- The `(authed)` layout checks the login cookie, then draws the sidebar.
- The API checks the cookie again. This is the second lock, because Next.js layouts do not re-run on every click.

---

## WHAT I BUILT THIS WEEK (commit evidence)

```
e27b789 Update isolation proof for migration 022 (login_lookup)
270e1cc Sync SCHEMA.sql with migration 022
e7390e1 Login: read the membership through the login_lookup rule
818a5bb Migration 022: let login read the user's own memberships
6247d33 Dashboard home: today's orders, wallet balance, latest products
0d4cfd8 Add serverGet: call the API from server pages with the login cookie
b8cb0d1 Fix import path after moving the dashboard page
345135b Add (authed) layout: login check, sidebar and header
```

---

## KNOWN LIMITATIONS (honest)

1. `login_lookup` has no dedicated automated test yet.
2. The subdomain is not yet matched against the login token. This is planned for deployment.
3. The database password is still the development value and must be changed before deployment.
4. The app's database user owns the tables, and `audit_logs` has no RLS.
5. Products, Orders, Wallet and Settings pages are not built yet.
6. CI is planned for Week 30.
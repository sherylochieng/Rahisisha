# AI Audit: Week 28 Weekend (Core Polish)

**Author:** Sheryl
**Date:** 10 November 2026
**Week 28 rule:** 40% manual / 60% AI, unless the weekend assignment says otherwise (to confirm). AI allowed for test scaffolding and documentation. NOT allowed for ledger logic or tenant isolation proofs.

This audit says what actually happened, including where the AI help went beyond what the rule allows.

> **Numbering follows the assignment sheet:**
> 1 happy-path tests, 2 loading states, 3 empty states, 4 validation errors in forms, 5 database outage, 6 signup seeding, 7 `reset-db.sh`, 8 `demo-data.sql`, 9 CI, 10 staging deploy.
> Task 10 was by far the largest. Rows marked "to confirm" are things Sheryl must check against her own work before submitting.

---

## 1. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | Happy-path test for every endpoint | files in `apps/api/tests/` (see git log) | AI wrote the tests and expected values (test scaffolding, allowed). Sheryl ran them. **To confirm:** every endpoint has one. |
| 2 | Loading state on every page | web pages and components | AI wrote the components and wording. Sheryl ran the app and checked each page. **To confirm:** every page. |
| 3 | Empty state on every list page | web pages and components | Same as Task 2. **To confirm:** every list page. |
| 4 | Validation errors surface clearly in forms | signup and login forms | **To confirm:** done or not. Sheryl checks by typing a bad phone number and looking for a message under the field. |
| 5 | Friendly errors when Postgres is down | friendly 503 handler and its test | AI wrote the handler and the test. Sheryl stopped the database and checked the page. |
| 6 | Signup seeds 3 sample products and 2 sample customers | signup sample-data service and its test | AI wrote the service, the SQL and the test. Sheryl ran the tests and checked a new shop in the browser. |
| 7 | Database reset script | `scripts/reset-db.sh` | AI wrote the script, safety checks and comments. Sheryl ran it. On 10 Nov the AI added the `RESET_DB_CONFIRM` option and the story box. |
| 8 | Demo data, committed and idempotent | `demo-data.sql` | AI wrote the SQL. Sheryl loaded it and ran the tests against it. **To confirm:** it runs twice without error or duplicates. |
| 9 | CI runs `npm test` | `.github/workflows/ci.yml` | AI wrote the workflow. Sheryl pushed it and read the red/green results. Two failures were fixed by the AI (typed-confirmation wait, missing app role). |
| 10 | Deploy to staging | Neon, Render, Vercel, DNS; `apps/api/src/utils/allowedOrigin.js`, `getShopSlug.js`, `app.js`, `login.js`; `capstone/STAGING.md` | See section 3. |
| 10 | Tests for the new code | `tests/allowedOrigin.test.js` (13), `tests/getShopSlug.test.js` (14) | AI wrote the tests and expected values (test scaffolding, allowed). Sheryl ran them. |
| 10 | Guides | `docs/src/utils/*.md`, `docs/tests/*.test.md`, `docs/src/app.md`, `docs/src/routes/auth/login.md`, `docs/INDEX.md`, `capstone/STAGING.md`, `capstone/PENDING_TASKS.md` | AI wrote them (documentation, allowed). Sheryl created the files, committed and pushed. |

---

## 2. Honest assessment against the 40/60 rule

- The manual share this weekend is **clearly below 40%**. Most of the work was the AI writing code and Sheryl running, checking and deciding.
- **What Sheryl did herself:** all the account work and purchases (Neon, Render, Vercel, the domain at Host Pinnacle and its payment), entering secrets into the right dashboards, running every command, reading every result, and deciding between options (domain name, which service, when to stop).
- **Tenant isolation:** no isolation or RLS rule was changed this weekend. The isolation suite was only **run** against staging, as proof. No AI-written isolation proof was added.
- **Ledger logic:** not touched this weekend.
- **One security-relevant code change by the AI:** the CORS rule and the shop lookup (Task 10). It decides who may call the API, so it is covered in section 3.

---

## 3. Task 10 in detail (security-sensitive lines)

**AI** = AI wrote it. **SELF** = Sheryl wrote it. **MIXED** = AI wrote the shape, Sheryl supplied the value.

The "Re-read" column is for Sheryl to tick (✔) after she has genuinely re-read that line. It is left unticked on purpose. **Nobody but Sheryl ticks these boxes.**

### `apps/api/src/utils/allowedOrigin.js` (CORS rule)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `if (!origin) return true` | Allows calls that are not from a browser page | AI | ☐ |
| `origin === env.WEB_ORIGIN` | Keeps the old single allowed address working | AI | ☐ |
| `hostname === root \|\| hostname.endsWith('.' + root)` | Allows the main site and every shop, and refuses look-alikes like `evilrahisishabiashara.com` | AI | ☐ |
| `isProduction && url.protocol !== 'https:'` | Refuses `http://` in production | AI | ☐ |
| `try { new URL(origin) } catch { return false }` | Garbage origins are refused, never crash | AI | ☐ |

### `apps/api/src/utils/getShopSlug.js` (shop lookup)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `RESERVED = new Set(['www','api'])` | These words are never shops | AI | ☐ |
| Origin first, then Host | Fixes "Shop not found" online (the API address was being read as the shop) | AI | ☐ |
| No `ROOT_DOMAIN` keeps the old rule | Laptop behaviour unchanged | AI | ☐ |

### `apps/api/src/routes/auth/login.js` and `app.js`

| Change | Who | Re-read |
|---|---|---|
| `login.js`: shop found with `getShopSlug`, unknown shop gives 404, no shop word skips the lookup. The password and membership checks were **not** changed | AI | ☐ |
| `app.js`: `cors({ origin: corsOrigin, credentials: true })` replaces the single-address setting | AI | ☐ |

### Settings and secrets (done by Sheryl in the dashboards)

| Item | Who |
|---|---|
| Created the Neon project, the app role `rahisisha_user` (not superuser, no BYPASSRLS) and the database | MIXED (AI gave the SQL, Sheryl ran it) |
| Set `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `WEB_ORIGIN`, `ROOT_DOMAIN`, `COOKIE_DOMAIN`, `PORT` on Render | MIXED (AI listed the names, Sheryl entered the values) |
| Set `NEXT_PUBLIC_API_URL` and `ROOT_DOMAIN` on Vercel | MIXED |
| Bought `rahisishabiashara.com`, pointed the nameservers, added the apex and wildcard domains | SELF (with AI step-by-step guidance) |

### Evidence

| Check | Result |
|---|---|
| Isolation suite against the Neon database as `rahisisha_user` | Passed (needed demo data loaded and `--testTimeout=60000`) |
| `npm test` (laptop) | 128 passed before the new tests, 141 after |
| CI | Green. Runs the full suite, including isolation, against a real Postgres |
| Live staging: signup, login, dashboard on a shop address, unknown shop shows "shop not found" | Checked by Sheryl in the browser |

---

## 4. Mistakes and incidents (kept on purpose)

- **A database password with `@` broke the connection URL and part of it appeared in the chat.** It was reset in the Neon console to a plain alphanumeric password, and staging was updated. Lesson: never paste connection strings into chat, and avoid special characters in passwords.
- **A copied command overwrote a copied secret on the clipboard**, so `NEON_ADMIN_URL` held command text instead of a URL. Found because `psql` complained. Lesson: type short commands by hand after copying a secret.
- **Vercel saved a variable as a Secret** and it could not be edited. Removed and re-added as plain config.
- **`reset-db.sh` edit was not applied at first.** Found with `Select-String`, then re-applied.
- **Login failed online for every shop** until the Origin-based lookup and the CORS rule were added. Found by code review before the first live attempt, then confirmed fixed live.
- **CI went red twice**: the script waited for typed confirmation, then the app role was missing on the CI machine. Both fixed, CI green.

---

## 5. What Sheryl understood and what to study

| Topic | Status |
|---|---|
| Why the app uses a database user without BYPASSRLS | To confirm in her own words |
| Why shop addresses need a CORS rule and not one fixed address | To confirm in her own words |
| Why Origin, not Host, tells the shop | To confirm in her own words |
| Why the `.` in `.rahisishabiashara.com` matters | To confirm in her own words |
| Why cookies need a real domain (`onrender.com` and `vercel.app` cannot share them) | To confirm in her own words |
| Why CI needs its own app role and a confirmation variable | To confirm in her own words |

Fill each row with "Explained and understood", "Learned after a mistake" or "To study again". Only Sheryl can say which.

---

## 6. What would raise the manual share (next steps)

1. Re-type `isAllowedOrigin` by hand from a blank file, closed book, then run `npm test -- allowedOrigin`.
2. Write the reserved-slug check at signup herself, with its test (see `capstone/PENDING_TASKS.md`, P3).
3. Write the conclusion of the staging guide (`STAGING.md`) in her own words.
4. Tick the "Re-read" boxes only after genuinely re-reading each line.

---

## 7. Still open

The full list, with reasons, is in `capstone/PENDING_TASKS.md`. The main ones:

- Reserved slugs (`api`, `www`) are not refused at signup.
- Public demo accounts (password `Demo1234!`) and leftover test shops are on staging. Remove them.
- Database SSL mode should become `verify-full`. `pool.js` needs a connection timeout.
- `audit_logs` has no RLS, and the app's database user owns the tables.
- Matching the shop in the address against the login token on later requests.
- Staging passwords and `JWT_SECRET` must be replaced with fresh values for production.
- Domain `rahisishabiashara.com` renews on 9 November 2027.
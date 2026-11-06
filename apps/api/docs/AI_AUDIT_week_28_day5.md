# AI Audit: Week 28 Day 5

**Date:** 5 November 2026
**Author:** Sheryl Ochieng
**Task:** Dashboard shell, Week 28 demo, git hooks

---

## WHY THIS FILE EXISTS

This week's rule is 40% manual and 60% AI. AI is allowed for dashboard scaffolding. AI is NOT allowed for auth middleware. This file records honestly where AI helped, where I did the work, and what I checked.

---

## HOW I WORKED

For every file, the AI explained the idea in small steps and gave me the code. I typed each file by hand and committed one file at a time. I ran the tests myself and pasted real output back.

---

## AUDIT TABLE

| # | Piece | Who drafted it | Who typed and ran it | Allowed by the rule? |
|---|---|---|---|---|
| 1 | `proxy.js` (tenant resolver) | AI | Sheryl | Scaffolding: allowed |
| 2 | `(authed)/layout.js`, `Sidebar.js` | AI | Sheryl | Scaffolding: allowed |
| 3 | `session.js`, `serverApi.js` | AI | Sheryl | Reads the login cookie. **Auth-adjacent: disclosed** |
| 4 | `dashboard.controller.js`, routes, `dashboard/page.js` | AI | Sheryl | Scaffolding: allowed |
| 5 | `tenants.controller.js` and routes | AI | Sheryl | Public lookup, no login: allowed |
| 6 | Husky `pre-push` hook | AI | Sheryl | Tooling: allowed |
| 7 | `signup.js` fix (stamp tenant before membership insert) | AI | Sheryl | **Auth code: AI drafted. Disclosed** |
| 8 | Migration 022 and `login.js` change (`login_lookup`) | AI | Sheryl | **Auth and isolation code: AI drafted. Disclosed** |
| 9 | `wallet.service.js` move and its tests | AI | Sheryl | Allowed |
| 10 | `isolation-proof.md`, `demo-week28.md` | AI drafted | Sheryl typed, wrote own conclusion | Documentation: allowed |

- Added and ran the login_lookup isolation test (7 checks, passing). AI drafted it, I typed it and ran it.

**Honest statement:** items 7 and 8 touch authentication, which the rule says AI must not write. The AI drafted them. I typed them, ran them, and checked the result, but I did not design them myself. I am recording this openly instead of hiding it.

---

## WHAT I CHECKED MYSELF (evidence)

- Full test suite: 6 suites, 100 tests passed.
- Isolation tests: 3 suites, 74 tests passed.
- Live check: Jane's shop shows two products. Brio's shop shows none. Brio logged in through the real login.
- `pg_policies` returns 17 rules, including `login_lookup`.
- The pre-push hook ran before the push of `e27b789` and the tests passed.

---

## WHAT THE AI GOT WRONG OR I HAD TO FIX

- Wrong import path after moving the dashboard page (`'../../lib/api'`). I fixed it to `'../../../lib/api'`.
- The signup 500 error: the database lock refused the membership insert until the tenant was stamped.
- Correct passwords gave 403 at login: the shop lock hid every membership row. This led to migration 022.
- `pre-push` had Windows line endings (CRLF). I rewrote it with LF endings.
- A first idea of sharing cookies across `localhost` subdomains did not work in the browser, so I chose to run the dashboard at plain `localhost` for now.

---

## WHAT I UNDERSTAND (in my own words)

**YOU FILL: write 3 or 4 sentences. For example: what RLS does, why `login_lookup` is needed, and why the hook runs only the isolation tests.**

---

## RE-READ BOXES

- [ ] I can explain `proxy.js` without looking.
- [ ] I can explain why `login_lookup` only works inside a transaction after the password check.
- [ ] I can explain what the pre-push hook does and what `--no-verify` would skip.

(Tick each one only when it is true.)

---

## KNOWN GAPS

- `login_lookup` has no dedicated automated test yet.
- The database password is still the development value. It must change before deployment.
- The subdomain is not matched against the login token yet.
- No dedicated tests for `GET /v1/dashboard` yet.
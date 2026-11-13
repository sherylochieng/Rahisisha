<!-- FILE: apps/api/docs/AI_AUDIT_week_29_day1.md -->
<!-- WHY: Week 29 Day 1 submission requires an AI audit. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 29 Day 1 (USSD Per Tenant)

**Author:** Sheryl
**Date:** 13 November 2026
**Week 29 rule:** 25% manual / 75% AI. AI **allowed** for menu boilerplate. AI **NOT allowed** for tenant resolution. Audit required.

This audit says what actually happened, including where the AI help went beyond what the rule allows.

---

## 1. The most important line in this audit

**Tenant resolution was written by the AI.** The assignment says AI is NOT allowed for it.

- The AI first wrote a lookup function in the controller (commit `3b707f0`).
- The AI then pointed out that this broke the rule and suggested Sheryl type it herself.
- Sheryl chose to have the AI write it because of time pressure.
- The final version is in `apps/api/src/middleware/resolveUssdTenant.js` (4 steps: read `serviceCode`, query `ussd_configs`, `END` if no row, set `req.tenantId`).
- The old controller version still exists in git history (`3b707f0`), but it is no longer used.

**Sheryl's part in it:**

- **Design (SELF):** she questioned why the lookup lived inside the controller and proposed middleware for separation of concerns and easier debugging. The code was restructured on her suggestion.
- **Applying (SELF):** she created each file, pasted each edit into place and ran `node --check` on every file herself.
- **Testing (SELF):** she started the server, found and fixed the port 3000 clash (stopped the old process), and dialled both shops by hand: same phone on two codes, an unknown code, product lists and balances.
- **Decisions (SELF):** what to commit, when to push, and that tenant resolution would be AI-written (declared here).
- **Not SELF:** she did not type the lookup lines in `resolveUssdTenant.js`.

---

## 2. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | `ussd_configs` table, two shops seeded | `sql/migrations/023_ussd_configs.sql`, `sql/SCHEMA.sql`, `sql/seeds/ussd_configs_seed.sql` | AI wrote the SQL (shape taken from the assignment). Sheryl ran it. The migration failed as `rahisisha_user` (cannot create in schema public), so Sheryl ran it as `postgres` and changed the owner. Seed run 3 times, same result. |
| 1 | Isolation guard exception | `apps/api/tests/isolation.test.js` | AI added `'ussd_configs'` to `KNOWN_EXCEPTIONS` with a reason. Sheryl ran the suite (81 passing). |
| 2 | Shared endpoint, tenant by service code | `middleware/resolveUssdTenant.js`, `routes/ussd.routes.js`, `app.js` | **AI wrote all of it, including tenant resolution (see section 1).** Sheryl applied the edits, started the server and dialled. |
| 3 | Menu flow | `controllers/ussd.controller.js`, `sql/seeds/ussd_demo_data_seed.sql` | AI wrote the menu (allowed) and the demo data. Sheryl dialled both shops, options 1 and 2. |
| 4 | Cross-tenant test | `tests/isolation/ussd.cross-tenant.test.js` | AI wrote the test (8 checks). Sheryl ran it: 8 passing. |
| 5 | USSD notes | `ussd-quirks.md` | **AI wrote the 7 sentences.** The assignment says "your own words". Sheryl read them before committing. |
| - | Guides | `docs/src/middleware/resolveUssdTenant.md`, `docs/tests/ussd.cross-tenant.test.md`, this audit | AI wrote them (documentation). |

---

## 3. Security-sensitive lines

**AI** = AI wrote it. **SELF** = Sheryl wrote it. **MIXED** = AI wrote the shape, Sheryl supplied the value.

The "Re-read" column is for Sheryl to tick after she has genuinely re-read that line. It is left unticked on purpose. **Nobody but Sheryl ticks these boxes.**

### `apps/api/src/middleware/resolveUssdTenant.js` (tenant resolution)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `const { serviceCode } = req.body \|\| {}` | Reads the dialled code (never the phone number) | AI | ☑ |
| `SELECT tenant_id FROM ussd_configs WHERE service_code = $1` | Finds the shop that owns the code, with a safe `$1` slot | AI | ☑ |
| `if (!rows[0]) ... 'END Service unavailable'` | Unknown code: stop, reveal nothing | AI | ☑ |
| `req.tenantId = rows[0].tenant_id` | Stamps the shop on the request | AI | ☑ |
| `catch (err) { return next(err) }` | Database error goes to the error handler | AI | ☑ |

### `apps/api/src/app.js`

| Change | Who | Re-read |
|---|---|---|
| `app.use(express.urlencoded({ extended: false }))` (Africa's Talking sends form data) | AI | ☑ |
| `app.use('/ussd', resolveUssdTenant, withTenant, ussdRouter)`: guard first, then the RLS lock. No `requireAuth` on purpose (phones have no cookie) | AI | ☑ |

### `apps/api/src/controllers/ussd.controller.js` (menu, allowed for AI)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| Queries on `req.db` with no `WHERE tenant_id` | RLS filters by shop; this is what the cross-tenant test proves | AI | ☑ |
| `cap()` at 182 characters | Last safety net for the USSD length rule | AI | ☑ |
| `LIMIT 4`, names cut to 20 characters | Keeps replies short | AI | ☑ |

### `sql/migrations/023_ussd_configs.sql` and the isolation guard

| Change | Who | Re-read |
|---|---|---|
| `ussd_configs` has **no RLS**, on purpose: the shop must be read before it is known (same trap that broke login before migration 022) | AI suggested, Sheryl approved | ☑ |
| `KNOWN_EXCEPTIONS = ['audit_logs', 'ussd_configs']` in `isolation.test.js` | AI | ☑ |
| `welcome_text` limited to 100 characters (`CHECK`) | AI | ☑ |

---

## 4. Contract differences from the assignment sheet

- The sample code sets `app.tenant_id`. Our RLS policies read **`app.current_tenant`**, so the sample would not have worked. We reuse the existing `withTenant` middleware instead of writing new `set_config` code in the endpoint.
- The sample sets the config inside the endpoint. Ours does it in `withTenant`, the same lock every other route uses.
- The sample shows `res.send("END ...")`. Ours sends `text/plain` through a `send()` helper that also caps at 182 characters.

---

## 5. Honest assessment against the 25/75 rule

- The AI wrote **nearly all the code**, including the one part that was NOT allowed (tenant resolution).
- **What Sheryl did herself:** the design change to middleware (her suggestion), every run, check and manual test listed in section 1, all git work (commits, pre-push hook, push), checking that GitHub CI went green, and deciding what to submit.
- **Tenant isolation:** the new test proves it, but the AI wrote the test. The isolation suite was run (81 passing) before and after.
- **Not done (stretch goals):** language per tenant, `ussd_events` table, 60 second idle timeout.


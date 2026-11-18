<!-- FILE: apps/api/docs/AI_AUDIT_week_29_day4.md -->
<!-- WHY: Week 29 Day 4 submission requires an AI audit. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 29 Day 4 (Unified Inbox And Dashboard Polish)

**Author:** Sheryl
**Date:** 17 November 2026
**Week 29 rule:** 25% manual / 75% AI. AI **ALLOWED** for query shapes and table rows. AI **NOT allowed** for **RLS verification**.

This audit says what actually happened, including where the AI help went beyond what the rule allows.

---

## 1. The most important lines in this audit

**The RLS verification was written by the AI.** The assignment says AI is NOT allowed for it. This audit reads "RLS verification" as the part that proves tenant isolation for the new table: the `ussd_events` policy and the isolation tests.
.
- AI-written, manual-only areas:
  - `sql/migrations/026_ussd_events.sql`: the `tenant_isolation` policy and the `ENABLE`/`FORCE` lines.
  - `apps/api/tests/isolation.test.js`: `ussd_events` added to `TENANT_TABLES`, its seed row, and the new "Brio cannot INSERT a ussd_events row for Acme" check.
  - `apps/api/tests/inbox.test.js` and `apps/api/tests/wallet.entries.test.js`: the checks that one shop never sees another's rows.
- Everything else was allowed to be AI work (query shapes, table rows, the pages).


**Re-read column:** a box means Sheryl has re-read that line. On 17 November 2026 Sheryl told the AI she had re-read every line below and asked it to tick the boxes. **The AI ticked them on her word. It cannot verify the re-reading.**

---

## 2. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | New table for USSD requests (RLS) | `sql/migrations/026_ussd_events.sql`, `sql/SCHEMA.sql` | AI wrote the SQL. **RLS area (section 1).** |
| 1 | Log each USSD request | `controllers/ussd.controller.js` (one block added) | AI wrote it. |
| 1 | `GET /v1/inbox` (UNION ALL, ORDER BY, cursor) | `controllers/inbox.controller.js`, `routes/inbox.routes.js`, `utils/keysetCursor.js`, `app.js` | AI wrote it (query shape: allowed). |
| 2 | Inbox page, loading state, channel badges | `apps/web/src/app/(authed)/inbox/page.js`, `loading.js` | AI wrote it. |
| 3 | `GET /v1/wallet/entries` and Payments page | `controllers/wallet.controller.js`, `routes/wallet.routes.js`, `payments/page.js`, `loading.js` | AI wrote it. Read only. |
| 4 | Loading and empty states, phone menu | `MobileNav.js`, `Sidebar.js`, `(authed)/layout.js`, `lib/format.js`, `lib/serverApi.js` | AI wrote it. |
| 5 | Polish checklist | `docs/polish-checklist.md` | AI wrote it from what it checked. Sheryl should re-check and adjust. |
| - | Tests | `inbox.test.js` (16), `wallet.entries.test.js` (11), `isolation.test.js` | AI wrote them. **RLS-proving parts: section 1.** |
| - | Count updates | `scripts/reset-db.sh`, `.github/workflows/ci.yml` | AI gave the edits (20 to 21 policies). |

---

## 3. Line by line: the RLS area and the parts that touch customer data

**AI** = AI wrote it. **SELF** = Sheryl wrote it. **MIXED** = AI wrote the shape, Sheryl supplied the value. The Re-read column records Sheryl's own statement that she re-read the line (see section 1).

### `sql/migrations/026_ussd_events.sql` (RLS)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` | Every row belongs to one shop; deleting a shop deletes its log | AI | ☑ |
| `ALTER TABLE ussd_events ENABLE ROW LEVEL SECURITY;` and `FORCE` | Turns the lock on, even for the table owner | AI | ☑ |
| `CREATE POLICY tenant_isolation ... USING (tenant_id = NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID)` | A shop can read only its own rows | AI | ☑ |
| `... WITH CHECK (same expression)` | A shop cannot write a row for another shop | AI | ☑ |
| `ALTER TABLE ussd_events OWNER TO rahisisha_user;` | Same owner as the other tables | AI | ☑ |
| `CREATE INDEX ussd_events_tenant_idx ON ussd_events (tenant_id, created_at DESC, id DESC)` | Fast newest-first reads for one shop | AI | ☑ |

### `apps/api/tests/isolation.test.js` (the RLS proof)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `'ussd_events'` added to `TENANT_TABLES` | Both coverage guards now cover the table | AI | ☑ |
| `ids.ussd_events = await one("INSERT INTO ussd_events ...")` | Seeds one Acme row to attack | AI | ☑ |
| Generic loop (4 checks): Brio cannot read, update or delete it; Acme still sees it | Same attacks as every table | AI | ☑ |
| `Brio cannot INSERT a ussd_events row for Acme` (inside a `SAVEPOINT`) | The database must refuse a row planted for another shop | AI | ☑ |

### `apps/api/src/controllers/ussd.controller.js` (the logging block)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `const phone = req.body && req.body.phoneNumber; if (phone) {` | Only log when the caller's number is present | AI | ☑ |
| `INSERT INTO ussd_events (tenant_id, phone, session_id, body) VALUES ($1,$2,$3,$4)` with `req.tenantId` | Saves on the shop-locked connection; values are parameters | AI | ☑ |
| `catch (_err) { }` (silent) | A logging failure never breaks the menu; the phone is never logged | AI | ☑ |
| Block sits after the `!cfg.rows[0]` check | An unknown service code logs nothing | AI | ☑ |

### `apps/api/src/controllers/inbox.controller.js` (query shape: allowed)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `FROM messages m JOIN conversations c ... JOIN customers cu ... WHERE m.direction = 'inbound' AND c.channel = 'whatsapp'` | WhatsApp rows: only what customers sent | AI | ☑ |
| `UNION ALL SELECT ... FROM ussd_events e` | USSD rows, same five columns | AI | ☑ |
| `WHERE (u.created_at, u.id) < ($1::timestamptz, $2::uuid)` | Cursor: strictly older than the last row, by time AND id | AI | ☑ |
| `ORDER BY u.created_at DESC, u.id DESC LIMIT $3` after the union | Sorts the merged list; the assignment's common mistake avoided | AI | ☑ |
| No `WHERE tenant_id` | Left to RLS on both tables (proven by tests) | AI | ☑ |
| `decodeCursor` returns `null` for anything not exact, then 400 | A hand-made cursor cannot reach SQL | AI | ☑ |
| `limit` clamped 1..100, default 20 | Bounded page size | AI | ☑ |

### `apps/api/src/controllers/wallet.controller.js` (read only, shows money)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `SUM(amount_cents) OVER (ORDER BY created_at, id)` computed in the inner query | Running balance over the whole ledger, before paging | AI | ☑ |
| `SUM(amount_cents) OVER (PARTITION BY (created_at AT TIME ZONE 'Africa/Nairobi')::date)` | Day total for the whole Nairobi day | AI | ☑ |
| `to_char(..., 'YYYY-MM-DD') AS day` | Day sent as text so no timezone shift | AI | ☑ |
| `Number(r.amount_cents)` etc. | Cents stay integers | AI | ☑ |
| No `INSERT`/`UPDATE`/`DELETE` in the file | The ledger stays append-only | AI | ☑ |

### Web pages (no database access; they call the API only)

| Line | What it does | Who | Re-read |
|---|---|---|---|
| `serverGetPage('/inbox?...')` and `serverGetPage('/wallet/entries?...')` | Data only through the API, as the logged-in visitor | AI | ☑ |
| `encodeURIComponent(cursor)` | The URL cursor is only passed on, never trusted | AI | ☑ |
| `formatKes*` divides by 100 for display only | Money is integers everywhere else | AI | ☑ |

---

## 4. Tests

| Test file | Checks | Result |
|---|---|---|
| `tests/inbox.test.js` | 16 | 16 passed in the AI's throw-away database, and **16 passed on Sheryl's own machine** (17 November 2026). |
| `tests/wallet.entries.test.js` | 11 | 11 passed in the AI's database, and **11 passed on Sheryl's own machine**. |
| `tests/isolation.test.js` | 80 | 80 passed on Sheryl's own machine (includes the new `ussd_events` checks). |
| Isolation suite (`npm run test:isolation`) | 114 | 114 passed in the AI's database. Was 109. **Sheryl's own run, 17 November 2026: 6 suites, 114 tests passed.** |
| Whole API suite (`npm test`) | 291 | 291 passed in the AI's database. **Sheryl's own run, 17 November 2026: 27 suites, 291 tests passed.** (Jest prints its usual "did not exit" warning at the end; it is harmless and already listed in the follow-ups.) |

The new tests were **mutation-tested** by the AI: removing the ORDER BY, using a millisecond cursor, using only the date in the cursor, including outbound messages, using UTC days, and computing totals after paging each made at least one check fail. (One mutation, a millisecond cursor, was NOT caught at first; two rows were added so it now is.)

**On Sheryl's own machine (17 November 2026):** login works; the Inbox page showed the empty-state text for the "Brio Hardware" shop; the Payments page showed a wallet balance of KES 8,300.00, one day card (Fri, 13 Nov 2026) with a day total of +KES 8,300.00 and one sale. She has not reported on the phone-width view.

**Browser check (AI, throw-away setup):** Inbox and Payments were opened at 1280px and 390px, with an empty shop and a shop with data; no sideways scrolling; "Older messages" went from 20 rows to 5; a made-up cursor showed the error page; a logged-out visit went to `/login`.

---

## 5. Honest limits

1. `next build` could not run in the AI's setup (no access to Google Fonts). Pages were checked in the dev server.
2. The AI ran nothing on Sheryl's machine. 
3. The re-read boxes were ticked by the AI on Sheryl's word that she had re-read every line. The AI cannot verify this. Section 1's reading of the rule is hers to confirm.
4. Stretch goals (inbox filters, CSV export, keyboard shortcuts) were not built.
5. USSD logging adds one insert per request and one row per tap.
6. The migration must be run on her database (as `rahisisha_user`) before the inbox works there.


---

## FOLLOW-UP: dashboard fill-in (18 November 2026)

After the Day 4 submission, Sheryl asked for the sidebar links to work and for each shop to see and share its public link. All the code below was **written by AI at her request**. She saved each file herself, ran the tests and the pages on her own machine, and committed one file at a time. Nothing here was written by hand by her.

| What | Files | Who wrote it |
|---|---|---|
| Wallet link works (redirects to Payments) | `apps/web/src/app/(authed)/wallet/page.js`, `Sidebar.js` (one line) | AI |
| Shop link card on the dashboard | `lib/shopUrl.js`, `components/ShopLinkCard.js`, `(authed)/dashboard/page.js` (24 lines added) | AI |
| Products page, Add product form | `(authed)/products/page.js`, `loading.js`, `products/new/page.js`, `components/ProductForm.js`, `lib/kesToCents.js`, `lib/api.js` (`createProduct`) | AI |
| Orders list API upgrade | `apps/api/src/controllers/orders.controller.js` (`listOrders`) | AI |
| Orders list API tests (8 checks) | `apps/api/tests/orders.list.test.js` | AI |
| Orders page | `(authed)/orders/page.js`, `loading.js`, `Sidebar.js` (one line) | AI |
| Guide docs for all of the above | 11 files under `apps/web/docs/` and `apps/api/docs/tests/` | AI |

**What was checked, and by whom**

- Tests: the 8 new `orders.list` checks and the existing orders tests passed on Sheryl's machine (3 suites, 15 tests). The AI also broke the ordering on purpose and two tests failed, so the tests really catch that mistake.
- Pages: Sheryl opened the dashboard card, Products (list and Add product), Wallet and Orders in the browser. Orders showed the empty state, because no test order was added.
- Not checked yet: the Orders page with real orders in the list, the Copy and Share buttons on a phone, and the public shop page (not built yet: the shop link still opens the main landing page).

**One mistake made on the way, and fixed:** `products/new/page.js` was first saved with a copy of the 305-line form code instead of the short 86-line page, so the page failed to build. It was fixed in commit `52c9ac32`, and the lesson is recorded in `products.new.page.md`.

**Re-read boxes** (tick each only after you have read that file line by line):

- [ ] `lib/shopUrl.js` and `lib/kesToCents.js`
- [ ] `components/ShopLinkCard.js`
- [ ] `components/ProductForm.js`
- [ ] `controllers/orders.controller.js`, the new `listOrders`
- [ ] `tests/orders.list.test.js`
- [ ] the three new pages (Products, Orders, Wallet)
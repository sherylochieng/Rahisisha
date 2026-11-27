# Pending Tasks and Roadmap (as of 27 Nov 2026)

**FILE:** `docs/PENDING_TASKS.md`
**Written:** Week 30 (26 Nov 2026). **Merged and updated:** 27 Nov 2026
**Replaces:** the 26 Nov list (this file, before the merge) and the 10 Nov list (`capstone/PENDING_TASKS.md`, kept in `capstone/archive/PENDING_TASKS_2026-11-10.md`)

---

## WHY THIS DOC EXISTS

One honest list of everything still to do, in the order we plan to do it, so nothing is forgotten between sessions. Before 27 Nov there were two lists that overlapped. Now there is one. It also records future ideas so they are not lost.

## WHY IMPORTANT

The project is big. Without a written list, small but important items (like extra login security for the admin, or refunds) get lost. This list also feeds the launch checklist and the final documents update.

## DANGER (what breaks without it)

Forgotten items become launch problems: money that was double paid and never refunded, migrations missing on the live database (this really happened: on 27 Nov the live database was seven migrations behind), or an admin account with only a password.

## WHAT IT SOLVES

A single place to see what is done, what is next, and what is deliberately postponed.

## SYSTEM DESIGN PRINCIPLE

Do the work that makes the product safe and complete first (money, ownership, admin), then growth features. Tick items honestly: a half-done item is not done.

## RULES

1. Update this file when something is finished or a new idea appears.
2. Mark each item `[ ]` (not started), `[~]` (in progress) or `[x]` (done and pushed).
3. Do not delete finished items; they move to the Done section so the history is visible.
4. Every item has a code (`P1` to `P69`). The codes `P1` to `P28` are from the 10 Nov list and never change. New items continue from `P29`. Say "Let's do P2" to pick one.
5. Anything that touches money, the shop locks or the live database goes in its own batch, with a backup first.

## PRACTICAL EXAMPLE

Before starting a work session, open this file, find the current batch in section B, work on it, then tick it and add a line in the Done log.

## DECISIONS

- Finish the customer shop first, then the platform admin, then the marketplace, pricing and sign-up, then the live launch.
- **27 Nov: the product becomes a hybrid.** A marketplace window plus individual shops. The marketplace only browses. Buying, payment and orders happen inside the shop. One shop is one order and one payment. Details: `Rahisisha Biashara: hybrid build plan in batches` (the batch plan).
- **27 Nov: money model is commission only, for now.** No plans or fees to chase. A shop accepts the rules at sign-up and the commission is taken automatically on each sale, by a licensed payment provider that splits the payment. Until that is built, the commission is only calculated and recorded per order, not collected. Keep the rate in one place so it can change later.
- **27 Nov: Phase 2 idea.** A one-time fee of about KES 300 when a shop asks to go live on the marketplace and be verified, then commission per sale. Not built now.
- **27 Nov: the public demo password is retired.** It must never protect an account again. Demo data now asks for a password at run time.
- All project documents (README, API reference, runbook, secrets guide) are updated once at the end, not per feature.

## WHERE USED

Read it at the start of each session. Linked from `NEXT.md` when that file is next updated.

## TRADEOFFS

+ Nothing is lost, and there is one list instead of two.
- It must be kept honest by hand.

## HOW TO USE

Work through section B (the batches) in order. Sections C to K hold items that either belong to a batch (the line says which) or are waiting to be placed.

---

## PIECE BY PIECE (real life, in simple terms)

**Done**: already built, tested and committed.
**A. Right now**: the last clean-up jobs before new building.
**B. The hybrid build**: ten batches, one feature at a time.
**C to K**: everything else, grouped by topic, so nothing hides.

---

## Done (all so far)

### Customer side
- [x] Public shop page with product photos (Cloudinary)
- [x] Product create, edit and delete
- [x] Basket, bottom checkout bar, header chip
- [x] Checkout with M-Pesa, receipt screen, optional delivery note
- [x] Safe payments: reconcile service, no second prompt while one is unresolved, "I've paid, check my payment" button
- [x] Tests for all of the above (full API suite: 33 suites, 359 tests at the 26 Nov count; the suite has grown since)

### Platform admin foundation (Week 30)
- [x] `platform_admins` table, separate admin identity, suspension fields on shops (`suspended_at`, `suspended_reason`, `suspended_by`) and `audit_logs.actor_admin_id` (migration 028)
- [x] Admin sign-in API: login, logout, me, the guard that checks the admin on every request, the login brake (5 tries per phone, 20 per address, 15 minutes), tests
- [x] Admin can read shop owners (migration 029, a read-only rule that is on only inside the admin lock)

### Clean-up of 27 Nov
- [x] Three public demo accounts on staging locked (their password replaced by a random one, shops kept)
- [x] Public demo password removed from notes and scripts; seed script, demo SQL and `reset-db.sh` now take a password at run time
- [x] `reset-db.sh` lock count corrected from 21 to 23
- [x] Neon backed up (`pg_dump`, file kept outside the repo), then migrations 023 to 029 applied by hand; all 27 tables owned by `rahisisha_user`; 23 policies
- [x] Local commits pushed, CI green

---

## A. Right now (finish Batch 0)

- [~] **P1. Delete the public demo accounts** (old public password, now retired)
      Locked on 27 Nov. Still to do: delete them (or decide to keep the shops for a demo), and confirm `capstone/STAGING.md` no longer lists the password.
- [ ] **P2. Delete the leftover test shops** (like `jojo-shop`). Staging has 9 users in total, 3 of them the demo owners.
      Why: clutter, and confusing in a demo. Done when: only shops you want to show remain.
- [ ] **P3. Refuse reserved shop names (`api`, `www`) at signup**
      Why: login already ignores them as shops, but signup still lets someone register them. That shop would never work.
      Done when: signup returns a clear error for those names, and a test proves it.
      Note: write this one yourself. It counts toward your manual share.
- [~] **P29. Confirm Render and Vercel redeployed** after the 27 Nov push and the site starts normally (open it once and wait for the sleeping API).
- [ ] **P30. `CLOUDINARY_*` settings on Render.**
- [ ] **P31. Record the hybrid and commission decisions** in `WILL_NOT_BUILD`, `SPEC` and `ROADMAP` (additions only).
- [ ] **P32. Create the live admin account** on Neon with the create-admin script. Type your own phone and password in your own terminal only; never paste them anywhere.
- [ ] **P33. Add an index entry or note in `NEXT.md`** that points to this single list.

---

## B. The hybrid build (ten batches)

Order matters. A batch ends green: full tests including isolation, one browser check, push, CI green. No new batch starts on a red build.

- [~] **Batch 0. Clean the house.** Left: P1, P2, P29 to P33 above. Everything else in Batch 0 is done (see Done).
- [ ] **Batch 1. Admin core (API only).** Migration for `verified_at` and `verified_by` on shops; an audit service that writes the audit row in the same transaction as the action; shop list and detail (safe summaries only); suspend, reinstate and verify with a required reason of up to 500 characters; routes at `/v1/admin/shops`; suspended-shop rules; tests.
- [ ] **Batch 2. Look and feel.** Choose the blue by eye (A `#1D4ED8`, B `#1E3A8A`, C navy `#0F172A`), colour tokens in `tailwind.config.js` (additions only), shared components.
- [ ] **Batch 3. Admin screens.** `/admin/login` and the Merchants screen.
- [ ] **Batch 4. Catalogue basics.** Categories, shop profile, product form with sizes and stock, marketplace switch. Includes P35 (categories), P36 (stock).
- [ ] **Batch 5. Shopper journey.** Product page, basket grouped by seller, pay-and-track page, Explore shops, rate limits on checkout and pay (P40).
- [ ] **Batch 6. Marketplace read path.** One limited database role, one narrow rule, one function; the most important tests in the project. Check first how Neon creates roles.
- [ ] **Batch 7. Front doors, sign-up and plans.** `/sell`, `/pricing`, 5-step sign-up. **Needs a re-cut** because of the commission-only decision: plans and the Free limit may move later, and the "payments" step must follow the payment decision (section E).
- [ ] **Batch 8. Moderation and billing.** Hide listings, reports, categories admin. Billing shrinks to "later" while commission-only.
- [ ] **Batch 9. Pilot hardening and launch.** Password reset, rate limits, admin two-step sign-in, backups with a tested restore, privacy and terms, ODPC registration, refunds, launch evidence.

---

## C. Shop owner tools (not yet placed in a batch)

These were on the 26 Nov list. The batch plan does not schedule most of them, so **decide where each fits**. In particular the owner's orders page is essential: a seller must see paid orders to ship them.

- [ ] **P34. Owner's orders page:** see paid orders, the delivery note, mark packed and delivered.
- [ ] **P35. Categories** and the shop filter (Batch 4). The migration takes the next free number (028 and 029 are used).
- [ ] **P36. Stock (inventory):** optional stock number per product, reduce when a payment is confirmed, never sell the last item twice, "Sold out" on the shop, low-stock warning and "add stock" on the dashboard (Batch 4). Needs a database migration.
- [ ] **P37. Optional product details page** (Batch 5).
- [ ] **P38. Settings page:** the shop's M-Pesa details and WhatsApp.
- [ ] **P39. New order alert** to the owner (SMS or WhatsApp).
- [ ] **P40. Per-IP rate limit** on the public endpoints (Batch 5 for checkout and pay; Batch 9 for sign-up and login).
- [ ] **P41. Refunds screen:** list attempts with `result_desc = 'paid_but_order_not_open'` and track refunds. First case: one extra KES 320 from the 26 Nov test, still refunded by hand (Batch 9).
- [ ] **P42. Scheduled sweeper** that settles old pending payments without anyone pressing a button.
- [ ] **P43. Clean-up job** for unpaid orders and for photos uploaded but never saved.
- [ ] **P44. M-Pesa receipt codes** for payments settled by a check (Transaction Status API).
- [ ] **P45. Show the delivery note on the owner's side.**

---

## D. Platform admin (the Rahisisha owner)

- [x] `platform_admins` table and a separate admin sign-in API (phone and password; created by a command, no public sign-up). The sign-in **screen** `/admin/login` is Batch 3.
- [ ] **P46. Add a one-time code (2FA) to the admin sign-in** (Batch 9, and before real shops go live). *Reminder: we chose simple phone and password first, and agreed to add the extra code afterwards.*
- [x] Narrow read-only database access so the admin can see all shops without switching off the protection between shops: done with the admin lock plus the read-only rule from migration 029. The marketplace's cross-shop read path is separate (Batch 6).
- [~] **P47. Suspension.** The fields exist (done). Still to do: who and when are written on suspend, and the rule that a suspended shop disappears everywhere (shop link, checkout, Explore, search, category pages), each with a test. Decision pending: a suspended owner may sign in read-only to see why (my lean: yes).
- [ ] **P48. Admin screens:** shops list, one shop's details, suspend and reinstate, audit trail, problem payments, subscriptions (Batches 1 and 3).
- [ ] **P49. Tests:** a normal owner is refused from every admin route; every admin action writes an audit row.
- [ ] **P50. No access to customers' phone numbers or messages by default.**
- [ ] **P51. Admin change-password screen** (after the pilot).

---

## E. Money and business (pricing and sign-up)

Decided on 27 Nov: **commission only, for now.** See Decisions.

- [~] **P27. Decide how Rahisisha makes money.** Direction chosen: free to join, one all-in commission per completed sale, a higher rate for marketplace sales (you brought the buyer) and a lower rate for sales through the shop's own link. Example rates for discussion only: 7% and 4%. Still to do: one paragraph in the README with the final rate and the reason.
- [ ] **P52. Choose and verify the automatic split.** A licensed payment provider splits each payment: your share to you, the rest to the seller. Compare IntaSend, Paystack Kenya and Flutterwave Kenya. Fees we found were from third-party pages (about 1.5% capped at KES 2,000 for Paystack; about 2.9% plus KES 100 per transfer out for Flutterwave), so confirm them. Also confirm the provider's licence covers a marketplace splitting money. Not legal advice.
- [ ] **P53. Record the commission per order** (a number only, not collected yet), with the rate held in one place. Do this before the pricing page.
- [ ] **P54. Record the rules each shop accepted at sign-up** (the date and the version of the rules).
- [ ] **P55. Phase 2: one-time fee of about KES 300** when a shop goes live on the marketplace and gets verified, paid to Rahisisha's own till. Needs Rahisisha's own till or paybill, its own business registration and a refund rule for rejected shops.
- [ ] **P56. Pricing page** and 5-step sign-up (Batch 7). Re-cut for commission only. The database allows `starter`, `growth`, `pro` today; they are not the money model for now.
- [ ] **P57. Registration collects business details and how the shop receives money.**
- [ ] **P58. Subscription billing** (later): the owner pays Rahisisha by M-Pesa to the platform's own till or paybill. A free trial first. Unpaid means the shop is paused. Postponed while commission-only.

Options for how shops receive customer payments (decision needed before the sign-up payments step):
1. The owner enters their own Daraja keys (what we have now; hard for ordinary owners, so provide a guide).
2. Simple mode: the customer pays to the owner's till and enters the M-Pesa code, and the owner confirms it.
3. Rahisisha collects and pays out to shops (easiest for owners, but heavy and needs financial licensing; leave for much later).
4. **New, leading option:** a licensed payment provider with automatic split (P52). Rahisisha never holds the money.

---

## F. Launch (Week 30 Day 3, postponed on purpose)

- [x] Backup the live database (`pg_dump`), then apply migrations to **Neon by hand** (done 27 Nov: 023 to 029).
- [ ] **P59. DNS proof, TLS padlock proof, first real tenant from a real phone** (screenshots in `day3-launch/`, crop phone numbers and passwords).
- [ ] **P60. `docs/LAUNCH_CHECKLIST.md`**, ticked honestly.
- [ ] **P61. AI audit file for this week**, and list `reconcile.service.js` as money code in the root `AI_AUDIT.md`.
- [ ] **P62. First live payment should be a small test amount.**
- [ ] **P63. Rollback plan.**
- [ ] **P22. Tell your instructor the staging address:** https://rahisishabiashara.com
- [ ] **P23. Set a reminder to renew the domain** (due 9 November 2027, about KES 2,030 a year).
- [ ] **P24. Check the sleeping API before any demo:** open the site, wait a minute, then show it.

---

## G. Security and maintenance

- [ ] **P4. Match the shop in the address against the login token on every request.**
      Why: today only login checks the address. Later requests trust the token alone. The database locks still protect data, so the risk is low.
- [ ] **P5. Add a lock (RLS) to `audit_logs`, and stop the app user owning the tables.**
      Why: it is the only tenant table without a lock, and an owner can switch locks off.
- [ ] **P6. Set the database SSL mode to `verify-full`.**
      Why: the app does not check the database's identity yet. This also removes the `pg` warning in the logs.
- [ ] **P7. New passwords and a new `JWT_SECRET` for production.**
      Why: staging values are not for real customers, and one password was seen in chat once. Never reuse staging values.
- [ ] **P64. `npm audit` and the Next.js security advisory.**
- [ ] **P65. Open issues #4 and #5.**
- [ ] **P66. Backups schedule and error alerts.**
- [ ] **P67. Privacy:** register with the data protection office (ODPC) and publish privacy and terms pages before launch.

---

## H. Reliability

- [ ] **P8. Give `pool.js` a connection timeout.**
      Why: a stuck database makes requests wait forever. With a timeout they fail fast and show the friendly 503.
- [ ] **P9. Move off Render's free plan when real users arrive.**
      Why: the free API sleeps after 15 minutes and the first visit takes about a minute. Until then: open the site once before any demo.

---

## I. Tidiness

- [ ] **P10. Fix slugify:** cut the name first, then trim leading and trailing dashes.
- [ ] **P11. Make the dashboard answer match the others** (add `error: null`).
- [ ] **P12. Make login errors use the standard shape** (`{ error: { code, message, details } }`) instead of `{ error: "text" }`.
- [ ] **P13. Make `session.js` treat an API outage like `serverApi.js` does.**
- [ ] **P14. Add a customers page and endpoint** (none exist yet).
- [ ] **P15. Fix two stale comments in `orders.controller.js`** (a `FOR UPDATE` mention in `createOrder`, and `?status`/`?channel` filters on `listOrders` that do not exist).
- [ ] **P16. Check `updateOrderStatus` with an unknown status** (for example `"banana"`). The check may never fire and return 500 instead of 400. Test first, then fix.
- [ ] **P68. Seed script note:** section 7 of `scripts/seed-capstone.js` inserts into `wallet_entries` with a column called `reference_id`, but `SCHEMA.sql` calls it `reference`. Check by running the seed locally; fix if it fails.

---

## J. Proof and paperwork

- [ ] **P17. Add an end-to-end test for the real login endpoint.** Today the pieces are tested separately, but nothing runs login from start to finish.
- [ ] **P18. Add a test for `GET /v1/dashboard`.**
- [ ] **P19. Write the missing guides:** friendly 503 handler (`dbDown.js`), sample data on signup (`sampleData.service.js`), the happy-path tests, the database-down test, the signup sample-data test, and the web layout, sidebar and dashboard page.
- [ ] **P20. Fill in the "understood" rows in `AI_AUDIT_week_28_weekend.md`** in your own words. Fix the task numbers and the "Who" cells for Tasks 3 to 6.
- [ ] **P21. Closed-book rewrite** of the wallet functions and of `isAllowedOrigin`, to raise the manual share.
- [ ] **P69. Add an end-to-end test that a shop owner token is refused on every admin route** once the shop routes exist (Batch 1).

---

## K. Product ideas and later

- [ ] **P25. Shareable, branded shop page.** Each shop gets a public products page a friend can open from WhatsApp (logo, colours, tone). The hybrid plan covers this (Batches 4 and 5), so it is now part of those batches.
      Steps: check whether `tenants` has colour and logo columns (add a migration if not); a public page with no login; colours through CSS variables; readable text on pale brand colours; the public query returns only active products and nothing private, with a test that another shop's products never appear.
- [ ] **P26. Study the competition (about 20 minutes).** Mybizna (https://app.mybizna.com/) already sells a shareable shop link to Kenyan Instagram sellers, so a shop link alone is not our difference. Make a free account, use it as a customer, and write down what feels good and what is missing. How do they price (free plan plus a cut per payment, as their landing page says)? Do they track stock? Do they answer customers? Only their landing page was read so far.
- [ ] **P28. Write the one-sentence pitch and the Odoo/Shopify/Mybizna comparison in the README.** One sentence to start from: "Rahisisha helps a busy Kenyan seller sell on WhatsApp and get paid on M-Pesa without being online all day." Do not promise features that are not built.

Ideas for later:
- WhatsApp: real Meta WhatsApp Business connection, replies from the inbox, and a bot that learns a shop's products and sells over WhatsApp.
- AI-made posters and posts, auto-posting, post-sale ratings.
- Discount codes, customer order tracking and reviews, Swahili language option.
- Custom domain for a shop, installable web app (offline), multiple photos per product.
- USSD and Telegram buying flows.

After the pilot (stay out of the plan until real sellers show they matter): shopper order notifications and WhatsApp replies from the inbox; USSD ordering; automatic plan billing and a small fee only on marketplace orders; reviews and ratings; one payment across many shops; admin change-password screen; AI tools for the Pro plan; delivery partner integrations and a mobile app.

---

## L. Open decisions

| Decision | Options | State | Needed by |
| --- | --- | --- | --- |
| How shops receive customer money | Own Daraja keys, Rahisisha collects, till plus manual confirm, or a licensed provider that splits | Leaning to a licensed provider with automatic split (P52). Confirm fees and licence first | Before Batch 7 |
| Money model | Plans, commission, or both | **Decided 27 Nov: commission only for now.** KES 300 fee is Phase 2 | Done |
| Can a suspended seller still sign in? | Yes, read-only, or no | Lean: yes, read-only | Batch 1 |
| Does `/` become the marketplace now? | Now, or `/explore` first | Lean: `/explore` first, until there are 5 to 10 shops | Batch 6 |
| The blue | A `#1D4ED8`, B `#1E3A8A`, C navy `#0F172A` | Decide by eye in Batch 2 | Batch 2 |
| Admin two-step sign-in | Before the pilot, or after | Before real shops go live | Batch 9 |
| The KES 320 refund | Manual now, or a refund tool | Manual now, tool in Batch 9 | Batch 9 |
| Where do the shop owner tools (section C) go? | Which batch | Open | Now |

---

## M. Documents to update once at the end

README, `docs/api-reference.md` (merge `docs/api/customer-checkout-endpoints.md`, uploads sign, product `imageUrl`, storefront fields), `launch-blockers.md`, `NEXT.md`, `qa/manual-plan.md`, `docs/secrets.md` (`CLOUDINARY_*` and the new `DEMO_PASSWORD`), `docs/RUNBOOK.md` (apply migrations to Neon by hand, `ROOT_DOMAIN` local note, photos, the double-charge procedure, the 27 Nov lesson that the live database was behind), `infra/PROVISION.md`, the `.env.example` files (add `DEMO_PASSWORD`), the capstone documents, and the AI audit for photos, checkout and reconcile. Also `sql/SCHEMA.sql` header run-order list: add migrations 029 and the 030s as they are made.

---

## Done log

| Code | Date finished | Commit |
| ---- | ------------- | ------ |
| Admin read of memberships (migration 029) | 27 Nov 2026 | `ac8cedf77c` |
| SCHEMA.sql records migration 029 | 27 Nov 2026 | `c3a3a83946` |
| Seed script reads demo password from .env | 27 Nov 2026 | `89da17cb34` |
| Public demo password removed from notes | 27 Nov 2026 | `6ca3defc44` |
| Seed script and guide stop naming the old password | 27 Nov 2026 | `edae529589` |
| Demo data asks for a password | 27 Nov 2026 | `b98fe56953` |
| `reset-db.sh` passes the demo password, lock count 23 | 27 Nov 2026 | `3b4c4a9a8c` |
| Neon backed up and migrations 023 to 029 applied | 27 Nov 2026 | (done by hand, no commit) |
| Staging demo accounts locked | 27 Nov 2026 | (done by hand, no commit) |
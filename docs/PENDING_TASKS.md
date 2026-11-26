# Pending Tasks and Roadmap (as of 26 Nov 2026)

**FILE:** `docs/PENDING_TASKS.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

One honest list of everything still to do, in the order we plan to do it, so nothing is forgotten between sessions. It also records future ideas so they are not lost.

## WHY IMPORTANT

The project is big. Without a written list, small but important items (like extra login security for the admin, or refunds) get lost. This list also feeds the launch checklist and the final documents update.

## DANGER (what breaks without it)

Forgotten items become launch problems: money that was double paid and never refunded, migrations missing on the live database, or an admin account with only a password.

## WHAT IT SOLVES

A single place to see what is done, what is next, and what is deliberately postponed.

## SYSTEM DESIGN PRINCIPLE

Do the work that makes the product safe and complete first (money, ownership, admin), then growth features. Tick items honestly: a half-done item is not done.

## RULES

1. Update this file when something is finished or a new idea appears.
2. Mark each item `[ ]` (not started), `[~]` (in progress) or `[x]` (done and pushed).
3. Do not delete finished items; move them to "Done" so the history is visible.

## PRACTICAL EXAMPLE

Before starting a work session, open this file, pick the next unticked item in section A, work on it, then tick it.

## DECISIONS

- Finish the customer shop first, then the platform admin, then pricing and sign-up, then the live launch (Week 30 Day 3).
- All project documents (README, API reference, runbook, secrets guide) are updated once at the end, not per feature. The new guides in `docs/guides/` and `docs/api/` hold the details until then.

## WHERE USED

Read it at the start of each session. Linked from `NEXT.md` when that file is next updated.

## TRADEOFFS

+ Nothing is lost.
- It must be kept honest by hand.

## HOW TO USE

Work through section A top to bottom. Items in later sections can move up if you decide so.

---

## PIECE BY PIECE (real life, in simple terms)

**Done**  
Already built, tested and committed.

**Next**  
The list in the order we plan to build it.

**Later**  
Good ideas that must wait.

---

## Done (customer side)

- [x] Public shop page with product photos (Cloudinary)
- [x] Product create, edit and delete
- [x] Basket, bottom checkout bar, header chip
- [x] Checkout with M-Pesa, receipt screen, optional delivery note
- [x] Safe payments: reconcile service, no second prompt while one is unresolved, "I've paid, check my payment" button
- [x] Tests for all of the above (full API suite: 33 suites, 359 tests at the time of writing)

## A. Next: finish the shop

- [ ] **Push** all local commits, check the pipeline (CI) is green, confirm Render and Vercel redeploy. (Wait until the Neon migration item below is ready, because the new code needs `image_url`.)
- [ ] **Owner's orders page:** see paid orders, the delivery note, mark packed and delivered.
- [ ] **Stock (inventory):** optional stock number per product, reduce when a payment is confirmed, never sell the last item twice, "Sold out" on the shop, low-stock warning and "add stock" on the dashboard. Needs a database migration.
- [ ] **Categories** (migration 028) and the shop filter.
- [ ] **Optional product details page.**
- [ ] **Settings page:** the shop's M-Pesa details and WhatsApp.
- [ ] **New order alert** to the owner (SMS or WhatsApp).
- [ ] **Refunds screen:** list attempts with `result_desc = 'paid_but_order_not_open'` and track refunds. First case: one extra KES 320 from the 26 Nov test.
- [ ] **Scheduled sweeper** that settles old pending payments without anyone pressing a button.
- [ ] **Per-IP rate limit** on the public endpoints.
- [ ] **Clean-up job** for unpaid orders and for photos uploaded but never saved.
- [ ] Fetch **M-Pesa receipt codes** for payments settled by a check (Transaction Status API).
- [ ] Show the **delivery note** on the owner's side.

## B. Platform admin (the Rahisisha owner)

- [ ] `platform_admins` table and a separate admin login at `/admin/login` (phone and password to start; created by a command, no public sign-up).
- [ ] **Add a one-time code (2FA) to the admin login.** *Reminder: we chose simple phone and password first, and agreed to add the extra code afterwards.*
- [ ] Narrow read-only database functions so the admin can see all shops without switching off the protection between shops.
- [ ] Suspension fields (who, when, reason). A suspended shop's owner cannot log in or use the dashboard; its public page already shows "not found".
- [ ] Admin screens: shops list, one shop's details, suspend and reinstate, audit trail, problem payments, subscriptions.
- [ ] Tests: a normal owner is refused from every admin route; every admin action writes an audit row.
- [ ] No access to customers' phone numbers or messages by default.

## C. Business side (pricing and sign-up)

- [ ] **Pricing page** with plans (the database has `starter`, `growth`, `pro`; confirm names and prices).
- [ ] **Registration** collects business details and how the shop receives money.
- [ ] **Decide how shops receive customer payments** (see options below).
- [ ] **Subscription billing:** the owner pays Rahisisha monthly by M-Pesa to the platform's own till or paybill. A free trial first is recommended. Unpaid means the shop is paused.

Options for shop payments:
1. The owner enters their own Daraja keys (what we have now; hard for ordinary owners, so provide a guide).
2. Simple mode: the customer pays to the owner's till and enters the M-Pesa code, and the owner confirms it.
3. Rahisisha collects and pays out to shops (easiest for owners, but heavy and needs financial licensing; leave for much later).

## D. Launch (Week 30 Day 3, postponed on purpose)

- [ ] Backup the live database (`pg_dump`), then apply migration 027 (and any new ones) to **Neon by hand**.
- [ ] `CLOUDINARY_*` settings on Render.
- [ ] DNS proof, TLS padlock proof, first real tenant from a real phone (screenshots in `day3-launch/`, crop phone numbers and passwords).
- [ ] `docs/LAUNCH_CHECKLIST.md`, ticked honestly.
- [ ] AI audit file for this week, and list `reconcile.service.js` as money code in the root `AI_AUDIT.md`.
- [ ] First live payment should be a small test amount.
- [ ] Rollback plan.

## E. Security and maintenance

- [ ] `npm audit` and the Next.js security advisory.
- [ ] Open issues #4 and #5.
- [ ] Backups schedule and error alerts.

## F. Ideas for later

- WhatsApp: real Meta WhatsApp Business connection, replies from the inbox, and a bot that learns a shop's products and sells over WhatsApp.
- AI-made posters and posts, auto-posting, post-sale ratings.
- Discount codes, customer order tracking and reviews, Swahili language option.
- Custom domain for a shop, installable web app (offline), multiple photos per product.
- USSD and Telegram buying flows.

## G. Documents to update once at the end

README, `docs/api-reference.md` (merge `docs/api/customer-checkout-endpoints.md`, uploads sign, product `imageUrl`, storefront fields), `launch-blockers.md`, `NEXT.md`, `qa/manual-plan.md`, `docs/secrets.md` (`CLOUDINARY_*`), `docs/RUNBOOK.md` (apply migrations to Neon by hand, `ROOT_DOMAIN` local note, photos, the double-charge procedure), `infra/PROVISION.md`, the `.env.example` files, the capstone documents, and the AI audit for photos, checkout and reconcile.

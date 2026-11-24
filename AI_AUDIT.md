# AI Audit (index)

This file is a map. The audits live next to the code they describe, in `apps/api/docs/`.

| Day | Audit |
|---|---|
| Week 28 Day 3 | `apps/api/docs/AI_AUDIT_week_28_day3.md` |
| Week 28 Day 4 | `apps/api/docs/AI_AUDIT_week_28_day4.md` |
| Week 28 Day 5 | `apps/api/docs/AI_AUDIT_week_28_day5.md` |
| Week 28 Weekend | `apps/api/docs/AI_AUDIT_week_28_weekend.md` |
| Week 29 Day 1 | `apps/api/docs/AI_AUDIT_week_29_day1.md` |
| Week 29 Day 2 | `apps/api/docs/AI_AUDIT_week_29_day2.md` |
| Week 29 Day 3 | `apps/api/docs/AI_AUDIT_week_29_day3.md` |
| Week 29 Day 4 | `apps/api/docs/AI_AUDIT_week_29_day4.md` |
| Week 29 Day 5 | `apps/api/docs/AI_AUDIT_week_29_day5.md` |
| Week 29 Weekend | `apps/api/docs/AI_AUDIT_week_29_weekend.md` |

---

## Money Audit (Week 28 Day 4)

The Money Audit lists **every line that touches `wallet_entries`**, marked SELF, AI or MIXED, with a re-read column.

It is section 3 of: **`apps/api/docs/AI_AUDIT_week_28_day4.md`**

Covered there:

- `sql/migrations/021_fix_wallet_entries.sql`
- `sql/SCHEMA.sql` (wallet section)
- `apps/api/src/services/wallet.service.js` (`credit`, `debit`, `balance`)
- `apps/api/tests/isolation.test.js` (the lines that touch the wallet)

## Isolation Audit (Week 28 Day 4)

Section 4 of the same file.

---

## Tenant Resolution Note (Week 29 Day 1)

The assignment lists tenant resolution as NOT allowed for AI. In Week 29 Day 1 the AI wrote it, at Sheryl's request, and this is declared openly.

The lines are in `apps/api/src/middleware/resolveUssdTenant.js`, and each one is listed in section 3 of **`apps/api/docs/AI_AUDIT_week_29_day1.md`**.

## Token Handling and Tenant Resolution Note (Week 29 Day 2)

The assignment lists token handling and tenant resolution as NOT allowed for AI. In Week 29 Day 2 the AI wrote both, at Sheryl's request, and this is declared openly. The AI also wrote `whatsapp-security.md`, which the assignment asks for in Sheryl's own words.

The lines are in `apps/api/src/utils/kms.js`, `apps/api/src/services/whatsapp.service.js` and `apps/api/src/middleware/resolveWhatsappTenant.js`, and each one is listed in section 3 of **`apps/api/docs/AI_AUDIT_week_29_day2.md`**.

## Money Audit (Week 29 Day 3)

The assignment lists the ledger update and callback verification as NOT allowed for AI. In Week 29 Day 3 the AI wrote both, at Sheryl's request, and this is declared openly. The AI wrote a first draft of `reconciliation.md`, which Sheryl then rewrote in her own words, as the assignment asks.

The Money Audit lists **every line that touches money**, marked SELF, AI or MIXED, with a re-read column. It is section 3 of **`apps/api/docs/AI_AUDIT_week_29_day3.md`**.

Covered there:

- `apps/api/src/controllers/mpesa.callback.controller.js` (callback verification and the wallet credit)
- `apps/api/src/middleware/resolveMpesaTenant.js` and `apps/api/src/routes/mpesa.routes.js`
- `apps/api/src/services/daraja.service.js` (STK push and the Safaricom confirmation)
- `apps/api/src/controllers/payments.controller.js` and `routes/orders.routes.js` (the pay route)
- `sql/migrations/025_daraja_payments.sql` (secrets encrypted, unique receipt, one paid attempt per order)

## RLS Verification Note (Week 29 Day 4)

The assignment as written lists RLS verification as NOT allowed for AI. In Week 29 Day 4 the AI wrote the `ussd_events` policy and the isolation tests for it, at Sheryl's request, and this is declared openly. Sheryl says this restriction was changed from the assignment as first written; the AI cannot verify that, so a reviewer should check it. The query shapes (the inbox `UNION ALL` and the payments window functions) are allowed AI work.

Every line is listed in section 3 of **`apps/api/docs/AI_AUDIT_week_29_day4.md`**, with a re-read column that was ticked on Sheryl's word that she re-read each line (see section 1 there).

Covered there:

- `sql/migrations/026_ussd_events.sql` (the RLS policy)
- `apps/api/tests/isolation.test.js` (`ussd_events` attacks)
- `apps/api/src/controllers/ussd.controller.js` (the logging block)
- `apps/api/src/controllers/inbox.controller.js` and `wallet.controller.js` (query shapes)

## Demo Script and Reflection Note (Week 29 Day 5)

The assignment allows AI for the demo script and does **not** allow it for the demo reflection. In Week 29 Day 5 the AI wrote `capstone/demo-script.md` and `demo-week29.md` (allowed). The AI refused to write `reflog-notes.md`, which is Sheryl's own work: the AI only explained the concepts beforehand and checked the facts afterwards. This is Sheryl's statement, and the AI cannot prove who typed the final words.

`reflog-demo.txt` was assembled by the AI from the terminal output Sheryl pasted, because PowerShell's recorder did not save Git's replies. The file says so at the top.

The one code change is `apps/api/scripts/seed-daraja-demo.js`, which now sets up Brio Hardware as well as Amina's Boutique. It is described in section 3 of **`apps/api/docs/AI_AUDIT_week_29_day5.md`**.

## Weekend Stability Note (Week 29 Weekend)

The weekend assignment gave no AI rules, so the AI's work is declared in full. The AI wrote the test scripts (`scripts/demo-run.mjs`, `apps/api/scripts/load-test-orders.js`), their guides, `RUNBOOK.md`, `PERFORMANCE.md` and `NEXT.md`. Sheryl ran every script on her own computer, and the results in the documents are hers.

The AI changed production code once: a 3-line database error handler in `apps/api/src/db/pool.js`, with a test, after Sheryl's chaos test crashed the API. The AI also wrote four small web fixes (a loading screen for the public shop page, a bad-cursor fix for the inbox and payments pages, and a hydration fix in `ShopLinkCard.js`). The weekend did not touch money, ledger, tenant or RLS code.

Everything is listed in **`apps/api/docs/AI_AUDIT_week_29_weekend.md`**, including what went wrong and what is not verified (no video, WhatsApp simulated, M-Pesa sandbox only, only idle database connections cut).
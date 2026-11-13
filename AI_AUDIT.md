# AI Audit (index)

This file is a map. The audits live next to the code they describe, in `apps/api/docs/`.

| Day | Audit |
|---|---|
| Week 28 Day 3 | `apps/api/docs/AI_AUDIT_week_28_day3.md` |
| Week 28 Day 4 | `apps/api/docs/AI_AUDIT_week_28_day4.md` |
| Week 28 Day 5 | `apps/api/docs/AI_AUDIT_week_28_day5.md` |
| Week 28 Weekend | `apps/api/docs/AI_AUDIT_week_28_weekend.md` |
| Week 29 Day 1 | `apps/api/docs/AI_AUDIT_week_29_day1.md` |

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
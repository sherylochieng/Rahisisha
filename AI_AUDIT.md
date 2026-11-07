# AI Audit (index)

This file is a map. The audits live next to the code they describe, in `apps/api/docs/`.

| Day | Audit |
|---|---|
| Week 28 Day 3 | `apps/api/docs/AI_AUDIT_week_28_day3.md` |
| Week 28 Day 4 | `apps/api/docs/AI_AUDIT_week_28_day4.md` |
| Week 28 Day 5 | `apps/api/docs/AI_AUDIT_week_28_day5.md` |

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
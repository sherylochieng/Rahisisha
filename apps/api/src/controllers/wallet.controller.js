// =============================================================================
// FILE: apps/api/src/controllers/wallet.controller.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The Payments page needs the shop's wallet_entries, newest first, with the
//   day each one belongs to and a running total. This returns exactly that.
//
// WHY IMPORTANT
//   It shows the owner their money. A wrong running total is a wrong balance.
//
// DANGER
//   1. The running total is computed by Postgres over the WHOLE ledger
//      (oldest to newest) BEFORE the page is cut. If it were computed on one
//      page only, page 2 would start again from zero and be wrong.
//   2. Money is whole cents (integers). Never divide here; the page formats.
//   3. Days are Nairobi days (Africa/Nairobi), not UTC. A sale at 00:30 Nairobi
//      time belongs to that Nairobi day. The day is sent as TEXT 'YYYY-MM-DD'
//      because a JavaScript Date would shift it by the server's timezone.
//   4. This file only READS. The ledger is append-only: nothing here inserts,
//      updates or deletes a wallet row.
//   5. Read through req.db only. RLS limits wallet_entries to this shop.
//
// WHAT IT SOLVES
//   GET /v1/wallet/entries?limit=50&cursor=...
//   -> { data: [{ id, amountCents, reason, reference, createdAt, day,
//                 dayTotalCents, balanceAfterCents }], nextCursor, error }
//
// DECISIONS
//   - dayTotalCents = the day's net movement, over ALL that day's entries, even
//     if the day is split across two pages.
//   - balanceAfterCents = the wallet balance right after this entry.
//   - The last row's balanceAfterCents on the newest page equals the dashboard
//     balance (both are SUM(amount_cents)). The tests check this.
//   - Same cursor rules as the inbox (src/utils/keysetCursor.js).
//
// RULES
//   1. Totals are computed BEFORE paging (inner query), page is cut AFTER (outer).
//   2. Group by the Nairobi day, never the UTC day.
//   3. Read only: no INSERT/UPDATE/DELETE on wallet_entries here.
//   4. Bad cursor = 400. Cents stay integers.
//
// PRACTICAL EXAMPLE
//   Ledger: +1,500.00 (sale), +800.00 (sale), -200.00 (commission).
//   Row 3 -> balanceAfterCents 210000, dayTotalCents = that day's net movement.
//   Real life: the running balance column on a bank statement, with a
//   "net for the day" line, handed over one page at a time.
//
// WHERE USED
//   routes/wallet.routes.js, mounted in app.js. Read by web: (authed)/payments/page.js.
//
// TRADEOFFS
//   - The window functions scan this shop's whole ledger on every request.
//     Fine for a small shop (indexed by tenant). For a very large ledger the
//     next step is a stored daily summary.
//
// HOW TO USE
//   app.use('/v1/wallet', requireAuth, withTenant, walletRouter)
// =============================================================================
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: the import  =  "BORROW THE BOOKMARK TOOLS"
//   Same cursor helpers as the inbox (utils/keysetCursor.js).
//
// PIECE 2: NAIROBI_DAY  =  "WHICH DAY DOES THIS BELONG TO, IN KENYA?"
//   Takes the saved time, shifts it to Nairobi time, keeps only the date.
//   Real life: a sale at 00:30 on 2 January Nairobi time is a 2 January sale for
//   the shop owner, even though the clock in London still says 1 January.
//
// PIECE 3: STEP 1 and STEP 2, limit and cursor  =  "HOW MANY, AND FROM WHERE?"
//   Limit is 50 by default (1 to 100). A made-up cursor is refused with a 400.
//
// PIECE 4: STEP 3, the INNER query  =  "WORK OUT THE TOTALS FIRST"
//   Reads ALL of this shop's ledger rows and adds two helper columns:
//     day_total     = everything that happened on the same Nairobi day
//     balance_after = everything from the very first entry up to this one
//   Real life: the passbook's balance column. It must be worked out from the
//   first line of the book, not from the top of the page you happen to look at.
//
// PIECE 5: STEP 3, the OUTER query  =  "NOW CUT ONE PAGE"
//   Keeps rows older than the bookmark, newest first, limit+1 rows. Because the
//   totals were worked out BEFORE this cut, they are right on every page.
//
// PIECE 6: STEP 4, nextCursor  =  "IS THERE ANOTHER PAGE?"
//   The extra row tells us there is more; the bookmark is built from the last row
//   we actually return.
//
// PIECE 7: the answer  =  "CENTS AS WHOLE NUMBERS"
//   Postgres sends SUM() results as text, so Number() turns them back into
//   numbers. The page turns cents into KES only for display.
// =============================================================================

import { CURSOR_TS_SQL, decodeCursor, encodeCursor } from '../utils/keysetCursor.js';

const NAIROBI_DAY = `(created_at AT TIME ZONE 'Africa/Nairobi')::date`;

// -----------------------------------------------------------------------------
// listWalletEntries - the whole endpoint, in three steps
// WINDOW FUNCTIONS in one line each:
//   SUM(...) OVER (PARTITION BY day)      = add up every entry of the SAME day
//   SUM(...) OVER (ORDER BY created_at,id) = add up everything from the start
//                                            up to and including this row
// Real life: the "balance" column in a passbook.
// -----------------------------------------------------------------------------
export async function listWalletEntries(req, res) {
  // STEP 1: limit 1..100, default 50
  const parsed = parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isNaN(parsed) ? 50 : parsed, 1), 100);

  // STEP 2: cursor (bad cursor = 400)
  let ts = null;
  let id = null;
  if (req.query.cursor) {
    const c = decodeCursor(String(req.query.cursor));
    if (!c) {
      return res.status(400).json({
        data: null,
        error: { code: 'validation', message: 'Invalid cursor' },
      });
    }
    ts = c.ts;
    id = c.id;
  }

  // STEP 3: the inner query adds day + the two totals over the FULL ledger;
  // the outer query then cuts one page (+1 to learn if there is more)
  const { rows } = await req.db.query(
    `SELECT w.id, w.amount_cents, w.reason, w.reference, w.created_at,
            w.day, w.day_total, w.balance_after,
            ${CURSOR_TS_SQL('w.created_at')} AS cursor_ts
       FROM (
              SELECT id, amount_cents, reason, reference, created_at,
                     to_char(${NAIROBI_DAY}, 'YYYY-MM-DD') AS day,
                     SUM(amount_cents) OVER (PARTITION BY ${NAIROBI_DAY})        AS day_total,
                     SUM(amount_cents) OVER (ORDER BY created_at, id)            AS balance_after
                FROM wallet_entries
            ) w
      WHERE ($1::timestamptz IS NULL OR (w.created_at, w.id) < ($1::timestamptz, $2::uuid))
      ORDER BY w.created_at DESC, w.id DESC
      LIMIT $3`,
    [ts, id, limit + 1]
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore ? encodeCursor(last.cursor_ts, last.id) : null;

  // SUM() of a bigint comes back as text from Postgres, so convert to numbers
  // (cents are far below the safe-integer limit for any real shop)
  const data = page.map((r) => ({
    id: r.id,
    amountCents: Number(r.amount_cents),
    reason: r.reason,
    reference: r.reference,
    createdAt: r.created_at,
    day: r.day,
    dayTotalCents: Number(r.day_total),
    balanceAfterCents: Number(r.balance_after),
  }));

  res.json({ data, nextCursor, error: null });
}
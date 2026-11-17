// =============================================================================
// FILE: apps/web/src/app/(authed)/payments/page.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Shows the shop's wallet ledger (wallet_entries) grouped by DAY, each day with
//   its net total, and a running balance after every entry.
//
// WHY IMPORTANT
//   It is the owner's money record: what came in (sales), what went out
//   (refunds, commission, payouts) and what the wallet held afterwards. If it is
//   wrong, the owner stops trusting the product.
//
// DANGER
//   - Server Component: NO 'use client'. Data only from serverGetPage('/wallet/entries').
//   - Money is whole cents from the API. It is turned into KES only for DISPLAY
//     (lib/format.js). Never add up money in the browser; the running total and
//     day totals come from the database, so they are right on every page.
//   - This page only READS the ledger. It has no buttons that change money.
//   - A day can be split across two pages. Its header then appears on both
//     pages, with the SAME whole-day total (the API computes it over the full day).
//   - API failure THROWS (error page). We never draw a fake "no payments".
//
// WHAT IT SOLVES
//   /payments            -> the 50 newest entries, grouped by Nairobi day
//   /payments?cursor=... -> the next 50 older ones
//   no entries           -> an empty state
//
// SYSTEM DESIGN PRINCIPLE
//   Group in the page, calculate in the database. Rows arrive newest first, so
//   all entries of one day sit next to each other and a single pass groups them.
//
// RULES
//   1. Days are Nairobi days. The API sends day as 'YYYY-MM-DD' text.
//   2. Money in is green with "+", money out is red with "-".
//   3. "Balance after" is shown on every row (the running total).
//   4. Layout wraps on a phone (flex-wrap); no wide table that scrolls sideways.
//
// PRACTICAL EXAMPLE
//   Fri, 2 Jan 2026                              Day total +KES 100.00
//     Sale   ref-300      +KES 300.00    Balance KES 1,700.00
//     Refund ref-100      -KES 100.00    Balance KES 1,400.00
//
// TRADEOFFS
//   + No client JavaScript, correct totals on every page.
//   - Only "older" paging. CSV export and filters are stretch goals, not built.
// =============================================================================
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: imports and PAGE_SIZE  =  "THE TOOLS AND HOW MANY LINES"
//   serverGetPage asks the API, the format helpers turn cents and times into
//   words, EmptyState is the shared "nothing yet" box. 50 entries per page.
//
// PIECE 2: REASONS  =  "FRIENDLY NAMES FOR THE LEDGER WORDS"
//   The database only allows sale, refund, commission and payout. This turns
//   them into Sale, Refund, Commission and Payout. An unknown one still shows.
//
// PIECE 3: groupByDay  =  "ONE ENVELOPE PER DAY"
//   Receipts arrive newest first, so entries of the same day sit together. One
//   pass starts a new envelope each time the day changes. Real life: sorting
//   the till slips into a pile per day.
//
// PIECE 4: STEP 1 and 2  =  "WHICH PAGE, THEN ASK THE API"
//   Read the cursor from the address, ask the API on the server (loading.js
//   shows while we wait). A failure throws and the error page shows.
//
// PIECE 5: STEP 4, the balance card  =  "WHAT IS IN THE WALLET RIGHT NOW"
//   On the first page the newest line's balance-after IS the wallet balance.
//   On older pages it would be misleading, so the card is hidden there.
//
// PIECE 6: STEP 5a, EmptyState  =  "NO PAYMENTS YET"
//   A new shop sees a friendly box, not a blank screen.
//
// PIECE 7: STEP 5b, the day cards  =  "THE PASSBOOK"
//   Each day has a header (date + the day's net total) and its lines: what
//   happened, the reference and time, the signed amount (green in, red out) and
//   the balance after. Totals come from the database, not from this page.
//
// PIECE 8: STEP 6, the links  =  "TURN THE PAGE"
//   Older payments and Back to newest, as plain links like the inbox.
// =============================================================================

import Link from 'next/link';

import { serverGetPage } from '../../../lib/serverApi';
import { formatKes, formatKesSigned, formatNairobiDay, formatNairobiTime } from '../../../lib/format';
import EmptyState from '../../../components/EmptyState';

const PAGE_SIZE = 50;

// Words for each reason in the ledger (the database allows exactly these four)
const REASONS = {
  sale: 'Sale',
  refund: 'Refund',
  commission: 'Commission',
  payout: 'Payout',
};

// PIECE 1: group newest-first rows into [{ day, dayTotalCents, entries }]
// Real life: sorting a pile of receipts into one envelope per day. Because the
// rows already arrive sorted by time, a new envelope starts whenever the day changes.
function groupByDay(entries) {
  const groups = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.day === e.day) {
      last.entries.push(e);
    } else {
      groups.push({ day: e.day, dayTotalCents: e.dayTotalCents, entries: [e] });
    }
  }
  return groups;
}

export default async function PaymentsPage({ searchParams }) {
  // STEP 1: which page? No cursor = the newest entries
  const { cursor } = await searchParams;
  const query = `?limit=${PAGE_SIZE}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

  // STEP 2: ask the API (loading.js shows while we wait)
  const { data: entries, nextCursor } = await serverGetPage(`/wallet/entries${query}`);

  // STEP 3: group by day
  const groups = groupByDay(entries);

  // STEP 4: the balance card. On the first page the newest row's "balance after"
  // IS the wallet balance right now. On older pages it would be misleading, so hide it.
  const showBalance = !cursor && entries.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-brand-navy">Payments</h1>

      {showBalance && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Wallet balance</p>
          <p className="mt-2 font-display text-3xl sm:text-4xl font-bold text-brand-navy">
            {formatKes(entries[0].balanceAfterCents)}
          </p>
        </div>
      )}

      {/* STEP 5a: nothing yet */}
      {entries.length === 0 ? (
        <EmptyState
          title="No payments yet."
          message="Money from paid orders will show up here, day by day."
        />
      ) : (
        /* STEP 5b: one card per day */
        groups.map((g) => (
          <section key={g.day} className="bg-white rounded-2xl border border-gray-100">
            {/* Day header: the date on the left, the day's net total on the right */}
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-3 border-b border-gray-100">
              <h2 className="font-display font-bold text-brand-navy">{formatNairobiDay(g.day)}</h2>
              <p className="text-sm text-gray-500">
                Day total{' '}
                <span className={`font-semibold ${g.dayTotalCents < 0 ? 'text-red-600' : 'text-brand-navy'}`}>
                  {formatKesSigned(g.dayTotalCents)}
                </span>
              </p>
            </header>

            <ul className="divide-y divide-gray-100">
              {g.entries.map((e) => (
                <li key={e.id} className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-navy">{REASONS[e.reason] || e.reason}</p>
                    <p className="text-xs text-gray-400 break-all">
                      {e.reference ? `${e.reference} · ` : ''}{formatNairobiTime(e.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${e.amountCents < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatKesSigned(e.amountCents)}
                    </p>
                    <p className="text-xs text-gray-400">Balance {formatKes(e.balanceAfterCents)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* STEP 6: paging links (same idea as the inbox) */}
      <div className="flex items-center justify-between text-sm">
        {cursor ? (
          <Link href="/payments" className="text-brand-orange font-medium hover:underline">
            Back to newest
          </Link>
        ) : <span />}
        {nextCursor && (
          <Link
            href={`/payments?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-brand-orange font-medium hover:underline"
          >
            Older payments
          </Link>
        )}
      </div>
    </div>
  );
}
// =============================================================================
// FILE: apps/web/src/components/admin/ReceiptsList.js   (Week 30 Day 3, Batch 2, part 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Draws a list of receipts (the audit trail): what was done, by which admin, when, from
//   which address, and the written reason.
//
// WHY IMPORTANT
//   Receipts are the proof of every admin action. They must read clearly, because they are
//   what you open when a shop owner asks "why was I suspended?".
//
// DANGER
//   - The reason is typed by an admin. It is shown as plain text only. Never as HTML.
//   - It only draws what it is given. It cannot show receipts of other shops by itself.
//
// WHAT IT SOLVES
//   One receipt list for the shop page now and the Receipts page later (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: the receipt words come from lib/adminReceipts.js, the times
//   from lib/format.js, and this file only lays them out.
//
// RULES
//   1. An empty list shows a calm "No receipts yet" line.
//   2. A receipt with no admin name (the admin was removed) shows "Unknown admin".
//   3. Times are Nairobi time.
//
// PRACTICAL EXAMPLE
//   <ReceiptsList receipts={shop.receipts} />
//
// DECISIONS
//   - An ordered list (newest first), as the API sends it.
//
// WHERE USED
//   ShopDetail.js. The Receipts page later.
//
// TRADEOFFS
//   + Simple and reusable.
//
// HOW TO USE
//   <ReceiptsList receipts={receipts} />
// =============================================================================

import { formatNairobiTime } from '../../lib/format';
import { receiptReason, receiptTitle } from '../../lib/adminReceipts';

export default function ReceiptsList({ receipts }) {
  if (!receipts || receipts.length === 0) {
    return <p className="text-sm text-slate-600">No receipts yet. Nothing has been done to this shop.</p>;
  }

  return (
    <ol className="space-y-3">
      {receipts.map((r) => {
        const reason = receiptReason(r);
        return (
          <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-brand-navy">{receiptTitle(r.action)}</span>
              <span className="text-xs text-slate-600">{formatNairobiTime(r.createdAt)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-700">By {r.adminName || 'Unknown admin'}</p>
            {/* The reason is plain text. React escapes it, so it can never run as code. */}
            {reason && <p className="mt-2 text-sm text-slate-800">Reason: {reason}</p>}
            {r.ipAddress && <p className="mt-1 text-xs text-slate-500">From {r.ipAddress}</p>}
          </li>
        );
      })}
    </ol>
  );
}

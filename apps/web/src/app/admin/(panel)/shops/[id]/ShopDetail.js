'use client';
// Runs in the browser: it loads one shop with the admin cookie.

// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/shops/[id]/ShopDetail.js   (Week 30 Day 3, Batch 2, part 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The shop's page: the summary at the top and its receipts below. Part 3b adds the
//   suspend, reinstate, verify and unverify buttons here.
//
// WHY IMPORTANT
//   This is where an admin decides what to do about one shop, so it must show the facts
//   and the history clearly.
//
// DANGER
//   - Read only for now. No button here changes anything yet.
//   - 404 shows a calm "Shop not found", not an error.
//
// WHAT IT SOLVES
//   Seeing one shop's details and what has already been done to it.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: useAdminLoad fetches, ShopSummary and ReceiptsList draw, this
//   file chooses what to show for each state.
//
// RULES
//   1. States: loading, not found, error with Try again, ready.
//   2. A way back to the list is always shown.
//
// PRACTICAL EXAMPLE
//   Click Mama Njeri Groceries in the list: you see her details and an empty receipts list.
//
// DECISIONS
//   - The receipts come in the same answer as the shop (one call, one consistent picture).
//
// WHERE USED
//   shops/[id]/page.js.
//
// TRADEOFFS
//   + Simple. Latest 20 receipts only, which the API decides.
//
// HOW TO USE
//   <ShopDetail id={shopId} />
// =============================================================================

// PIECE BY PIECE
//   useAdminLoad(...)  = the shop (with receipts), plus loading / error / notFound flags.
//   BackLink           = the way back to the list, shown in every state.
//   the states         = loading text, not found box, error with Try again, or the page.

import Link from 'next/link';
import { adminApi } from '../../../../../lib/adminApi';
import { useAdminLoad } from '../../../../../hooks/useAdminLoad';
import AdminButton from '../../../../../components/admin/AdminButton';
import ShopSummary from '../../../../../components/admin/ShopSummary';
import ReceiptsList from '../../../../../components/admin/ReceiptsList';
import FormError from '../../../../../components/FormError';
import EmptyState from '../../../../../components/EmptyState';

// The way back, written once and used in every state.
function BackLink() {
  return (
    <Link href="/admin/shops" className="text-sm font-semibold text-brand-navy underline underline-offset-4">
      &larr; All shops
    </Link>
  );
}

export default function ShopDetail({ id }) {
  const { data: shop, loading, error, notFound, retry } = useAdminLoad(() => adminApi.getShop(id), id);

  return (
    <div className="space-y-5">
      <BackLink />

      {loading ? (
        <p role="status" className="py-8 text-center text-sm text-slate-600">Loading shop...</p>
      ) : notFound ? (
        <EmptyState title="Shop not found" message="It may have been removed, or the address is wrong." />
      ) : shop ? (
        <>
          <ShopSummary shop={shop} />
          <section aria-labelledby="receipts-heading" className="space-y-3">
            <h2 id="receipts-heading" className="text-lg font-bold text-brand-navy">Receipts</h2>
            <ReceiptsList receipts={shop.receipts} />
          </section>
        </>
      ) : (
        // An error and nothing to show: say it, and offer to try again.
        <>
          <FormError message={error} />
          <div className="flex justify-center">
            <AdminButton onClick={retry}>Try again</AdminButton>
          </div>
        </>
      )}
    </div>
  );
}

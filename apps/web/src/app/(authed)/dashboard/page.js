// =============================================================================
// (authed)/dashboard/page.js — the dashboard home: the owner's morning summary
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The first screen after login. It answers three questions at a glance:
//     1. How many orders came in today?
//     2. How much money is in my wallet?
//     3. What are my newest products?
//
// WHY IMPORTANT:
// - It is the first thing every owner sees. If it is wrong, or shows another
//   shop's numbers, the owner stops trusting the product
//
// DANGER (if this file does not exist):
// - /dashboard has nothing to show, or shows made-up numbers
//
// WHAT IT SOLVES:
// - Real numbers from the API, drawn on the server, for the logged-in shop only
//
// SYSTEM DESIGN PRINCIPLE: The page never touches the database
// - It calls GET /v1/dashboard through serverGet. The API answers through the
//   tenant-scoped connection (req.db), so only this shop's rows come back
// - This is a Server Component: the page is drawn on the server and the
//   browser receives finished HTML. No data fetching code shipped to the browser
//
// RULES:
// - No 'use client' here. This page reads private data on the server
// - Never call the database or pool from this file. Only serverGet
// - Money arrives in whole cents. Turn it into KES only for DISPLAY
// - If the API fails, serverGet THROWS, so we never draw a page of zeros that
//   look real
// - Empty lists use the shared <EmptyState>. Never leave a blank box
//
// PRACTICAL EXAMPLES:
// - New shop:      Orders 0, Wallet KES 0.00, "No products yet"
// - Busy shop:     Orders 7, Wallet KES 3,500.00, five newest products
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any dashboard home: fetch one summary on the server, draw cards
//
// TRADEOFFS:
// + Simple, fast first paint, no client-side fetching
// - Numbers are fixed at page load; refresh to update (live updates come later)
//
// HOW TO USE:
// - Open /dashboard while logged in. The (authed) layout runs the login check
//
// -----------------------------------------------------------------------------
// THE STORY: BEFORE AND AFTER (Week 28 Weekend, Task 3)
// -----------------------------------------------------------------------------
//   BEFORE (how we first designed it)
//     - The empty "latest products" message was a plain <p> written by hand
//       inside this page.
//     - While the API answered, the page was a blank white screen.
//
//   WHY WE CHANGED IT
//     The weekend assignment asked for loading states and empty states on
//     the existing pages (no new features). A brand-new shop sees an empty
//     list on its very first visit, so this is the first impression of every
//     new customer.
//
//   AFTER (how it works now)
//     1. The empty message uses the shared <EmptyState> (same words, a
//        dashed "slot waiting to be filled" look, and screen reader support).
//     2. A new file next to this one, loading.js, shows grey placeholder
//        boxes while this page waits for the API. Next.js uses it by itself.
//        THIS file needs no loading code at all.
//     3. The status tag markup is written out in full (one `>` was missing
//        in the copy we pasted, and is correct here).
//     The numbers, the cards and the product list did NOT change.
// =============================================================================

// serverGet: calls the API with the visitor's login cookie
import { serverGet } from '../../../lib/serverApi';

// ✅ AFTER (NEW): the shared "nothing here yet" box
// ❌ BEFORE: no import. The empty message was a <p> written further down.
import EmptyState from '../../../components/EmptyState';

// -----------------------------------------------------------------------------
// formatKes — turn whole cents into a readable KES amount for display only
//   350000 -> "KES 3,500.00"
// -----------------------------------------------------------------------------
function formatKes(cents) {
  const kes = cents / 100;
  return 'KES ' + kes.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// STATUS_STYLES: the little colour tag next to each product
const STATUS_STYLES = {
  active:   'bg-green-100 text-green-700',
  draft:    'bg-gray-100 text-gray-600',
  archived: 'bg-amber-100 text-amber-700',
};

// -----------------------------------------------------------------------------
// DashboardPage — a Server Component. "async" lets us await data right here
// -----------------------------------------------------------------------------
export default async function DashboardPage() {
  // await new Promise((resolve) => setTimeout(resolve, 3000)); // TEMP TEST: remove after
  //   throw new Error('TEMP TEST: remove after');

  // STEP 1: ask the API for the morning summary.
  // Returns { ordersToday, balanceCents, latestProducts }
  // While we wait here, Next.js shows loading.js (the grey placeholder boxes)
  const { ordersToday, balanceCents, latestProducts } = await serverGet('/dashboard');

  // STEP 2: draw the page
  return (
    <div className="space-y-8">

      {/* Page title */}
      <h1 className="font-display text-2xl font-bold text-brand-navy">Dashboard</h1>

      {/* TOP ROW: two number cards */}
      <div className="grid gap-6 sm:grid-cols-2">

        {/* Card 1: today's orders */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Today&apos;s orders</p>
          <p className="mt-2 font-display text-4xl font-bold text-brand-navy">
            {ordersToday}
          </p>
        </div>

        {/* Card 2: wallet balance (cents -> KES for display only) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-sm text-gray-500">Wallet balance</p>
          <p className="mt-2 font-display text-4xl font-bold text-brand-navy">
            {formatKes(balanceCents)}
          </p>
        </div>
      </div>

      {/* BOTTOM: the five newest products */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-display text-lg font-bold text-brand-navy">Latest products</h2>

        {/* No products yet: the shared EmptyState instead of an empty box.
            mt-4 keeps the same gap under the heading as before.

            ❌ BEFORE: a plain paragraph written by hand right here:
              <p className="mt-4 text-sm text-gray-500">
                No products yet. Add your first product to see it here.
              </p>
            ✅ AFTER: same words, split into a title and a hint, in the
            shared box (dashed outline, role="status" for screen readers). */}
        {latestProducts.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No products yet"
            message="Add your first product to see it here."
          />
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {latestProducts.map((product) => (
              <li key={product.id} className="py-3 flex items-center justify-between">
                {/* Left: name and price */}
                <div>
                  <p className="text-sm font-medium text-brand-navy">{product.name}</p>
                  <p className="text-xs text-gray-500">{formatKes(product.price_cents)}</p>
                </div>

                {/* Right: status tag (draft, active or archived) */}
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                    STATUS_STYLES[product.status] || STATUS_STYLES.draft
                  }`}
                >
                  {product.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
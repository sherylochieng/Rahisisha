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
//   browser receives finished HTML. No loading flicker, no data fetching code
//   shipped to the browser
//
// RULES:
// - No 'use client' here. This page reads private data on the server
// - Never call the database or pool from this file. Only serverGet
// - Money arrives in whole cents. Turn it into KES only for DISPLAY
// - If the API fails, serverGet THROWS, so we never draw a page of zeros that
//   look real
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
// =============================================================================

// serverGet: calls the API with the visitor's login cookie
import { serverGet } from '../../../lib/serverApi';

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

  // STEP 1: ask the API for the morning summary.
  // Returns { ordersToday, balanceCents, latestProducts }
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

        {/* No products yet: a friendly message instead of an empty box */}
        {latestProducts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No products yet. Add your first product to see it here.
          </p>
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
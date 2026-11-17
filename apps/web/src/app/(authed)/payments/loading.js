// =============================================================================
// FILE: apps/web/src/app/(authed)/payments/loading.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   payments/page.js waits for the API. Next.js shows THIS file during the wait,
//   so the owner never sees a blank white screen.
//
// WHY IMPORTANT
//   Money pages are the ones people refresh nervously. A visible "loading" shape
//   tells them the page is working, not frozen.
//
// DANGER
//   Keep the shape close to the real page (title, balance card, a day card), or
//   the page jumps when the real data arrives. Keep role="status" and the
//   sr-only text so screen readers announce it.
//
// WHAT IT SOLVES
//   The loading state for /payments (assignment: every page has a loading state).
//
// SYSTEM DESIGN PRINCIPLE
//   Skeleton screens: show the shape before the data.
//
// RULES
//   Pure markup. No fetching, no state.
//
// PRACTICAL EXAMPLE
//   Amina opens Payments on a slow network: a title, a grey balance box and a
//   grey day card pulse, then the real figures replace them.
//
// TRADEOFFS
//   + Zero logic. - An approximation of the real heights.
// =============================================================================
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: role="status" + sr-only text  =  "TELL BLIND VISITORS IT IS LOADING"
//   Screen readers announce "Loading your payments..."; the eye never sees it.
//
// PIECE 2: animate-pulse  =  "THE GENTLE BLINK"
//   Every grey box fades in and out so people know something is happening.
//
// PIECE 3: the title and balance boxes  =  "WHERE THE HEADING AND BALANCE WILL BE"
//   A grey bar for "Payments" and a bigger grey box where the wallet balance
//   card will appear.
//
// PIECE 4: one day card with four rows  =  "WHERE THE PASSBOOK WILL BE"
//   A date line on top, then four rows (two text lines on the left, an amount
//   on the right), shaped like real entries so nothing jumps when they arrive.
// =============================================================================
export default function PaymentsLoading() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse space-y-6">
      <span className="sr-only">Loading your payments...</span>

      {/* Title placeholder */}
      <div className="h-8 w-36 rounded bg-gray-200" />

      {/* Balance card placeholder */}
      <div className="h-24 rounded-2xl bg-gray-200" />

      {/* One day card: a header line and four entry rows */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="h-5 w-44 rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex justify-between">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-3 w-32 rounded bg-gray-200" />
              </div>
              <div className="h-4 w-20 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// =============================================================================
// FILE: apps/web/src/app/(authed)/orders/loading.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - While the Orders page waits for the API, Next.js shows this file instead
//   of a blank white screen. It is a grey outline of the page-to-come
//
// WHY IMPORTANT:
// - A blank screen looks broken. A skeleton tells the owner "your orders are
//   on the way"
//
// DANGER (if this file does not exist):
// - Slow connections show white nothing, and owners tap again and again
//
// WHAT IT SOLVES:
// - A calm placeholder with the same shape as the real list
//
// SYSTEM DESIGN PRINCIPLE: Same shape, no data
// - It fetches nothing and knows nothing about any shop. Pure drawing
//
// RULES:
// - Keep role="status" and the screen-reader text, so people using a screen
//   reader are told the page is loading
// - Keep the shape close to the real page (title, then rows)
// - No 'use client', no fetching
//
// PRACTICAL EXAMPLE:
// - On a slow phone connection the owner sees pulsing grey rows for a second,
//   then the real orders replace them
//
// WHERE USED:
// - Next.js picks this up by itself for /orders. page.js needs no loading code
//
// TRADEOFFS:
// + Tiny and reusable
// - Only a guess at the final shape (six rows)
//
// HOW TO USE:
// - Nothing to call. Next.js shows it while page.js waits
// =============================================================================

export default function OrdersLoading() {
  return (
    // animate-pulse makes every grey box fade in and out gently
    <div role="status" aria-busy="true" className="animate-pulse space-y-6">
      {/* Read aloud by screen readers, invisible to the eye */}
      <span className="sr-only">Loading your orders...</span>

      {/* Title placeholder */}
      <div className="h-8 w-28 rounded bg-gray-200" />

      {/* Six order-row placeholders: a name, a details line and a stage tag */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-3 w-52 rounded bg-gray-200" />
            </div>
            <div className="h-6 w-16 rounded-full bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// role="status"        : tells assistive tools "this area reports progress"
// aria-busy="true"     : "content here is still loading"
// animate-pulse        : the gentle fade in and out of the grey boxes
// sr-only span         : text only screen readers read: "Loading your orders..."
// Array.from({length:6}): draws six identical placeholder rows. Real life: six
//                        empty clipboard slots waiting for order slips
// h-4 w-40 rounded bg-gray-200 : one grey bar, the shape of a line of text
// =============================================================================
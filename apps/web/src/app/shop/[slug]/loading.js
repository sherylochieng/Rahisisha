// =============================================================================
// FILE: apps/web/src/app/shop/[slug]/loading.js  (Week 29 Weekend, stability)
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - While the public shop page waits for the API, Next.js shows this file
//   instead of a blank white screen. It is a grey outline of the shop page
//
// WHY IMPORTANT:
// - This is the page your CUSTOMERS see, usually on a phone with a slow
//   connection. A blank screen looks broken, and a customer who thinks a shop
//   is broken leaves and buys somewhere else
//
// DANGER (if this file does not exist):
// - Slow connections show white nothing for a few seconds
// - The owner's own pages had a skeleton, but the page customers see did not
//
// WHAT IT SOLVES:
// - A calm placeholder with the same shape as the real shop page: the navy
//   name board on top, then a grid of product tiles
//
// SYSTEM DESIGN PRINCIPLE: Same shape, no data
// - It fetches nothing and knows nothing about any shop (not even the name).
//   Pure drawing. It cannot show the wrong shop's name to anyone
//
// RULES:
// - Keep role="status" and the screen-reader text, so people using a screen
//   reader are told the page is loading
// - Keep the shape close to page.js (same header colour, same grid columns),
//   so the page does not jump when the real content arrives
// - No 'use client', no fetching, no shop name
//
// PRACTICAL EXAMPLE:
// - A customer opens a shop link from WhatsApp on a weak connection. They see
//   a navy band and pulsing grey tiles for a second, then the real shop
//
// WHERE USED:
// - Next.js picks this up by itself for /shop/<slug>. page.js needs no loading
//   code. It was added in the Week 29 Weekend stability pass (no new feature)
//
// TRADEOFFS:
// + Tiny, and the page keeps its shape while loading
// - Only a guess at the final shape (eight tiles)
//
// HOW TO USE:
// - Nothing to call. Next.js shows it while page.js waits for the API
// =============================================================================

export default function ShopLoading() {
  return (
    // Same outer frame as page.js: full height, light grey background
    <div
      role="status"
      aria-busy="true"
      className="min-h-screen bg-gray-50 flex flex-col"
    >
      {/* Read aloud by screen readers, invisible to the eye */}
      <span className="sr-only">Loading the shop...</span>

      {/* The navy name board, with grey bars where the name will appear */}
      <div className="bg-brand-navy">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10 animate-pulse">
          <div className="h-8 w-56 rounded bg-white/20" />
          <div className="mt-3 h-4 w-44 rounded bg-white/10" />
        </div>
      </div>

      {/* The shelves: same grid columns as page.js (2, 3, then 4 across) */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              {/* The picture tile */}
              <div className="h-28 bg-gray-200 sm:h-32" />
              {/* Name and price bars */}
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-1/3 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// role="status"        : tells assistive tools "this area reports progress"
// aria-busy="true"     : "content here is still loading"
// sr-only span         : text only screen readers read: "Loading the shop..."
// bg-brand-navy band   : the same navy name board as the real page. Real life:
//                        the shop sign is already up while the shelves are
//                        being stocked behind it
// bg-white/20          : white at 20% strength, so the grey bars show on navy
// animate-pulse        : the gentle fade in and out of the grey boxes
// grid-cols-2 sm:3 lg:4: the same columns as page.js, so nothing jumps
// Array.from({length:8}): draws eight identical tiles. Real life: eight empty
//                        shelf slots waiting to be filled
// No shop name         : this file never knows which shop it is. The real name
//                        appears only when page.js has the data
// =============================================================================
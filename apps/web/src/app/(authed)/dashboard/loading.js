// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/(authed)/dashboard/loading.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The dashboard page asks the API for data (orders today,
//   balance, latest products). That takes a moment. Next.js
//   shows THIS file automatically during that moment, instead
//   of a blank white page.
//
// WHY IMPORTANT
//   The dashboard is the first screen after login. A blank
//   screen for a second or two feels broken. A grey "skeleton"
//   shape shows the page is on its way.
//
// DANGER (what breaks without it)
//   - A white screen while data loads, so users think the app
//     froze and refresh or leave.
//   - On a slow Kenyan mobile connection, that blank time can
//     be several seconds.
//
// WHAT IT SOLVES
//   A loading state for the dashboard with no extra code in
//   page.js. We never write "if (loading)" ourselves. Next.js
//   does the switching.
//
// SYSTEM DESIGN PRINCIPLE
//   "Show the shape of the page before the data arrives" (a
//   skeleton screen). It feels faster than a spinner because
//   the layout does not jump when the real content appears.
//   Also: convention over configuration. Next.js knows the
//   file name loading.js and uses it by itself.
//
// RULES (never do this)
//   1. NEVER rename this file. It must be loading.js, in the
//      same folder as page.js, or Next.js ignores it.
//   2. NEVER fetch data in here. It must render instantly.
//   3. NEVER make the skeleton a different size from the real
//      page. If it is, the page jumps when the data arrives.
//   4. NEVER add new features. This is polish only.
//
// PRACTICAL EXAMPLE
//   Mama Njeri logs in on a slow connection. For 2 seconds she
//   sees three grey pulsing boxes where the numbers will be,
//   then the real dashboard replaces them.
//
// DECISIONS
//   - Plain grey boxes with Tailwind's animate-pulse (a gentle
//     fade in and out). No library needed.
//   - Three blocks: two small stat cards and one larger list,
//     matching the dashboard's three pieces of data.
//   - aria-busy and role="status" with hidden text, so screen
//     reader users also hear that it is loading.
//   - No 'use client': it has no state, so it stays a server
//     component and renders immediately.
//
// WHERE YOU WILL USE THIS
//   - Only for /dashboard. Other pages can get their own
//     loading.js later by copying this idea.
//
// TRADEOFFS
//   + Zero logic, zero risk.
//   - The sizes are a guess. If the real dashboard layout
//     changes, update the skeleton to match.
//
// HOW TO USE
//   Nothing to import. Just keep the file next to page.js.
//   To SEE it: in dev, open /dashboard on a throttled network
//   (browser DevTools > Network > Slow 4G).
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. loading.js  =  THE "OPENING SOON" PAPER ON A NEW SHOP WINDOW
//    People see something friendly while the real shop is set up.
//    WHERE: next to page.js. WHEN: page.js fetches data.
//
// 2. animate-pulse  =  A BREATHING LIGHT
//    Boxes fade softly in and out, which says "working on it".
//
// 3. bg-gray-200 rounded h-24  =  A GREY PLACEHOLDER BOX
//    Like a cardboard cut-out of where the real item will stand.
//
// 4. grid grid-cols-2 gap-4  =  TWO SMALL BOXES SIDE BY SIDE
//    Matches the two stat cards (orders today, balance).
//
// 5. role="status" + aria-busy="true"
//    =  ANNOUNCING "LOADING" TO SCREEN READERS
//    The <span className="sr-only"> text is invisible on screen
//    but spoken aloud by screen readers.
// ═══════════════════════════════════════════════════════════

export default function DashboardLoading() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse space-y-4 p-4">
      {/* Invisible to the eye, read aloud by screen readers */}
      <span className="sr-only">Loading your dashboard...</span>

      {/* Title placeholder */}
      <div className="h-8 w-48 rounded bg-gray-200" />

      {/* Two small stat boxes: orders today and balance */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded bg-gray-200" />
        <div className="h-24 rounded bg-gray-200" />
      </div>

      {/* One larger box: latest products list */}
      <div className="h-48 rounded bg-gray-200" />
    </div>
  );
}
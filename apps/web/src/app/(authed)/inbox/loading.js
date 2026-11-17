// =============================================================================
// FILE: apps/web/src/app/(authed)/inbox/loading.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   inbox/page.js waits for the API. Next.js shows THIS file during the wait,
//   instead of a blank white screen. No "if (loading)" code is needed anywhere.
//
// WHY IMPORTANT
//   On a slow mobile connection the wait can be several seconds. A grey outline
//   of the list shows the page is coming, and the layout does not jump when
//   the real rows arrive.
//
// DANGER
//   - Keep the shape close to the real page (title + rows), or the page jumps.
//   - role="status" + the sr-only text tell screen readers "loading". Without
//     them a blind user hears nothing.
//
// WHAT IT SOLVES
//   The loading state for /inbox (the assignment's "every page has a loading state").
//
// SYSTEM DESIGN PRINCIPLE
//   Skeleton screens: show the SHAPE of the page before the data arrives.
//
// RULES
//   Pure markup. No fetching, no state.
//
// PRACTICAL EXAMPLE
//   Amina taps Inbox on a slow network: she sees a title bar and six grey rows
//   pulsing, then the real messages replace them.
//
// TRADEOFFS
//   + Zero logic. - Not tied to the real row height exactly (close enough).
// =============================================================================
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: role="status" + sr-only text  =  "TELL BLIND VISITORS IT IS LOADING"
//   Screen readers announce "Loading your inbox..."; the eye never sees it.
//
// PIECE 2: animate-pulse  =  "THE GENTLE BLINK"
//   Every grey box fades in and out so people know something is happening.
//
// PIECE 3: the title bar  =  "WHERE THE HEADING WILL BE"
//   A grey bar the size of the "Inbox" heading.
//
// PIECE 4: six placeholder rows  =  "WHERE THE MESSAGES WILL BE"
//   A small badge shape and two text lines, matching a real row, so nothing
//   jumps when the real rows arrive. Real life: empty chairs set out before the
//   guests come.
// =============================================================================
export default function InboxLoading() {
  return (
    // animate-pulse makes every grey box fade in and out gently
    <div role="status" aria-busy="true" className="animate-pulse space-y-6">
      {/* Read aloud by screen readers, invisible to the eye */}
      <span className="sr-only">Loading your inbox...</span>

      {/* Title placeholder */}
      <div className="h-8 w-32 rounded bg-gray-200" />

      {/* Six message-row placeholders: a badge circle + two text lines */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 flex items-start gap-3">
            <div className="h-6 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-4 w-3/4 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
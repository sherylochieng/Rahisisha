'use client';
// Client Component: it logs the error in the browser and has a click button

// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/PageError.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   When a whole page fails to load, we show a calm message and
//   a "Try again" button. This component is that message, written
//   ONCE. The error.js files in different folders just use it.
//
// WHY IMPORTANT
//   Without one shared piece, every folder gets its own copy of
//   the text and the styling. They drift apart, and a wording fix
//   means hunting through many files.
//
// DANGER (what breaks without it)
//   - Three error pages with three different sentences.
//   - A copy shows error.message, which can leak technical or
//     private details.
//   - A "Try again" that does not fetch the data again, so the
//     user clicks and nothing seems to happen.
//
// WHAT IT SOLVES
//   One component for "this page could not load", with two looks:
//   a card inside the layout, or a full dark screen. Its button
//   really retries, and shows that it is working.
//
// SYSTEM DESIGN PRINCIPLE
//   "Single source of truth" (DRY) plus "thin boundaries".
//   The look and wording live here. The error.js files only decide
//   WHERE the message appears and pass in what Next.js gives them.
//   Also: "feedback for every action". The button says
//   "Trying again..." and locks itself while it works.
//
// RULES (never do this)
//   1. NEVER show error.message to the user. Log it for us only.
//   2. NEVER remove role="alert". Screen readers need it.
//   3. NEVER put page-specific logic in here. It must work for
//      every page.
//   4. NEVER call reset() alone for pages that fetch on the
//      server. Refresh first (see retry below).
//
// PRACTICAL EXAMPLE
//   (authed)/error.js:
//     <PageError error={error} reset={reset} />
//   app/error.js (public pages):
//     <PageError error={error} reset={reset} fullScreen />
//
// DECISIONS
//   - Props: error, reset (both from Next.js), fullScreen,
//     title and message (optional, to override the wording).
//   - retry = router.refresh() + reset() inside startTransition.
//     refresh() asks the server for fresh data. reset() asks
//     Next.js to draw the page again. Together they really retry.
//   - The default wording matches the API's 503 sentence.
//
// ───────────────────────────────────────────────────────────
// THE STORY: BEFORE AND AFTER (this file's second version)
// ───────────────────────────────────────────────────────────
//   BEFORE (first version)
//     - The button called reset() directly.
//     - On a page that fetches on the server, that re-draws the
//       page but may not fetch the data again, so the user could
//       click and see no change.
//     - No feedback while retrying.
//
//   WHY WE CHANGED IT
//     While testing, "Try again" looked dead. Part of that was the
//     red dev overlay and a test line that threw every time, but
//     part was real: reset() alone is not the recommended pattern
//     for server-fetched pages.
//
//   AFTER
//     - retry() = router.refresh() then reset(), inside
//       startTransition.
//     - The button shows "Trying again..." and is disabled while
//       the retry runs (pending).
// ───────────────────────────────────────────────────────────
//
// WHERE YOU WILL USE THIS
//   - (authed)/error.js and app/error.js
//   - Any future folder that needs its own error boundary
//
// TRADEOFFS
//   + One place for wording, look and retry logic.
//   - One generic message for every kind of failure.
//
// HOW TO USE
//   import PageError from '../../components/PageError';
//   export default function Error({ error, reset }) {
//     return <PageError error={error} reset={reset} />;
//   }
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. error  =  THE REPORT FROM THE BROKEN ROOM
//    Next.js gives it to us. It is for OUR logbook, not the user.
//
// 2. reset  =  "DRAW THE PAGE AGAIN"
//    Like re-opening the shop door. But if the shelves are empty
//    (no data), opening the door alone does not restock them.
//
// 3. router.refresh()  =  "RESTOCK THE SHELVES"
//    Asks the server for fresh data for this page.
//
// 4. startTransition + pending  =  THE "BUSY" LIGHT
//    pending is true while the retry is running. We use it to
//    disable the button and change its words.
//
// 5. useEffect(() => console.error(error))
//    =  WRITING IN THE LOGBOOK
//    Runs once when the message appears. The user never sees it.
//
// 6. fullScreen  =  WHICH ROOM THE SIGN HANGS IN
//    false = a card inside the page (the sidebar stays).
//    true  = the whole screen, dark navy, like the 404 page.
//
// 7. role="alert"  =  THE BELL FOR SCREEN READERS
//    The message is read aloud the moment it appears.
// ═══════════════════════════════════════════════════════════

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// Standard wording. Matches the API's 503 sentence.
const DEFAULT_TITLE   = "We're having trouble right now";
const DEFAULT_MESSAGE = 'Please try again in a moment. Your data is safe.';

export default function PageError({
  error,
  reset,
  fullScreen = false,
  title   = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
}) {
  const router = useRouter();

  // pending is true while the retry is running
  const [pending, startTransition] = useTransition();

  // Write the real problem to the browser console, for us only.
  // The user only sees the friendly message below.
  useEffect(() => {
    console.error(error);
  }, [error]);

  // ✅ AFTER: really retry.
  // refresh() fetches fresh server data, reset() draws the page again.
  // ❌ BEFORE: onClick={reset} only. It re-drew the page without
  //            fetching the data again.
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  // The message card (same markup for both looks)
  const card = (
    <div
      role="alert"
      className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-lg mx-auto"
    >
      <h1 className="font-display text-xl font-bold text-brand-navy">
        {title}
      </h1>

      <p className="mt-2 text-sm text-gray-500">{message}</p>

      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="mt-6 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors"
      >
        {pending ? 'Trying again...' : 'Try again'}
      </button>
    </div>
  );

  // Look 1: a card inside the layout (the sidebar stays)
  if (!fullScreen) return card;

  // Look 2: the whole screen, dark navy like login and 404
  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4">
      {card}
    </div>
  );
}
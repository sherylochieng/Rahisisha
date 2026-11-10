'use client';
// Next.js requires error pages to be Client Components

// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/(authed)/error.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   It tells Next.js: "if any page inside the logged-in area
//   fails to load, show the shared error message HERE". It is
//   the error boundary for the whole (authed) area.
//
// WHY IMPORTANT
//   It catches the failure in ONE page and keeps the layout
//   (sidebar, navigation) working. The owner can still click
//   around instead of seeing a dead screen.
//
// DANGER (what breaks without it)
//   - A bare "Application error" page with no way forward.
//   - The sidebar disappears, because the error would bubble
//     up to a higher boundary that has no sidebar.
//
// WHAT IT SOLVES
//   Covers the dashboard AND every future logged-in page
//   (products, orders, settings) with no extra files.
//
// SYSTEM DESIGN PRINCIPLE
//   "Thin boundary, shared content." This file only decides
//   WHERE the error shows (inside (authed), under the layout).
//   WHAT it looks like lives in components/PageError.js.
//
// RULES (never do this)
//   1. NEVER copy the message or styling into this file. Change
//      PageError instead.
//   2. NEVER remove 'use client'. Next.js requires it.
//   3. NEVER rename this file. Next.js finds it by the name
//      error.js.
//   4. NEVER show error.message to the user (PageError already
//      protects against this).
//
// PRACTICAL EXAMPLE
//   Orders page (added next month) fails to load. No new error
//   file is needed. This one catches it, the sidebar stays, and
//   the owner taps "Try again".
//
// WHERE YOU WILL USE THIS
//   Automatic for every page under (authed).
//
// TRADEOFFS
//   + Five lines, covers many pages.
//   - One look for every failure in this area.
//
// HOW TO USE
//   Nothing to import. Keep the file named error.js.
//
// ───────────────────────────────────────────────────────────
// THE STORY: BEFORE AND AFTER (Week 28 Weekend, Task 3)
// ───────────────────────────────────────────────────────────
//   BEFORE (first version, an hour earlier)
//     - This file held the whole message: the title, the text,
//       the button, the styling and the console logging.
//
//   WHY WE CHANGED IT
//     A public page (login, signup) also needs an error page,
//     and it would have meant copying all of that into a second
//     file. We asked: where is the best place for it? Answer:
//     a shared component, plus thin boundary files.
//
//   AFTER
//     - components/PageError.js holds the look and the wording.
//     - This file just hands over what Next.js gave it.
//     - app/error.js (next step) does the same for public pages
//       with the fullScreen look.
// ───────────────────────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
//
// 1. { error, reset }  =  WHAT NEXT.JS HANDS US
//    error = what went wrong. reset = the "try again" switch.
//
// 2. <PageError error={error} reset={reset} />
//    =  HANGING THE STANDARD SIGN
//    No fullScreen, so it appears as a card inside the layout.
// ═══════════════════════════════════════════════════════════

import PageError from '../../components/PageError';
// PageError: the shared error message (look + wording + logging)

export default function AuthedError({ error, reset }) {
  return <PageError error={error} reset={reset} />;
}
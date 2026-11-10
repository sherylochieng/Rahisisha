'use client';
// Next.js requires error pages to be Client Components
// (this line MUST be the first line of the file)

// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/error.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   It tells Next.js: "if a PUBLIC page (home, login, signup)
//   fails to load, show the shared error message". It is the
//   error boundary for everything outside the logged-in area.
//
// WHY IMPORTANT
//   Public pages are the first thing a new visitor sees. A crash
//   there with no explanation loses them for good.
//
// DANGER (what breaks without it)
//   - A bare "Application error" screen on login or signup.
//   - Without 'use client' on line 1 the app does not even
//     compile. We hit exactly this error.
//
// WHAT IT SOLVES
//   A friendly full-screen message with a "Try again" button for
//   the public pages.
//
// SYSTEM DESIGN PRINCIPLE
//   "Thin boundary, shared content." This file only decides
//   WHERE the error shows. The look and wording live in
//   components/PageError.js, the same one the (authed) area uses.
//
// RULES (never do this)
//   1. NEVER remove 'use client' from line 1. Next.js requires it.
//   2. NEVER copy the message or styling into this file. Change
//      PageError instead.
//   3. NEVER rename this file. Next.js finds it by the name
//      error.js.
//   4. NEVER show error.message to the user.
//
// PRACTICAL EXAMPLE
//   The login page crashes on a visitor's old phone. They see the
//   dark navy screen with "We're having trouble right now" and a
//   "Try again" button, instead of a blank page.
//
// DECISIONS
//   - fullScreen is ON: public pages have no sidebar, so the
//     message fills the screen like the 404 page.
//   - The (authed) folder has its own error.js. Next.js uses the
//     NEAREST one, so logged-in pages keep their sidebar.
//
// WHERE YOU WILL USE THIS
//   Automatic for pages outside (authed).
//
// TRADEOFFS
//   + Five lines, one consistent look.
//   - Does not catch errors in the root layout itself. That needs
//     a global-error.js, which we do not need yet.
//
// HOW TO USE
//   Nothing to import. Keep the file named error.js.
//
// ───────────────────────────────────────────────────────────
// THE STORY: BEFORE AND AFTER (Week 28 Weekend, Task 3)
// ───────────────────────────────────────────────────────────
//   BEFORE
//     - This file existed without 'use client', so the web app
//       failed to compile with: "error.js must be a Client
//       Component".
//
//   AFTER
//     - 'use client' is the first line.
//     - It uses the shared PageError with the fullScreen look.
// ───────────────────────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
//
// 1. 'use client'  =  "THIS PAGE RUNS IN THE BROWSER"
//    The Try again button needs a click handler, which only
//    works in the browser. Next.js enforces it for error pages.
//
// 2. { error, reset }  =  WHAT NEXT.JS HANDS US
//    error = what went wrong. reset = the "try again" switch.
//
// 3. fullScreen  =  THE SIGN HANGS IN THE WHOLE ROOM
//    Dark navy background, same family as login and 404.
// ═══════════════════════════════════════════════════════════

import PageError from '../components/PageError';
// PageError: the shared error message (look + wording + logging)

export default function AppError({ error, reset }) {
  return <PageError error={error} reset={reset} fullScreen />;
}
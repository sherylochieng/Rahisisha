// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/not-found.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   When someone opens an address that does not exist (a typo,
//   an old link), Next.js shows THIS page instead of its plain
//   built-in "404" screen.
//
// WHY IMPORTANT
//   A dead end feels like the app is broken. A friendly page
//   with a clear way back keeps people in the product.
//
// DANGER (what breaks without it)
//   - Visitors see the default grey Next.js 404, with no brand
//     and no way back, and they leave.
//
// WHAT IT SOLVES
//   A branded 404 that says plainly what happened and offers two
//   useful next steps: the home page, or log in.
//
// SYSTEM DESIGN PRINCIPLE
//   "Design for every state", including "this does not exist".
//   Errors should never be dead ends.
//
// RULES (never do this)
//   1. NEVER leave a dead end. Always offer a way back.
//   2. NEVER blame the user ("You typed the wrong address").
//   3. NEVER show technical details (paths, stack traces).
//   4. NEVER use <a href> for internal pages. Use <Link>.
//   5. NEVER add a 'use client' directive here. It needs no state.
//
// PRACTICAL EXAMPLE
//   A customer opens rahisisha.co.ke/dashbord (a typo). They see
//   the big orange 404, "Page not found", and a button back home.
//
// WHERE YOU WILL USE THIS
//   Next.js uses it automatically for every unknown address.
//
// TRADEOFFS
//   + Simple, on-brand, no logic.
//   - The same page shows for logged-in and logged-out visitors.
//     Both get the home link and the login link.
//
// HOW TO USE
//   Nothing to import. Next.js finds the file by its name.
//
// ───────────────────────────────────────────────────────────
// THE STORY: BEFORE AND AFTER (Week 28 Weekend, Task 3)
// ───────────────────────────────────────────────────────────
//   BEFORE
//     - The page worked and looked right.
//     - The bottom part (button and "or log in") was not indented
//       like the rest, and "Call to action" was written twice.
//       It worked, but it was hard to read and easy to break.
//
//   WHY WE CHANGED IT
//     The weekend assignment lists not-found among the pages to
//     polish. This page needed no new behaviour, only tidying.
//
//   AFTER
//     - Same design, same words, same links.
//     - Clean indentation, one comment per block, full header.
// ═══════════════════════════════════════════════════════════

import Link from 'next/link';
// Link — internal navigation, no full page reload

export default function NotFound() {
  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-4">
      {/* Full screen — same dark navy as the login page, consistent brand feel */}

      <div className="text-center text-white max-w-md">

        {/* Logo mark */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <span className="text-orange-500 font-bold text-lg">R</span>
          </div>
          <span className="font-bold text-lg">Rahisisha Biashara</span>
        </div>

        {/* Big 404 */}
        <h1 className="text-8xl font-bold text-orange-500 mb-4">404</h1>
        {/* text-8xl — very large, makes it immediately clear what happened */}
        {/* text-orange-500 — brand orange, not a scary red */}

        {/* Human-friendly message */}
        <h2 className="text-2xl font-semibold mb-3">
          Page not found
        </h2>
        <p className="text-blue-300 text-sm mb-8">
          The page you are looking for does not exist or has been moved.
          Let us take you back to safety.
        </p>
        {/* text-blue-300 — softer than white, easy to read on a dark background */}

        {/* Call to action — takes the visitor somewhere useful */}
        <Link
          href="/"
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
        >
          Go to home page
        </Link>

        {/* Secondary option */}
        <p className="text-blue-300 text-sm mt-4">
          or{' '}
          <Link href="/login" className="text-white hover:underline font-medium">
            log in to your account
          </Link>
        </p>

      </div>
    </div>
  );
}
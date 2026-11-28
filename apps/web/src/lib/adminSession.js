// =============================================================================
// FILE: apps/web/src/lib/adminSession.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   One tiny rule, written once: "if the API says 401 (signed out), go to the
//   sign-in page." Every admin screen needs it.
//
// WHY IMPORTANT
//   The admin's cookie can expire while a page is open. Without this rule, the page
//   would show a confusing error. With it, the admin is simply taken to sign in.
//
// DANGER
//   Only 401 means "signed out". Do not treat a network error or a 500 as signed out,
//   or one bad moment of signal would throw the admin out.
//
// WHAT IT SOLVES
//   The same if-statement copied into every admin screen (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   DRY: one rule, one place. Fix it here and every screen follows.
//
// RULES
//   1. Returns true when it handled the error (it redirected). The caller then stops.
//   2. Returns false for everything else. The caller shows its own message.
//
// PRACTICAL EXAMPLE
//   Sheryl leaves the shops page open overnight. Next morning she clicks "Load more":
//   the API answers 401 and she lands on the sign-in page.
//
// DECISIONS
//   - Takes the router as a parameter, so this file stays a plain function (no hooks).
//
// WHERE USED
//   AdminShell.js and ShopsBrowser.js, and every admin screen after them.
//
// TRADEOFFS
//   + Tiny and obvious.
//
// HOW TO USE
//   catch (err) { if (redirectIfSignedOut(err, router)) return; showMessage(err.message); }
// =============================================================================

export function redirectIfSignedOut(err, router) {
  // Only a 401 means "not signed in (any more)".
  if (err && err.status === 401) {
    router.replace('/admin/login');
    return true;
  }
  return false;
}

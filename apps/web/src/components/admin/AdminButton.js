// =============================================================================
// FILE: apps/web/src/components/admin/AdminButton.js   (Week 30 Day 3, Batch 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The main orange button of the admin panel: orange background, NAVY text, and a
//   "loading" state that locks it.
//
// WHY IMPORTANT
//   Every admin page needs this button (sign in, retry, save, confirm). Written once,
//   one change restyles them all. Navy text on orange is readable. White on orange is not.
//
// DANGER
//   - Do not use it for destructive actions (Suspend). Those need their own, more
//     careful look and a confirmation step, so nobody clicks them by habit.
//
// WHAT IT SOLVES
//   Repeated button markup and an inconsistent loading state (DRY).
//
// SYSTEM DESIGN PRINCIPLE
//   DRY, and design for every state: normal, loading, disabled.
//
// RULES
//   1. Set loading while a call is running, so a double click cannot send it twice.
//   2. type is 'button' by default. Use type="submit" inside a form.
//   3. full makes it as wide as its box (forms).
//
// PRACTICAL EXAMPLE
//   <AdminButton type="submit" full loading={loading} loadingText="Signing in...">Sign in</AdminButton>
//
// DECISIONS
//   - A boolean "full" instead of passing width classes, because Tailwind classes that
//     fight each other (w-full vs none) are decided by the stylesheet, not by order.
//
// WHERE USED
//   AdminLoginForm.js and AdminShell.js, and the shop pages next.
//
// TRADEOFFS
//   + One look, one behaviour.
//
// HOW TO USE
//   See the practical example above.
// =============================================================================

export default function AdminButton({
  type = 'button',
  loading = false,
  loadingText = 'Please wait...',
  full = false,
  onClick,
  children,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      className={`${full ? 'w-full' : ''} rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-orange-dark disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {loading ? loadingText : children}
    </button>
  );
}

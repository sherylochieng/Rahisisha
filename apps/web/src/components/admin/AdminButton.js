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
//   - Do not use the default (orange) look for destructive actions (Suspend). Use
//     variant="danger" and ONLY inside a confirmation step, so nobody clicks it by habit.
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
//   4. variant picks the look: 'primary' (orange, default), 'danger' (red, for destructive
//      confirmations) or 'quiet' (white with a navy border, for Cancel and small actions).
//
// PRACTICAL EXAMPLE
//   <AdminButton type="submit" full loading={loading} loadingText="Signing in...">Sign in</AdminButton>
//
// DECISIONS
//   - A boolean "full" instead of passing width classes, because Tailwind classes that
//     fight each other (w-full vs none) are decided by the stylesheet, not by order.
//   - A named variant instead of passing colour classes, for the same reason, and so the
//     whole panel only ever has three button looks.
//
// WHERE USED
//   AdminLoginForm.js, AdminShell.js, the shops pages, ShopActions.js and ReasonDialog.js.
//
// TRADEOFFS
//   + One look, one behaviour.
//
// HOW TO USE
//   See the practical example above.
// =============================================================================

// The three looks. Navy text on orange (never white on orange: it is hard to read).
const VARIANTS = {
  primary: 'bg-brand-orange text-brand-navy hover:bg-brand-orange-dark',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  quiet: 'border border-brand-navy bg-white text-brand-navy hover:bg-slate-100',
};

export default function AdminButton({
  type = 'button',
  variant = 'primary',
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
      className={`${full ? 'w-full' : ''} ${VARIANTS[variant] || VARIANTS.primary} rounded-lg px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {loading ? loadingText : children}
    </button>
  );
}

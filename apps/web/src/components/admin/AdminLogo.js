// =============================================================================
// FILE: apps/web/src/components/admin/AdminLogo.js   (Week 30 Day 3, Batch 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The small orange "R" square that marks the admin panel, drawn in ONE place.
//
// WHY IMPORTANT
//   The sign-in card and the side menu both show it. If you change the look (colour,
//   shape, a real logo later), you change this one file and both places follow.
//
// DANGER
//   None. It is only a picture.
//
// WHAT IT SOLVES
//   Repeated markup (DRY): one logo, used everywhere.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and small reusable components.
//
// RULES
//   1. Colours come from the brand tokens (brand-orange, brand-navy), never hex codes.
//   2. size is 'md' (default) or 'lg'.
//
// PRACTICAL EXAMPLE
//   Like the same stamp on every receipt of a shop: change the stamp once.
//
// DECISIONS
//   - A plain "R" for now. A real logo image can replace it later in this file only.
//
// WHERE USED
//   AdminLoginForm.js and AdminShell.js.
//
// TRADEOFFS
//   + One place to change.
//
// HOW TO USE
//   <AdminLogo />   or   <AdminLogo size="lg" />
// =============================================================================

export default function AdminLogo({ size = 'md' }) {
  // The two sizes: md for the side menu, lg for the sign-in card.
  const box = size === 'lg' ? 'h-10 w-10 text-base' : 'h-9 w-9 text-sm';

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center rounded-lg bg-brand-orange font-bold text-brand-navy ${box}`}
    >
      R
    </div>
  );
}

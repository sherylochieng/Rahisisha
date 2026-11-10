// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/components/EmptyState.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A brand new shop has no products and no orders. An empty
//   list looks like a bug. This component shows a friendly box
//   that says what is missing and what to do next.
//
// WHY IMPORTANT
//   A new owner's first look at the app is mostly EMPTY screens.
//   If they look broken, the owner thinks the app is broken.
//
// DANGER (what breaks without it)
//   - A blank white area where a list should be. The user
//     wonders: did it fail to load, or is there just nothing?
//   - Owners leave on day one without adding their first product.
//
// WHAT IT SOLVES
//   One reusable "nothing here yet" box, with a title, a short
//   explanation and an optional hint on what to do.
//
// SYSTEM DESIGN PRINCIPLE
//   "Design for every state": loading, empty, error and success.
//   Most apps only design the success state. An empty state is
//   the real first impression of every new customer.
//
// RULES (never do this)
//   1. NEVER use this for ERRORS. Empty means "loaded fine, no
//      data". An error needs <FormError> or an error message.
//   2. NEVER leave the hint vague. Say what to do: "Add your
//      first product", not "Nothing to show".
//   3. NEVER add a button here that does a NEW feature. Task 3
//      is polish only. Text hints are fine.
//   4. NEVER use it while still loading. Use the loading state,
//      or users will briefly see "empty" before the data arrives.
//
// PRACTICAL EXAMPLE
//   A new shop opens the dashboard. Latest products is empty:
//     <EmptyState
//       title="No products yet"
//       message="Products you add will show up here."
//     />
//
// DECISIONS
//   - Props: title (bold line), message (smaller line),
//     className (extra spacing).
//   - Dashed border: a visual hint of "an empty slot waiting
//     to be filled".
//   - role="status": screen readers can announce it politely,
//     without shouting like an error.
//   - No 'use client': no state or clicks.
//
// WHERE YOU WILL USE THIS
//   - Dashboard: latest products, when there are none
//   - Later: orders list, customers list
//
// TRADEOFFS
//   + Simple and consistent.
//   - Text only. A future version could take an icon or a link.
//
// HOW TO USE
//   import EmptyState from '../../../components/EmptyState';
//   {products.length === 0 && (
//     <EmptyState title="No products yet" message="..." />
//   )}
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. title  =  THE SIGN ON THE EMPTY SHELF
//    "No products yet" says plainly what is missing.
//
// 2. message  =  THE SMALL PRINT UNDER THE SIGN
//    "Products you add will show up here." tells the user it is
//    normal, and what will fill the space.
//
// 3. border-dashed  =  AN OUTLINE FOR A SPOT TO BE FILLED
//    Like chalk lines on a shelf: something goes here.
//
// 4. text-center  =  CENTRED WORDS
//    Empty states look calmer in the middle of the box.
//
// 5. role="status"  =  A POLITE ANNOUNCEMENT
//    Unlike role="alert" (urgent, interrupts), "status" waits
//    for the reader to finish. Empty is not an emergency.
//
// 6. {message && <p>...</p>}  =  SHOW THIS ONLY IF IT EXISTS
//    If you give no message, the small line is simply left out.
// ═══════════════════════════════════════════════════════════

export default function EmptyState({ title, message, className = '' }) {
  return (
    <div
      role="status"
      className={`rounded border border-dashed border-gray-300 px-4 py-8 text-center ${className}`}
    >
      <p className="font-medium text-gray-700">{title}</p>

      {message && <p className="mt-1 text-sm text-gray-500">{message}</p>}
    </div>
  );
}
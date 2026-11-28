// =============================================================================
// FILE: apps/web/src/components/admin/VerifiedMark.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Shows "Verified" with a tick, or "Not verified", in one place.
//
// WHY IMPORTANT
//   Verified means "an admin checked this shop is real". The same mark must look the same
//   in the list and in the detail page.
//
// DANGER
//   - "Not verified" is shown in plain grey on purpose: it is not a punishment or a
//     warning, most new shops start that way.
//
// WHAT IT SOLVES
//   Repeated markup (DRY). The tick is a drawn icon, not an emoji.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY and accessibility: the word is always there, the tick is decoration only.
//
// RULES
//   1. The tick icon is hidden from screen readers (aria-hidden), the word is read.
//
// PRACTICAL EXAMPLE
//   <VerifiedMark verified={shop.verified} />
//
// DECISIONS
//   - Navy for Verified, grey for Not verified.
//
// WHERE USED
//   ShopsTable.js, and the shop detail page next.
//
// TRADEOFFS
//   + One place to change.
//
// HOW TO USE
//   <VerifiedMark verified={true} />
// =============================================================================

export default function VerifiedMark({ verified }) {
  if (!verified) {
    return <span className="text-sm text-slate-600">Not verified</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
      {/* A drawn tick, decoration only. */}
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-brand-orange" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5l4 4 8-9" />
      </svg>
      Verified
    </span>
  );
}

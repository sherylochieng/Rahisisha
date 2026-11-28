// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/page.js   (Week 30 Day 3, Batch 2, part 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The first admin page, /admin. For now it only proves the sign-in and the guard
//   work. The shops list replaces it in the next part.
//
// WHY IMPORTANT
//   A small, safe first landing spot lets us test the sign-in end to end before we
//   build the bigger pages on top.
//
// DANGER
//   None. It shows no data.
//
// WHAT IT SOLVES
//   A place to land after sign-in, so you can see the door works.
//
// SYSTEM DESIGN PRINCIPLE
//   Build in small, testable steps: door first, rooms after.
//
// RULES
//   1. Keep it data-free until the shop pages exist.
//
// PRACTICAL EXAMPLE
//   After signing in you see "You are signed in" with the menu on the left.
//
// DECISIONS
//   - A plain placeholder, not a fake dashboard with invented numbers.
//
// WHERE USED
//   Next.js serves it at /admin.
//
// TRADEOFFS
//   + Nothing to maintain.
//
// HOW TO USE
//   Open /admin after signing in.
// =============================================================================

import Link from 'next/link';

export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy">Overview</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        You are signed in. Open the shops list to find a shop. Suspend and verify arrive in the next step.
      </p>
      <Link href="/admin/shops" className="mt-4 inline-block text-sm font-semibold text-brand-navy underline underline-offset-4">
        Go to shops
      </Link>
    </div>
  );
}

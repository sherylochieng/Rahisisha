// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/page.js   (Week 30 Day 3, Batch 2, part 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The admin home page, /admin: the overview numbers (how many shops, how many are open,
//   closed or verified, how many joined this week) and a way into the shops list.
//
// WHY IMPORTANT
//   It is where every admin lands after signing in, so it must load fast and never look broken.
//
// DANGER
//   It shows counts only (via OverviewStats). Never put names or phone numbers on this page.
//
// WHAT IT SOLVES
//   A useful place to land after sign-in: the state of the platform at a glance.
//
// SYSTEM DESIGN PRINCIPLE
//   Build in small, testable steps: door first, rooms after.
//
// RULES
//   1. Numbers only. Anything about one shop belongs on that shop's page.
//
// PRACTICAL EXAMPLE
//   After signing in you see five number cards and a "Go to shops" link.
//
// DECISIONS
//   - Real numbers from the API, never invented ones. The page itself stays a thin server
//     page, and the browser component OverviewStats does the fetching.
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
import OverviewStats from '../../../components/admin/OverviewStats';

export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy">Overview</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        You are signed in. Here is how the platform is doing. Open the shops list to find a shop, or to suspend or verify one.
      </p>
      <div className="mt-6">
        <OverviewStats />
      </div>
      <Link href="/admin/shops" className="mt-4 inline-block text-sm font-semibold text-brand-navy underline underline-offset-4">
        Go to shops
      </Link>
    </div>
  );
}

// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/shops/page.js   (Week 30 Day 3, Batch 2, part 2)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The address /admin/shops. It only sets the tab title and shows the shops browser.
//
// WHY IMPORTANT
//   It sits inside the (panel) folder, so the guard and menu wrap it for free.
//
// DANGER
//   Do not fetch here. The admin cookie is not readable on the server, so the browser
//   component does the fetching.
//
// WHAT IT SOLVES
//   A guarded shops page with no extra code.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin page, fat component (same as the sign-in page).
//
// RULES
//   1. Keep it inside (panel).
//
// PRACTICAL EXAMPLE
//   Click "Shops" in the navy menu and land here.
//
// DECISIONS
//   - Title "Shops" (the layout's template adds the rest).
//
// WHERE USED
//   Next.js serves it at /admin/shops.
//
// TRADEOFFS
//   + Tiny.
//
// HOW TO USE
//   Nothing to call.
// =============================================================================

import ShopsBrowser from './ShopsBrowser';

export const metadata = { title: 'Shops' };

export default function AdminShopsPage() {
  return <ShopsBrowser />;
}

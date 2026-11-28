// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/shops/[id]/page.js   (Week 30 Day 3, Batch 2, part 3a)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The address /admin/shops/<shop id>. It checks the id looks real, sets the tab title and
//   shows the ShopDetail screen.
//
// WHY IMPORTANT
//   It sits inside (panel), so the sign-in guard and the navy menu wrap it for free.
//
// DANGER
//   - Do not fetch here. The admin cookie is not readable on the server.
//   - A made-up id (not a UUID) is turned away early with the normal "not found" page.
//
// WHAT IT SOLVES
//   A guarded detail page with a clean web address.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin page, fat component. Check cheap things early (the id's shape).
//
// RULES
//   1. params is awaited (Next.js 16 gives it as a promise).
//   2. Keep it inside (panel).
//
// PRACTICAL EXAMPLE
//   /admin/shops/5bc6d791-ad88-41ad-93c2-4663c1d0507f
//
// DECISIONS
//   - Same UUID check as your product edit page.
//
// WHERE USED
//   Next.js serves it. The shops table links here.
//
// TRADEOFFS
//   + Tiny.
//
// HOW TO USE
//   Nothing to call.
// =============================================================================

import { notFound } from 'next/navigation';
import ShopDetail from './ShopDetail';

export const metadata = { title: 'Shop' };

// A real shop id is a UUID. Anything else cannot be a shop.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminShopPage({ params }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  return <ShopDetail id={id} />;
}

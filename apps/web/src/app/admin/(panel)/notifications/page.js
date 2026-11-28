// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/notifications/page.js   (Week 30 Day 3, Batch 3b-2b, web step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The address /admin/notifications. It only sets the page title and shows the browser.
//
// WHY IMPORTANT
//   Keeps the page file tiny; the interactive work lives in NotificationsBrowser.js
//   (a client component), exactly like the Shops page.
//
// DANGER
//   The admin guard is the (panel) layout around this page (AdminShell). Do not move this
//   file outside the (panel) folder.
//
// WHAT IT SOLVES
//   "A page for the outbox inside the admin panel."
//
// SYSTEM DESIGN PRINCIPLE
//   Server page + client component split.
//
// RULES
//   1. No data fetching here.
//
// PRACTICAL EXAMPLE
//   Visit /admin/notifications while signed in as an admin.
//
// DECISIONS
//   Same shape as shops/page.js.
//
// WHERE USED
//   Next.js route /admin/notifications.
//
// TRADEOFFS
//   + Simple. - Nothing to customise here.
//
// HOW TO USE
//   Link to it from the admin menu (AdminShell.js).
// =============================================================================

import NotificationsBrowser from './NotificationsBrowser';

export const metadata = { title: 'Notifications' };

export default function AdminNotificationsPage() {
  return <NotificationsBrowser />;
}

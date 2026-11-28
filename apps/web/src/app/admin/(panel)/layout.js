// =============================================================================
// FILE: apps/web/src/app/admin/(panel)/layout.js   (Week 30 Day 3, Batch 2, part 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Wraps every admin page (everything inside the "(panel)" folder) in the guard and
//   the menu frame, once.
//
// WHY IMPORTANT
//   A new admin page gets the guard for free by living in this folder. No page can
//   forget it.
//
// DANGER
//   Do NOT put the sign-in page inside (panel). It would be wrapped by the guard and
//   you could never reach it while signed out.
//
// WHAT IT SOLVES
//   "Every admin page is guarded" without repeating code.
//
// SYSTEM DESIGN PRINCIPLE
//   Route groups: the folder name in brackets groups pages under one layout without
//   changing the address (/admin, not /admin/(panel)).
//
// RULES
//   1. Keep robots noindex for the whole panel.
//   2. The layout only wraps. It fetches nothing.
//
// PRACTICAL EXAMPLE
//   Later: app/admin/(panel)/shops/page.js becomes /admin/shops, already guarded.
//
// DECISIONS
//   - Stays a server component (it only sets metadata and wraps). The client
//     component AdminShell does the browser work.
//
// WHERE USED
//   Next.js applies it to every page in (panel).
//
// TRADEOFFS
//   + One place for the guard.
//
// HOW TO USE
//   Add new admin pages under app/admin/(panel)/.
// =============================================================================

import AdminShell from '../../../components/admin/AdminShell';

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminPanelLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}

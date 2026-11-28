// =============================================================================
// FILE: apps/web/src/app/admin/login/page.js   (Week 30 Day 3, Batch 2, part 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The address /admin/login. It only sets the page title, tells search engines
//   to stay away, and shows the sign-in form.
//
// WHY IMPORTANT
//   The admin door should never appear in Google, and it must be a separate door
//   from the shop owner's /login.
//
// DANGER
//   Do not link to /admin/login from any public page. It is not a secret (the real
//   protection is the password and the API), but there is no reason to advertise it.
//
// WHAT IT SOLVES
//   A clear, separate sign-in address for the platform admin.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin page, fat component: this file only frames the page. The form logic lives
//   in AdminLoginForm.js (a client component), as the owner login does.
//
// RULES
//   1. Keep robots noindex so search engines skip it.
//   2. No data fetching here. The form does the work in the browser.
//
// PRACTICAL EXAMPLE
//   Sheryl types rahisishabiashara.com/admin/login, signs in, and lands on /admin.
//
// DECISIONS
//   - Lives OUTSIDE the (panel) folder, so the sign-in page is not wrapped by the
//     guard (or you could never reach it while signed out).
//
// WHERE USED
//   Next.js serves it at /admin/login.
//
// TRADEOFFS
//   + Tiny and obvious.
//
// HOW TO USE
//   Nothing to call. Open /admin/login in the browser.
// =============================================================================

import AdminLoginForm from './AdminLoginForm';

// The browser tab title, and "do not index" for search engines.
export const metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main>
      <AdminLoginForm />
    </main>
  );
}

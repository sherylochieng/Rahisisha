'use client';
// Runs in the browser: it asks the API "am I signed in?" using the admin cookie.

// =============================================================================
// FILE: apps/web/src/components/admin/AdminShell.js   (Week 30 Day 3, Batch 2, part 1)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The frame around EVERY admin page: the navy side menu, the sign-out button, and
//   the guard that sends a signed-out visitor to /admin/login.
//
// WHY IMPORTANT
//   One guard in one place means no admin page can forget to check the sign-in.
//
// DANGER
//   - This guard only decides what the PAGE SHOWS. It is not the lock. The real lock
//     is the API (requirePlatformAdmin): even if someone skipped this file, the API
//     would still refuse every admin request. Never move security into the browser.
//   - Never render children until the check says "signed in".
//
// WHAT IT SOLVES
//   Signed-out visitors see the sign-in page, not an empty or broken admin screen.
//   Network trouble shows a clear message with a Retry button, not a bounce to login.
//
// SYSTEM DESIGN PRINCIPLE
//   Defence in depth: the API is the lock, the shell is the friendly doorman.
//   Fail safe: while we do not know yet, show nothing private.
//
// RULES
//   1. 401 from /admin/auth/me means go to /admin/login.
//   2. Any other failure shows a message and Retry. It does NOT sign the admin out.
//   3. Clean up the effect so a late answer cannot update a page that is gone.
//
// PRACTICAL EXAMPLE
//   Sheryl opens /admin with a fresh browser: me() answers 401, she lands on the
//   sign-in page. After signing in, me() answers 200 and the menu appears.
//
// DECISIONS
//   - The menu lists only pages that exist (Overview and Shops now). Receipts and Admins
//     are added as we build them.
//   - The "signed out? go to sign in" rule is shared (adminSession.js), not copied.
//   - Navy menu, orange active item, as chosen in the colour mock-up (option C).
//
// WHERE USED
//   app/admin/(panel)/layout.js wraps every admin page in it.
//
// TRADEOFFS
//   + One guard, one frame.
//   - A short "Checking..." flash on first load. Acceptable for an admin panel.
//
// HOW TO USE
//   <AdminShell>{page content}</AdminShell>   (done once, in the panel layout)
// =============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi } from '../../lib/adminApi';
import { redirectIfSignedOut } from '../../lib/adminSession';
import AdminLogo from './AdminLogo';
import AdminButton from './AdminButton';

// The menu. Add an entry here when a new admin page exists.
const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/shops', label: 'Shops' },
];

export default function AdminShell({ children }) {
  const router = useRouter();
  const pathname = usePathname(); // used to highlight the current page

  // status: 'checking' | 'ready' | 'error'
  const [state, setState] = useState({ status: 'checking', admin: null, message: '' });
  const [attempt, setAttempt] = useState(0); // bump it to run the check again (Retry)

  useEffect(() => {
    let cancelled = false; // set to true when the page goes away

    async function check() {
      try {
        const res = await adminApi.me();
        if (!cancelled) setState({ status: 'ready', admin: res.data.admin, message: '' });
      } catch (err) {
        if (cancelled) return;
        if (redirectIfSignedOut(err, router)) return; // not signed in: go to the door
        // Network or server trouble: stay here, tell the admin, offer Retry.
        setState({ status: 'error', admin: null, message: err.message });
      }
    }

    check();
    return () => { cancelled = true; };
  }, [router, attempt]);

  async function handleSignOut() {
    try { await adminApi.logout(); } catch { /* even if this fails, leave the panel */ }
    router.replace('/admin/login');
  }

  // 1) Still asking the API: show nothing private.
  if (state.status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Checking your session...
      </div>
    );
  }

  // 2) Could not ask (offline / server trouble): say so, offer Retry.
  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <p role="alert" className="max-w-sm text-sm text-slate-700">{state.message}</p>
        <AdminButton onClick={() => { setState({ status: 'checking', admin: null, message: '' }); setAttempt((n) => n + 1); }}>
          Try again
        </AdminButton>
      </div>
    );
  }

  // 3) Signed in: the frame (navy menu on the left, the page on the right).
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex flex-col gap-1 bg-brand-navy p-4 text-white lg:w-56 lg:shrink-0">
        <div className="mb-5 flex items-center gap-3 px-1">
          <AdminLogo />
          <span className="text-sm font-bold">Rahisisha Admin</span>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Admin menu">
          {NAV.map((item) => {
            // Overview is exact. Other items stay lit on their sub-pages (/admin/shops/123).
            const active = item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-2.5 text-sm ${active ? 'bg-brand-orange font-bold text-brand-navy' : 'text-white/90 hover:bg-white/10'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-white/15 pt-4 text-sm lg:mt-auto">
          <p className="mb-2 px-1 text-white/80">Signed in as {state.admin?.name}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg border border-white/30 px-3 py-2 text-left text-sm font-medium hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-9">{children}</main>
    </div>
  );
}

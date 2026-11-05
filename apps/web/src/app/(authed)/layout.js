// =============================================================================
// (authed)/layout.js — the room every private page lives in
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Every page inside the (authed) folder is private. This layout runs the
//   login check once and draws the frame (sidebar + header) around them
//
// WHY IMPORTANT:
// - It is the front door of the whole dashboard. Without it, private pages
//   would be public or each page would need its own check
//
// DANGER (if this file does not exist):
// - /dashboard would show to logged-out visitors, with no menu
//
// WHAT IT SOLVES:
// - Logged out -> redirected to /login (done by requireSession)
// - Logged in  -> sidebar + header + the page
//
// SYSTEM DESIGN PRINCIPLE: Protect the folder, not each page
// - One layout guards a whole group of pages. New private pages only need to be
//   placed in this folder
//
// RULES:
// - Always call requireSession() first, before drawing anything
// - This is a Server Component (no 'use client'): it runs on the server, so
//   the cookie is read safely and private data never reaches a logged-out browser
// - Pages must STILL load their data through the API. The layout is not the only
//   lock (see the caution below)
//
// CAUTION:
// - Next.js does not re-run a layout on every click between its pages. The API
//   checking the cookie on every data request is the second lock
//
// PRACTICAL EXAMPLES:
// - /dashboard (logged in)  -> sidebar, "Welcome, jane kamau", the page
// - /dashboard (logged out) -> redirected to /login
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every app with a private area: an (authed) or (app) route group with a
//   layout that checks the session
//
// TRADEOFFS:
// + One place for the frame and the check
// - One extra API call per full page load (/me)
//
// HOW TO USE:
// - Put private pages in apps/web/src/app/(authed)/<page>/page.js
// =============================================================================

// requireSession: the bouncer. Returns { user, tenant } or redirects to /login
import { requireSession } from '../../lib/session';

// Sidebar: the menu on the left
import Sidebar from '../../components/Sidebar';

// children = whichever page the visitor asked for (for example the dashboard)
export default async function AuthedLayout({ children }) {

  // STEP 1: the bouncer. If the visitor is not logged in, this line redirects
  // and the code below never runs
  const { user, tenant } = await requireSession();

  // STEP 2: draw the room
  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* LEFT: the sidebar. Hidden on small screens (no mobile menu yet) */}
      <div className="hidden md:block">
        <Sidebar shopName={tenant.name} />
      </div>

      {/* RIGHT: header on top, the page below */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* min-w-0 — lets long content shrink instead of pushing the layout wide */}

        {/* Header: who is logged in */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Welcome, <span className="font-semibold text-brand-navy">{user.name}</span>
          </p>
          <p className="text-sm text-gray-400">{tenant.name}</p>
        </header>

        {/* The page the visitor asked for */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
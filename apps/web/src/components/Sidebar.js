'use client';
// 'use client' — needed because we ask the browser "which page am I on?"
// (usePathname). Server files cannot know that

// =============================================================================
// Sidebar.js — the menu on the left of the dashboard
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The owner needs to move between Dashboard, Products, Orders, Wallet and
//   Settings. This is that menu
//
// WHY IMPORTANT:
// - It is the frame of the whole dashboard. Every private page shows it
//
// DANGER (if this file does not exist):
// - Each page builds its own menu, and they drift apart
//
// WHAT IT SOLVES:
// - One menu, shared by every page, with the current page highlighted
// - Pages that are not built yet are shown greyed out, so nothing leads to a
//   broken page
//
// SYSTEM DESIGN PRINCIPLE: Data, not copy-paste
// - The menu is a LIST of items (NAV_ITEMS). Adding a page = adding one line
//   to the list, not new markup
//
// RULES:
// - Never link to a page that does not exist yet. Mark it ready: false
// - This file only DISPLAYS a menu. It does not decide who may see it. The
//   layout runs the login check before this ever shows
//
// DECISIONS:
// 1. Unbuilt pages (Products, Orders, Wallet, Settings) are visible but
//    disabled, tagged "soon". The assignment asks for these five items, and a
//    link that 404s would look broken
// 2. The shop name is passed IN (a prop). This file does not fetch anything
//
// PRACTICAL EXAMPLE:
//   <Sidebar shopName="skirt Shirt" />
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Every admin dashboard. The same list-driven menu works for any app
//
// TRADEOFFS:
// + Tiny, easy to extend
// - No mobile menu yet (the sidebar is hidden on small screens in the layout)
//
// HOW TO USE:
//   import Sidebar from '../../components/Sidebar';
// =============================================================================

// Link: Next.js's link that changes page without a full reload
import Link from 'next/link';

// usePathname: tells us the current address path, for example "/dashboard"
import { usePathname } from 'next/navigation';

// The menu as a list. ready: true = the page exists, false = coming soon
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', ready: true  },
  { label: 'Products',  href: '/products',  ready: false },
  { label: 'Orders',    href: '/orders',    ready: false },
  { label: 'Wallet',    href: '/wallet',    ready: false },
  { label: 'Settings',  href: '/settings',  ready: false },
];

// shopName comes from the layout (the layout already knows the shop)
export default function Sidebar({ shopName }) {

  // The current page's path, for example "/dashboard"
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-brand-navy text-white min-h-screen flex flex-col">
      {/* bg-brand-navy — the dark brand colour from tailwind.config.js */}
      {/* shrink-0 — the sidebar never gets squeezed narrower */}
      {/* min-h-screen — as tall as the screen */}

      {/* Top: logo and shop name */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-display font-bold">Rahisisha</span>
        </div>
        {/* The shop that is logged in */}
        <p className="mt-3 text-sm text-white/60 truncate">{shopName}</p>
        {/* truncate — a long name is cut with "..." instead of breaking the layout */}
      </div>

      {/* The menu */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {

          // Is this the page we are on? (also true for sub-pages like /orders/123)
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          // NOT BUILT YET: a greyed-out box with a "soon" tag, no link
          if (!item.ready) {
            return (
              <div
                key={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white/30 cursor-not-allowed"
              >
                <span>{item.label}</span>
                <span className="text-[10px] uppercase tracking-wide bg-white/10 rounded px-1.5 py-0.5">
                  soon
                </span>
              </div>
            );
          }

          // BUILT: a real link, highlighted when it is the current page
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-orange text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
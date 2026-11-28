'use client';
// 'use client' - needed because we ask the browser "which page am I on?" (usePathname)

// =============================================================================
// FILE: apps/web/src/components/owner/MobileNav.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The Sidebar is hidden on small screens (layout.js: "hidden md:block"), so
//   on a phone the owner had NO way to move between pages. Most Kenyan shop
//   owners use a phone. This is a slim menu bar that shows ONLY on small screens.
//
// WHY IMPORTANT
//   Without it the new Inbox and Payments pages cannot be reached on a phone,
//   and the "mobile layout works" polish item would be a lie.
//
// DANGER
//   - Shown with "md:hidden", the exact opposite of the Sidebar's "hidden
//     md:block". Both visible at once = a doubled menu; neither = no menu.
//   - It reuses NAV_ITEMS from Sidebar.js. Never copy that list here: a page
//     added to one menu and not the other is a bug nobody notices.
//   - It only DISPLAYS a menu. The login check is the layout's job.
//
// WHAT IT SOLVES
//   A horizontally scrollable row of links under the header on phones.
//   Pages that are not built yet are shown greyed out, same as the Sidebar.
//
// SYSTEM DESIGN PRINCIPLE
//   One data list (NAV_ITEMS), two presentations (side column, top row).
//
// RULES
//   1. Never link to a page that does not exist (ready: false = greyed out).
//   2. Touch targets are at least 40px tall (py-2.5) so thumbs can hit them.
//   3. The row scrolls sideways (overflow-x-auto) instead of wrapping.
//
// PRACTICAL EXAMPLE
//   Amina opens Rahisisha on her phone: she sees
//   [Dashboard] [Inbox] [Payments] [Products soon] ... and swipes sideways.
//
// TRADEOFFS
//   + Tiny, no menu button or open/close state to get stuck.
//   - A scrolling row is less polished than a slide-out drawer (future work).
//
// HOW TO USE
//   <MobileNav />   (inside layout.js, wrapped in a "md:hidden" box)
// =============================================================================
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: 'use client' + usePathname  =  "WHICH PAGE AM I ON?"
//   Only the browser knows the current address, so this file runs in the
//   browser. Real life: a "you are here" dot on a shopping mall map.
//
// PIECE 2: import { NAV_ITEMS }  =  "THE ONE SHARED MENU LIST"
//   The Sidebar and this bar read the same list, so they can never disagree.
//   Real life: one printed menu, copied onto two boards.
//
// PIECE 3: <nav className="md:hidden ...">  =  "ONLY ON SMALL SCREENS"
//   md:hidden hides the bar on bigger screens (where the Sidebar shows).
//   overflow-x-auto lets a phone swipe the row sideways.
//
// PIECE 4: isActive  =  "HIGHLIGHT THE CURRENT PAGE"
//   True when the address is exactly the link, or sits under it (/inbox/...).
//   The current link turns orange.
//
// PIECE 5: ready false  =  "COMING SOON, NOT A LINK"
//   Greyed text with no link, so nobody taps into a page that does not exist.
//
// PIECE 6: ready true  =  "A REAL LINK"
//   A tall, thumb-sized button (py-2.5) that goes to the page.
// =============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The SAME list the Sidebar uses (see DANGER)
import { NAV_ITEMS } from './Sidebar';

export default function MobileNav() {
  // The current page's path, for example "/inbox" (used to highlight the link)
  const pathname = usePathname();

  return (
    // aria-label: screen readers announce "Main menu" for this bar
    <nav aria-label="Main menu" className="md:hidden bg-brand-navy overflow-x-auto">
      <ul className="flex gap-1 px-3 py-2 whitespace-nowrap">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          // NOT BUILT YET: grey text, no link
          if (!item.ready) {
            return (
              <li key={item.href}>
                <span className="block px-3 py-2.5 rounded-lg text-sm text-white/30">
                  {item.label}
                </span>
              </li>
            );
          }

          // BUILT: a real link, highlighted when current
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-brand-orange text-white' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
// =============================================================================
// FILE: apps/web/src/app/(authed)/wallet/page.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The sidebar has a "Wallet" link. The money view already exists as the
//   Payments page (/payments). This file makes /wallet lead there
//
// WHY IMPORTANT:
// - An owner who clicks "Wallet" expects to see their money. Without this
//   file the link would be a dead end (a 404 page)
//
// DANGER (if this file does not exist):
// - "Wallet" stays greyed out as "soon", or it opens a "page not found"
//
// WHAT IT SOLVES:
// - One place for the money view (/payments), two names that both work
//
// SYSTEM DESIGN PRINCIPLE: Do not build the same thing twice
// - Two copies of the money page would drift apart (one shows a wrong total).
//   A redirect keeps ONE page as the single source of truth
//
// RULES:
// - This file shows nothing and fetches nothing. It only redirects
// - It sits inside the (authed) folder, so the layout still runs the login
//   check first. A logged-out visitor goes to /login, never to /payments
//
// DECISIONS:
// 1. A redirect, not a copy of the Payments page
// 2. Plain redirect() from Next.js: it works in a Server Component with no
//    extra code
//
// PRACTICAL EXAMPLE:
// - Amina clicks "Wallet" in the sidebar. The address bar changes to /payments
//   and she sees her balance and her payments grouped by day
//
// WHERE USED:
// - Sidebar.js and MobileNav.js link to /wallet
//
// TRADEOFFS:
// + Tiny, nothing to keep in sync
// - The menu then has two items ("Payments" and "Wallet") that open the same
//   page. A later clean-up can merge them into one label
//
// HOW TO USE:
// - Nothing to call. Next.js runs it when someone opens /wallet
// =============================================================================

// redirect: a Next.js helper that sends the visitor to another address
import { redirect } from 'next/navigation';

// The page. It has nothing to draw: it immediately sends the visitor on
export default function WalletPage() {
  // Like a shop assistant saying "the till is over there" and pointing
  redirect('/payments');
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// import { redirect } ...  : borrows Next.js's "send the visitor elsewhere"
//                           tool. Real life: a sign saying "Wallet: go to the
//                           Payments counter"
// export default function  : Next.js shows the default export for this
//                           address, so /wallet runs this function
// redirect('/payments')    : sends the visitor to /payments before anything is
//                           drawn, so they never see an empty page
// =============================================================================
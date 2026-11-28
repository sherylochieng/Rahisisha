// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/shop/[slug]/checkout/page.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   The checkout page: /shop/<shop>/checkout (on a shop's own address it reads
//   aminas-boutique.rahisishabiashara.com/shop/aminas-boutique/checkout). It is
//   where the basket bar's "Checkout" button and the header's "Basket" chip lead.
//   This file is deliberately THIN. It only:
//     - finds the shop (so the page can say whose shop it is),
//     - wraps everything in the shop's basket (CartProvider),
//     - draws the header and footer,
//     - hands the real work to CheckoutFlow.
//
// WHY IMPORTANT
//   It completes the customer's journey: shelf -> basket -> pay -> receipt.
//   Without it the Checkout button leads to a "page not found".
//
// DANGER (what breaks without it)
//   - The Checkout button and the Basket chip open a 404.
//   - If it used a private endpoint it would show private data to strangers.
//     It only uses publicApi.js (the public shop window).
//   - Search engines indexing checkout pages. We tell them not to (noindex).
//
// WHAT IT SOLVES
//   Gives checkout a real address, with the shop's name on it, so the customer
//   knows where they are paying.
//
// SYSTEM DESIGN PRINCIPLE
//   Server Component shell, client islands inside. The server draws the frame
//   (fast on a cheap phone); the interactive parts (CheckoutFlow) run in the
//   browser. Separation of concerns: this file frames, CheckoutFlow decides,
//   CheckoutForm and PaymentStatus draw.
//
// RULES (never break these)
//   1. Use fetchStorefront only (public, no cookie). Never serverGet.
//   2. A missing shop is notFound(), never a blank page.
//   3. The page must be noindex: it is a private, per-customer page.
//   4. No prices or money maths here. The server decides every amount.
//
// PRACTICAL EXAMPLES
//   localhost:3001/shop/aminas-boutique/checkout   -> this page
//   localhost:3001/shop/nobody/checkout            -> the not-found screen
//
// DECISIONS
//   - The same CartProvider and the same slug as the shop page, so the basket
//     the customer built is exactly the basket they see here.
//   - A "Back to the shop" link in the header: a nervous customer can always
//     leave to change the basket.
//   - Same navy header and white page as the shop, so it feels like one shop.
//   - generateMetadata sets the tab title to "Checkout - <shop name>" and
//     robots: noindex.
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS
//   Any "thin page + client islands" screen: booking, sign-up, payment.
//
// TRADEOFFS
//   + Tiny, easy to read, fast first paint.
//   - Asks the API for the shop's name (one small call) even though the products
//     are not shown here.
//
// HOW TO USE
//   Nothing to call. Open /shop/<slug>/checkout, or tap Checkout in the shop.
//
// ═══════════════════════════════════════════════════════════
// PIECE BY PIECE — real life: the pay counter of the kiosk
// ═══════════════════════════════════════════════════════════
//   getShop            = reading the name board of the kiosk to confirm which
//                        kiosk you are at. No such kiosk: "no such shop".
//   generateMetadata   = the label on the pay counter in the browser tab, plus a
//                        "do not photograph for the directory" note (noindex).
//   <CartProvider>     = bringing YOUR basket (the one from the shelves) to the
//                        pay counter.
//   header             = the same navy name board, with "Back to the shop".
//   <CheckoutFlow>     = the cashier. She decides whether to ask for your number,
//                        wait for the PIN, or give your receipt.
//   max-w-lg           = the counter is narrow on purpose: one thing to do at a
//                        time, easy for a thumb.

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchStorefront } from '../../../../lib/publicApi';
import { CartProvider } from '../../../../components/shop/CartProvider';
import CheckoutFlow from '../../../../components/shop/CheckoutFlow';

// Ask the API for the shop (its name). null means "no such shop".
async function getShop(params) {
  // Next.js 16 gives params as a promise, so we await it.
  const { slug } = await params;
  const page = await fetchStorefront(slug);
  return { slug, shop: page ? page.shop : null };
}

// The browser tab title, and "do not index this page" for search engines.
export async function generateMetadata({ params }) {
  const { shop } = await getShop(params);
  if (!shop) return { title: 'Shop not found' };
  return {
    title: `Checkout - ${shop.name}`,
    // A checkout page is private to the customer: never list it in Google.
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({ params }) {
  const { slug, shop } = await getShop(params);

  // Unknown or closed shop: the not-found screen.
  if (!shop) notFound();

  return (
    // The same basket the customer built on the shelves (same slug).
    <CartProvider slug={slug}>
      <div className="flex min-h-screen flex-col bg-gray-50">
        {/* THE SHOP'S NAME BOARD, with a way back to the shelves */}
        <header className="bg-brand-navy text-white">
          <div className="mx-auto max-w-lg px-4 py-6">
            <Link
              href={`/shop/${slug}`}
              className="text-sm text-gray-300 transition hover:text-white"
            >
              ← Back to the shop
            </Link>
            <h1 className="mt-3 font-display text-2xl font-bold">{shop.name}</h1>
            <p className="mt-1 text-sm text-gray-300">Checkout. Pay with M-Pesa.</p>
          </div>
        </header>

        {/* THE PAY COUNTER: the cashier component does all the work */}
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
          <CheckoutFlow slug={slug} />
        </main>

        <footer className="py-6 text-center text-xs text-gray-400">
          Powered by Rahisisha Biashara
        </footer>
      </div>
    </CartProvider>
  );
}
// ═══════════════════════════════════════════════════════════
// FILE: apps/web/src/app/shop/[slug]/page.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   This is the shop window: the public page a customer sees when they
//   open a shop's link (brio-hardware.rahisishabiashara.com). It shows the
//   shop's name and the products it is selling, with prices.
//
// WHY IMPORTANT
//   This is the page the owner shares on WhatsApp. It is the first thing
//   a customer sees, and the base the cart and checkout will grow from.
//
// DANGER (what breaks without it)
//   - The shop link opens the main Rahisisha landing page and the customer
//     never sees the shop.
//   - If this page ever called a private endpoint it would show private
//     data to strangers. It only uses publicApi.js.
//
// WHAT IT SOLVES
//   Shows { shop name, product grid, "More products" paging, a friendly
//   empty state, a not-found screen for unknown shops }.
//
// SYSTEM DESIGN PRINCIPLE
//   Server Component, public data only. The server asks the API and sends
//   finished HTML: fast on a cheap phone, and good for link previews.
//   Same paging idea as Orders: the page reads ?cursor= from the address
//   and shows a link to the next page, so no JavaScript is needed.
//
// RULES (never break these)
//   1. Use fetchStorefront only (public, no cookie). Never serverGet.
//   2. Validate the cursor shape before sending it on.
//   3. Show only what the API sends: name, description, price, photo address.
//   4. Prices go through formatKes. Never do money maths here.
//   5. A missing shop is notFound(), never a blank page.
//
// PRACTICAL EXAMPLES
//   brio-hardware.localhost:3001      -> proxy.js rewrites "/" to this page
//   localhost:3001/shop/brio-hardware -> the same page on the main address
//   ...?cursor=<bookmark>             -> the next page of products
//   localhost:3001/shop/nobody        -> the not-found screen
//
// DECISIONS
//   - (Week 30) A product with a photo shows it at the top of its card
//     (a plain img, lazy loaded). The whole photo is always visible: it is
//     FITTED inside a square (object-contain), never cropped, so a tall
//     dress or a wide bag is not cut off. A product WITHOUT a photo keeps
//     the coloured tile with the product's first letter, same square size,
//     so the grid stays even.
//   - (Week 30) Each card has an "Add" button (AddToBasket). Tapping it puts
//     the product in the customer's basket, which lives on THEIR phone
//     (lib/cart.js + CartProvider). A bar at the bottom (BasketBar) shows the
//     count and total and links to the checkout page. The page itself stays a
//     Server Component: only the small basket parts run in the browser.
//   - The page title is the shop's name, via generateMetadata, so a
//     WhatsApp link preview says "Brio Hardware".
//   - "Powered by Rahisisha Biashara" sits in a small footer.
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS
//   Any "one page per customer" catalogue: a menu, a portfolio, a
//   property list.
//
// TRADEOFFS
//   + Simple and fast: the page itself is built on the server. Only the
//     basket parts (Add button, basket bar) are client JavaScript.
//   - No search, categories or photo gallery yet (one photo per product).
//     No stock counting yet (nothing says "sold out").
//
// HOW TO USE
//   Nothing to call. Open /shop/<slug>, or a shop's own address.
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request (follow-up to Week 29 Day 4).
//   Declared in docs/AI_AUDIT_week_29_day4.md.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. CURSOR_PATTERN  =  "IS THIS BOOKMARK SHAPED LIKE OURS?"
//    Letters, numbers, - and _ only, up to 300 characters. Anything else
//    is ignored and the first page is shown.
//
// 2. getPage(params, searchParams)  =  "FETCH WHAT THIS VISIT ASKED FOR"
//    Next.js 16 gives params and searchParams as promises, so we await
//    them. Both generateMetadata and the page need the same answer.
//
// 3. generateMetadata  =  "THE SIGN OVER THE DOOR"
//    Sets the browser tab and link-preview title to the shop's name.
//
// 4. The header  =  "THE SHOP'S NAME BOARD"
//    A dark navy band with the name in the display font.
//
// 5. The grid  =  "THE SHELVES"
//    One card per product: the photo (or a letter tile when there is none),
//    the name, up to two lines of description, and the price in KES. 2 columns on a phone, 3 and 4
//    on larger screens.
//
//    (Week 30) p.image_url  =  "THE PICTURE IN THE SHOP WINDOW"
//    If the owner added a photo it is drawn at the top of the card. Real life:
//    a customer walking past decides from the picture, not the label. No photo
//    means the letter tile stays, like a plain price tag on the shelf.
//    aspect-square gives every picture the same square box, and object-contain
//    FITS the whole photo inside it without cutting or stretching (object-cover
//    would fill the box but crop the edges, which is what looked "zoomed in").
//    Real life: putting a whole dress on a hanger vs. only showing its middle.
//    loading="lazy" loads photos only when they scroll near, saving bundles.
//
// 6. The empty state  =  "NOTHING IN THE WINDOW YET"
//    Friendly words, not a blank screen.
//
// 7. "More products" link  =  "TURN THE PAGE"
//    Only shown when the API gave us a nextCursor.
//
// 8. (Week 30) <CartProvider slug={slug}>  =  "THE SHARED BASKET ON THE COUNTER"
//    Wraps the whole page so every Add button and the basket bar look at the
//    SAME basket. The slug decides which shop's basket is loaded, so a customer
//    shopping at two shops never mixes them.
//
// 9. (Week 30) <AddToBasket product={p} />  =  "THE ADD BUTTON ON EACH SHELF"
//    Sits under the price on every card. One tap adds; after that it turns into
//    "- 2 +" so the amount can be changed in place. Real life: pointing at the
//    soda and saying "this one", then "make it two".
//
// 10. (Week 30) <BasketBar slug={slug} />  =  "THE PAY COUNTER AT THE FRONT"
//    Appears only when something is in the basket. Shows the count and the
//    total, and the orange Checkout button takes the customer to the payment page.
// ═══════════════════════════════════════════════════════════

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchStorefront } from '../../../lib/publicApi';
import { formatKes } from '../../../lib/format';
import EmptyState from '../../../components/EmptyState';
// (Week 30) The basket: shared memory, the Add button and the bottom bar
import { CartProvider } from '../../../components/CartProvider';
import AddToBasket from '../../../components/AddToBasket';
import BasketBar from '../../../components/BasketBar';

// Same shape rule as the Orders page: only characters our bookmarks use
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;

// Read the address word and the bookmark, then ask the API once
async function getPage(params, searchParams) {
  const { slug } = await params;
  const { cursor } = await searchParams;
  const safeCursor =
    typeof cursor === 'string' && CURSOR_PATTERN.test(cursor) ? cursor : null;

  const page = await fetchStorefront(slug, safeCursor);
  return { slug, cursor: safeCursor, page };
}

// The browser tab and link-preview title: the shop's name
export async function generateMetadata({ params, searchParams }) {
  const { page } = await getPage(params, searchParams);
  if (!page) return { title: 'Shop not found' };
  return {
    title: page.shop.name,
    description: `Shop online with ${page.shop.name}. Pay with M-Pesa.`,
  };
}

export default async function ShopPage({ params, searchParams }) {
  const { slug, cursor, page } = await getPage(params, searchParams);

  // Unknown or closed shop: the not-found screen
  if (!page) notFound();

  const { shop, products, nextCursor } = page;

  return (
    // (Week 30) CartProvider shares ONE basket with every Add button and the
    // basket bar below. It is a client part inside this server page.
    <CartProvider slug={slug}>
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* THE SHOP'S NAME BOARD */}
      <header className="bg-brand-navy text-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{shop.name}</h1>
          <p className="mt-1 text-sm text-gray-300">Shop online. Pay with M-Pesa.</p>
        </div>
      </header>

      {/* THE SHELVES */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {products.length === 0 ? (
          <EmptyState
            title={cursor ? 'No more products' : 'Nothing for sale yet'}
            message={
              cursor
                ? 'You have seen everything this shop has.'
                : 'This shop has not added products yet. Please check back soon.'
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
              >
                {/* The photo when there is one. Plain <img>: it lives on Cloudinary.
                    aspect-square makes every picture box the same square;
                    object-contain FITS the whole photo inside it (nothing is
                    cut off, any spare space shows the soft grey behind);
                    lazy = loads only near the screen */}
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="aspect-square w-full bg-gray-50 object-contain"
                  />
                ) : (
                  /* No photo: a tile with the product's first letter */
                  <div
                    aria-hidden="true"
                    className="flex aspect-square items-center justify-center bg-brand-cream text-4xl font-display font-bold text-brand-orange"
                  >
                    {p.name.trim().charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex flex-1 flex-col p-3">
                  <h2 className="text-sm font-semibold text-brand-navy break-words">{p.name}</h2>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{p.description}</p>
                  )}
                  <p className="mt-auto pt-3 text-sm font-bold text-brand-navy">
                    {formatKes(p.price_cents)}
                  </p>

                  {/* (Week 30) The Add button: one tap to put it in the basket.
                      Only the public product fields are handed to it. */}
                  <AddToBasket
                    product={{
                      id: p.id,
                      name: p.name,
                      price_cents: p.price_cents,
                      image_url: p.image_url || null,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* TURN THE PAGE */}
        {(nextCursor || cursor) && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
            {cursor && (
              <Link href={`/shop/${slug}`} className="text-gray-600 underline">
                Back to the first products
              </Link>
            )}
            {nextCursor && (
              <Link
                href={`/shop/${slug}?cursor=${encodeURIComponent(nextCursor)}`}
                className="rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white hover:bg-brand-orange-dark"
              >
                More products
              </Link>
            )}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        Powered by Rahisisha Biashara
      </footer>

      {/* (Week 30) The bar at the bottom: count, total and Checkout.
          It shows nothing while the basket is empty. */}
      <BasketBar slug={slug} />
    </div>
    </CartProvider>
  );
}
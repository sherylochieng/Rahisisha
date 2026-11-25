// =============================================================================
// FILE: apps/web/src/app/(authed)/products/page.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The "Products" link in the sidebar needs a page. This is the owner's list
//   of everything the shop sells: name, price, status and code (SKU)
//
// WHY IMPORTANT:
// - Products are what customers buy. The owner must be able to see them all,
//   not only the five newest that the dashboard shows
//
// DANGER (if this file does not exist):
// - "Products" stays greyed out as "soon", and a shop can never review its
//   catalogue
//
// WHAT IT SOLVES:
// - A paged list of this shop's products, drawn on the server, with Edit and
//   Delete on every row
// - A friendly empty box for a brand-new shop
//
// SYSTEM DESIGN PRINCIPLE: The page never touches the database
// - It calls GET /v1/products through serverGetPage. The API answers through
//   the tenant-scoped connection, so only this shop's rows ever come back
//
// RULES:
// - Server Component: no 'use client', no database, no pool
// - Money arrives in whole cents (price_cents). Turn it into KES only for
//   DISPLAY, with formatKes from lib/format.js
// - The bookmark (cursor) comes from the address bar, which anyone can edit.
//   We accept only a real id shape (a UUID). Anything else is ignored and the
//   first page is shown, so a mangled address never crashes the page
// - If the API fails, serverGetPage THROWS, so we never show an empty list
//   that looks real
// - This page READS the list. Adding is at /products/new and editing at
//   /products/[id]/edit. Delete is a button in each row (DeleteProductButton,
//   a small client component placed inside this server page)
//
// DECISIONS:
// 1. 20 products per page (the API allows up to 100)
// 2. Only a "Next page" and "Back to first page" link. The products API pages
//    forward by id, so there is no "previous page" link
// 3. A product with no SKU shows a dash, not the word "null"
// 4. (Week 30) Edit and Delete sit on their own line under each product, so
//    they fit on a phone screen
//
// PRACTICAL EXAMPLE:
// - Brio Hardware opens /products and sees "Cement 50kg  KES 750.00  active"
//   and "Hammer  KES 450.00  active"
//
// WHERE USED:
// - Sidebar.js and MobileNav.js link to /products
//
// TRADEOFFS:
// + Simple and fast. The only client-side piece is the Delete button
// - No search or filter yet, and no product images yet
//
// HOW TO USE:
// - Open /products while logged in. The (authed) layout runs the login check
// =============================================================================

import Link from 'next/link';

// serverGetPage: calls the API as the logged-in visitor, returns { data, nextCursor }
import { serverGetPage } from '../../../lib/serverApi';
// formatKes: 75000 -> "KES 750.00"
import { formatKes } from '../../../lib/format';
import EmptyState from '../../../components/EmptyState';
import DeleteProductButton from '../../../components/DeleteProductButton';

// How many products per page
const PAGE_SIZE = 20;

// The shape of a real product id (a UUID). Used to check the address bar
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The little colour tag next to each product (same colours as the dashboard)
const STATUS_STYLES = {
  active:   'bg-green-100 text-green-700',
  draft:    'bg-gray-100 text-gray-600',
  archived: 'bg-amber-100 text-amber-700',
};

// searchParams is a Promise in this version of Next.js
export default async function ProductsPage({ searchParams }) {
  // STEP 1: which page? Only a real id shape counts; anything else = page one
  const { cursor: rawCursor } = await searchParams;
  const cursor = typeof rawCursor === 'string' && UUID_PATTERN.test(rawCursor) ? rawCursor : null;
  const query = `?limit=${PAGE_SIZE}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

  // STEP 2: ask the API. While we wait here, Next.js shows loading.js
  const { data: products, nextCursor } = await serverGetPage(`/products${query}`);

  return (
    <div className="space-y-6">
           {/* Week 29 Day 4 follow-up: title on the left, the Add product button on the right.
          flex-wrap lets the button drop under the title on a small phone screen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand-navy">Products</h1>
        <Link
          href="/products/new"
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Add product
        </Link>

      </div>
      {/* STEP 3a: no products yet */}
      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          message="Your products will appear here once you add them."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100">
          {/* STEP 3b: the list. divide-y draws a thin line between rows */}
          <ul className="divide-y divide-gray-100">
            {products.map((product) => (
              <li key={product.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                {/* Left: name, code and price. min-w-0 lets a long name shrink */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-navy break-words">{product.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatKes(product.price_cents)}
                    <span className="mx-1.5 text-gray-300">|</span>
                    SKU: {product.sku || '—'}
                  </p>
                </div>

                {/* Right: status tag */}
                <span
                  className={`shrink-0 text-xs font-medium rounded-full px-2.5 py-1 ${
                    STATUS_STYLES[product.status] || STATUS_STYLES.draft
                  }`}
                >
                  {product.status}
                </span>

                {/* Week 30: row actions. flex-wrap on the <li> and w-full here put
                    these on their own line under the name and status, so they fit
                    on a phone */}
                <div className="flex w-full items-center gap-4">
                  <Link
                    href={`/products/${product.id}/edit`}
                    className="text-sm font-medium text-brand-orange hover:underline"
                    aria-label={`Edit ${product.name}`}
                  >
                    Edit
                  </Link>
                  <DeleteProductButton productId={product.id} productName={product.name} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP 4: paging links */}
      <div className="flex items-center justify-between text-sm">
        {cursor ? (
          <Link href="/products" className="text-brand-orange font-medium hover:underline">
            Back to first page
          </Link>
        ) : <span />}
        {nextCursor && (
          <Link
            href={`/products?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-brand-orange font-medium hover:underline"
          >
            Next page
          </Link>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// PAGE_SIZE            : how many rows per page. Real life: how many items fit
//                        on one shelf before you start the next shelf
// UUID_PATTERN         : the shape of a real product id. Real life: a ticket
//                        number must look like a ticket number, or the clerk
//                        ignores it
// STATUS_STYLES        : colour stickers (green = on sale, grey = draft,
//                        amber = archived). An unknown status gets grey
// await searchParams   : reads ?cursor=... from the address bar
// cursor               : the bookmark. Only used if it looks like a real id
// serverGetPage(...)   : asks the API for this shop's products, on the server
// products.length === 0: nothing to show, so the friendly empty box appears
// formatKes(...)       : turns whole cents into shillings for display only
// product.sku || '—'   : no code? show a dash instead of "null"
// nextCursor           : the API's bookmark for the following page, or null
//                        when this is the last page
//
// Week 30 additions
// Edit link            : a normal link to /products/<id>/edit, the page that
//                        opens the form with the old values filled in. Real
//                        life: a pen mark beside a line in the stock book,
//                        "tap here to correct this one"
// DeleteProductButton  : the Delete button with the "are you sure?" step. This
//                        page stays a SERVER page and the button is one small
//                        CLIENT piece placed inside it. Real life: the shop
//                        window is the server, and the button is one little
//                        lever a customer can pull
// flex-wrap + w-full   : on a narrow phone the row would be too crowded with
//                        name, price, status, Edit and Delete. These drop the
//                        actions onto their own line under the product
// =============================================================================
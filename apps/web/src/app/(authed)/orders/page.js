// =============================================================================
// FILE: apps/web/src/app/(authed)/orders/page.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The "Orders" link in the sidebar needs a page. This is the owner's list of
//   orders: who ordered, how much, which stage it is at, and when
//
// WHY IMPORTANT:
// - Orders are the money coming in. The owner decides what to pack and send
//   from this list. A missing order is a lost sale
//
// DANGER (if this file does not exist):
// - "Orders" stays greyed out as "soon", and the owner has no way to see orders
//   except by asking the database
//
// WHAT IT SOLVES:
// - A paged, read-only list of this shop's orders, NEWEST FIRST, with the
//   customer's name and phone, drawn on the server
// - A friendly empty box for a shop with no orders yet
//
// SYSTEM DESIGN PRINCIPLE: The page never touches the database
// - It calls GET /v1/orders through serverGetPage. The API answers through the
//   tenant-scoped connection, so only this shop's orders and customers come
//   back
//
// RULES:
// - Server Component: no 'use client', no database, no pool
// - Money arrives in whole cents (total_cents). Turn it into KES only for
//   DISPLAY, with formatKes from lib/format.js
// - Times are shown in Nairobi time with formatNairobiTime
// - The bookmark (cursor) comes from the address bar, which anyone can edit.
//   We accept only the plain characters our bookmarks are made of. Anything
//   else is ignored and the newest page is shown
// - Customer phone numbers are private. They are drawn on screen for the owner
//   and are never logged or put in a link
// - If the API fails, serverGetPage THROWS, so we never show an empty list
//   that looks real
// - This page only READS. Changing an order's status comes in a later step
//
// DECISIONS:
// 1. 20 orders per page
// 2. "Newer orders" and "Older orders" links, like the inbox, because the
//    bookmark pages forward in time order (newest first)
// 3. If a customer has no name, the phone number is shown as the main line
// 4. Unknown statuses (a future one) get a neutral grey tag instead of
//    breaking the page
//
// PRACTICAL EXAMPLE:
// - Brio Hardware opens /orders and sees "Amina Test, +2547..., KES 500.00,
//   created, 4 Jan, 15:00" at the top
//
// WHERE USED:
// - Sidebar.js and MobileNav.js link to /orders
//
// TRADEOFFS:
// + Simple, fast, no client-side code
// - Read-only for now, with no search, filter or order detail yet
//
// HOW TO USE:
// - Open /orders while logged in. The (authed) layout runs the login check
// =============================================================================

import Link from 'next/link';

// serverGetPage: calls the API as the logged-in visitor, returns { data, nextCursor }
import { serverGetPage } from '../../../lib/serverApi';
// formatKes: 50000 -> "KES 500.00".  formatNairobiTime: ISO time -> "4 Jan, 15:00"
import { formatKes, formatNairobiTime } from '../../../lib/format';
import EmptyState from '../../../components/EmptyState';

// How many orders per page
const PAGE_SIZE = 20;

// Our bookmarks are made only of letters, digits, "_" and "-" (base64url).
// Anything else in the address bar is ignored
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;

// The little colour tag for each stage of an order
const STATUS_STYLES = {
  created:   'bg-blue-100 text-blue-700',
  paid:      'bg-green-100 text-green-700',
  packed:    'bg-amber-100 text-amber-700',
  sent:      'bg-purple-100 text-purple-700',
  delivered: 'bg-green-200 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

// Where the order came from, in plain words
const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  web: 'Website',
  ussd: 'USSD',
};

// searchParams is a Promise in this version of Next.js
export default async function OrdersPage({ searchParams }) {
  // STEP 1: which page? Only a plain-looking bookmark counts; anything else = newest page
  const { cursor: rawCursor } = await searchParams;
  const cursor = typeof rawCursor === 'string' && CURSOR_PATTERN.test(rawCursor) ? rawCursor : null;
  const query = `?limit=${PAGE_SIZE}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

  // STEP 2: ask the API. While we wait here, Next.js shows loading.js
  const { data: orders, nextCursor } = await serverGetPage(`/orders${query}`);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-brand-navy">Orders</h1>

      {/* STEP 3a: no orders yet */}
      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Orders from your customers will appear here."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100">
          {/* STEP 3b: the list. divide-y draws a thin line between rows */}
          <ul className="divide-y divide-gray-100">
            {orders.map((order) => (
              <li key={order.id} className="p-4 flex items-center justify-between gap-3">
                {/* Left: who, how much, where from, when. min-w-0 lets long names shrink */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-navy break-words">
                    {order.customer_name || order.customer_phone || 'Customer'}
                  </p>
                  {/* Show the phone under the name (only when there is a name) */}
                  {order.customer_name && order.customer_phone && (
                    <p className="text-xs text-gray-500 break-all">{order.customer_phone}</p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatKes(order.total_cents)}
                    <span className="mx-1.5 text-gray-300">|</span>
                    {CHANNEL_LABELS[order.channel] || order.channel}
                    <span className="mx-1.5 text-gray-300">|</span>
                    {formatNairobiTime(order.created_at)}
                  </p>
                </div>

                {/* Right: stage tag */}
                <span
                  className={`shrink-0 text-xs font-medium rounded-full px-2.5 py-1 ${
                    STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {order.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP 4: paging links */}
      <div className="flex items-center justify-between text-sm">
        {cursor ? (
          <Link href="/orders" className="text-brand-orange font-medium hover:underline">
            Back to newest orders
          </Link>
        ) : <span />}
        {nextCursor && (
          <Link
            href={`/orders?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-brand-orange font-medium hover:underline"
          >
            Older orders
          </Link>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// PAGE_SIZE            : how many rows per page. Real life: how many order
//                        slips fit on one clipboard
// CURSOR_PATTERN       : the allowed characters of a bookmark. Real life: a
//                        ticket number must look like a ticket number, or the
//                        clerk ignores it
// STATUS_STYLES        : colour stickers for each stage (blue = new, green =
//                        paid, amber = being packed, purple = on the way,
//                        dark green = delivered, grey = cancelled)
// CHANNEL_LABELS       : turns "web" into "Website" for people
// await searchParams   : reads ?cursor=... from the address bar
// serverGetPage(...)   : asks the API for this shop's orders, on the server
// orders.length === 0  : nothing to show, so the friendly empty box appears
// order.customer_name || phone : the name if we have one, otherwise the phone
// formatKes / formatNairobiTime : cents to shillings, and the time in Nairobi
// nextCursor           : the API's bookmark for the OLDER page, or null when
//                        this is the last page
// =============================================================================
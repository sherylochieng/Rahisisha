// =============================================================================
// FILE: apps/web/src/app/(authed)/inbox/page.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The owner's one list of "who contacted my shop": WhatsApp messages and USSD
//   requests together, newest first, each tagged with its channel (WA / USSD).
//
// WHY IMPORTANT
//   A customer who messages and gets no answer buys somewhere else. This page
//   is where the owner sees them all in one place.
//
// DANGER
//   - Server Component: NO 'use client'. The page asks the API on the server and
//     the browser receives finished HTML.
//   - Never read the database from here. Only serverGetPage('/inbox'). The API
//     uses the tenant-locked connection, so only THIS shop's rows come back.
//   - The "cursor" in the address bar is typed by the visitor, so it is only
//     passed along (URL-encoded), never trusted. The API checks it and answers
//     400 for a made-up one, which shows the error page, not someone else's data.
//   - If the API fails, serverGetPage THROWS, so the error page shows. We never
//     draw an empty inbox that is really a failure.
//
// WHAT IT SOLVES
//   /inbox            -> the 20 newest messages
//   /inbox?cursor=... -> the next 20 older ones ("Older messages" link)
//   no messages       -> the empty state (text fixed by the assignment)
//
// SYSTEM DESIGN PRINCIPLE
//   Keyset paging: each page ends with a bookmark (nextCursor) for the next.
//   A link, not a button, so it works with no JavaScript and the Back button
//   behaves as people expect.
//
// RULES
//   1. Empty state text is exactly: "No messages yet. Share your USSD code or
//      WhatsApp number."
//   2. Every channel has a badge: WA (green) or USSD (amber). The full word is in
//      the badge's title/aria-label so a screen reader says "WhatsApp".
//   3. Times show in Nairobi time (lib/format.js).
//   4. Long messages wrap (break-words); the layout never goes sideways on a phone.
//
// PRACTICAL EXAMPLE
//   [WA]   0711 000 111   "Do you have the red kitenge dress?"   2 Jan, 09:30
//   [USSD] 0722 000 222   dialled, chose "2" (balance)           2 Jan, 09:12
//
// WHERE USED
//   Sidebar and MobileNav link here. loading.js sits next to this file.
//
// TRADEOFFS
//   + Simple and fast; no client JavaScript.
//   - Only "older" paging (no "newer"); the Back button or the Inbox link returns
//     to the newest. Live updates (new messages appearing by themselves) come later.
// =============================================================================
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: imports  =  "THE TOOLS ON THE TABLE"
//   Link for the paging links, serverGetPage to ask the API, formatNairobiTime
//   for the times, EmptyState for the "nothing yet" box.
//
// PIECE 2: PAGE_SIZE  =  "HOW MANY MESSAGES PER PAGE"
//   20, like the assignment's example. Real life: 20 letters per tray.
//
// PIECE 3: CHANNELS + ChannelBadge  =  "THE COLOURED STICKER"
//   WA is green, USSD is amber. The full word sits in title/aria-label so a
//   screen reader says "WhatsApp", not "WA". Unknown channels still show.
//
// PIECE 4: STEP 1, searchParams  =  "WHICH PAGE OF THE LIST?"
//   In this Next.js version searchParams is a Promise, so we await it. No
//   cursor means the newest page. The cursor is URL-encoded and only passed on.
//
// PIECE 5: STEP 2, serverGetPage  =  "ASK THE API"
//   Runs on the server with the visitor's login cookie. While it waits, Next.js
//   shows loading.js. A failure throws and the error page shows.
//
// PIECE 6: STEP 3a, EmptyState  =  "NOTHING HERE YET"
//   The exact words from the assignment, in the shared box.
//
// PIECE 7: STEP 3b, the list  =  "ONE ROW PER MESSAGE"
//   Badge, who (the phone number), when (Nairobi time), what. A USSD row with
//   no body means the caller only dialled the code.
//
// PIECE 8: STEP 4, the links  =  "TURN THE PAGE"
//   Older messages (when more exist) and Back to newest (when deep in). Plain
//   links, so the Back button and no-JavaScript both work.
// =============================================================================

import Link from 'next/link';

// serverGetPage: calls the API as the logged-in visitor, returns { data, nextCursor }
import { serverGetPage } from '../../../lib/serverApi';
import { formatNairobiTime } from '../../../lib/format';
import EmptyState from '../../../components/EmptyState';

// How many messages per page (the API allows up to 100)
const PAGE_SIZE = 20;

// PIECE 1: the badge. Real life: the coloured sticker on a mail tray
// (green = WhatsApp, amber = USSD). Anything unknown still shows its own name.
const CHANNELS = {
  whatsapp: { short: 'WA',   full: 'WhatsApp', style: 'bg-green-100 text-green-700' },
  ussd:     { short: 'USSD', full: 'USSD',     style: 'bg-amber-100 text-amber-700' },
};

function ChannelBadge({ channel }) {
  const c = CHANNELS[channel] || { short: channel, full: channel, style: 'bg-gray-100 text-gray-600' };
  return (
    <span
      title={c.full}
      aria-label={c.full}
      className={`shrink-0 w-12 text-center text-xs font-semibold rounded-full py-1 ${c.style}`}
    >
      {c.short}
    </span>
  );
}

// PIECE 2: the page. searchParams is a Promise in this version of Next.js
export default async function InboxPage({ searchParams }) {
  // STEP 1: which page? No cursor = the newest messages
  const { cursor } = await searchParams;
  const query = `?limit=${PAGE_SIZE}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');

  // STEP 2: ask the API. While we wait here, Next.js shows loading.js
  const { data: messages, nextCursor } = await serverGetPage(`/inbox${query}`);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-brand-navy">Inbox</h1>

      {/* STEP 3a: nothing yet. The shared empty box, with the assignment's words */}
      {messages.length === 0 ? (
        <EmptyState title="No messages yet. Share your USSD code or WhatsApp number." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100">
          {/* STEP 3b: the list. divide-y draws a thin line between rows */}
          <ul className="divide-y divide-gray-100">
            {messages.map((m) => (
              <li key={m.id} className="p-4 flex items-start gap-3">
                <ChannelBadge channel={m.channel} />

                {/* min-w-0 lets a long message shrink and wrap instead of pushing the page wide */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-semibold text-brand-navy">{m.from}</p>
                    <p className="text-xs text-gray-400">{formatNairobiTime(m.createdAt)}</p>
                  </div>
                  {/* A USSD row with body "" means the caller only dialled the code */}
                  <p className="mt-1 text-sm text-gray-700 break-words">
                    {m.channel === 'ussd'
                      ? (m.body === '' ? 'Dialled the USSD code' : `Chose: ${m.body}`)
                      : m.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP 4: paging links. Older = next page; "Back to newest" only when deep in */}
      <div className="flex items-center justify-between text-sm">
        {cursor ? (
          <Link href="/inbox" className="text-brand-orange font-medium hover:underline">
            Back to newest
          </Link>
        ) : <span />}
        {nextCursor && (
          <Link
            href={`/inbox?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-brand-orange font-medium hover:underline"
          >
            Older messages
          </Link>
        )}
      </div>
    </div>
  );
}
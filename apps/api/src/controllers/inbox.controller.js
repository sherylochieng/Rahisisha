// =============================================================================
// FILE: apps/api/src/controllers/inbox.controller.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The owner wants ONE list of "who contacted my shop", whatever the channel.
//   WhatsApp chats live in `messages`, USSD requests live in `ussd_events`.
//   This controller merges both into one newest-first list.
//
// WHY IMPORTANT
//   It is the data behind the Inbox page. If the order or the paging is wrong,
//   the owner misses or re-reads messages.
//
// DANGER
//   1. UNION ALL does NOT sort. The ORDER BY must sit AFTER the union, on the
//      whole result, or the rows come back in table order.
//   2. Paging uses TWO values (created_at, id), not just a date: two rows can
//      share a timestamp, and a date-only cursor would skip one of them.
//   3. The cursor timestamp must keep MICROSECONDS. JavaScript Dates keep only
//      milliseconds, so the cursor time is built inside Postgres as text and
//      sent back untouched. Rounding it would repeat or skip rows.
//   4. Read through req.db only. RLS adds the shop filter to BOTH tables, so
//      there is no "WHERE tenant_id" below, on purpose.
//
// WHAT IT SOLVES
//   GET /v1/inbox?limit=20&cursor=...  ->  { data: [...], nextCursor, error }
//   each row: { id, channel, from, body, createdAt }
//     channel: 'whatsapp' | 'ussd'
//
// SYSTEM DESIGN PRINCIPLE
//   Keyset (cursor) paging: "give me rows older than the last one I saw".
//   Unlike OFFSET it stays fast on page 500 and never shifts when new
//   messages arrive while the owner is scrolling.
//
// DECISIONS
//   - UNION ALL (not UNION): the two sources can never contain the same row,
//     so skipping the duplicate check is faster.
//   - Only INBOUND WhatsApp messages: an inbox is what customers sent us, and
//     "from" would be wrong for our own replies.
//   - A plain query, not a materialised view: nothing to refresh, always live.
//     Both tables have a (tenant_id, created_at DESC) index.
//   - limit default 20, max 100. We fetch limit+1 rows to know if more exist.
//
// RULES
//   1. ORDER BY goes after the UNION, on the merged list.
//   2. Compare (created_at, id) as a PAIR, never created_at alone.
//   3. The cursor is validated (decodeCursor) before use; bad = 400, never a crash.
//   4. Return exactly { id, channel, from, body, createdAt } per row.
//   5. No "WHERE tenant_id": RLS does it. No phone numbers or message bodies in logs.
//
// PRACTICAL EXAMPLE
//   GET /v1/inbox?limit=2 ->
//     { data: [ {channel:'whatsapp', from:'254711000111', body:'Hi', ...},
//               {channel:'ussd',     from:'254722000222', body:'2',  ...} ],
//       nextCursor: 'MjAyNi0...', error: null }
//   GET /v1/inbox?limit=2&cursor=MjAyNi0...  -> the next two older rows.
//   Real life: a mail tray with two kinds of letters (WhatsApp, USSD) merged into
//   one pile, newest on top, handed over two at a time with a bookmark.
//
// WHERE USED
//   routes/inbox.routes.js, mounted in app.js. Read by web: (authed)/inbox/page.js.
//
// TRADEOFFS
//   - Each page runs the union again. Fine for one shop's volume; at millions
//     of rows a materialised view with a refresh plan would be the next step.
//
// HOW TO USE
//   app.use('/v1/inbox', requireAuth, withTenant, inboxRouter)
// =============================================================================
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: the import  =  "BORROW THE BOOKMARK TOOLS"
//   CURSOR_TS_SQL, decodeCursor and encodeCursor come from utils/keysetCursor.js,
//   shared with the payments list. Real life: two shops sharing one stamp.
//
// PIECE 2: STEP 1, the limit  =  "HOW MANY PER PAGE?"
//   Reads ?limit=, falls back to 20 when it is missing or junk, and keeps it
//   between 1 and 100. Real life: a waiter who serves 20 plates at a time and
//   will never carry 10,000 at once.
//
// PIECE 3: STEP 2, the cursor  =  "WHERE DID WE STOP LAST TIME?"
//   No cursor = start from the newest. A cursor is checked by decodeCursor; a
//   made-up one gets a 400 reply ("Invalid cursor"), not a crash.
//
// PIECE 4: STEP 3, the SQL  =  "EMPTY BOTH MAIL TRAYS INTO ONE PILE"
//   - First SELECT: WhatsApp messages. We join messages -> conversations ->
//     customers to find the customer's phone. Only inbound messages (what the
//     customer sent), only the whatsapp channel.
//   - UNION ALL: stack the USSD rows (from ussd_events) underneath, in the same
//     5 columns.
//   - The outer part: keep rows older than the bookmark, sort the WHOLE pile
//     newest first (ORDER BY after the union), take limit+1 rows.
//   - There is no "WHERE tenant_id". The database lock (RLS) already hides other
//     shops' rows from this connection.
//
// PIECE 5: STEP 4, nextCursor  =  "IS THERE ANOTHER PAGE?"
//   We asked for one extra row. If it came back, there is more, so we build a
//   bookmark from the LAST row we actually return and drop the extra row.
//
// PIECE 6: STEP 5, the answer  =  "ONLY WHAT THE SCREEN NEEDS"
//   Five fields per row: id, channel, from, body, createdAt. Nothing else leaves.
// =============================================================================

// The cursor helpers are shared with the wallet list: src/utils/keysetCursor.js
import { CURSOR_TS_SQL, decodeCursor, encodeCursor } from '../utils/keysetCursor.js';

// -----------------------------------------------------------------------------
// listInbox - the whole endpoint, in five steps (see the numbered STEP comments)
// Real life: the receptionist who gathers both mail trays, sorts the merged pile
// newest first, and hands you one page with a bookmark.
// -----------------------------------------------------------------------------
export async function listInbox(req, res) {
  // STEP 1: read and clamp the limit (1..100, default 20)
  const parsed = parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isNaN(parsed) ? 20 : parsed, 1), 100);

  // STEP 2: read the cursor, if any. A bad cursor is the caller's mistake: 400
  let ts = null;
  let id = null;
  if (req.query.cursor) {
    const c = decodeCursor(String(req.query.cursor));
    if (!c) {
      return res.status(400).json({
        data: null,
        error: { code: 'validation', message: 'Invalid cursor' },
      });
    }
    ts = c.ts;
    id = c.id;
  }

  // STEP 3: merge both sources, sort the MERGED list, cut one page (+1)
  // INNER part (the two SELECTs): one SELECT per source, each shaped into the
  //   same 5 columns so UNION ALL can stack them. 'whatsapp'::text / 'ussd'::text
  //   is the channel label. messages -> conversations -> customers is how we get
  //   the customer's phone for "from".
  // OUTER part: the cursor filter "older than (time, id)", the ORDER BY on the
  //   merged result, and LIMIT. $1/$2/$3 are values passed separately from the
  //   SQL text, so a caller can never inject SQL.
  const { rows } = await req.db.query(
    `SELECT u.id, u.channel, u."from", u.body, u.created_at,
            ${CURSOR_TS_SQL('u.created_at')} AS cursor_ts
       FROM (
              SELECT m.id, 'whatsapp'::text AS channel, cu.phone AS "from",
                     m.body, m.created_at
                FROM messages m
                JOIN conversations c ON c.id  = m.conversation_id
                JOIN customers    cu ON cu.id = c.customer_id
               WHERE m.direction = 'inbound'
                 AND c.channel   = 'whatsapp'
              UNION ALL
              SELECT e.id, 'ussd'::text AS channel, e.phone AS "from",
                     e.body, e.created_at
                FROM ussd_events e
            ) u
      WHERE ($1::timestamptz IS NULL OR (u.created_at, u.id) < ($1::timestamptz, $2::uuid))
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT $3`,
    [ts, id, limit + 1]
  );

  // STEP 4: did we get an extra row? Then there is a next page.
  // (We asked for limit+1 on purpose: the extra row is only a "there is more" signal.)
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore ? encodeCursor(last.cursor_ts, last.id) : null;

  // STEP 5: shape each row exactly as the assignment asks
  const data = page.map((r) => ({
    id: r.id,
    channel: r.channel,
    from: r.from,
    body: r.body,
    createdAt: r.created_at,
  }));

  res.json({ data, nextCursor, error: null });
}
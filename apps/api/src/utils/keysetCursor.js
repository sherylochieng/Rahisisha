// =============================================================================
// FILE: apps/api/src/utils/keysetCursor.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Two lists show "the newest 20, then the next 20 older": the inbox and the
//   wallet entries. To know where page 2 starts, each page hands back a
//   BOOKMARK (called a cursor). This file makes and opens those bookmarks, once,
//   so both lists follow the same rules.
//
// WHY IMPORTANT
//   A wrong bookmark means the owner misses a message or a payment, or sees the
//   same one twice. Nothing crashes, so nobody notices. That is the dangerous kind
//   of bug.
//
// DANGER
//   1. The time must keep MICROSECONDS. A JavaScript Date keeps only
//      milliseconds, so the time is turned into text INSIDE Postgres
//      (CURSOR_TS_SQL) and sent back unchanged. Rounding it skips or repeats rows.
//   2. Compare (created_at, id) as a PAIR. Two rows can share a time, and the id
//      breaks the tie.
//   3. A cursor comes from the caller (it sits in the web address), so it is
//      validated strictly (exact time shape + a real UUID) before it reaches SQL.
//      It is still passed as a query parameter, never glued into the SQL text.
//
// WHAT IT SOLVES
//   Three small tools: CURSOR_TS_SQL (formats the time), encodeCursor (makes a
//   bookmark) and decodeCursor (opens and checks one).
//
// SYSTEM DESIGN PRINCIPLE
//   Keyset paging: "give me the rows OLDER than this one". Unlike page numbers
//   (OFFSET), it stays fast on page 500 and does not shift when new messages
//   arrive while the owner is scrolling.
//
// RULES
//   1. Cursor = base64url("<UTC time with 6 decimals>|<row id>").
//   2. A cursor that is not exactly that shape is refused (decodeCursor gives
//      null, and the controller answers 400).
//   3. The `column` given to CURSOR_TS_SQL must be OUR constant, never user input.
//
// PRACTICAL EXAMPLE
//   Page 1 ends at a message sent at 10:04:00.123456 with id 7f3a...
//   The bookmark is that time and that id, packed into one text.
//   Page 2 asks Postgres for rows strictly older than that time/id pair.
//
// WHERE USED
//   controllers/inbox.controller.js and controllers/wallet.controller.js
//
// TRADEOFFS
//   + Small, safe, shared by two lists.
//   - Forward only (older). There is no "previous page" bookmark.
//   - Not signed: a visitor could craft a cursor, but it can only ever move
//     inside their own shop's rows (RLS limits the rows).
//
// HOW TO USE
//   SELECT ..., ${CURSOR_TS_SQL('w.created_at')} AS cursor_ts ...
//   const c = decodeCursor(raw);   // { ts, id } or null (null = answer 400)
//   const next = encodeCursor(lastRow.cursor_ts, lastRow.id);
//
//
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: UUID_RE and TS_RE  =  "WHAT A VALID BOOKMARK LOOKS LIKE"
//   Two patterns. UUID_RE says an id looks like 7f3a1b2c-1234-... . TS_RE says
//   a time looks like 2026-01-01T10:04:00.123456Z with EXACTLY 6 decimals.
//   Real life: a cinema ticket must have the right serial format before the
//   usher lets you in. A made-up ticket is turned away at the door.
//
// PIECE 2: CURSOR_TS_SQL(column)  =  "WRITE THE TIME TO THE MICROSECOND"
//   Returns a piece of SQL that makes Postgres print the time as text, with 6
//   decimals. We do it in Postgres because JavaScript would round to
//   milliseconds. Real life: two receipts printed in the same minute: the exact
//   second and fraction is what tells them apart.
//
// PIECE 3: decodeCursor(raw)  =  "OPEN THE BOOKMARK AND CHECK IT"
//   Unpacks the text, splits it at "|" into time and id, and checks both against
//   the patterns above. If anything is wrong (or it cannot be unpacked at all) it
//   returns null instead of crashing. Real life: the librarian checks the
//   bookmark is really hers before she opens the book at that page.
//
// PIECE 4: encodeCursor(ts, id)  =  "MAKE A BOOKMARK"
//   Joins time and id with "|" and wraps it in base64url, which is safe to put in
//   a web address (no + or / or =). Real life: folding the note into an envelope
//   that survives the post.
// =============================================================================

// UUID_RE = a real id (8-4-4-4-12 letters/digits). TS_RE = a time with exactly
// 6 decimals (microseconds).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

// SQL text that turns a timestamptz column into the cursor time (UTC, microseconds).
// `column` is OUR constant (never user input), so putting it in the SQL is safe.
export function CURSOR_TS_SQL(column) {
  return `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

// Returns { ts, id }, or null when the cursor is not one of ours
export function decodeCursor(raw) {
  try {
    const [ts, id, extra] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (extra !== undefined || !TS_RE.test(ts || '') || !UUID_RE.test(id || '')) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

// Makes a bookmark. base64url keeps it safe to put in a web address.
export function encodeCursor(ts, id) {
  return Buffer.from(`${ts}|${id}`, 'utf8').toString('base64url');
}
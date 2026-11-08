// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/utils/dbDown.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   When Postgres is switched off or unreachable, Node throws
//   many different errors (ECONNREFUSED, a timeout, "the
//   database system is shutting down", ...). This file has ONE
//   function that answers a single question:
//   "Is this error because the database is down?"
//
// WHY IMPORTANT
//   Without it, a database outage looks like a bug in OUR code
//   (a 500 "Something went wrong"). With it, we can tell the
//   user the truth: "We're having trouble, try again soon" (503).
//
// DANGER (what breaks without it)
//   - The user sees a vague error and thinks the app is broken,
//     or keeps clicking and makes the outage worse.
//   - Monitoring tools cannot tell "our bug" (500) from "database
//     down" (503), so the wrong person is woken up at night.
//
// WHAT IT SOLVES
//   One shared list of "the database is unavailable" signals, so
//   app.js, login.js and signup.js all use the SAME rule.
//
// SYSTEM DESIGN PRINCIPLE
//   "Fail gracefully." When a dependency (the database) is down,
//   the app should say so clearly and recover by itself when the
//   database comes back. Also: DRY (Don't Repeat Yourself). One
//   list in one place, not three copies that drift apart.
//
// RULES (never do this)
//   1. NEVER treat every error as "database down". A bug in our
//      code or a bad user input must stay a 500 or a 400.
//   2. NEVER show the raw database error to the user (it can leak
//      the host name, the user name or the table names).
//   3. NEVER add a code here without knowing what it means.
//   4. NEVER copy this list into another file. Import it.
//
// PRACTICAL EXAMPLE
//   Postgres is stopped. A shop owner opens the dashboard.
//   pool.connect() fails with ECONNREFUSED. isDatabaseDown()
//   says true, so the API answers 503 "We're having trouble
//   right now. Please try again in a moment."
//
// DECISIONS
//   - We check Node network codes AND Postgres codes AND the
//     message text. Different failures show up in different
//     ways (pool timeout has NO code, only a message).
//   - Node 20+ can wrap several failures into one error with an
//     .errors list (it tries IPv4 and IPv6). We look inside it.
//
// WHERE YOU WILL USE THIS
//   - app.js central error handler (Step 2)
//   - routes/auth/login.js and signup.js (Step 3)
//   - any future route that catches its own errors
//
// TRADEOFFS
//   + One rule, easy to test and extend.
//   - The message-text check is a safety net and can miss a
//     differently worded error. Add the new wording here when
//     we meet one.
//
// HOW TO USE
//   import { isDatabaseDown } from '../utils/dbDown.js';
//   if (isDatabaseDown(err)) { ...send 503... }
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. DB_DOWN_NODE_CODES  =  THE "PHONE DID NOT CONNECT" SIGNALS
//    ECONNREFUSED = you called and nobody picked up (Postgres is
//    off). ETIMEDOUT = it rang forever. ENOTFOUND = wrong address.
//    ECONNRESET = they hung up on you mid-call.
//
// 2. DB_DOWN_PG_CODES  =  THE "SHOP SAYS: WE'RE CLOSED" SIGNALS
//    Postgres itself answered, but said it cannot serve now.
//    57P01/57P02 = shutting down or crashed. 57P03 = starting up.
//    53300 = too many customers inside. 08xxx = connection lost.
//
// 3. The message check  =  READING THE SIGN ON THE DOOR
//    Some failures have no code, only words (like the pool's
//    "timeout exceeded when trying to connect"). We match words.
//
// 4. err.errors  =  A BOX WITH SEVERAL FAILURES INSIDE
//    Node may try 2 addresses and report both failures in one
//    error. We open the box and check each one.
//
// 5. .some(isDatabaseDown)  =  "IS AT LEAST ONE OF THEM DOWN?"
//    The function calls itself on each item (recursion).
// ═══════════════════════════════════════════════════════════

// Node.js network error codes that mean "could not reach the database"
const DB_DOWN_NODE_CODES = [
  'ECONNREFUSED',   // nothing is listening (Postgres is off)
  'ECONNRESET',     // the connection was cut in the middle
  'ETIMEDOUT',      // no answer in time
  'ENOTFOUND',      // the host name does not exist
  'EHOSTUNREACH',   // the network path is broken
  'EPIPE',          // wrote to a connection that is already closed
];

// Postgres error codes that mean "the database cannot serve right now"
const DB_DOWN_PG_CODES = [
  '57P01', // admin_shutdown        : being shut down
  '57P02', // crash_shutdown        : crashed
  '57P03', // cannot_connect_now    : still starting up
  '53300', // too_many_connections  : full
  '08000', // connection_exception
  '08001', // unable to establish connection
  '08003', // connection_does_not_exist
  '08004', // server rejected the connection
  '08006', // connection_failure
];

// Words that show up in errors that have NO code
const DB_DOWN_MESSAGE =
  /timeout exceeded when trying to connect|connection terminated|database system is (starting up|shutting down)/i;

// isDatabaseDown(err): true only if the error means "database unavailable"
export function isDatabaseDown(err) {
  // No error, nothing to check
  if (!err) return false;

  // 1) Known Node network code or known Postgres code
  if (DB_DOWN_NODE_CODES.includes(err.code)) return true;
  if (DB_DOWN_PG_CODES.includes(err.code)) return true;

  // 2) Error with no code, recognised by its words
  if (DB_DOWN_MESSAGE.test(err.message || '')) return true;

  // 3) Several failures wrapped in one error: check each inside
  if (Array.isArray(err.errors)) return err.errors.some(isDatabaseDown);

  // Anything else is OUR bug or the user's input, not an outage
  return false;
}
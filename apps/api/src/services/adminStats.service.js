// =============================================================================
// FILE: apps/api/src/services/adminStats.service.js   (Week 30 Day 3, Batch 3a: admin overview numbers)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Counts the shops on the platform for the admin's Overview page: how many in total,
//   how many are open, closed (suspended) and verified, and how many joined in the last
//   seven days.
//
// WHY IMPORTANT
//   It is the first thing the admin sees after signing in. The numbers must be right, and
//   they must be only numbers: no names, no phone numbers, nothing about any one shop.
//
// DANGER
//   1. Nothing here decides WHO may ask. The route's admin guard (requirePlatformAdmin)
//      does that BEFORE this code runs. Never call this from a shop owner's route.
//   2. The admin lock (app.platform_admin = 'on') is opened only by withAdminLock, inside
//      a transaction. Do not run this query on the plain pool: the shops table is locked
//      per shop and would answer with zero.
//   3. Counts must leave out DELETED shops. A deleted shop is gone as far as the admin is
//      concerned, so it must not inflate any number.
//   4. COUNT returns a big number as TEXT in the pg driver. We cast to int so the screen
//      receives real numbers (and never the text "12").
//
// WHAT IT SOLVES
//   "How big is the platform, and how is it doing, at a glance?"
//
// SYSTEM DESIGN PRINCIPLE
//   Service layer: the rule lives here, testable without a web server.
//   One round trip: a single SELECT with FILTER counts all five numbers at once, so the
//   numbers always agree with each other (one consistent snapshot).
//   Data minimisation: only counts leave this file.
//
// RULES
//   1. total          = shops that are not deleted.
//   2. active         = status 'active'.
//   3. suspended      = status 'suspended'.
//   4. verified       = not deleted AND verified_at is set.
//   5. newThisWeek    = not deleted AND created in the last 7 days.
//   6. Read only. It changes nothing and writes no receipt (a receipt is for CHANGES).
//
// PRACTICAL EXAMPLE
//   getPlatformStats(pool) -> { shops: { total: 9, active: 8, suspended: 1, verified: 2,
//   newThisWeek: 3 } }
//   Real life: the county office manager asks "how many businesses are registered, how many
//   are closed, how many did we verify, how many joined this week?" and gets one tally sheet.
//
// DECISIONS
//   - The answer is { shops: { ... } }, not a flat object, so later batches can add
//     orders or revenue beside it without renaming anything.
//   - "Last 7 days" is a rolling window (NOW() minus 7 days), not "since Monday".
//   - No cache. The query is one cheap scan with a counter per column. When the platform is
//     big enough for that to matter, add a cache then.
//
// WHERE USED
//   apps/api/src/controllers/adminStats.controller.js
//
// TRADEOFFS
//   + One query, one consistent answer, trivial to test.
//   - Counts every shop on each call. Fine for thousands of shops. For millions we would
//     keep a running tally table instead.
//
// HOW TO USE
//   import { getPlatformStats } from '../services/adminStats.service.js';
//   const stats = await getPlatformStats(pool);
// =============================================================================

// PIECE BY PIECE
//   withAdminLock()  = open the head-office lock for this one transaction.
//   COUNT(*) FILTER  = count only the rows that match the condition after FILTER.
//   ::int            = turn the count into a real number.
//   the return value = a small, plain object the screen can draw.

import { withAdminLock } from './platformAdmin.service.js';

export async function getPlatformStats(db) {
  return withAdminLock(db, async (client) => {
    // One query, five counters. Real life: one pass down the register with five tally marks.
    const { rows } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'deleted')::int                                     AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int                                       AS active,
        COUNT(*) FILTER (WHERE status = 'suspended')::int                                    AS suspended,
        COUNT(*) FILTER (WHERE status <> 'deleted' AND verified_at IS NOT NULL)::int         AS verified,
        COUNT(*) FILTER (WHERE status <> 'deleted'
                           AND created_at >= NOW() - INTERVAL '7 days')::int                 AS new_this_week
        FROM tenants`);

    const r = rows[0];
    return {
      shops: {
        total: r.total,
        active: r.active,
        suspended: r.suspended,
        verified: r.verified,
        newThisWeek: r.new_this_week,
      },
    };
  });
}

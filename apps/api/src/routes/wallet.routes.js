// =============================================================================
// FILE: apps/api/src/routes/wallet.routes.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Gives the wallet controller a web address: GET /v1/wallet/entries.
//   A route file only connects "this address" to "that function". The real work
//   (day totals, running balance, paging) is in controllers/wallet.controller.js.
//
// WHY IMPORTANT
//   Where this router is mounted (in app.js) decides who can reach it. The mount
//   line carries the login check and the shop lock. That is what keeps one shop's
//   money away from another shop.
//
// DANGER
//   1. Never mount this router without requireAuth and withTenant (see app.js).
//      Without the shop lock, the ledger page could read every shop's money.
//   2. Always wrap the handler in asyncHandler, so an error inside it becomes a
//      clean error reply instead of a request that hangs forever.
//   3. Mount it above the "unknown address" (404) catch-all in app.js, or the
//      catch-all answers first.
//   4. Keep it GET only. The ledger is append-only and the Payments page must
//      never be able to change money. Money is written by the M-Pesa callback,
//      not by this router.
//
// WHAT IT SOLVES
//   Day 4 Task 3 wiring: GET /v1/wallet/entries?limit=50&cursor=...
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes connect, controllers work.
//
// RULES
//   1. No logic in this file.
//   2. GET only. The wallet page only reads.
//
// PRACTICAL EXAMPLE
//   Amina opens the Payments page. The web server calls GET /v1/wallet/entries
//   with her login cookie. app.js checks the cookie (requireAuth), locks the
//   database to her shop (withTenant), then this router passes the request to
//   listWalletEntries.
//
// WHERE USED
//   apps/api/src/app.js:  app.use('/v1/wallet', requireAuth, withTenant, walletRouter);
//
// TRADEOFFS
//   + Tiny, easy to read.
//   - One more file for one line of wiring (the project's usual layout).
//
// HOW TO USE
//   Import it in app.js and mount it behind the two guards.
//
// =============================================================================
// EXPLAINED PIECE BY PIECE (simple words, real life)
// =============================================================================
//
// PIECE 1: Router()  =  "A SMALL SWITCHBOARD"
//   A mini list of addresses that app.js plugs in under /v1/wallet.
//   Real life: one extension line on the office phone system.
//
// PIECE 2: router.get('/entries', ...)  =  "WHEN SOMEONE ASKS FOR THE LEDGER LINES"
//   '/entries' here means exactly /v1/wallet/entries (the /v1/wallet part comes
//   from app.js). GET means "just show me", never "change something".
//
// PIECE 3: asyncHandler(listWalletEntries)  =  "A SAFETY NET AROUND THE WORKER"
//   listWalletEntries waits for the database (async). If it fails, asyncHandler
//   catches the failure and hands it to the error reply. Real life: a net under
//   a trapeze artist.
// =============================================================================

import { Router } from 'express';
import { listWalletEntries } from '../controllers/wallet.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/entries', asyncHandler(listWalletEntries));

export default router;
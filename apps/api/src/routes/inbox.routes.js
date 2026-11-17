// =============================================================================
// FILE: apps/api/src/routes/inbox.routes.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Gives the inbox controller a web address: GET /v1/inbox.
//   A route file only connects "this address" to "that function". The real work
//   is in controllers/inbox.controller.js.
//
// WHY IMPORTANT
//   Where this router is mounted (in app.js) decides who can reach it. The mount
//   line carries the login check and the shop lock, which is the safety story.
//
// DANGER
//   1. Never mount this router without requireAuth and withTenant (see app.js).
//      Without the shop lock, the inbox would read every shop's messages.
//   2. Always wrap the handler in asyncHandler, so an error inside it becomes a
//      clean error reply instead of a request that hangs forever.
//   3. Mount it above the "unknown address" (404) catch-all in app.js, or the
//      catch-all answers first.
//
// WHAT IT SOLVES
//   Day 4 Task 1 wiring: GET /v1/inbox?limit=20&cursor=...
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: routes connect, controllers work.
//
// RULES
//   1. No logic in this file.
//   2. GET only. The inbox only reads.
//
// PRACTICAL EXAMPLE
//   Amina opens the Inbox page. The web server calls GET /v1/inbox with her login
//   cookie. app.js checks the cookie (requireAuth), locks the database to her
//   shop (withTenant), then this router passes the request to listInbox.
//
// WHERE USED
//   apps/api/src/app.js:  app.use('/v1/inbox', requireAuth, withTenant, inboxRouter);
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
//   A mini list of addresses that app.js plugs in under /v1/inbox.
//   Real life: one extension line on the office phone system.
//
// PIECE 2: router.get('/', ...)  =  "WHEN SOMEONE ASKS FOR THE INBOX ITSELF"
//   '/' here means exactly /v1/inbox (the /v1/inbox part comes from app.js).
//   GET means "just show me", never "change something".
//
// PIECE 3: asyncHandler(listInbox)  =  "A SAFETY NET AROUND THE WORKER"
//   listInbox waits for the database (async). If it fails, asyncHandler catches
//   the failure and hands it to the error reply. Real life: a net under a
//   trapeze artist.
// =============================================================================

import { Router } from 'express';
import { listInbox } from '../controllers/inbox.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(listInbox));

export default router;
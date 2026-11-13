/**
 * ============================================================
 * FILE: apps/api/src/routes/whatsapp.routes.js
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *   Connects the two WhatsApp webhook doors to their handlers, and
 *   puts the guard and the lock in the right ORDER on the POST door.
 *
 * WHY IMPORTANT
 *   Order is the security here. If withTenant ran before
 *   resolveWhatsappTenant, there would be no shop to lock to. If the
 *   handler ran without withTenant, queries would not be filtered by
 *   the shop.
 *
 * DANGER
 *   - Do NOT add requireAuth. Meta's servers have no login cookie.
 *     (Later: check Meta's X-Hub-Signature-256 header instead.)
 *   - Do NOT put resolveWhatsappTenant or withTenant on the GET door:
 *     the verify handshake carries no phone_number_id, and it must
 *     work before any shop is known.
 *   - Keep resolveWhatsappTenant BEFORE withTenant on the POST door.
 *
 * WHAT IT SOLVES
 *   Day 2, Task 2: "POST /webhooks/whatsapp resolves the tenant by
 *   phone_number_id, sets the RLS tenant, then processes".
 *
 * SYSTEM DESIGN PRINCIPLE
 *   "Stamp, then lock, then work": the same pattern as /v1/products
 *   (requireAuth -> withTenant) and /ussd (resolveUssdTenant -> withTenant).
 *
 * RULES
 *   1. GET  /  : handleVerify only (no shop yet).
 *   2. POST /  : resolveWhatsappTenant -> withTenant -> handleInbound.
 *   3. Mounted in app.js at /webhooks/whatsapp, before the 404
 *      catch-all.
 *
 * PRACTICAL EXAMPLE
 *   Customer messages Amina's number. Meta POSTs to
 *   /webhooks/whatsapp. The guard finds Amina, the lock fixes the
 *   database to Amina, the handler saves the message in her inbox.
 *
 * DECISIONS (and WHY)
 *   - Guard and lock live HERE (on the router), not in app.js, so the
 *     GET and POST doors can differ. USSD put them in app.js because it
 *     has only one door.
 *   - asyncHandler on both handlers: Express 4 does not catch async
 *     errors by itself.
 *
 * WHERE USED / FUTURE USES
 *   app.js: app.use('/webhooks/whatsapp', whatsappRouter)
 *   Later: signature check middleware before the guard.
 *
 * TRADEOFFS
 *   Guard + lock = two steps per message. Worth it: they are what keep
 *   shops apart.
 *
 * HOW TO USE
 *   import whatsappRouter from './routes/whatsapp.routes.js';
 *   app.use('/webhooks/whatsapp', whatsappRouter);
 * ============================================================
 */
// Router: Express's mini-app for a group of related URLs
import { Router } from 'express';

// asyncHandler: catches errors from async functions and passes them to the
// central error handler (so nothing hangs)
import { asyncHandler } from '../middleware/asyncHandler.js';

// The guard (finds the shop) and the lock (fixes the database to that shop)
import { resolveWhatsappTenant } from '../middleware/resolveWhatsappTenant.js';
import { withTenant } from '../middleware/withTenant.js';

// The two handlers
import { handleVerify, handleInbound } from '../controllers/whatsapp.controller.js';

// Create this file's router
const router = Router();

// GET /webhooks/whatsapp -> Meta's handshake. No guard, no lock: no shop is
// known yet, and the handler checks the verify token itself.
router.get('/', asyncHandler(handleVerify));

// POST /webhooks/whatsapp -> a customer message. Order matters:
// 1) find the shop  2) lock the database to it  3) do the work
router.post('/', resolveWhatsappTenant, withTenant, asyncHandler(handleInbound));

// Share the router so app.js can mount it
export default router;
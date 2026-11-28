// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/controllers/shopProfile.controller.js   (Week 30 Day 3, Batch 4b)
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Answers the two questions the owner's Shop profile page asks:
//     GET /v1/shop/profile  "what does my card say now?"
//     PUT /v1/shop/profile  "save these changes to my card".
//
// WHY IMPORTANT
//   It is the gatekeeper for what an owner may write: lengths are limited, the WhatsApp
//   number must be a real Kenyan mobile number, and unknown fields are refused.
//
// DANGER
//   1. Mounted behind requireAuth and withTenant, so req.db is locked to the owner's
//      shop. Never read a shop id from the request body.
//   2. The WhatsApp number is stored in the app's one phone shape (2547XXXXXXXX) so
//      it matches customers and M-Pesa numbers.
//   3. .strict() on the form: a field the form does not know about is an error, not
//      silently ignored. (A typo like "listInMarketplce" must not quietly do nothing.)
//
// WHAT IT SOLVES
//   Safe reading and saving of the shop's business card, with clear field-by-field errors.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin controller: check the form (Zod), call the service, answer. The database work
//   lives in shopProfile.service.js.
//
// RULES
//   1. town max 60, short description max 160, delivery areas max 300.
//   2. Empty text means "clear this box" and is saved as NULL.
//   3. Only send the boxes you want to change.
//
// PRACTICAL EXAMPLE
//   PUT /v1/shop/profile  { "town": "Kitengela", "whatsappNumber": "0712 345 678",
////                           "listInMarketplace": true }
//   -> { data: { town: "Kitengela", whatsapp_number: "254712345678",
//                list_in_marketplace: true, ... }, error: null }
//
// DECISIONS
//   - Requests are camelCase (like products), responses snake_case (like the rest).
//   - A wrong WhatsApp number is reported under details.whatsappNumber.
//
// WHERE USED
//   shopProfile.routes.js
//
// TRADEOFFS
//   + Simple. - PUT behaves like a "partial save" (only sent fields change); that is
//     friendlier for forms than a strict full replace.
//
// HOW TO USE
//   Mounted in app.js:  app.use('/v1/shop/profile', requireAuth, withTenant,
//                                blockWritesWhenSuspended, shopProfileRouter);
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// text(max)         = A BOX THAT TAKES WORDS UP TO A LIMIT; blank becomes "empty".
// whatsappNumber    = THE PHONE BOX: any normal way of writing a Kenyan mobile number
//                     is turned into one standard shape, or refused.
// Form (strict)     = THE WHOLE FORM; unknown boxes are refused.
// getProfile        = "SHOW ME MY CARD".
// updateProfile     = "SAVE MY CHANGES": check, translate names, save, show the saved card.
// ═══════════════════════════════════════════════════════════

import { z } from 'zod';
import { normalizePhone } from '../services/daraja.service.js';
import { readProfile, saveProfile } from '../services/shopProfile.service.js';
import { validationError } from '../utils/validationError.js';

// text(max): trims spaces, turns empty into null, and refuses text longer than max.
const text = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

// The phone box: empty clears it; anything else must be a valid Kenyan mobile number.
const phone = z
  .string()
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;          // not sent: leave the box alone
    if (v === null || v.trim() === '') return null; // empty: clear the box
    try {
      return normalizePhone(v);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Not a valid Kenyan mobile number' });
      return z.NEVER;
    }
  });

const Form = z
  .object({
    town: text(60),
    shortDescription: text(160),
    whatsappNumber: phone,
    deliveryAreas: text(300),
    listInMarketplace: z.boolean().optional(),
  })
  .strict();

// GET /v1/shop/profile
export async function getProfile(req, res) {
  const data = await readProfile(req.db);
  res.json({ data, error: null });
}

// PUT /v1/shop/profile
export async function updateProfile(req, res) {
  const parsed = Form.safeParse(req.body ?? {});
  if (!parsed.success) return validationError(res, parsed.error);
  const f = parsed.data;

  // Translate to the API's snake_case names, keeping ONLY what was sent.
  const names = {
    town: 'town',
    shortDescription: 'short_description',
    whatsappNumber: 'whatsapp_number',
    deliveryAreas: 'delivery_areas',
    listInMarketplace: 'list_in_marketplace',
  };
  const changes = {};
  for (const [key, column] of Object.entries(names)) {
    if (f[key] !== undefined) changes[column] = f[key];
  }

  const data = await saveProfile(req.db, req.tenantId, changes);
  res.json({ data, error: null });
}

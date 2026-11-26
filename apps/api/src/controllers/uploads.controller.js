// =============================================================================
// FILE: apps/api/src/controllers/uploads.controller.js   (Week 30, product photos)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Handles POST /v1/uploads/sign. A logged-in shop owner asks "may I upload a
//   photo?" and we answer with the signed permit made by cloudinary.service.js.
//
// WHY IMPORTANT
//   It is the only door to our Cloudinary account. If it were open to anyone,
//   strangers could fill our photo storage.
//
// DANGER
//   1. It must stay behind requireAuth (see app.js). No login = no permit.
//   2. The shop id comes from the login cookie (req.tenantId), NEVER from the
//      request body, so a shop cannot ask for another shop's folder.
//   3. Never put the API secret in the reply.
//
// WHAT IT SOLVES
//   Photo upload without our server carrying the photo.
//
// SYSTEM DESIGN PRINCIPLE
//   Thin controller: no logic here except "ask the service, send the answer".
//
// RULES
//   1. Reply in the usual envelope: { data, error }.
//   2. Not set up (missing Cloudinary settings) => 503 with code
//      'uploads_not_set_up', never a crash.
//
// PRACTICAL EXAMPLE
//   POST /v1/uploads/sign  (cookie of Mama Njeri's shop)
//   -> 200 { data: { cloudName, apiKey, timestamp, folder, signature }, error: null }
//
// WHERE USED
//   apps/api/src/routes/uploads.routes.js
//
// TRADEOFFS
//   + Tiny and easy to test.
//   - No rate limit yet: a logged-in user can ask for many permits. Cloudinary's
//     own plan limits are the safety net for now.
//
// HOW TO USE
//   Called by the web app's "Choose photo" button before it uploads.
// =============================================================================

// PIECE BY PIECE
//
// 1. import { makeUploadSignature } ...
//    = "call the person who knows how to stamp permits".
//    Real life: the clerk at the counter does not stamp slips himself. He walks
//    to the manager's desk (the service), who owns the stamp.
//
// 2. export async function signUpload(req, res)
//    = "the clerk's job". `req` is the customer's request, `res` is how we
//    answer. `async` because answering may take a moment.
//    Real life: Mama Njeri walks to the counter and says "I want to send a
//    photo of my dress".
//
// 3. try { ... } catch (err) { ... }
//    = "try the normal way; if something goes wrong, handle it nicely".
//    Real life: if the stamp pad is empty, the clerk says "sorry, not ready yet"
//    instead of shouting and walking out.
//
// 4. makeUploadSignature(req.tenantId)
//    = "make a permit for THIS shop". req.tenantId was put there by requireAuth
//    after reading the login cookie. The browser cannot change it.
//    Real life: the clerk reads the shop name from Mama Njeri's ID card, not
//    from what she says. So she cannot pretend to be another shop.
//
// 5. res.json({ data: permit, error: null })
//    = "send the permit back in our usual envelope". data = the answer,
//    error = null means all fine. Same shape as every other route, so the web
//    app reads every reply the same way.
//
// 6. err.code === 'uploads_not_set_up' -> status 503
//    = "the service is not ready" (the Cloudinary settings are missing on this
//    server). 503 means "temporarily unavailable, not your fault".
//    Real life: the shop's M-Pesa till is closed for the day. The customer did
//    nothing wrong; we simply cannot serve right now.
//
// 7. throw err (any other error)
//    = "I do not know this problem, pass it up". The central error handler in
//    app.js turns it into a clean 500 reply. Never swallow unknown errors,
//    or bugs hide.

import { makeUploadSignature } from '../services/cloudinary.service.js';

export async function signUpload(req, res) {
  try {
    const permit = makeUploadSignature(req.tenantId);
    return res.json({ data: permit, error: null });
  } catch (err) {
    if (err.code === 'uploads_not_set_up') {
      return res.status(503).json({
        data: null,
        error: { code: 'uploads_not_set_up', message: 'Photo uploads are not set up yet' },
      });
    }
    throw err; // anything else: the central error handler answers
  }
}
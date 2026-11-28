// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/utils/validationError.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Every controller that checks a form with Zod needs to answer a bad form in the
//   SAME way: HTTP 400, code "validation", and a "details" list that names each
//   broken field. This file writes that answer once.
//
// WHY IMPORTANT
//   The web forms read error.details.<field> to show the red message beside the
//   right box. If every controller built its own answer, one of them would drift
//   and a form would show nothing.
//
// DANGER
//   Do not change the shape of the answer: { error: { code, message, details } }.
//   The web app depends on exactly these three keys.
//
// WHAT IT SOLVES
//   One shared "your form has a problem here, and here" reply.
//
// SYSTEM DESIGN PRINCIPLE
//   DRY: one place for the error shape. (products.controller.js and
//   orders.controller.js still hold their own older copies; they can switch to this
//   one in a later clean-up, with no change in behaviour.)
//
// RULES
//   1. Call it with the response object and the error Zod gave you.
//   2. Never put the user's wrong value in the message (it may be private).
//
// PRACTICAL EXAMPLE
//   const parsed = Schema.safeParse(req.body);
//   if (!parsed.success) return validationError(res, parsed.error);
//
// WHERE USED
//   shopProfile.controller.js
//
// HOW TO USE
//   import { validationError } from '../utils/validationError.js';
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE
// ═══════════════════════════════════════════════════════════
// issue.path.join('.')  = THE LABEL ON THE BROKEN BOX, e.g. "town".
// issue.message         = WHAT IS WRONG WITH IT, e.g. "String must contain at most 60 character(s)".
// res.status(400)       = "THE REQUEST WAS WRONG, NOT THE SERVER".
// ═══════════════════════════════════════════════════════════

// validationError: answers a bad form with HTTP 400 and says WHICH boxes are wrong.
//   res      = the reply we are about to send back (Express "response").
//   zodError = what the form checker (Zod) found wrong.
export function validationError(res, zodError) {
  // details = a list: box name -> what is wrong with it.
  // Real life: the clerk circling "phone number" in red on your paper form.
  const details = {};

  // zodError.issues = one entry per problem found.
  for (const issue of zodError.issues) {
    // issue.path = where the problem is, for example ['whatsappNumber'].
    // join('.') turns it into the text "whatsappNumber". An empty path (the whole
    // body is wrong, for example not an object) is labelled "body".
    details[issue.path.join('.') || 'body'] = issue.message;
  }

  // 400 = "your request was wrong" (not "the server broke"). The web form reads
  // error.details.<box> to show a red message beside the right box.
  return res.status(400).json({
    error: {
      code: 'validation',                       // a short word the web app can test for
      message: 'Request validation failed',     // a plain sentence for people
      details,                                  // the box-by-box breakdown
    },
  });
}

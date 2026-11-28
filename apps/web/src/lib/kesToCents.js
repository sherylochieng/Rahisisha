// =============================================================================
// FILE: apps/web/src/lib/kesToCents.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - Owners type prices in shillings ("350" or "1,500.50"). The API stores
//   money as whole cents (KES 350 = 35000). This file converts one into the
//   other, safely
//
// WHY IMPORTANT:
// - Money is the one place we must never be "nearly right". In plain
//   JavaScript maths, 19.99 * 100 gives 1998.9999999999998. A price off by one
//   cent breaks totals, receipts and the wallet
//
// DANGER (if this file does not exist):
// - Each form multiplies by 100 on its own and some prices are saved a cent
//   wrong, or as "NaN"
//
// WHAT IT SOLVES:
// - "350"       -> 35000
// - "1,500.50"  -> 150050
// - "19.99"     -> 1999   (not 1998.9999999999998)
// - "abc", "-5", "1.234", ""  -> null (not a valid price)
//
// SYSTEM DESIGN PRINCIPLE: Never use decimals for money
// - We never multiply a decimal number. We read the text as digits and build
//   the cents from whole numbers only
//
// RULES:
// - Returns a whole number of cents, or null when the text is not a clean price
// - At most 2 digits after the dot
// - No negative prices, no letters, no scientific notation like "1e3"
// - Thousands commas are allowed only in the right places ("1,500" yes,
//   "1,,5" or "15,00" no)
// - At most 9 digits before the dot (stops absurd numbers)
// - The API still validates everything again. This file only helps the form
//   give a quick, friendly answer
//
// DECISIONS:
// 1. null (not an error) for bad input, so the form can show its own message
// 2. Zero is allowed (a free item or sample). The API accepts it too
//
// PRACTICAL EXAMPLE:
//   kesToCents('450')    -> 45000
//   kesToCents('7.5')    -> 750
//   kesToCents('7.555')  -> null
//
// WHERE USED:
// - components/owner/ProductForm.js
//
// TRADEOFFS:
// + Exact, tiny, easy to test
// - Only understands the shilling format with a dot (not "350,50" European style)
//
// HOW TO USE:
//   import { kesToCents } from '../lib/kesToCents';
//   const priceCents = kesToCents(form.get('price'));
//   if (priceCents === null) { /* show "Enter a price like 350 or 350.50" */ }
// =============================================================================

export function kesToCents(text) {
  // Only text can be a price
  if (typeof text !== 'string') return null;

  // Remove the spaces around it: " 1,500.50 " -> "1,500.50"
  const trimmed = text.trim();

  // Commas are allowed ONLY as proper thousands separators (1,500 or 12,000.50).
  // A typo like "1,,5" or "15,00" is refused instead of being guessed at
  if (trimmed.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(trimmed)) return null;

  // Now the commas can be dropped: "1,500.50" -> "1500.50"
  const clean = trimmed.replace(/,/g, '');

  // The only shape we accept: digits, then optionally a dot and 1 or 2 digits
  const match = clean.match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  // Whole shillings and the cents part, both still as text
  const shillings = match[1];
  // "5" after the dot means 50 cents, "05" means 5 cents, nothing means 0
  const centsText = (match[2] || '').padEnd(2, '0');

  // Whole-number maths only: shillings x 100 + cents
  return parseInt(shillings, 10) * 100 + parseInt(centsText, 10);
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// typeof text !== 'string' : anything that is not text is not a price
// trim()                   : removes spaces around the typing
// comma check              : "1,500" is fine, "1,,5" is refused. Real life: a
//                            shopkeeper writes "1,500 " on a tag, we read 1500,
//                            but a smudged "1,,5" is sent back to be rewritten
// replace(/,/g,'')         : drops the proper commas so the digits can be read
// the regular expression   : a strict gate. 1 to 9 digits, then an optional dot
//                            with 1 or 2 digits. Real life: a bouncer who only
//                            lets in prices that look like prices
// padEnd(2, '0')           : "5" -> "50" (KES 7.5 is 7 shillings 50 cents)
// parseInt(...) * 100 + ... : integer maths, so no 0.30000000000000004 surprises
// return null              : "this is not a usable price", and the form says so
// =============================================================================
// =============================================================================
// FILE: apps/web/src/lib/centsToKes.js
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The database keeps money in cents (KES 350 is 35000). The Edit form must
//   show the owner "350", not "35000". This turns cents back into the text the
//   owner types. It is the mirror image of kesToCents.js.
//
// WHY IMPORTANT
//   Show 35000 in the price box and an owner who presses Save would turn a KES
//   350 product into KES 35,000. Money bugs are the expensive kind.
//
// DANGER
//   - Always round-trips with kesToCents: kesToCents(centsToKes(x)) === x.
//   - Never uses floating point maths on money (no cents / 100). It uses whole
//     numbers only.
//
// WHAT IT SOLVES
//   Pre-filling the price box on the Edit page.
//
// SYSTEM DESIGN PRINCIPLE
//   Money is whole cents inside the system. Shillings with decimals exist only
//   at the screen, and only in these two small converter files.
//
// RULES
//   1. Input is whole cents (a non-negative integer). Anything else gives ''.
//   2. KES 350 shows as "350", KES 350.50 as "350.50", KES 350.05 as "350.05".
//
// EXAMPLES
//   centsToKes(35000) -> "350"
//   centsToKes(35050) -> "350.50"
//   centsToKes(35005) -> "350.05"
//   centsToKes(0)     -> "0"
//
// WHERE USED
//   components/ProductForm.js (edit mode).
//
// TRADEOFFS
//   No thousands commas ("1250", not "1,250"), so the text is exactly what
//   kesToCents accepts back, with no surprises.
// =============================================================================

export function centsToKes(cents) {
  const n = Number(cents);

  // Not a whole, non-negative number of cents: show an empty box, not "NaN"
  if (!Number.isInteger(n) || n < 0) return '';

  const shillings = Math.floor(n / 100);
  const rest = n % 100;

  // 35000 -> "350". Otherwise two digits after the dot: 35005 -> "350.05"
  return rest === 0 ? String(shillings) : `${shillings}.${String(rest).padStart(2, '0')}`;
}

// PIECE BY PIECE
//   Number(cents): a database driver may hand us "35000" as text. Make it a number.
//   Number.isInteger: cents are whole. 350.5 cents is nonsense, so show nothing.
//   Math.floor(n / 100): the shillings part. 35050 -> 350.
//   n % 100: what is left over, the cents. 35050 -> 50.
//   padStart(2, '0'): 5 cents becomes "05", so 350.05 is not mistaken for 350.5.
//   Real life: a till slip. KES 350 and 50 cents is written 350.50, never 350.5.
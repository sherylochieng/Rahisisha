# kesToCents.js: Typed Price To Whole Cents

**File:** `apps/web/src/lib/kesToCents.js`
**Doc:** `apps/web/docs/src/lib/kesToCents.md`
**Added:** Week 29 Day 4 follow-up

---

## WHY THIS FILE EXISTS

Owners type prices in shillings (`350`, `1,500.50`). The API stores money as whole cents (KES 350 is 35000). This file converts one into the other safely.

## WHY IMPORTANT

In plain JavaScript maths, `19.99 * 100` is `1998.9999999999998`. A price one cent off breaks totals, receipts and the wallet.

## DANGER

- Never multiply a decimal by 100 anywhere in the web app. Use this file.
- It returns `null` for a bad price. Never treat `null` as zero.
- The database column is a 32-bit whole number, so the form also refuses prices above 2,147,483,647 cents.

## WHAT IT SOLVES

`350` gives 35000, `1,500.50` gives 150050, `19.99` gives 1999. `abc`, `-5`, `1.234`, `1,,5`, `15,00` and an empty box give `null`.

## SYSTEM DESIGN PRINCIPLE

Never use decimals for money. The text is read as digits and the cents are built from whole numbers only.

## RULES

- At most 2 digits after the dot.
- No negatives, letters or scientific notation.
- Thousands commas only in the right places.
- At most 9 digits before the dot.
- The API validates again; this only gives the form a quick, friendly answer.

## PRACTICAL EXAMPLE

`kesToCents('7.5')` gives 750 (7 shillings 50 cents).

## TRADEOFFS

+ Exact and easy to test. - Understands only the dot format, not `350,50`.

## PIECE BY PIECE (simple words, real-life examples)

### The type check

Anything that is not text is not a price.

### The comma check

`1,500` is fine, `1,,5` is refused. Real life: a smudged number on a tag is sent back to be rewritten, not guessed.

### The regular expression

A strict gate: 1 to 9 digits, then an optional dot with 1 or 2 digits.

### padEnd and parseInt

`.5` becomes 50 cents. Whole-number maths only, so no 0.30000000000000004 surprises.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`, follow-up section). Last updated 18 November 2026.*

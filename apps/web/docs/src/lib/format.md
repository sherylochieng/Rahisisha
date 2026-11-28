# format.js: Money And Time Words

**File:** `apps/web/src/lib/format.js`
**Doc:** `apps/web/docs/src/lib/format.md`
**Added:** Week 29 Day 4

---

## WHY THIS FILE EXISTS

Inbox and Payments both show money and times. One file decides how.

## WHY IMPORTANT

A time in the wrong timezone makes owners distrust the page.

## DANGER

- Cents in, display out; never send formatted text back to the API.
- Always pass `timeZone: 'Africa/Nairobi'`; the server may be elsewhere.
- A day label is a DAY, pinned to noon +03:00 so it can never shift.

## WHAT IT SOLVES

`formatKes`, `formatKesSigned`, `formatNairobiTime`, `formatNairobiDay`.

## SYSTEM DESIGN PRINCIPLE

One source of truth for presentation.

## RULES

Pure functions, safe in server and client files.

## PRACTICAL EXAMPLE

`formatKesSigned(-20000)` is `-KES 200.00`; `formatNairobiDay('2026-01-02')` is `Fri, 2 Jan 2026`.

## TRADEOFFS

+ Tiny. - The older dashboard page still has its own private `formatKes` (left untouched).

## PIECE BY PIECE (simple words, real-life examples)

### `formatKes`

Divides cents by 100 and prints two decimals with thousands separators.

### `formatKesSigned`

Adds `+` or `-` in front, using the absolute value so the sign is not doubled.

### `formatNairobiTime`

Day, month, hour, minute in Nairobi time (24 hour).

### `formatNairobiDay`

Turns `YYYY-MM-DD` into `Fri, 2 Jan 2026`.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*

---

## Addition (Week 30 Day 3, Batch 2, part 2): formatNairobiDate

`formatNairobiDate(iso)` turns a timestamp into a plain Nairobi date such as `12 Nov 2026`. No time of day.

- **Why it exists:** the admin shops list shows when each shop joined. `formatNairobiTime` shows the day and the hour but no year, which is confusing in a list that spans months.
- **Why Nairobi time:** the same rule as the other helpers: a shop that joined at 11pm Nairobi time must show that day, not the next day in UTC.
- **Used by:** `components/admin/ShopsTable.js`.
- **Nothing else in this file changed.**

Line by line: `new Date(iso)` reads the timestamp; `toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day, month, year })` writes it in Kenyan format in Nairobi time.

// =============================================================================
// FILE: apps/web/src/lib/format.js  (Week 29 Day 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The Inbox and Payments pages both show money and times. Writing the
//   formatting twice would let the two pages drift apart (one shows "KES 12.00",
//   the other "Ksh12"). This file is the one place that decides how they look.
//
// WHY IMPORTANT
//   Owners read money and times all day. A time shown in the wrong timezone
//   ("3:00 AM" for a sale made at 6:00 AM) makes the owner distrust the page.
//
// DANGER
//   1. Money arrives from the API in WHOLE CENTS (integers). Divide by 100 only
//      here, only for DISPLAY. Never send a formatted string back to the API.
//   2. Times are shown in Nairobi time on purpose. The server running this code
//      may sit in another timezone, so the timezone is always passed in
//      explicitly (timeZone: 'Africa/Nairobi'), never left to the machine.
//   3. A day label such as '2026-01-02' is a calendar DAY, not a moment. We
//      build it at noon Nairobi time so no timezone can push it to the day
//      before or after.
//
// WHAT IT SOLVES
//   formatKes(150000)               -> "KES 1,500.00"
//   formatKesSigned(-20000)         -> "-KES 200.00"   (+KES 500.00 for credits)
//   formatNairobiTime(isoString)    -> "2 Jan, 09:30"
//   formatNairobiDay('2026-01-02')  -> "Fri, 2 Jan 2026"
//
// SYSTEM DESIGN PRINCIPLE
//   One source of truth for presentation. Pages ask for a format; they never
//   build one themselves.
//
// RULES
//   - Pure functions only: same input, same output, no fetching.
//   - Safe in server and client files (no next/headers here).
//
// TRADEOFFS
//   + Tiny and testable.
//   - The dashboard page still has its own private formatKes (written earlier).
//     It gives the same result for positive amounts; moving it here is a
//     future clean-up, left alone now so an old page is not touched.
//
// HOW TO USE
//   import { formatKes, formatNairobiTime } from '../../../lib/format';
// =============================================================================

// ---------------------------------------------------------------------------
// PIECE 1: formatKes
// Real life: the till receipt. 150000 cents becomes "KES 1,500.00".
// Math.abs is NOT used here: a negative number keeps its minus sign.
// ---------------------------------------------------------------------------
export function formatKes(cents) {
  return 'KES ' + (cents / 100).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// PIECE 2: formatKesSigned
// Real life: the M-Pesa statement. Money in shows "+", money out shows "-".
// The sign goes BEFORE "KES" ("-KES 200.00") so it is the first thing the eye sees.
// ---------------------------------------------------------------------------
export function formatKesSigned(cents) {
  const sign = cents < 0 ? '-' : '+';
  return sign + formatKes(Math.abs(cents));
}

// ---------------------------------------------------------------------------
// PIECE 3: formatNairobiTime
// Real life: the timestamp on a WhatsApp message, in the shop owner's own time.
// timeZone is set explicitly (see DANGER 2). hour12:false gives "09:30".
// ---------------------------------------------------------------------------
export function formatNairobiTime(iso) {
  return new Date(iso).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// PIECE 4: formatNairobiDay
// Real life: the date heading on a bank statement ("Fri, 2 Jan 2026").
// The day text 'YYYY-MM-DD' is pinned to NOON +03:00 first (see DANGER 3).
// ---------------------------------------------------------------------------
export function formatNairobiDay(day) {
  return new Date(`${day}T12:00:00+03:00`).toLocaleDateString('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
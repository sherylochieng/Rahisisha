// =============================================================================
// FILE: apps/api/src/services/adminLoginLimiter.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Slows down someone who keeps guessing the admin password. After too many
//   WRONG tries for one phone number (or from one address) in a short time, the
//   admin login answers "too many attempts, wait" instead of checking the
//   password again.
//
// WHY IMPORTANT
//   The admin login is the most valuable door in the whole system. Without a
//   limit, a program could try thousands of passwords a minute.
//
// DANGER
//   1. The counts live in this server's MEMORY. They reset when the server
//      restarts and are not shared between two servers. That is fine for one
//      server (Render free plan) but must move to a shared store (Redis or the
//      database) if we ever run several.
//   2. Locking by phone means an attacker who knows your number can lock YOU out
//      for 15 minutes by failing on purpose. For an admin door we accept that:
//      a 15 minute wait is better than a guessed password. The terminal script
//      can always reset the password.
//   3. Behind a hosting proxy, every visitor can look like the same address. The
//      address limit is therefore generous (it acts as a global brake), and the
//      phone limit is the sharp one.
//
// WHAT IT SOLVES
//   Brute-force guessing of the admin password.
//
// SYSTEM DESIGN PRINCIPLE
//   Fail closed and cheap: refuse BEFORE the expensive password check (bcrypt),
//   so an attacker cannot also use up our server's time.
//
// RULES
//   1. Window: 15 minutes (a failure is forgotten after that).
//   2. Per phone: at most 5 failures. Per address: at most 20 failures.
//   3. A successful login clears that phone's failures.
//   4. Old entries are swept so memory never grows without limit.
//
// PRACTICAL EXAMPLE
//   const gate = checkAdminLoginAllowed(phone, ip);
//   if (!gate.allowed) return 429 with gate.retryAfterSeconds;
//   ...password wrong...  recordAdminLoginFailure(phone, ip);
//   ...password right...  clearAdminLoginFailures(phone);
//
// DECISIONS
//   - The clock is a parameter (`now`) so tests can move time without waiting.
//   - Only FAILURES count. A customer of Rahisisha never uses this door.
//
// WHERE USED
//   controllers/adminAuth.controller.js (next sub-step), tests/adminLoginLimiter.test.js
//
// TRADEOFFS
//   + Tiny, no new dependency, easy to read and test.
//   - Memory only (see DANGER 1).
//
// HOW TO USE
//   import { checkAdminLoginAllowed, recordAdminLoginFailure,
//            clearAdminLoginFailures } from './adminLoginLimiter.js';
// =============================================================================

// PIECE BY PIECE
//   failures (a Map)      = the guard's notepad: for each phone and each address,
//                           the times of recent wrong tries.
//   recent(list, now)     = tear off the old lines: only the last 15 minutes count.
//   checkAdminLoginAllowed= the guard looks at the notepad BEFORE opening the
//                           door: "you tried 5 times, come back in N minutes".
//   recordAdminLoginFailure = she writes one more line when a try fails.
//   clearAdminLoginFailures = after a correct password she rubs out your lines.

// ── The settings ─────────────────────────────────────────────────────────────
// How long a failed try is remembered: 15 minutes, written in milliseconds
// (15 minutes x 60 seconds x 1000 milliseconds). After that the guard forgets it.
const WINDOW_MS = 15 * 60 * 1000;
// How many failed tries are allowed INSIDE that window before we say "wait".
// 5 per phone number: a real person who mistypes will never reach 5.
// 20 per address: generous, because behind a hosting proxy many visitors can
// look like one address, so this one is only a global brake.
const MAX_PER_PHONE = 5;
const MAX_PER_IP = 20;

// ── The guard's notepad ─────────────────────────────────────────────────────
// A Map is a list of "label -> value" pairs. Here: label -> the times (in
// milliseconds) of recent wrong tries. Labels look like "phone:254712345678" or
// "ip:41.90.1.2", so phones and addresses can never be mixed up.
// It lives in the server's MEMORY: it is wiped when the server restarts.
const failures = new Map();

// ── Helper 1: tear off the old lines ────────────────────────────────────────
// Keep only the failures that happened less than 15 minutes ago. Anything older
// is forgiven. `list || []` means "if this label has no lines yet, use an empty
// list instead of crashing".
function recent(list, now) {
  return (list || []).filter((at) => now - at < WINDOW_MS);
}

// ── Helper 2: how long must they wait? ──────────────────────────────────────
// The door opens again when the OLDEST remembered failure turns 15 minutes old.
// Math.min finds the oldest time. We add the window, subtract now, convert to
// seconds, and round UP (Math.ceil) so we never say "0 seconds" while still
// blocked. Math.max(1, ...) guarantees the answer is at least 1 second.
// Real life: "your first wrong try was at 9:00, come back at 9:15."
function secondsUntilFree(list, now) {
  const oldest = Math.min(...list);
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
}

// ═════════════════════════════════════════════════════════════════════════════
// QUESTION 1: "MAY THIS PHONE, FROM THIS ADDRESS, TRY THE PASSWORD NOW?"
// Call this BEFORE checking the password. `now` defaults to the real clock; tests
// pass their own so they do not have to wait 15 real minutes.
// ═════════════════════════════════════════════════════════════════════════════
export function checkAdminLoginAllowed(phone, ip, now = Date.now()) {
  // Read this phone's recent failures and this address's recent failures.
  const byPhone = recent(failures.get(`phone:${phone}`), now);
  const byIp = recent(failures.get(`ip:${ip}`), now);

  // 5 or more wrong tries for this phone: blocked, and say for how long.
  if (byPhone.length >= MAX_PER_PHONE) {
    return { allowed: false, retryAfterSeconds: secondsUntilFree(byPhone, now) };
  }
  // 20 or more wrong tries from this address (any phones): blocked too.
  if (byIp.length >= MAX_PER_IP) {
    return { allowed: false, retryAfterSeconds: secondsUntilFree(byIp, now) };
  }
  // Neither limit reached: go ahead and check the password.
  return { allowed: true, retryAfterSeconds: 0 };
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 2: WRITE DOWN ONE MORE WRONG TRY
// Call this each time a password check FAILS.
// ═════════════════════════════════════════════════════════════════════════════
export function recordAdminLoginFailure(phone, ip, now = Date.now()) {
  // We keep two lines on the notepad for every failure: one under the phone, one
  // under the address.
  for (const key of [`phone:${phone}`, `ip:${ip}`]) {
    // First drop the old lines (so the list never grows without limit) ...
    const list = recent(failures.get(key), now);
    // ... then add the new failure time ...
    list.push(now);
    // ... and put the list back on the notepad.
    failures.set(key, list);
  }
  // Housekeeping: if the notepad has become very big (over 2000 labels), throw
  // away labels whose failures have ALL expired. This stops a flood of fake phone
  // numbers from slowly filling the server's memory.
  if (failures.size > 2000) {
    for (const [key, list] of failures) {
      if (recent(list, now).length === 0) failures.delete(key);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// JOB 3: FORGIVE A PHONE AFTER A CORRECT PASSWORD
// ═════════════════════════════════════════════════════════════════════════════
// Only the phone's line is cleared. The ADDRESS's line stays: it counts all the
// failed tries from that address, from every phone.
export function clearAdminLoginFailures(phone) {
  failures.delete(`phone:${phone}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// FOR TESTS ONLY: WIPE THE WHOLE NOTEPAD
// ═════════════════════════════════════════════════════════════════════════════
export function resetAdminLoginLimiter() {
  failures.clear();
}
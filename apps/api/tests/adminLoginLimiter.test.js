// =============================================================================
// FILE: apps/api/tests/adminLoginLimiter.test.js   (Week 30, platform admin: step 4)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the admin login brake works: 5 wrong tries for one phone, then a wait;
//   a different phone is not punished; a correct login clears the count; time
//   heals; and the address limit acts as a global brake.
//
// WHY IMPORTANT
//   If the brake is broken, the admin password can be guessed at machine speed.
//
// DANGER
//   Uses only made-up phones and addresses. No database, no secrets.
//
// WHAT IT SOLVES
//   Confidence in adminLoginLimiter.js without waiting 15 real minutes: the
//   clock is passed in as a number.
//
// SYSTEM DESIGN PRINCIPLE
//   Make time a parameter so time-based rules are testable.
//
// RULES
//   1. Each test starts with an empty notepad (resetAdminLoginLimiter).
//   2. Time is simulated with plain numbers (milliseconds).
//
// PRACTICAL EXAMPLE
//   npm test -- adminLoginLimiter
//
// DECISIONS
//   - No fake timers: passing `now` is simpler and clearer.
//
// WHERE USED
//   Normal test run and the pre-push hook.
//
// TRADEOFFS
//   + Instant and exact.
//   - Does not test the memory sweep with 2000+ keys (it is simple code).
//
// HOW TO USE
//   cd apps/api ; npm test -- adminLoginLimiter
// =============================================================================

// PIECE BY PIECE
//   T0         = a pretend "now", so we control the clock.
//   fail(n)    = "the guard writes n wrong tries for this phone on the notepad".
//   beforeEach = wipe the notepad so tests never affect each other.

// ── Bring in the four functions we are testing ──────────────────────────────
import {
  checkAdminLoginAllowed,   // "may this phone/address try now?"
  recordAdminLoginFailure,  // "write down one wrong try"
  clearAdminLoginFailures,  // "forgive this phone"
  resetAdminLoginLimiter,   // "wipe the notepad" (tests only)
} from '../src/services/adminLoginLimiter.js';

// ── Pretend clock ───────────────────────────────────────────────────────────
// T0 is a made-up "now" in milliseconds. WINDOW is 15 minutes in milliseconds
// (15 x 60 x 1000), the same length the real limiter uses.
const T0 = 1_000_000;
const WINDOW = 15 * 60 * 1000;

// ── Helper: write n wrong tries ─────────────────────────────────────────────
// Loops n times and records one failure each time, 1000 ms (1 second) apart,
// starting at `start`. Real life: the guard writing n lines on the notepad.
function fail(phone, ip, n, start = T0) {
  for (let i = 0; i < n; i += 1) recordAdminLoginFailure(phone, ip, start + i * 1000);
}

// ── Clean notepad before EVERY test ─────────────────────────────────────────
// So one test's failures can never leak into the next test.
beforeEach(() => resetAdminLoginLimiter());

describe('admin login limiter (Week 30)', () => {

  // CHECK 1. Four wrong tries are fine, the fifth locks the door.
  // Real life: the guard lets you try the lock a few times, then says "enough".
  test('1. four failures are allowed, the fifth blocks that phone', () => {
    // Write 4 wrong tries for this phone.
    fail('254700000001', '1.1.1.1', 4);
    // 4 is under the limit of 5, so the door is still open.
    expect(checkAdminLoginAllowed('254700000001', '1.1.1.1', T0 + 5000).allowed).toBe(true);
    // Write the 5th wrong try (at a later time, so it does not overwrite the others).
    fail('254700000001', '1.1.1.1', 1, T0 + 5000);
    // Now the count is 5: the door is shut.
    const gate = checkAdminLoginAllowed('254700000001', '1.1.1.1', T0 + 6000);
    expect(gate.allowed).toBe(false);
    // It tells the caller how long to wait: more than 0 and at most 15 minutes.
    expect(gate.retryAfterSeconds).toBeGreaterThan(0);
    expect(gate.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  // CHECK 2. Another phone is not punished for this phone's failures.
  // Real life: the guard blocks the person who kept guessing, not the next visitor.
  test('2. a different phone is still allowed', () => {
    // Five wrong tries for phone ...01 from address 1.1.1.1.
    fail('254700000001', '1.1.1.1', 5);
    // Phone ...01 is blocked even from a NEW address (the phone line is full).
    expect(checkAdminLoginAllowed('254700000001', '2.2.2.2', T0 + 6000).allowed).toBe(false);
    // Phone ...02 from that same new address is fine.
    expect(checkAdminLoginAllowed('254700000002', '2.2.2.2', T0 + 6000).allowed).toBe(true);
  });

  // CHECK 3. A correct login clears the phone's failures.
  // Real life: you finally use the right key, the guard rubs out your lines.
  test('3. a successful login clears that phone\'s failures', () => {
    // Four wrong tries, one short of being blocked.
    fail('254700000001', '1.1.1.1', 4);
    // Then a correct password: the phone's line is rubbed out.
    clearAdminLoginFailures('254700000001');
    // Four more wrong tries (from a different address, to keep the address count
    // out of the way). If the old four were still counted we would be at 8 and
    // blocked; because they were cleared we are at 4 and still allowed.
    fail('254700000001', '9.9.9.9', 4, T0 + 10_000);
    expect(checkAdminLoginAllowed('254700000001', '9.9.9.9', T0 + 20_000).allowed).toBe(true);
  });

  // CHECK 4. Time heals: after 15 minutes the old failures are forgotten.
  // Real life: come back after lunch and the guard has forgotten the morning.
  test('4. after the 15 minute window the phone is allowed again', () => {
    // Five wrong tries: blocked 10 seconds later ...
    fail('254700000001', '1.1.1.1', 5);
    expect(checkAdminLoginAllowed('254700000001', '1.1.1.1', T0 + 10_000).allowed).toBe(false);
    // ... but allowed once more than 15 minutes have passed (we just pass a
    // later `now`; no real waiting).
    expect(checkAdminLoginAllowed('254700000001', '1.1.1.1', T0 + WINDOW + 10_000).allowed).toBe(true);
  });

  // CHECK 5. The address limit is a global brake across many phones.
  // Real life: one stranger trying many different staff names from one spot.
  test('5. 20 failures from one address block that address, even for new phones', () => {
    // 20 wrong tries, each for a DIFFERENT phone (...0100 to ...0119), all from 3.3.3.3.
    // padStart(2, '0') turns 5 into '05' so every phone has the same length.
    for (let i = 0; i < 20; i += 1) recordAdminLoginFailure(`2547000001${String(i).padStart(2, '0')}`, '3.3.3.3', T0 + i);
    // A brand-new phone from the SAME address is blocked ...
    expect(checkAdminLoginAllowed('254799999999', '3.3.3.3', T0 + 100).allowed).toBe(false);
    // ... but the same new phone from another address is fine.
    expect(checkAdminLoginAllowed('254799999999', '4.4.4.4', T0 + 100).allowed).toBe(true);
  });
});
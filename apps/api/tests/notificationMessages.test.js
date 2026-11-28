// =============================================================================
// FILE: apps/api/tests/notificationMessages.test.js   (Week 30 Day 3, Batch 3b-2a, step 6)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Proves the wording file builds the right sentence for each message and keeps
//   unsafe or oversized blanks under control.
//
// WHY IMPORTANT
//   These sentences go to real people's phones. A missing shop name, a leaked
//   internal reason or a 5,000-character reason would embarrass the platform.
//
// DANGER
//   None: pure functions, no database, no network.
//
// WHAT IT SOLVES
//   Confidence that each template says what we mean, only the suspend message
//   shows the reason, and odd input is cleaned.
//
// SYSTEM DESIGN PRINCIPLE
//   Pure functions are the easiest thing to test: input in, text out.
//
// RULES
//   1. No database. 2. No random values. 3. One promise per test.
//
// PRACTICAL EXAMPLE
//   cd apps/api ; npm test -- notificationMessages
//
// DECISIONS
//   Checks use "contains" for the important words, not the whole sentence, so a
//   small wording polish does not break the tests.
//
// WHERE USED
//   Normal test run.
//
// TRADEOFFS
//   + Instant. - Does not prove delivery (the channel tests do that).
//
// HOW TO USE
//   npm test -- notificationMessages
// =============================================================================

import { renderMessage } from '../src/services/notificationMessages.js';
import { NOTIFICATION_TEMPLATES as T } from '../src/services/notifications.service.js';

describe('notification wording (Week 30 Day 3, Batch 3b-2a)', () => {

  // CHECK 1. Suspend says the shop name AND the reason.
  test('1. suspend names the shop and gives the reason', () => {
    const text = renderMessage(T.SHOP_SUSPENDED, { shopName: 'Mama Njeri Groceries', reason: 'fake M-Pesa messages' });
    expect(text).toContain('Rahisisha Biashara');
    expect(text).toContain('"Mama Njeri Groceries"');
    expect(text).toContain('suspended');
    expect(text).toContain('Reason: fake M-Pesa messages');
  });

  // CHECK 2. The other three name the shop and never show a reason.
  test('2. reinstate, verify and un-verify name the shop and show no reason', () => {
    for (const [template, word] of [
      [T.SHOP_REINSTATED, 'open again'],
      [T.SHOP_VERIFIED, 'now verified'],
      [T.SHOP_UNVERIFIED, 'removed'],
    ]) {
      const text = renderMessage(template, { shopName: 'Wanjiku Fashions', reason: 'internal note' });
      expect(text).toContain('"Wanjiku Fashions"');
      expect(text).toContain(word);
      expect(text).not.toContain('internal note');
      expect(text).not.toContain('Reason');
    }
  });

  // CHECK 3. Hidden characters and line breaks are cleaned.
  test('3. control characters and line breaks are cleaned from the blanks', () => {
    const text = renderMessage(T.SHOP_SUSPENDED, { shopName: 'Odd\u0000\nName', reason: 'line one\r\nline two\t!' });
    expect(text).toContain('"Odd Name"');
    expect(text).toContain('Reason: line one line two !');
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u001F]/.test(text)).toBe(false);
  });

  // CHECK 4. Oversized blanks are cut.
  test('4. a very long shop name and reason are limited', () => {
    const text = renderMessage(T.SHOP_SUSPENDED, { shopName: 'N'.repeat(300), reason: 'R'.repeat(2000) });
    expect(text).toContain(`"${'N'.repeat(80)}"`);
    expect(text).not.toContain('N'.repeat(81));
    expect(text).toContain('R'.repeat(500));
    expect(text).not.toContain('R'.repeat(501));
  });

  // CHECK 5. Missing blanks use friendly fallbacks, never "undefined".
  test('5. missing blanks never print undefined', () => {
    const text = renderMessage(T.SHOP_SUSPENDED, {});
    expect(text).toContain('"your shop"');
    expect(text).toContain('Reason: not given');
    expect(text).not.toContain('undefined');
    expect(renderMessage(T.SHOP_VERIFIED, null)).toContain('"your shop"');
    expect(renderMessage(T.SHOP_VERIFIED, [1, 2])).toContain('"your shop"');
  });

  // CHECK 6. An unknown template is a permanent error.
  test('6. an unknown template throws a permanent error', () => {
    let error;
    try { renderMessage('shop.invented', {}); } catch (err) { error = err; }
    expect(error).toBeDefined();
    expect(error.permanent).toBe(true);
    // Names that exist on every object must not be mistaken for templates.
    expect(() => renderMessage('toString', {})).toThrow();
  });
});

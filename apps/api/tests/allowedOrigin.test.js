// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/allowedOrigin.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   It proves the CORS rule in utils/allowedOrigin.js lets in our own
//   websites (main site and every shop) and keeps out everyone else.
//
// WHY IMPORTANT
//   This rule is a security door. A mistake in either direction hurts:
//   too strict = shops cannot log in, too loose = a stranger's website
//   can act as a logged-in user.
//
// DANGER (what breaks without it)
//   Someone later "simplifies" the rule to endsWith("rahisishabiashara.com")
//   and look-alike domains slip through. Nobody notices until it is abused.
//
// WHAT IT SOLVES
//   Locks in the rule with examples, including the sneaky look-alikes.
//
// SYSTEM DESIGN PRINCIPLE
//   "Test the security rule with attackers' examples, not only friendly ones."
//   Pure functions (no database, no network) are the cheapest, fastest
//   tests, so we test the rule on its own.
//
// RULES
//   1. NEVER delete a "REFUSED" test to make a change pass. If one fails,
//      the change opened a hole.
//   2. Pass settings through the env argument. Do NOT edit process.env.
//
// PRACTICAL EXAMPLE
//   https://mama-mboga.rahisishabiashara.com -> allowed
//   https://evilrahisishabiashara.com        -> refused
//
// DECISIONS
//   - Plain unit tests: no database, so they run in milliseconds.
//   - Each case has its own name that reads like a sentence, so a failure
//     explains itself.
//   - Two sets of settings (prod and laptop), because the rule behaves
//     differently on each, and both must keep working.
//
// WHERE USED
//   npm test (and the GitHub robot, on every push).
//
// TRADEOFFS
//   + Fast, no setup.
//   - Tests only the rule, not the real browser. The staging site covers that.
//
// HOW TO USE
//   npm test -- allowedOrigin
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. import { describe, test, expect }  =  THE TOOLBOX
//    describe = a labelled folder of tests. test = one question.
//    expect = "I expect the answer to be ...".
//    WHERE: every Jest test file starts with these.
//
// 2. const prod = {...}  =  THE LIVE SETTINGS, WRITTEN DOWN
//    The same three settings the online API has in Render. We pass them in
//    by hand, so the test never touches the real settings.
//    EXAMPLE: practising a fire drill with a pretend building.
//
// 3. const laptop = {...}  =  YOUR LAPTOP'S SETTINGS
//    No ROOT_DOMAIN, only WEB_ORIGIN. Proves we did not break your local work.
//
// 4. describe('...')  =  A FOLDER LABEL
//    Groups similar tests, so a failure reads like:
//    "look-alikes are REFUSED > a look-alike without the dot is refused".
//
// 5. test('...', () => { expect(...).toBe(true) })  =  ONE QUESTION, ONE ANSWER
//    We ask the rule "may this address in?" and say what we expect.
//    toBe(true) = allowed. toBe(false) = refused.
//
// 6. The look-alike tests  =  THE FAKE-ID TESTS
//    A bouncer must refuse fake IDs, not just welcome real ones.
//    evilrahisishabiashara.com looks close to ours, but it is NOT a room
//    inside our house, so the answer must be false.
//
// 7. The corsOrigin test  =  CHECKING THE FORM, NOT THE DECISION
//    The cors library does not want true/false. It wants us to call a
//    function it hands us. We give a spy function that records the answer.
// ═══════════════════════════════════════════════════════════

import { describe, test, expect } from '@jest/globals';
import { isAllowedOrigin, corsOrigin } from '../src/utils/allowedOrigin.js';

// The settings the live (staging) API runs with
// (NODE_ENV production = https only; ROOT_DOMAIN = our street name)
const prod = {
  NODE_ENV: 'production',
  ROOT_DOMAIN: 'rahisishabiashara.com',
  WEB_ORIGIN: 'https://rahisishabiashara.com',
};

// The settings on a laptop: no ROOT_DOMAIN, one fixed website address
const laptop = {
  NODE_ENV: 'development',
  WEB_ORIGIN: 'http://localhost:3001',
};

// ── Group 1: friendly visitors are let in ────────────────────
describe('isAllowedOrigin: our own websites', () => {
  // The front door of the house
  test('the main domain is allowed', () => {
    expect(isAllowedOrigin('https://rahisishabiashara.com', prod)).toBe(true);
  });

  // A room inside the house: this is the case that was broken before Task 8
  test('a shop address is allowed', () => {
    expect(isAllowedOrigin('https://mama-mboga.rahisishabiashara.com', prod)).toBe(true);
  });

  // Browsers sometimes send capitals. Capitals must not change the answer
  test('a shop address with letters in capitals is allowed', () => {
    expect(isAllowedOrigin('https://Mama-Mboga.RahisishaBiashara.com', prod)).toBe(true);
  });

  // Our own website's server, tests and curl send no Origin at all
  test('no Origin at all (curl, our own server) is allowed', () => {
    expect(isAllowedOrigin(undefined, prod)).toBe(true);
  });
});

// ── Group 2: look-alikes and strangers are turned away ───────
describe('isAllowedOrigin: look-alikes and strangers are REFUSED', () => {
  // The classic trick: a name that ENDS with ours but has no dot before it
  test('a look-alike without the dot is refused', () => {
    expect(isAllowedOrigin('https://evilrahisishabiashara.com', prod)).toBe(false);
  });

  // The other classic trick: our name used as the START of a stranger's address
  test('our domain used as a prefix of a stranger is refused', () => {
    expect(isAllowedOrigin('https://rahisishabiashara.com.evil.com', prod)).toBe(false);
  });

  // An ordinary stranger
  test('a completely different website is refused', () => {
    expect(isAllowedOrigin('https://example.com', prod)).toBe(false);
  });

  // In production, only the secure lock (https). Plain http can be spied on
  test('plain http is refused in production', () => {
    expect(isAllowedOrigin('http://mama-mboga.rahisishabiashara.com', prod)).toBe(false);
  });

  // Garbage must be refused calmly, never crash the API
  test('a made-up value that is not an address is refused, not a crash', () => {
    expect(isAllowedOrigin('not a url', prod)).toBe(false);
  });

  // Only web addresses count (http or https). Anything else is refused
  test('a non-web address (ftp) is refused', () => {
    expect(isAllowedOrigin('ftp://rahisishabiashara.com', prod)).toBe(false);
  });
});

// ── Group 3: your laptop keeps working exactly as before ─────
describe('isAllowedOrigin: the laptop behaves like before', () => {
  // The old rule: the one WEB_ORIGIN address is allowed
  test('WEB_ORIGIN is still allowed', () => {
    expect(isAllowedOrigin('http://localhost:3001', laptop)).toBe(true);
  });

  // With no ROOT_DOMAIN there is no domain rule, so other addresses are refused
  test('anything else is refused when there is no ROOT_DOMAIN', () => {
    expect(isAllowedOrigin('http://localhost:9999', laptop)).toBe(false);
  });
});

// ── Group 4: the shape the cors library needs ────────────────
describe('corsOrigin: the shape the cors library expects', () => {
  test('calls back with (null, true) for an allowed origin', () => {
    // "answer" is our spy note: it records what corsOrigin told the library.
    // No Origin means allowed, so we do not depend on any real settings.
    let answer;
    corsOrigin(undefined, (err, allowed) => { answer = [err, allowed]; });

    // null = "no error", true = "allowed"
    expect(answer).toEqual([null, true]);
  });
});
// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/getShopSlug.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   It proves utils/getShopSlug.js picks the right shop (or no shop)
//   from a request, both online and on a laptop.
//
// WHY IMPORTANT
//   This decides who can log in where. The exact bug that blocked every
//   online login (the shop word was always "api") is locked in below, so
//   it can never come back unnoticed.
//
// DANGER (what breaks without it)
//   A later edit makes the function read the API's own address again.
//   Everything passes on a laptop and breaks only online.
//
// WHAT IT SOLVES
//   Turns "login works online" from a hope into a checked fact.
//
// SYSTEM DESIGN PRINCIPLE
//   "Pin a past bug with a test." The first test below is the bug itself.
//   A pure function with fake requests needs no database or server.
//
// RULES
//   1. NEVER delete the "the exact bug" test. It is the reason this file exists.
//   2. Build fake requests with the req() helper. Do NOT edit process.env.
//
// PRACTICAL EXAMPLE
//   A browser on mama-mboga.rahisishabiashara.com calls
//   api.rahisishabiashara.com. The shop must be "mama-mboga", not "api".
//
// DECISIONS
//   - A tiny req() helper builds a fake request with only headers, which is
//     all the function reads.
//   - Settings are passed in by hand (prod, laptop), like in the CORS test.
//
// WHERE USED
//   npm test (and the GitHub robot).
//
// TRADEOFFS
//   + Instant, no setup.
//   - Does not test login itself. The staging site does.
//
// HOW TO USE
//   npm test -- getShopSlug
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. req(headers)  =  A FAKE VISITOR
//    Express hands the real function a request with headers. We build a tiny
//    pretend one, like a mannequin in a shop-window test.
//
// 2. prod / laptop  =  THE TWO WORLDS
//    Online has ROOT_DOMAIN. A laptop does not. Both must work.
//
// 3. "the exact bug" test  =  THE CRIME SCENE, KEPT AS EVIDENCE
//    Host is api.rahisishabiashara.com (where the call lands) and Origin is
//    the shop page. The answer must be the SHOP.
//
// 4. reserved words  =  OUR OWN SIGNS ON THE BUILDING
//    www and api are never shops, so they give null (main entrance).
//
// 5. look-alikes  =  THE FAKE-ID TESTS
//    A name that merely ends like ours must not be treated as our shop.
// ═══════════════════════════════════════════════════════════

import { describe, test, expect } from '@jest/globals';
import { getShopSlug } from '../src/utils/getShopSlug.js';

// A fake request: the function only reads headers
const req = (headers) => ({ headers });

// The settings the live (staging) API runs with
const prod = { ROOT_DOMAIN: 'rahisishabiashara.com' };

// A laptop: no ROOT_DOMAIN at all
const laptop = {};

// ── Online: the visitor's own address decides the shop ───────
describe('getShopSlug online (ROOT_DOMAIN set)', () => {
  // THE bug: the call lands on api.…, but the visitor is on a shop page
  test('the exact bug: a call from a shop page to api. gives the SHOP', () => {
    const r = req({
      host: 'api.rahisishabiashara.com',
      origin: 'https://mama-mboga.rahisishabiashara.com',
    });
    expect(getShopSlug(r, prod)).toBe('mama-mboga');
  });

  // The main entrance: login/signup on the plain domain
  test('a call from the main site gives no shop (null)', () => {
    const r = req({
      host: 'api.rahisishabiashara.com',
      origin: 'https://rahisishabiashara.com',
    });
    expect(getShopSlug(r, prod)).toBeNull();
  });

  // www is the main site too
  test('www is not a shop', () => {
    const r = req({
      host: 'api.rahisishabiashara.com',
      origin: 'https://www.rahisishabiashara.com',
    });
    expect(getShopSlug(r, prod)).toBeNull();
  });

  // No Origin (not a browser call): fall back to the Host
  test('no Origin and Host is api. gives no shop (api is reserved)', () => {
    const r = req({ host: 'api.rahisishabiashara.com' });
    expect(getShopSlug(r, prod)).toBeNull();
  });

  // No Origin, but the Host itself is a shop address
  test('no Origin and Host is a shop address gives that shop', () => {
    const r = req({ host: 'kamau.rahisishabiashara.com' });
    expect(getShopSlug(r, prod)).toBe('kamau');
  });

  // Capitals and a port must not change the answer
  test('capitals and a port are ignored', () => {
    const r = req({
      host: 'API.rahisishabiashara.com:443',
      origin: 'https://Mama-Mboga.RahisishaBiashara.com',
    });
    expect(getShopSlug(r, prod)).toBe('mama-mboga');
  });
});

// ── Online: look-alikes and nonsense are NOT our shops ───────
describe('getShopSlug online: strangers and nonsense', () => {
  // Ends like ours but there is no dot: not a room in our house
  test('a look-alike domain gives no shop', () => {
    const r = req({
      host: 'api.rahisishabiashara.com',
      origin: 'https://evilrahisishabiashara.com',
    });
    expect(getShopSlug(r, prod)).toBeNull();
  });

  // Our name as the START of a stranger's address
  test('our domain as a prefix of a stranger gives no shop', () => {
    const r = req({
      host: 'api.rahisishabiashara.com',
      origin: 'https://mama.rahisishabiashara.com.evil.com',
    });
    expect(getShopSlug(r, prod)).toBeNull();
  });

  // Garbage must never crash the login
  test('a made-up Origin does not crash, and falls back to Host', () => {
    const r = req({
      host: 'api.rahisishabiashara.com',
      origin: 'not a url',
    });
    expect(getShopSlug(r, prod)).toBeNull();
  });

  // A request with no headers at all
  test('no headers at all gives no shop', () => {
    expect(getShopSlug({ headers: {} }, prod)).toBeNull();
  });
});

// ── Laptop: the old behaviour, word for word ─────────────────
describe('getShopSlug on a laptop (no ROOT_DOMAIN)', () => {
  test('localhost:3000 gives no shop', () => {
    expect(getShopSlug(req({ host: 'localhost:3000' }), laptop)).toBeNull();
  });

  test('plain localhost gives no shop', () => {
    expect(getShopSlug(req({ host: 'localhost' }), laptop)).toBeNull();
  });

  // The old code took the first word of the Host, so we still do
  test('a shop address on lvh.me gives the first word', () => {
    expect(getShopSlug(req({ host: 'acme.lvh.me:3000' }), laptop)).toBe('acme');
  });

  // On a laptop the Origin is ignored, exactly like before
  test('the Origin is ignored on a laptop', () => {
    const r = req({
      host: 'localhost:3000',
      origin: 'http://acme.lvh.me:3001',
    });
    expect(getShopSlug(r, laptop)).toBeNull();
  });
});
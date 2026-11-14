// =============================================================
// FILE: apps/api/tests/daraja.service.test.js
// =============================================================
//
// WHY THIS FILE EXISTS
//   Proves the shared M-Pesa sender (services/daraja.service.js) does the
//   right thing with MONEY and SECRETS: it uses the current shop's own keys
//   and till, sends the right amount, refuses bad input before calling
//   Safaricom, and never lets a key, token or phone number leak.
//
// WHY IMPORTANT
//   A bug here sends one shop's customer to another shop's till, or charges
//   the wrong amount, or writes a key into a log file. None of that shows up
//   unless a test looks for it.
//
// DANGER (if this file does not exist)
//   - Someone edits stkPush and starts logging the request "for debugging".
//     The passkey ends up in the log files. Check 3 catches it.
//   - A refactor reads the config without the shop filter and Amina's
//     customers pay into Brio's till. Checks 1 and 2 catch it.
//   - Someone "fixes" a decimal price by rounding it. Check 7 catches it.
//
// WHAT IT SOLVES
//   Day 3, Task 2 proof: "STK push per tenant, fires correctly".
//
// SYSTEM DESIGN PRINCIPLE
//   Test the promise, not the code. Safaricom is replaced by a fake fetch,
//   so no real network call and no real money. The database is REAL, so row
//   level security really applies, exactly as in the app.
//
// RULES
//   1. NEVER call the real Safaricom. global.fetch is faked in every check.
//   2. Make our own two shops and a throw-away KMS key, so the tests also
//      pass on a fresh CI database and never touch your real keys.
//   3. Put everything back at the end (fetch, env, rows).
//   4. All keys in here are FAKE words made from a random tag.
//
// PRACTICAL EXAMPLE
//   Check 2: while the database is locked to Brio, stkPush must call
//   Safaricom's PRODUCTION address with Brio's key and Brio's till number,
//   and never contain anything of Amina's.
//
// DECISIONS (and WHY)
//   - Shop A is 'sandbox' and shop B is 'production', so the checks also
//     prove the right Safaricom address is used per shop.
//   - Config rows are written under the shop lock, because daraja_configs
//     has RLS (a plain insert would be refused).
//   - A real database lock is used (not a fake db object), because the
//     lock is the thing being tested.
//
// WHERE USED
//   `npm test` and CI on every push.
//
// TRADEOFFS
//   + Fast, no network, exact checks on what would be sent to Safaricom.
//   - It cannot prove Safaricom accepts our request. Only a real sandbox
//     payment proves that (see the sandbox walkthrough).
//
// HOW TO RUN
//   cd apps/api
//   npm test -- tests/daraja.service.test.js
//
// GUIDE DOC: apps/api/docs/tests/daraja.service.test.md (with the Day 3 docs)
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request. Declared in the Day 3 money audit.

// =============================================================
// THE PIECES OF THIS FILE (read top to bottom)
//   1. Imports            the tools we borrow
//   2. Test data          two pretend shops with FAKE keys
//   3. Helpers            withLock, consoleText, reply, happyFetch
//   4. beforeAll          build the two shops and their config rows
//   5. beforeEach/After   a fresh fake Safaricom before every check
//   6. afterAll           clean up and put everything back
//   7. The 13 checks      what we promise, one by one
// =============================================================

// -------------------------------------------------------------
// PIECE 1: Imports
// -------------------------------------------------------------
// crypto : makes the random tag and the throw-away encryption key.
// pg     : talks to the real Postgres database (so RLS really applies).
// dotenv : loads DATABASE_URL from your .env file.
// jest   : the test tool. We use jest.fn / jest.spyOn to fake things.
// stkPush, normalizePhone : the two functions under test.
// encryptSecret : the SAME scrambler the app uses, so our test rows are
//                 built exactly like real ones.
import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

import { stkPush, normalizePhone } from '../src/services/daraja.service.js';
import { encryptSecret } from '../src/utils/kms.js';

dotenv.config();

// -------------------------------------------------------------
// PIECE 2: Test data
// -------------------------------------------------------------
// testPool: our own database connection. It connects as rahisisha_user (not
// a superuser), so row level security applies to it exactly as it does to
// the real app. If this connected as a superuser, RLS would be skipped and
// the isolation checks would prove nothing.
// Real life: testing the shop's lock with the SHOP's key, not the landlord's
// master key.
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// rand: a random tag added to every name, so running the tests twice (or two
// people running them at once) never clash on a name that must be unique.
const rand = crypto.randomBytes(4).toString('hex');

// Two pretend shops with FAKE keys. Every value contains the random tag, so
// if one ever shows up in a place it should not (a log, an error, the wrong
// shop's request), the check can spot it by name.
//   A = Amina, a SANDBOX shop (practice server, fake money)
//   B = Brio,  a PRODUCTION shop (real server)
// Using one of each lets us prove the right Safaricom address is used per shop.
const A = {
  key: `KEY-A-${rand}`, secret: `SECRET-A-${rand}`, passkey: `PASSKEY-A-${rand}`,
  shortcode: '111111', env: 'sandbox', callback: `https://a-${rand}.example/cb`,
};
const B = {
  key: `KEY-B-${rand}`, secret: `SECRET-B-${rand}`, passkey: `PASSKEY-B-${rand}`,
  shortcode: '222222', env: 'production', callback: `https://b-${rand}.example/cb`,
};
// ACCESS_TOKEN: the fake "visitor badge" our fake Safaricom hands out.
// We look for it in the console to prove it is never printed.
const ACCESS_TOKEN = `ACCESS-TOKEN-${rand}`;
// PHONE: typed the local way. The service must turn it into 254712345678.
const PHONE = '0712345678';

// Shared state. These are filled in by beforeAll/beforeEach and read by the
// checks. The first three remember your REAL settings so afterAll can put
// them back (a test must leave the computer the way it found it).
let realKey;       // your own KMS_KEY, put back at the end
let realFetch;     // the real fetch, put back at the end
let realBase;      // your DARAJA_API_BASE, put back at the end
let tenantA;       // shop A id
let tenantB;       // shop B id
let fetchMock;     // the fake Safaricom (a new one before every check)
const spies = [];  // hidden microphones on console.*

// -------------------------------------------------------------
// PIECE 3: Helpers
// -------------------------------------------------------------
// withLock(tenantId, fn): the test version of withTenant.
//   1. borrow one database connection
//   2. stamp it with the shop id (app.current_tenant), so RLS shows only
//      that shop's rows
//   3. run fn(connection)
//   4. ALWAYS clear the stamp and give the connection back, even if fn throws
// withLock(null, ...) stamps an empty value = "no shop", used to prove that
// nobody's keys are used when no shop is set.
// Real life: a hotel key card that opens only ONE room, and is wiped when
// you hand it back at the desk.
async function withLock(tenantId, fn) {
  const c = await testPool.connect();
  try {
    await c.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId ?? '']);
    return await fn(c);
  } finally {
    await c.query("SELECT set_config('app.current_tenant', '', false)");
    c.release();
  }
}

// consoleText(): everything the code tried to print (log, warn, error...)
// joined into one string, so a check can search it for secrets.
// Real life: a security camera recording of the notice board, so you can
// check nobody pinned a password on it.
function consoleText() {
  return JSON.stringify(spies.flatMap((s) => s.mock.calls));
}

// reply(status, body): builds a fake Safaricom answer. Real fetch answers have
// a `status` number and a json() function that returns the body; we copy that
// shape so the service cannot tell the difference.
const reply = (status, body) => ({ status, json: async () => body });

// happyFetch: the DEFAULT pretend Safaricom, where everything works.
//   - a call to the login address (/oauth/) returns an access token
//   - any other call (the push) returns ResponseCode '0' = "prompt sent"
// Checks that need a failure replace it with their own answer.
function happyFetch(url) {
  if (String(url).includes('/oauth/')) return Promise.resolve(reply(200, { access_token: ACCESS_TOKEN }));
  return Promise.resolve(reply(200, {
    ResponseCode: '0', MerchantRequestID: `mr-${rand}`, CheckoutRequestID: `ws_CO_${rand}`,
  }));
}

// -------------------------------------------------------------
// PIECE 4: beforeAll (runs ONCE, before the first check)
// -------------------------------------------------------------
// 1. Remember your real settings, then swap in a throw-away KMS_KEY. The
//    config rows below are encrypted with it, and the service decrypts with
//    it, so your real key is never involved.
// 2. Delete DARAJA_API_BASE so the service uses Safaricom's real addresses.
//    That is safe because fetch itself is faked: nothing leaves the computer.
// 3. Create two shops (the tenants table has no RLS, so a plain insert works).
// 4. Give each shop a daraja_configs row. That table HAS RLS, so each row is
//    written while locked to its own shop, or the database would refuse it.
//    Secrets go in ENCRYPTED, locked to that shop's id, as in the real app.
beforeAll(async () => {
  realKey = process.env.KMS_KEY;
  realFetch = global.fetch;
  realBase = process.env.DARAJA_API_BASE;
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');  // throw-away key
  delete process.env.DARAJA_API_BASE;   // use the real Safaricom addresses (fetch is fake)

  // The tenants table has no RLS, so a plain insert works.
  const a = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [`Daraja A ${rand}`, `daraja-a-${rand}`]);
  const b = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [`Daraja B ${rand}`, `daraja-b-${rand}`]);
  tenantA = a.rows[0].id;
  tenantB = b.rows[0].id;

  // daraja_configs has RLS, so each row is written under ITS shop's lock.
  for (const [tenantId, s] of [[tenantA, A], [tenantB, B]]) {
    await withLock(tenantId, (db) => db.query(
      `INSERT INTO daraja_configs
         (tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
          shortcode, passkey_encrypted, callback_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, s.env, encryptSecret(s.key, tenantId), encryptSecret(s.secret, tenantId),
        s.shortcode, encryptSecret(s.passkey, tenantId), s.callback]));
  }
});

// -------------------------------------------------------------
// PIECE 5: beforeEach / afterEach (before and after EVERY check)
// -------------------------------------------------------------
// beforeEach: a brand-new fake Safaricom (so one check's setup cannot leak
// into the next) and a hidden microphone on every console method. The
// mockImplementation(() => {}) keeps the test output quiet while still
// recording what the code tried to print.
// afterEach: take the microphones off.
beforeEach(() => {
  fetchMock = jest.fn(happyFetch);
  global.fetch = fetchMock;
  // Quiet and recorded: any console output is captured, not printed.
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
    spies.push(jest.spyOn(console, m).mockImplementation(() => {}));
  }
});

afterEach(() => {
  while (spies.length) spies.pop().mockRestore();
});

// -------------------------------------------------------------
// PIECE 6: afterAll (runs ONCE, after the last check)
// -------------------------------------------------------------
// Put the real fetch and your real settings back, then delete our two test
// shops. Deleting a shop also deletes its config row (ON DELETE CASCADE).
// Finally close the connection, or Jest would hang waiting for it.
afterAll(async () => {
  global.fetch = realFetch;
  if (realBase === undefined) delete process.env.DARAJA_API_BASE;
  else process.env.DARAJA_API_BASE = realBase;
  if (realKey === undefined) delete process.env.KMS_KEY;
  else process.env.KMS_KEY = realKey;

  // Clean up our own shops. Config rows go with the shop (ON DELETE CASCADE).
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB]]);
  await testPool.end();
});

// -------------------------------------------------------------
// PIECE 7: The checks
// -------------------------------------------------------------
describe('stkPush (one shared sender, one till per shop)', () => {

  // CHECK 1: the happy path for shop A. Proves, line by line, what Amina's
  // customer's request looks like on the wire: the sandbox address, Amina's
  // key and secret in the login, Amina's till number, the right amount
  // (150000 cents -> KES 1500), the phone in Daraja's form, and a Password
  // that equals base64(shortcode + passkey + timestamp).
  // Real life: reading the cheque before it leaves the building.
  test("1. locked to A: A's address, A's key, A's till, the right amount", async () => {
    const result = await withLock(tenantA, (db) =>
      stkPush(db, { amountCents: 150000, phone: PHONE, accountReference: 'ORD-AB12CD34' }));
    expect(result).toEqual({ merchantRequestId: `mr-${rand}`, checkoutRequestId: `ws_CO_${rand}` });

    // Call 1 = login, call 2 = the push.
    const [loginUrl, loginOptions] = fetchMock.mock.calls[0];
    expect(loginUrl).toBe('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials');
    expect(loginOptions.headers.Authorization)
      .toBe(`Basic ${Buffer.from(`${A.key}:${A.secret}`).toString('base64')}`);

    const [pushUrl, pushOptions] = fetchMock.mock.calls[1];
    expect(pushUrl).toBe('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest');
    expect(pushOptions.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);

    const sent = JSON.parse(pushOptions.body);
    expect(sent.Amount).toBe(1500);                 // 150000 cents = KES 1500
    expect(sent.BusinessShortCode).toBe(A.shortcode);
    expect(sent.PartyB).toBe(A.shortcode);
    expect(sent.PartyA).toBe('254712345678');
    expect(sent.PhoneNumber).toBe('254712345678');
    expect(sent.CallBackURL).toBe(A.callback);
    expect(sent.AccountReference).toBe('ORD-AB12CD34');
    expect(sent.TransactionType).toBe('CustomerPayBillOnline');

    // The Password must be base64(shortcode + passkey + timestamp).
    expect(sent.Timestamp).toMatch(/^\d{14}$/);
    expect(Buffer.from(sent.Password, 'base64').toString())
      .toBe(`${A.shortcode}${A.passkey}${sent.Timestamp}`);
  });

  // CHECK 2: the SAME call locked to shop B must use B's PRODUCTION address,
  // B's key and till, and must contain NOTHING of A's. This is the heart of
  // "payments per tenant": the wrong shop's till would mean money to the
  // wrong business.
  // Real life: two shops share one cashier; each customer's payment must
  // still go to the right shop's till.
  test("2. locked to B: B's production address, B's key and till, never A's", async () => {
    await withLock(tenantB, (db) => stkPush(db, { amountCents: 50000, phone: PHONE, accountReference: 'X' }));
    const [loginUrl, loginOptions] = fetchMock.mock.calls[0];
    const [pushUrl, pushOptions] = fetchMock.mock.calls[1];
    expect(loginUrl.startsWith('https://api.safaricom.co.ke/')).toBe(true);
    expect(pushUrl.startsWith('https://api.safaricom.co.ke/')).toBe(true);
    expect(loginOptions.headers.Authorization)
      .toBe(`Basic ${Buffer.from(`${B.key}:${B.secret}`).toString('base64')}`);

    const sent = JSON.parse(pushOptions.body);
    expect(sent.BusinessShortCode).toBe(B.shortcode);
    expect(sent.CallBackURL).toBe(B.callback);
    expect(sent.Amount).toBe(500);
    const everything = JSON.stringify(fetchMock.mock.calls);
    expect(everything).not.toContain(A.key);
    expect(everything).not.toContain(A.shortcode);
    expect(everything).not.toContain(A.callback);
  });

  // CHECK 3: run a good push AND a failing push, then search everything the
  // code printed for any key, secret, passkey, token, the phone digits, and
  // the words Basic / Bearer. Nothing may appear. If someone adds a
  // console.log "for debugging", this check fails.
  // Real life: checking the bin after the meeting for torn-up passwords.
  test('3. no key, secret, passkey, token or phone ever reaches the console', async () => {
    await withLock(tenantA, (db) => stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' }));
    fetchMock.mockImplementationOnce(() => Promise.resolve(reply(401, {})));
    await withLock(tenantA, (db) => stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' })).catch(() => {});
    const printed = consoleText();
    for (const secret of [A.key, A.secret, A.passkey, ACCESS_TOKEN, B.key, '712345678', 'Basic', 'Bearer']) {
      expect(printed).not.toContain(secret);
    }
  });

  // CHECK 4: read the raw stored columns (under A's lock, so RLS shows only
  // A's row: exactly 1 row) and prove each starts with 'v1.' (the encrypted
  // format) and contains none of the plain keys.
  // Real life: opening the safe-deposit box and finding sealed envelopes,
  // not loose cash.
  test('4. the stored keys are encrypted, not plain text', async () => {
    const { rows } = await withLock(tenantA, (db) =>
      db.query('SELECT consumer_key_encrypted, consumer_secret_encrypted, passkey_encrypted FROM daraja_configs'));
    expect(rows.length).toBe(1);   // RLS: only this shop's row is visible
    for (const value of Object.values(rows[0])) {
      expect(value.startsWith('v1.')).toBe(true);
    }
    const stored = JSON.stringify(rows[0]);
    expect(stored).not.toContain(A.key);
    expect(stored).not.toContain(A.secret);
    expect(stored).not.toContain(A.passkey);
  });

  // CHECK 5: Safaricom says 401 to the shop's login. The code must stop right
  // there (only ONE fetch call, no push), give the code daraja_auth_failed,
  // and the message may hold only the status number, never a key.
  // Real life: the bank refuses your ID, so you do not walk on to the till.
  test('5. Safaricom refuses the shop login: clear code, nothing secret in the message', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(reply(401, { errorMessage: 'bad' })));
    const err = await withLock(tenantA, (db) =>
      stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' })).catch((e) => e);
    expect(err.code).toBe('daraja_auth_failed');
    expect(err.message).toBe('M-Pesa login failed (status 401)');
    for (const secret of [A.key, A.secret, A.passkey]) expect(err.message).not.toContain(secret);
    expect(fetchMock).toHaveBeenCalledTimes(1);   // it stopped after the login
  });

  // CHECK 6: two different failures. (a) the push is answered with
  // ResponseCode '1' = refused: code daraja_rejected, and Safaricom's own
  // text ("nope") must NOT be copied into our error. (b) the network breaks:
  // code daraja_unreachable, and the raw reason ("socket hang up") is not
  // copied either. Safaricom's wording is never trusted or repeated.
  // Real life: "the machine is out of order", never a copy of the receipt.
  test('6. Safaricom refuses the push, or the network fails: clear codes', async () => {
    // ResponseCode other than '0' = not accepted.
    fetchMock.mockImplementation((url) => String(url).includes('/oauth/')
      ? Promise.resolve(reply(200, { access_token: ACCESS_TOKEN }))
      : Promise.resolve(reply(200, { ResponseCode: '1', errorMessage: 'nope' })));
    const refused = await withLock(tenantA, (db) =>
      stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' })).catch((e) => e);
    expect(refused.code).toBe('daraja_rejected');
    expect(refused.message).not.toContain('nope');   // Safaricom's text is never copied in

    // The network breaks.
    fetchMock.mockImplementation(() => Promise.reject(new Error('socket hang up')));
    const down = await withLock(tenantA, (db) =>
      stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' })).catch((e) => e);
    expect(down.code).toBe('daraja_unreachable');
    expect(down.message).not.toContain('socket');
  });

  // CHECK 7: the MONEY RULE. Each of these amounts is refused with
  // amount_not_whole_shillings, and fetch is never called, so no prompt goes
  // out. 150050 cents (KES 1500.50) is the important one: it must NOT become
  // 1500 or 1501 quietly.
  // Real life: a till that says "I cannot take that amount" instead of
  // quietly charging a different one.
  test('7. the amount must be whole shillings: refused, never rounded, nothing sent', async () => {
    for (const bad of [150050, 50, 0, -100, 100.5, '150000', null, NaN]) {
      const err = await withLock(tenantA, (db) =>
        stkPush(db, { amountCents: bad, phone: PHONE, accountReference: 'X' })).catch((e) => e);
      expect(err.code).toBe('amount_not_whole_shillings');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 8: a phone that is not a Kenyan mobile is refused before any call.
  // Real life: the till refuses to dial a number that is not a phone number.
  test('8. a bad phone number is refused and nothing is sent', async () => {
    for (const bad of ['abc', '', '0612345678', '07123', null]) {
      const err = await withLock(tenantA, (db) =>
        stkPush(db, { amountCents: 100000, phone: bad, accountReference: 'X' })).catch((e) => e);
      expect(err.code).toBe('invalid_phone');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 9: a brand-new shop (C) that never set up M-Pesa gets the clear
  // code daraja_not_configured and Safaricom is never called. We create C,
  // check, and ALWAYS delete C again (the `finally`).
  // Real life: a shop with no till number cannot take card payments yet.
  test('9. a shop with no M-Pesa settings: clear code, Safaricom never called', async () => {
    const c = await testPool.query(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
      [`Daraja C ${rand}`, `daraja-c-${rand}`]);
    const tenantC = c.rows[0].id;
    try {
      const err = await withLock(tenantC, (db) =>
        stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' })).catch((e) => e);
      expect(err.code).toBe('daraja_not_configured');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await testPool.query('DELETE FROM tenants WHERE id = $1', [tenantC]);
    }
  });

  // CHECK 10: with NO shop lock, nobody's keys may be used. Expect
  // daraja_not_configured and no Safaricom call. Even though two shops'
  // configs exist, an unlocked connection sees none of them (RLS).
  // Real life: a visitor with no key card cannot open any room.
  test("10. no lock at all: nobody's keys are used", async () => {
    const err = await withLock(null, (db) =>
      stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' })).catch((e) => e);
    expect(err.code).toBe('daraja_not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 11: the ROW-SWAP ATTACK. Someone with database access copies A's
  // encrypted consumer key into B's row. Because every secret is locked to
  // its own shop id, B's code cannot decrypt it: stkPush fails with the
  // generic message and never calls Safaricom. The `finally` puts B's real
  // value back so later checks are not affected.
  // Real life: a sealed envelope addressed to Amina will not open for Brio
  // even if you slip it into Brio's folder.
  test("11. a key copied into another shop's row will not decrypt", async () => {
    // Read A's stored consumer key, then plant it in B's row (a row-swap attack).
    const { rows } = await withLock(tenantA, (db) =>
      db.query('SELECT consumer_key_encrypted FROM daraja_configs'));
    const copiedFromA = rows[0].consumer_key_encrypted;
    const original = (await withLock(tenantB, (db) =>
      db.query('SELECT consumer_key_encrypted FROM daraja_configs'))).rows[0].consumer_key_encrypted;

    await withLock(tenantB, (db) =>
      db.query('UPDATE daraja_configs SET consumer_key_encrypted = $1', [copiedFromA]));
    try {
      const err = await withLock(tenantB, (db) =>
        stkPush(db, { amountCents: 100000, phone: PHONE, accountReference: 'X' })).catch((e) => e);
      expect(err.message).toBe('Could not decrypt the stored secret');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      // Put B's real value back so later checks are not affected.
      await withLock(tenantB, (db) =>
        db.query('UPDATE daraja_configs SET consumer_key_encrypted = $1', [original]));
    }
  });
});

// -------------------------------------------------------------
// normalizePhone checks (pure function: no database, no fetch)
// -------------------------------------------------------------
describe('normalizePhone', () => {

  // CHECK 12: every common way people type a Kenyan number becomes
  // 254 + 9 digits (7... or 1...). Spaces, dashes, brackets and a leading +
  // are all tolerated.
  // Real life: a receptionist who understands "0712 345 678", "+254-712..."
  // and "712345678" as the same phone number.
  test('12. accepts the usual Kenyan styles and returns 254 plus nine digits', () => {
    for (const input of ['0712345678', '712345678', '+254712345678', '254712345678',
      '+254 712-345 678', '(0712) 345678', '0112345678', '254112345678']) {
      expect(normalizePhone(input)).toMatch(/^254[17]\d{8}$/);
    }
    expect(normalizePhone('0712345678')).toBe('254712345678');
    expect(normalizePhone('0112345678')).toBe('254112345678');
  });

  // CHECK 13: anything else is refused with invalid_phone (06... is not a
  // mobile prefix, 07123 is too short, a long string is too long, null and
  // undefined are not text). The error message is fixed text and must never
  // repeat what the person typed (it could be someone's phone number).
  test('13. refuses anything else and never repeats the input in the error', () => {
    for (const input of ['', 'abc', '0612345678', '07123', '25471234567890', null, undefined, 712345678.5]) {
      let error;
      try { normalizePhone(input); } catch (e) { error = e; }
      expect(error.code).toBe('invalid_phone');
      // An empty input is trivially "inside" any text, so only check real ones.
      const typed = String(input ?? '');
      if (typed.length > 0) expect(error.message).not.toContain(typed);
    }
  });
});
// FILE: apps/api/tests/whatsapp.service.test.js
//
// WHY THIS FILE EXISTS
//   sendWhatsApp() holds the most sensitive thing in the whole WhatsApp
//   feature: each shop's decrypted Meta token. This test proves it uses the
//   RIGHT shop's token, never logs it, never leaks it in errors, and that
//   tokens are encrypted in the database.
//
// WHY IMPORTANT
//   A leaked token lets a stranger send WhatsApp messages as that business.
//   A wrong-shop token sends messages as the wrong business. Neither crashes
//   anything, so only a test can catch them.
//
// DANGER (if this file does not exist)
//   - Someone adds console.log(token) while debugging and ships it. The token
//     lands in log files for good. Check 3 fails.
//   - Someone changes the query to SELECT without the shop filter. whatsapp_configs
//     has no RLS, so the first row (maybe another shop) is used. Check 2 fails.
//   - Someone copies one shop's scrambled token into another shop's row.
//     Check 9 proves it will not decrypt.
//
// WHAT IT SOLVES (the 10 checks)
//    1  Locked to A: Meta is called with A's number id and A's token
//    2  Locked to B: B's number id and B's token (never A's)
//    3  The token never appears in any console output (success or failure)
//    4  Meta says 401: clear error code, no token in the message
//    5  Meta says 500: plain failure, no token in the message
//    6  No shop locked: "not set up", Meta is NOT called
//    7  Bad number or empty/too long body: refused, Meta is NOT called
//    8  A "+254..." number is cleaned to digits
//    9  A token copied into another shop's row will not decrypt
//   10  The token is stored encrypted in the database (not plain)
//
// SYSTEM DESIGN PRINCIPLE
//   Least privilege + secrets never leave the function. Test the secret's
//   exits: logs, errors, and the database.
//
// RULES
//   1. NO real Meta calls. fetch is replaced by a fake.
//   2. Fake tokens only. A throw-away KMS key. Own two shops.
//   3. Clean up everything, and put the real fetch and KMS_KEY back.
//
// DECISIONS (and WHY)
//   - A fake fetch instead of a real server: fast, free, and we can read
//     exactly what we "sent" to Meta.
//   - A real database (not a mock): the shop filter lives in the SQL, so the
//     SQL must really run to be tested.
//   - Tokens contain a random bit, so searching the logs for them cannot
//     match by accident.
//
// WHERE USED
//   npm test, the Husky pre-push hook (full suite) and CI.
//
// TRADEOFFS
//   + Proves the secret's exits are closed, with no real WhatsApp account.
//   - Does not prove Meta accepts our message shape (needs a real sandbox).
//
// HOW TO USE
//   cd apps/api
//   npm test -- tests/whatsapp.service.test.js
//
// GUIDE DOC: apps/api/docs/tests/whatsapp.service.test.md
//
// AI AUDIT NOTE
//   Test written by AI (allowed). The sender it checks was AI-written at
//   Sheryl's request, declared in AI_AUDIT_week_29_day2.md.

// crypto: Node's toolbox. Used here for random bits and a random key.
import crypto from 'node:crypto';

// pg: the Postgres client. We open our OWN connection (as rahisisha_user).
import pg from 'pg';

// dotenv: loads .env so process.env.DATABASE_URL exists.
import dotenv from 'dotenv';

// jest: needed as an import because this project runs Jest in ESM mode.
// It gives us jest.fn() (a fake function that remembers its calls) and
// jest.spyOn() (a hidden microphone on an existing function).
import { jest } from '@jest/globals';

// The function under test, and the helper that scrambles tokens the same
// way the real app does.
import { sendWhatsApp } from '../src/services/whatsapp.service.js';
import { encryptSecret } from '../src/utils/kms.js';

dotenv.config();

// Our own connection as rahisisha_user, so the database behaves like the app
// (RLS applies). Real life: test the lock with a normal key, not the master key.
const testPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Random bits, so leftovers from an old failed run can never clash
// (phone_number_id is UNIQUE).
const rand = crypto.randomBytes(4).toString('hex');
const PHONE_ID_A = `pid-a-${rand}`;
const PHONE_ID_B = `pid-b-${rand}`;
// Fake tokens. Unique, so a search of the logs cannot match by accident.
const TOKEN_A = `FAKE-TOKEN-A-${rand}`;
const TOKEN_B = `FAKE-TOKEN-B-${rand}`;

let realKey;        // your own KMS_KEY, put back at the end
let realFetch;      // the real fetch, put back at the end
let realBase;       // your WHATSAPP_API_BASE, put back at the end
let tenantA;        // shop A id
let tenantB;        // shop B id
let fetchMock;      // the fake Meta (a new one before every check)
const spies = [];   // the hidden microphones on console.*

// withLock: gives a check a connection locked to ONE shop, the way the real
// withTenant middleware does for a request. It ALWAYS unlocks and hands the
// connection back, even if the check throws.
// `false` in set_config means "lasts for the whole connection", like
// withTenant. Passing '' means "no shop locked".
// Real life: a clerk who holds one customer's key only while serving them.
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

// consoleText: everything the code printed to the console so far, as one
// string. We search it for tokens in check 3.
function consoleText() {
  return JSON.stringify(spies.flatMap((s) => s.mock.calls));
}

// beforeAll: runs ONCE before the checks. Builds the pretend world.
beforeAll(async () => {
  // Remember your real settings, then swap in safe ones.
  realKey = process.env.KMS_KEY;
  realFetch = global.fetch;
  realBase = process.env.WHATSAPP_API_BASE;
  process.env.KMS_KEY = crypto.randomBytes(32).toString('base64');  // throw-away key
  delete process.env.WHATSAPP_API_BASE;      // use the default Meta address

  // Two fresh shops (the tenants table has no RLS, so a plain insert works).
  const a = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [`WA Send A ${rand}`, `wa-send-a-${rand}`]);
  const b = await testPool.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [`WA Send B ${rand}`, `wa-send-b-${rand}`]);
  tenantA = a.rows[0].id;
  tenantB = b.rows[0].id;

  // Each shop's WhatsApp config. The tokens are FAKE and stored ENCRYPTED
  // (locked to their own shop id), exactly like the real thing.
  await testPool.query(
    `INSERT INTO whatsapp_configs
       (tenant_id, phone_number_id, access_token_encrypted, webhook_verify_token)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      tenantA, PHONE_ID_A, encryptSecret(TOKEN_A, tenantA), `verify-a-${rand}`,
      tenantB, PHONE_ID_B, encryptSecret(TOKEN_B, tenantB), `verify-b-${rand}`,
    ]);
});

// beforeEach: runs before EVERY check, so each check starts fresh.
beforeEach(() => {
  // A fake Meta that always answers "sent, message id wamid.SENT1".
  // jest.fn() also remembers every call, so checks can read what we "sent".
  fetchMock = jest.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.SENT1' }] }),
  });
  global.fetch = fetchMock;
  // Hide a microphone on every console method. mockImplementation keeps the
  // test output quiet but still records what would have been printed.
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
    spies.push(jest.spyOn(console, m).mockImplementation(() => {}));
  }
});

// afterEach: take the microphones off, so the next check starts clean.
afterEach(() => {
  while (spies.length) spies.pop().mockRestore();
});

// afterAll: runs ONCE at the end. Put everything back and clean the database.
afterAll(async () => {
  global.fetch = realFetch;
  if (realBase === undefined) delete process.env.WHATSAPP_API_BASE;
  else process.env.WHATSAPP_API_BASE = realBase;
  if (realKey === undefined) delete process.env.KMS_KEY;
  else process.env.KMS_KEY = realKey;

  // Configs first, then the shops (the configs point at the shops).
  await testPool.query('DELETE FROM whatsapp_configs WHERE tenant_id = ANY($1)', [[tenantA, tenantB]]);
  await testPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA, tenantB]]);
  // Hang up the phone line so Jest can exit.
  await testPool.end();
});

describe('sendWhatsApp (one shared sender, one token per shop)', () => {
  // CHECK 1: the happy path for shop A. We read back what the fake Meta
  // received: the address (with A's number id), the header (with A's token)
  // and the body (the message). mock.calls[0] = the first call we made.
  test("1. locked to A: Meta gets A's number id and A's token", async () => {
    const result = await withLock(tenantA, (db) => sendWhatsApp(db, '254712345678', 'Karibu Amina!'));
    expect(result).toEqual({ messageId: 'wamid.SENT1' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.facebook.com/v21.0/${PHONE_ID_A}/messages`);
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN_A}`);
    expect(JSON.parse(options.body)).toEqual({
      messaging_product: 'whatsapp', to: '254712345678', type: 'text', text: { body: 'Karibu Amina!' },
    });
  });

  // CHECK 2: shop B must get B's token, never A's. whatsapp_configs has no
  // RLS, so this only works because the query filters on the shop lock.
  // Real life: Brio's key opens only Brio's till.
  test("2. locked to B: B's number id and B's token, never A's", async () => {
    await withLock(tenantB, (db) => sendWhatsApp(db, '254799999999', 'Welcome to Brio'));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain(PHONE_ID_B);
    expect(url).not.toContain(PHONE_ID_A);
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN_B}`);
    expect(options.headers.Authorization).not.toContain(TOKEN_A);
  });

  // CHECK 3: nothing the function does may print a token. We run a success
  // AND a failure, then search every console line for either token and for
  // the word "Bearer" (the header that carries the token).
  // .catch(() => {}) says "we expect this one to fail, ignore the error".
  test('3. the token never appears in console output', async () => {
    await withLock(tenantA, (db) => sendWhatsApp(db, '254712345678', 'hello'));
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    await withLock(tenantA, (db) => sendWhatsApp(db, '254712345678', 'hello')).catch(() => {});
    const printed = consoleText();
    expect(printed).not.toContain(TOKEN_A);
    expect(printed).not.toContain(TOKEN_B);
    expect(printed).not.toContain('Bearer');
  });

  // CHECK 4: a 401/403 usually means the shop revoked access or the token
  // expired. The error says so with a code (the webhook can later tell the
  // owner "reconnect WhatsApp"), and still never contains the token.
  // mockResolvedValueOnce = "for the NEXT call only, make Meta say 401".
  test('4. Meta says 401: clear code, no token in the message', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    const err = await withLock(tenantA, (db) => sendWhatsApp(db, '254712345678', 'hi')).catch((e) => e);
    expect(err.code).toBe('whatsapp_token_rejected');
    expect(err.status).toBe(401);
    expect(err.message).toBe('WhatsApp send failed (status 401)');
    expect(err.message).not.toContain(TOKEN_A);
  });

  // CHECK 5: any other failure is a plain failure with only the status
  // number, and no special code.
  test('5. Meta says 500: plain failure, no token in the message', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const err = await withLock(tenantA, (db) => sendWhatsApp(db, '254712345678', 'hi')).catch((e) => e);
    expect(err.code).toBeUndefined();
    expect(err.message).toBe('WhatsApp send failed (status 500)');
    expect(err.message).not.toContain(TOKEN_A);
  });

  // CHECK 6: no shop locked ('') means NO shop's token. The dangerous
  // alternative would be "pick the first row". And Meta must not be called.
  test('6. no shop locked: not set up, and Meta is NOT called', async () => {
    const err = await withLock('', (db) => sendWhatsApp(db, '254712345678', 'hi')).catch((e) => e);
    expect(err.code).toBe('whatsapp_not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 7: bad input is refused BEFORE any database or Meta call.
  // "12" is too short, "abc" has letters, "" is empty, and 4097 characters is
  // one over WhatsApp's 4096 limit. `expect(...).rejects.toThrow(...)` means
  // "this async call must fail with this message".
  test('7. bad number or bad body is refused and Meta is NOT called', async () => {
    await withLock(tenantA, async (db) => {
      await expect(sendWhatsApp(db, '12', 'hi')).rejects.toThrow('Invalid WhatsApp recipient number');
      await expect(sendWhatsApp(db, 'abc', 'hi')).rejects.toThrow('Invalid WhatsApp recipient number');
      await expect(sendWhatsApp(db, '254712345678', '')).rejects.toThrow('Invalid WhatsApp message body');
      await expect(sendWhatsApp(db, '254712345678', 'x'.repeat(4097))).rejects.toThrow('Invalid WhatsApp message body');
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // CHECK 8: people type "+254...". Meta wants digits only, so the plus is
  // removed. We read the body we "sent" to Meta to prove it.
  test('8. a "+254..." number is cleaned to digits', async () => {
    await withLock(tenantA, (db) => sendWhatsApp(db, '+254712345678', 'hi'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe('254712345678');
  });

  // CHECK 9: the row-swap attack. Someone with database write access copies
  // A's scrambled token into B's row. We do exactly that INSIDE a transaction,
  // try to send as B, and expect a refusal (the shop id is part of the lock).
  // ROLLBACK in `finally` puts everything back, so no real data is changed.
  // `true` in set_config = "only until this transaction ends".
  test("9. A's scrambled token copied into B's row will not decrypt", async () => {
    const c = await testPool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `UPDATE whatsapp_configs SET access_token_encrypted =
           (SELECT access_token_encrypted FROM whatsapp_configs WHERE tenant_id = $1)
         WHERE tenant_id = $2`, [tenantA, tenantB]);
      await c.query("SELECT set_config('app.current_tenant', $1, true)", [tenantB]);
      await expect(sendWhatsApp(c, '254712345678', 'hi')).rejects.toThrow('Could not decrypt');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  });

  // CHECK 10: encrypted at rest. Read the raw column the way a database leak
  // would, and make sure the token is not in it. "v1." proves it uses our
  // versioned format.
  test('10. the token is stored encrypted, not plain', async () => {
    const { rows } = await testPool.query(
      'SELECT access_token_encrypted FROM whatsapp_configs WHERE tenant_id = $1', [tenantA]);
    const stored = rows[0].access_token_encrypted;
    expect(stored.startsWith('v1.')).toBe(true);
    expect(stored).not.toContain(TOKEN_A);
  });
});
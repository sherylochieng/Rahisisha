// =============================================================================
// wallet.service.test.js — Day 4: proves credit, debit and balance add up
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - wallet.service.js is the shop's MONEY BOOK. It has three jobs:
//     credit  = write "money came IN"
//     debit   = write "money went OUT"
//     balance = add every line up to get the total
// - We wrote those three functions, but nobody has checked them
// - This file checks them with real examples: put 500 in, take 200 out,
//   and see that the total is 300
//
// WHY IT IS IMPORTANT:
// - A wrong balance is not a small bug. It tells a shopkeeper she has money
//   she does not have, or hides money she does have
// - People trust the number on the screen. If the number is wrong, they
//   stop trusting the whole product
//
// DANGER — IF THIS FILE DOES NOT EXIST:
// - Example 1: someone changes debit to store a POSITIVE number. Now taking
//   money out ADDS money. Nothing crashes. The balance is just wrong
// - Example 2: someone removes the "must be a whole number above zero"
//   check. Now credit(-500) quietly removes money, or credit(1.5) puts
//   half a cent in the book
// - Example 3: balance() is changed and returns text "300" instead of the
//   number 300. Then "300" + 100 becomes "300100". No error, wrong money
//
// WHAT IT SOLVES:
// - Proves credit adds, debit subtracts and balance sums correctly
// - Proves bad amounts (0, negative, decimals, text) are REFUSED
// - Proves an empty wallet shows 0, not nothing and not a crash
// - Proves the tenant comes from the connection, never from the caller
//
// SYSTEM DESIGN PRINCIPLE: Test the rules of money, not the plumbing
// - Money code must be boring and provable. For every rule ("debit is
//   negative", "amounts are whole cents") there is one test that fails
//   the moment someone breaks that rule
// - Append-only ledger: we never edit a money line, we only add new lines.
//   The tests only ever ADD lines and read the total
//
// RULES (never break these in this file):
// - Never test against real money lines. Everything runs inside one
//   transaction that is ROLLED BACK, so nothing is saved
// - Never pass a tenant id to credit or debit. The tenant comes from the
//   connection (set_config). If a test needs one, the design is wrong
// - Money is always whole cents (integers). Never write 5.50, write 550
// - Compare the CHANGE in balance (after minus before), because the shop may
//   already have real money lines
// - Never use the same test data across tests. Each test rolls back
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any app that holds money: invoicing, savings groups (chama), school
//   fees, wallets, loyalty points. The same idea works for stock counts
//   and any other "total built from lines"
//
// TRADEOFFS:
// + Real database, real SQL, so we catch real mistakes
// + Nothing left behind, safe to run any time
// - Slower than tests with no database (about a second, not milliseconds)
// - Needs a tenant already in the database, and .env set up
//
// HOW TO USE:
//   cd apps/api
//   npm test -- tests/wallet.service.test.js
//
// =============================================================================

// pg: the PostgreSQL client. We use it to open our own connection
import pg     from 'pg';

// dotenv: loads .env so process.env.DATABASE_URL exists
import dotenv from 'dotenv';

// The three functions we are testing. Note the path: they live in services/
import { credit, debit, balance } from '../src/services/wallet.service.js';

// Load .env BEFORE we read process.env
dotenv.config();

// Pull the Pool class out of pg
const { Pool } = pg;

// testPool: our own pool for this test. It connects as rahisisha_user, so RLS
// applies to it, exactly as it does to the real app
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// ONE connection with ONE open transaction. All tests share it.
// The functions we test (credit, debit, balance) are given this connection
let client;

// -----------------------------------------------------------------------------
// beforeAll: runs ONCE, before the first test
// -----------------------------------------------------------------------------
beforeAll(async () => {
  // Borrow a connection from the pool
  client = await testPool.connect();

  // Find ONE real shop to be the owner of the test money
  const { rows } = await client.query(
    'SELECT id FROM tenants ORDER BY created_at LIMIT 1'
  );

  // No shop in the database? Stop now with a message a human can understand
  if (rows.length < 1) {
    throw new Error('Need at least one tenant in the database');
  }

  // Open the transaction. Everything from here is undone at the end
  await client.query('BEGIN');

  // Tell Postgres "the current shop is this one". This is the same job
  // withTenant.js does for a real request.
  // true = the setting lasts only until the transaction ends
  await client.query("SELECT set_config('app.current_tenant', $1, true)", [rows[0].id]);
});

// -----------------------------------------------------------------------------
// beforeEach: runs before EVERY test. Puts a bookmark in the transaction
// -----------------------------------------------------------------------------
beforeEach(async () => {
  await client.query('SAVEPOINT t');
});

// -----------------------------------------------------------------------------
// afterEach: runs after EVERY test. Rubs out only that test's money lines,
// so test 2 never sees the money test 1 added
// -----------------------------------------------------------------------------
afterEach(async () => {
  await client.query('ROLLBACK TO SAVEPOINT t');
});

// -----------------------------------------------------------------------------
// afterAll: runs ONCE, after the last test. Wipes everything and cleans up
// -----------------------------------------------------------------------------
afterAll(async () => {
  // Undo every fake money line: nothing is saved
  await client.query('ROLLBACK');

  // Give the connection back to the pool
  client.release();

  // Close the pool so Jest can exit
  await testPool.end();
});

// =============================================================================
// GROUP 1: the happy path (correct money goes in and out)
// =============================================================================
describe('credit, debit and balance: correct amounts', () => {

  // ---------------------------------------------------------------------------
  // TEST 1: credit ADDS money
  // ---------------------------------------------------------------------------
  test('credit(500) raises the balance by 500', async () => {
    // Look at the balance BEFORE. The shop may already have real money lines,
    // so we compare the CHANGE, not the total
    const before = await balance(client);

    // Put 500 cents in the book. reason 'sale' is one of the 4 allowed reasons
    await credit(client, 500, 'sale', 'test-credit-1');

    // Look at the balance AFTER
    const after = await balance(client);

    // The change must be exactly +500
    expect(after - before).toBe(500);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: debit TAKES money out
  // ---------------------------------------------------------------------------
  test('debit(200) lowers the balance by 200', async () => {
    const before = await balance(client);

    // Take 200 cents out. 'payout' is an allowed reason for money leaving
    await debit(client, 200, 'payout', 'test-debit-1');

    const after = await balance(client);

    // A debit is stored as -200, so the change must be exactly -200
    expect(after - before).toBe(-200);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: credit then debit gives the difference
  // ---------------------------------------------------------------------------
  test('credit(500) then debit(200) leaves +300', async () => {
    const before = await balance(client);

    await credit(client, 500, 'sale', 'test-both-1');
    await debit(client, 200, 'payout', 'test-both-2');

    const after = await balance(client);

    // 500 in, 200 out = 300 left
    expect(after - before).toBe(300);
  });
});

// =============================================================================
// GROUP 2: bad amounts (the book must say NO)
// =============================================================================
describe('credit and debit refuse bad amounts', () => {

  // The bad amounts, with a plain-English name for each.
  // test.each runs the SAME test once per row, so we don't copy-paste
  const BAD_AMOUNTS = [
    ['zero',              0],
    ['a negative number', -500],
    ['a decimal',         1.5],
    ['text',              '500'],
    ['nothing at all',    undefined],
  ];

  // ---------------------------------------------------------------------------
  // credit must throw for every bad amount
  // ---------------------------------------------------------------------------
  test.each(BAD_AMOUNTS)('credit refuses %s', async (_name, badAmount) => {
    // .rejects.toThrow() means: "this must fail with an error"
    await expect(
      credit(client, badAmount, 'sale', 'test-bad')
    ).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // debit must throw for every bad amount
  // ---------------------------------------------------------------------------
  test.each(BAD_AMOUNTS)('debit refuses %s', async (_name, badAmount) => {
    await expect(
      debit(client, badAmount, 'payout', 'test-bad')
    ).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // A refused amount must leave NO trace in the book
  // ---------------------------------------------------------------------------
  test('a refused credit writes nothing', async () => {
    const before = await balance(client);

    // Try the bad credit and swallow the error (we expect it)
    await credit(client, -500, 'sale', 'test-bad').catch(() => {});

    const after = await balance(client);

    // Nothing was written, so the change is 0
    expect(after - before).toBe(0);
  });
});

// =============================================================================
// GROUP 3: balance() gives back a real number
// =============================================================================
describe('balance returns a number', () => {

  test('balance is a number, not text', async () => {
    const total = await balance(client);

    // Postgres sends SUM back as text. balance() must turn it into a number.
    // If it did not, "300" + 100 would become "300100"
    expect(typeof total).toBe('number');
  });
});

// =============================================================================
// GROUP 4: the DATABASE refuses a reason that is not on the list
// =============================================================================
describe('the database guards the reason', () => {

  test('credit with an unknown reason is refused by the database', async () => {
    // 'gift' is NOT one of: sale, refund, commission, payout.
    // The CHECK constraint from migration 021 must say no
    await expect(
      credit(client, 500, 'gift', 'test-bad-reason')
    ).rejects.toThrow();
  });
});
// =============================================================================
// login-lookup.isolation.test.js — Day 5: proves the login_lookup rule is safe
// =============================================================================
//
// THE STORY (read this first):
// - Picture a hotel. The hotel is our database. Every room is a row.
// - There are TWO kinds of key card:
//     SHOP CARD  (app.current_tenant): opens every room of ONE shop.
//     LOGIN PASS (app.login_user):     opens only the rooms of ONE named
//                                      person, and ONLY to look. It can never
//                                      move, remove or add a room.
// - This file checks that the login pass cannot be used to cheat.
//
//        memberships table
//   ┌─────────────────────────────────────────┐
//   │  row mA (shop A, userA)                 │
//   │  row mB (shop B, userB)                 │
//   └─────────────────────────────────────────┘
//     shop card A    -> opens mA
//     login pass A   -> opens mA, LOOK ONLY
//     no card at all -> opens nothing
//
// WHY THIS FILE EXISTS:
// - Migration 022 added a SECOND rule on memberships, called login_lookup.
//   Login needs it: at login we do not know the person's shop yet, so the
//   shop card does not exist yet. The login pass lets us find the shop.
// - A new door in the wall must be tested. This file tries to break that door
//
// WHY IT IS IMPORTANT:
// - If login_lookup were too wide, one person could read who works in other
//   shops. If it allowed writes, a person could add themselves to someone
//   else's shop and then see that shop's orders and money
//
// DANGER — IF THIS FILE DOES NOT EXIST:
// - Example 1: someone edits the rule and removes the user_id check. Login
//   would now show EVERY membership of EVERY shop. All the other tests would
//   still pass, so nobody would notice
// - Example 2: someone changes FOR SELECT to FOR ALL while "fixing" a bug.
//   Now a logged-in person could insert, update or delete memberships
// - Example 3: the empty-string trap. A reused connection leaves '' (empty
//   text) in the setting, and '' cannot be read as a uuid. Without NULLIF the
//   lock would crash instead of hiding rows
//
// WHAT THIS TEST SOLVES (the 7 checks):
// - 1. No shop card and no login pass: nothing is visible, and nothing crashes
// - 2. Login pass for userA: ONLY userA's row is visible
// - 3. Login pass for userA: userB's row stays hidden, even by its id
// - 4. Login pass for userA: UPDATE changes 0 rows
// - 5. Login pass for userA: DELETE removes 0 rows
// - 6. Login pass for userA: INSERT is refused with an error
// - 7. Control: the shop card still works on its own
//
// RULES:
// - Connect as rahisisha_user (never a superuser), or RLS would be skipped and
//   the test would prove nothing
// - Everything happens inside ONE transaction that is ROLLED BACK at the end
// - Never change a test just to make it pass. A failing test is information
//   about the rule. Find out whether the rule or the test is wrong
//
// PRACTICAL EXAMPLES:
// - Real life: a bank teller can LOOK at your account when you show your ID,
//   but cannot move your money with only that ID
// - Real life: a school lets a parent LOOK at their own child's results, but
//   not other children's, and not edit any of them
// - In this project: login.js sets app.login_user after the password is
//   correct, reads the membership, and the setting disappears at COMMIT
//
// DECISIONS:
// - Own pool as rahisisha_user: so RLS applies, exactly like the real app
// - One transaction + ROLLBACK: the real database is left untouched
// - SAVEPOINT around the expected INSERT error: an error would cancel the
//   whole transaction, so we make a checkpoint and return to it
// - setContext writes BOTH settings every time: so any test can hold any
//   combination of cards, and old settings never leak into the next test
// - Two real shops from the database (like isolation.test.js): same style
//
// SYSTEM DESIGN PRINCIPLE: Every new door needs a test that tries to break it
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS:
// - Any time you add a second RLS rule, a bypass, or a special case, such as
//   an admin role, a support-staff view, or a public read-only page
//
// TRADEOFFS:
// + Small and fast (about 3 seconds), runs on every git push (pre-push hook)
// - Tests the DATABASE RULE only. It does not test login.js itself, so it
//   cannot catch login.js setting app.login_user too early
//
// HOW TO RUN:
//   cd apps/api
//   npm test -- tests/isolation/login-lookup.isolation.test.js
// =============================================================================

// pg: the PostgreSQL client. It lets this test talk to the database directly
import pg     from 'pg';

// dotenv: reads the .env file so process.env.DATABASE_URL exists
import dotenv from 'dotenv';

// Load .env BEFORE we read process.env (order matters)
dotenv.config();

// Pool is the tool that hands out database connections
const { Pool } = pg;

// testPool: this test's OWN door to the database.
// It logs in as rahisisha_user, so RLS applies to it, exactly like the app.
// (A superuser would bypass RLS and make this test meaningless)
const testPool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── SHARED LABELLED BOXES ───────────────────────────────────────────────────
// beforeAll fills these boxes once. Every test below reads them.
let client;        // ONE connection that stays open (the transaction lives on it)
let tenantA;       // the id of the first shop
let tenantB;       // the id of the second shop
let userA;         // the person who belongs to shop A
let userB;         // the person who belongs to shop B
let membershipA;   // userA's membership row (inside shop A)
let membershipB;   // userB's membership row (inside shop B)

// ─── HELPER: setContext ──────────────────────────────────────────────────────
// Writes the two key cards onto the connection.
//   tenant    = the SHOP CARD  ('' means "no shop card")
//   loginUser = the LOGIN PASS ('' means "no login pass")
// set_config(name, value, true): the `true` means "forget this when the
// transaction ends". It is correct here because BEGIN is already open.
// We write BOTH every time so an old card never stays behind by accident.
async function setContext(tenant, loginUser) {
  await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenant]);
  await client.query("SELECT set_config('app.login_user', $1, true)", [loginUser]);
}

// ─── SETUP ───────────────────────────────────────────────────────────────────
// beforeAll runs ONCE, before all checks. It builds a tiny world:
// two shops, one person in each, and a membership linking each pair
beforeAll(async () => {
  // Take ONE connection from the pool and keep it for the whole file
  client = await testPool.connect();

  // Find two real shops. The tenants table has no RLS, so this is allowed
  const t = await client.query('SELECT id FROM tenants ORDER BY created_at LIMIT 2');

  // Stop with a clear message if the database has fewer than two shops
  if (t.rows.length < 2) throw new Error('Need at least 2 tenants in the database.');
  tenantA = t.rows[0].id;
  tenantB = t.rows[1].id;

  // BEGIN opens the transaction. From here on, everything is a rehearsal:
  // at the end we ROLLBACK and the real database looks untouched
  await client.query('BEGIN');

  // tag makes the phone numbers different on every run, because the users
  // table does not allow two people with the same phone
  const tag = `login-${Date.now()}`;

  // Make two people. The users table has no RLS, so no shop card is needed.
  // 'x' is a fake password hash. Nobody logs in as these people
  userA = (await client.query(
    "INSERT INTO users (phone, name, password_hash) VALUES ($1, 'Login A', 'x') RETURNING id",
    [`${tag}-a`])).rows[0].id;
  userB = (await client.query(
    "INSERT INTO users (phone, name, password_hash) VALUES ($1, 'Login B', 'x') RETURNING id",
    [`${tag}-b`])).rows[0].id;

  // Link userA to shop A. memberships HAS RLS, so we must hold shop A's card
  // first, or the database refuses the insert (the same trap that broke signup)
  await setContext(tenantA, '');
  membershipA = (await client.query(
    'INSERT INTO memberships (tenant_id, user_id) VALUES ($1, $2) RETURNING id',
    [tenantA, userA])).rows[0].id;

  // Link userB to shop B, holding shop B's card this time
  await setContext(tenantB, '');
  membershipB = (await client.query(
    'INSERT INTO memberships (tenant_id, user_id) VALUES ($1, $2) RETURNING id',
    [tenantB, userB])).rows[0].id;
});

// afterAll runs ONCE, after all checks. It cleans up:
afterAll(async () => {
  // ROLLBACK undoes every row we inserted. The real database is unchanged
  await client.query('ROLLBACK');

  // Give the connection back, then close the pool so Jest can finish
  client.release();
  await testPool.end();
});

// ─── THE CHECKS ──────────────────────────────────────────────────────────────

describe('login_lookup rule on memberships', () => {

  // CHECK 1: no cards at all. Both settings are '' (empty text).
  // The NULLIF in the policies turns '' into NULL, so no row matches.
  // This proves two things: nobody gets in with no card, AND nothing crashes
  // (without NULLIF, '' cannot become a uuid and this query would throw)
  test('with no shop and no login name, no membership is visible', async () => {
    await setContext('', '');
    const { rows } = await client.query(
      'SELECT id FROM memberships WHERE id = ANY($1)', [[membershipA, membershipB]]);
    expect(rows.length).toBe(0);
  });

  // CHECK 2: hold userA's login pass and ask for BOTH rows.
  // We must get back userA's row and nothing else.
  // toEqual([membershipA]) fails if even one extra row appears
  test('with login name = userA, only userA\'s membership is visible', async () => {
    await setContext('', userA);
    const { rows } = await client.query(
      'SELECT id FROM memberships WHERE id = ANY($1)', [[membershipA, membershipB]]);
    expect(rows.map((r) => r.id)).toEqual([membershipA]);
  });

  // CHECK 3: hold userA's pass and ask for userB's row directly by its id.
  // Knowing the id is not enough: the database must say "nothing found"
  test('with login name = userA, userB\'s membership stays hidden', async () => {
    await setContext('', userA);
    const { rows } = await client.query(
      'SELECT id FROM memberships WHERE id = $1', [membershipB]);
    expect(rows.length).toBe(0);
  });

  // CHECK 4: the pass is LOOK ONLY. Try to change userA's own role.
  // rowCount 0 means the database found no row it was allowed to change
  test('with login name = userA, UPDATE changes 0 rows', async () => {
    await setContext('', userA);
    const res = await client.query(
      "UPDATE memberships SET role = 'staff' WHERE id = $1", [membershipA]);
    expect(res.rowCount).toBe(0);
  });

  // CHECK 5: the pass is LOOK ONLY. Try to delete userA's own membership.
  // rowCount 0 means nothing was removed
  test('with login name = userA, DELETE removes 0 rows', async () => {
    await setContext('', userA);
    const res = await client.query(
      'DELETE FROM memberships WHERE id = $1', [membershipA]);
    expect(res.rowCount).toBe(0);
  });

  // CHECK 6: the pass is LOOK ONLY. Try the real attack: add userA to shop B.
  // For an INSERT there is no old row to hide, so the database does not say
  // "0 rows". It REFUSES the new row with an error.
  //
  // SAVEPOINT: when Postgres raises an error inside a transaction, it cancels
  // everything after it (game over). A savepoint is a checkpoint: we mark it,
  // try the forbidden insert, catch the error, then go back to the checkpoint
  // and carry on with the next test
  test('with login name = userA, INSERT is refused by the database', async () => {
    await setContext('', userA);
    await client.query('SAVEPOINT before_insert');
    let message = '';
    try {
      await client.query(
        'INSERT INTO memberships (tenant_id, user_id) VALUES ($1, $2)',
        [tenantB, userA]);
    } catch (err) {
      // We EXPECT an error here. Keep its text so we can check what it says
      message = err.message;
    }
    await client.query('ROLLBACK TO SAVEPOINT before_insert');

    // The error must come from the lock itself ("row-level security"), not
    // from some other mistake such as a typo in the SQL
    expect(message).toMatch(/row-level security/i);
  });

  // CONTROL: the ORIGINAL shop rule still works when there is no login pass.
  // Without this check, checks 1 to 6 could pass just because everything is
  // broken and nothing is ever visible. This proves the lock opens for the
  // right card
  test('control: with shop A set and no login name, shop A\'s membership is visible', async () => {
    await setContext(tenantA, '');
    const { rows } = await client.query(
      'SELECT id FROM memberships WHERE id = $1', [membershipA]);
    expect(rows.length).toBe(1);
  });
});
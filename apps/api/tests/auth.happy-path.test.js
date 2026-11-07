// ═══════════════════════════════════════════════════════════
// FILE: apps/api/tests/auth.happy-path.test.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   Every shop owner must first sign up, then log in, then see
//   their own shop. This file checks that this whole "front door"
//   journey works when the user does everything correctly.
//
// WHAT IT TESTS (happy path = everything done correctly)
//   1. POST /v1/signup  -> 201 + cookie
//   2. POST /v1/login   -> 200 + cookie
//   3. GET  /v1/me      -> 200 + my user + my shop
//
// WHY IMPORTANT
//   If signup or login breaks, NOBODY can use Rahisisha Biashara.
//   No login = no products, no orders, no money. This is the
//   first thing every customer touches.
//
// DANGER (what breaks without it)
//   Someone edits signup.js or login.js and breaks it by accident.
//   Without this test you find out when a real shop owner
//   complains. With it, you find out in 5 seconds.
//
// WHAT IT SOLVES
//   Our isolation tests prove Shop A cannot see Shop B (locks).
//   They do NOT prove that signup, login and /v1/me work (doors).
//   This file proves the doors open.
//
// SYSTEM DESIGN PRINCIPLE
//   "Test the real thing, end to end."
//   We do not fake the database or the cookie. We call the real
//   API with supertest, like a browser would, so the test can
//   catch real bugs. A test that fakes everything proves nothing.
//   Also: "happy path first". Prove the normal case works before
//   testing the weird cases.
//
// RULES (never do this)
//   1. NEVER hard-code a phone number. Use a unique one each run,
//      or the 2nd run fails with 409 "duplicate".
//   2. NEVER log the password or the cookie in console.log.
//   3. NEVER point tests at the production database.
//   4. NEVER make one test depend on a test in ANOTHER file.
//      (Inside this file the 3 tests do run in order, on purpose.)
//   5. NEVER edit a test just to make it pass. First ask: is the
//      test wrong, or is the code wrong?
//   6. NEVER guess a URL. Read app.js to see where each router is
//      mounted. (We guessed /v1/auth/signup once and got 404.
//      The real URL is /v1/signup because app.js does
//      app.use('/v1', authRouter).)
//
// PRACTICAL EXAMPLE
//   Sheryl signs up "Happy Path Shop". The API says 201 Created
//   and gives a cookie. She logs in with the same phone and
//   password and gets 200 OK. Then /v1/me says "you are Happy
//   Tester and your shop is Happy Path Shop". That is exactly
//   what the 3 tests below do.
//
// DECISIONS
//   - Unique phone from Date.now(): simple and never repeats.
//   - Tests share variables (cookie) because login needs the
//     account that signup made. So the order matters.
//   - We read the cookie from res.headers['set-cookie'], the
//     same way a browser receives it.
//
// WHERE YOU WILL USE THIS
//   - Run it by hand:  npm test -- auth.happy-path
//   - CI (Task 7) runs it on every push to GitHub.
//   - The "Core Polish" grader looks for one test per endpoint.
//
// TRADEOFFS
//   + Real database = real confidence.
//   - Each run leaves one test shop behind in the database.
//     The reset script (Task 5) wipes these. We accept this
//     for now, because cleaning up under row-level security
//     needs extra code and the deadline is close.
//
// HOW TO USE
//   cd apps/api
//   npm test -- auth.happy-path
//   Expect: 3 passed.
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. supertest  =  a MYSTERY SHOPPER
//    Walks into the shop, buys something, tells us if it worked.
//    WHERE: test files only.  WHEN: to test any API route.
//    HOW:   request(app).post('/url').send({...})
//
// 2. app  =  the WHOLE SHOP BUILDING
//    All counters and doors. The shopper needs a shop to enter.
//    WHERE: imported in every API test.  HOW: import it once.
//
// 3. dotenv.config()  =  the KEY BOX behind the counter
//    Holds the secrets (database address, JWT secret).
//    WHEN: before anything uses process.env.
//    DANGER: skip it and the secrets are undefined.
//
// 4. phone = 07 + Date.now()  =  a NEW ID CARD for each visitor
//    Two people cannot share one ID.
//    WHEN: whenever the database says "must be unique".
//    HOW:  Date.now() is never the same twice.
//
// 5. signupCookie / loginCookie  =  a CONCERT WRISTBAND
//    Show it and you get in without paying again.
//    A browser keeps it for you; here we hold it by hand.
//
// 6. describe() / test()  =  a FOLDER and a CHECKLIST ITEM
//    describe groups related tests; test is one check.
//
// 7. .post(url).send(body)  =  FILLING IN A FORM and handing it
//    over the counter. Used for signup, products, orders.
//
// 8. expect(res.status).toBe(201)  =  RECEIPT CHECK
//    "Did the cashier say Paid?"  201 created, 200 OK,
//    401 not logged in, 404 not found.
//    A test with no expect proves NOTHING.
//
// 9. expect(res.body.message).toBe('...')  =  READING THE WORDS
//    on the receipt, not only its colour.
//
// 10. toBeDefined()  =  "IS THE ITEM IN THE BAG?"
//    Use for IDs and cookies that change every run.
//
// 11. res.headers['set-cookie']  =  THE CASHIER HANDING YOU
//    the wristband. It is in the header, not the body.
//
// 12. .set('Cookie', cookie)  =  SHOWING YOUR WRISTBAND
//    at the VIP door. Needed for every route that wants login.
//
// 13. GET /v1/me  =  ASKING THE GUARD "who am I?"
//    The web app calls it on load to show your name and shop.
//
// 14. 404 in a test  =  "THE SHOP ASSISTANT SAYS: we don't have
//    that aisle." It usually means YOUR URL is wrong, not that
//    the feature is missing.
// ═══════════════════════════════════════════════════════════

// supertest: lets us call our Express app like a browser,
// without starting a real server on a port.
import request from 'supertest';

// dotenv: loads DATABASE_URL, JWT_SECRET etc. from the .env file.
import dotenv from 'dotenv';

// app: our real Express app (all routes and middleware inside).
import app from '../src/app.js';

dotenv.config();

// Unique phone number for THIS run.
// Date.now() is the time in milliseconds, so it is different
// every run. We keep the last 8 digits and start with "07".
const phone = `07${String(Date.now()).slice(-8)}`;

// A test password. It only exists in this test.
const password = 'Test1234!';

// These two hold the cookies we receive, so later tests can
// use them. A cookie is the "I am logged in" ticket.
let signupCookie;
let loginCookie;

describe('Auth happy path', () => {

  // ── TEST 1: SIGNUP ────────────────────────────────────
  test('signup creates a shop and sets a cookie', async () => {
    // Send a POST request with the 4 fields signup needs.
    const res = await request(app)
      .post('/v1/signup')
      .send({
        phone,
        name: 'Happy Tester',
        password,
        tenant_name: 'Happy Path Shop',
      });

    // 201 = "Created". The account now exists.
    expect(res.status).toBe(201);

    // The API's friendly message must be exactly this.
    expect(res.body.message).toBe('Account created');

    // IDs prove the shop and the user really got saved.
    expect(res.body.tenant_id).toBeDefined();
    expect(res.body.user_id).toBeDefined();

    // The cookie arrives in the "set-cookie" header.
    // Without it the user would not be logged in after signup.
    signupCookie = res.headers['set-cookie'];
    expect(signupCookie).toBeDefined();
  });

  // ── TEST 2: LOGIN ─────────────────────────────────────
  test('login with the same phone and password works', async () => {
    // Use the account that test 1 just created.
    const res = await request(app)
      .post('/v1/login')
    // login reads the Host header to find the shop.
    // supertest's default host looks like a shop called "127",
    // so we pretend to be localhost, like the browser in dev.
      .set('Host', 'localhost')
      .send({ phone, password });

    // 200 = "OK". Password matched.
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged in');

    // Login must also give a fresh cookie.
    loginCookie = res.headers['set-cookie'];
    expect(loginCookie).toBeDefined();
  });

  // ── TEST 3: /v1/me ────────────────────────────────────
  test('/v1/me returns my user and my shop', async () => {
    // Send the login cookie back, like a browser does.
    // requireAuth reads it and knows who we are.
    const res = await request(app)
      .get('/v1/me')
      .set('Cookie', loginCookie);

    expect(res.status).toBe(200);

    // Both parts must come back.
    expect(res.body.user).toBeDefined();
    expect(res.body.tenant).toBeDefined();

    // It must be MY shop, not someone else's.
    expect(res.body.tenant.name).toBe('Happy Path Shop');
  });
});
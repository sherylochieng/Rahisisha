// FILE: scripts/demo-run.mjs
//
// WHY THIS FILE EXISTS
//   The Week 29 weekend task says: "Run the full demo end to end ten times"
//   and "Demo runs smoothly with zero manual interventions". Doing that by
//   hand ten times means ten rounds of typing, and a typo can look like a bug.
//   This script does the whole demo by itself, as many times as you ask, and
//   checks every answer. One command: reset, sign up two shops, USSD,
//   WhatsApp, orders, and proof that nothing leaks between the shops.
//
// WHY IMPORTANT
//   A demo you can only get right by luck is not ready. If it passes ten times
//   in a row from a clean database, with nobody touching it, it is repeatable.
//   If it fails once in ten, you have found a real bug on a quiet weekend
//   instead of in front of the instructor.
//
// DANGER
//   - It DELETES the local practice database on every run (it calls
//     scripts/reset-db.sh). Local practice data only. It refuses any API or
//     database address that is not on this computer.
//   - It briefly renames scripts/demo-data.sql (so the reset does not load the
//     practice shops, which clash with "Aminas Boutique") and always renames it
//     back, even if a run fails. If you stop it with Ctrl+C at the wrong moment,
//     check that scripts/demo-data.sql exists (RUNBOOK.md section 7).
//   - It does NOT test M-Pesa. M-Pesa uses Safaricom's sandbox and a real phone
//     prompt, so it is tried by hand twice (see PRACTICAL EXAMPLE).
//   - All passwords come from environment variables. None is in this file and
//     none is printed.
//
// WHAT IT SOLVES
//   - "Does the demo work from a clean start, every time?"
//   - "Does shop A ever see shop B's messages, orders or wallet?"
//   - "How long does the whole thing take?" (the target is under 5 minutes)
//
// SYSTEM DESIGN PRINCIPLE
//   A repeatable demo is a tested demo. Treat the demo like a test suite: start
//   from the same clean state, run the same steps, check the same answers.
//
// RULES
//   1. Local computer only.
//   2. Passwords only through environment variables.
//   3. Every run starts from a freshly reset database.
//   4. Every step checks its answer. One wrong answer fails the run.
//   5. It always puts scripts/demo-data.sql back.
//
// PRACTICAL EXAMPLE
//   Git Bash, in the repo folder, with the API running (cd apps/api, npm run dev):
//     export DEMO_ADMIN_PASSWORD='the postgres password'
//     export DEMO_APP_PASSWORD='the rahisisha_user password'
//     export DEMO_PASSWORD_A='a practice password for Aminas Boutique'
//     export DEMO_PASSWORD_B='a different practice password for Brio Hardware'
//     node scripts/demo-run.mjs            (one run)
//     node scripts/demo-run.mjs --runs 10  (ten runs and a summary)
//   Then do the M-Pesa part by hand, twice (capstone/demo-script.md, Part 4).
//
// DECISIONS (and WHY)
//   - One script, not ten commands: nobody can mistype a step.
//   - Real HTTP calls to the real API, not shortcuts into the database: it
//     tests what a customer or a shop owner would really touch.
//   - Isolation is checked in three places (inbox, orders, wallet) because one
//     leak anywhere is a leak.
//   - Node 18+ built-in fetch, no new package.
//   - .mjs file extension so it runs as a modern module without any setup.
//
// WHERE USED / FUTURE USES
//   Before every demo, and after any big change: run it once. Later: run it
//   against a staging server (change the local-only guard on purpose, never by
//   accident) and add the checkout steps once the online shop exists.
//
// TRADEOFFS
//   + Fast (about 10 to 20 seconds per run), repeatable, catches leaks.
//   - It wipes the practice database each run.
//   - It needs Git Bash (for bash and psql) and the API already running.
//   - No M-Pesa (see DANGER).
//
// HOW TO USE
//   See PRACTICAL EXAMPLE. Guide: apps/api/docs/scripts/demo-run.md
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request for the Week 29 weekend. Declared in the
//   weekend audit. Sheryl ran it and pasted the real results.

// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// THE BIG PICTURE
//   Imagine a driving instructor who, instead of watching you drive once,
//   makes you do the same test route ten times from the same starting point
//   and ticks a box for every turn you got right. This script is that test
//   route for the demo: same start (a freshly reset database), same turns
//   (the nine steps), a tick (check) after every one.
//
// 1. import { spawnSync } from 'node:child_process'  =  "CALL ANOTHER PROGRAM"
//    Lets this script run other programs (bash, psql, node) and wait for them.
//    REAL LIFE: the manager asking the stockroom to bring something and
//    waiting at the counter until it arrives.
//    WHERE: resetting the database and loading the settings.
//    WHEN: steps 1 and 3 of every run.
//
// 2. import { existsSync, renameSync } from 'node:fs'  =  "LOOK AT FILES, RENAME FILES"
//    existsSync asks "is this file there?". renameSync changes a file's name.
//    REAL LIFE: slipping a sheet of paper into a drawer for a moment, and
//    taking it out again afterwards.
//    WHERE: hiding scripts/demo-data.sql during the reset.
//
// 3. import { dirname, join } from 'node:path' and fileURLToPath  =  "FIND MY OWN ADDRESS"
//    Works out where this file lives, so the script runs correctly from any
//    folder. REAL LIFE: knowing the shop's street address, so directions
//    work wherever you start walking from.
//
// 4. const ROOT  =  THE REPO FOLDER
//    scripts/ is one level below the repo root, so ROOT is "one folder up".
//    Every file the script touches is found starting from ROOT.
//
// 5. const API and DB_NAME  =  WHERE THE APP AND THE DATABASE ARE
//    API defaults to http://localhost:3000 (this computer). DB_NAME is the
//    database the reset script rebuilds. REAL LIFE: the address of the shop
//    and the name of the filing cabinet.
//
// 6. const RUNS  =  HOW MANY TIMES
//    Reads "--runs 10" from the command line. Only whole numbers from 1 to
//    50 are accepted; anything else falls back to 1. REAL LIFE: "do the test
//    route ten times". WHEN: every time you start the script.
//
// 7. const A and const B  =  THE TWO PRETEND SHOPS
//    Everything that is different between the two shops lives here: name,
//    login phone, owner, password, USSD code, WhatsApp number id, the
//    WhatsApp message each customer sends, and a word that must show up in
//    its own product list. Passwords are read from the environment, never
//    written in the file.
//    REAL LIFE: two stall owners at the same market, each with their own
//    name, key and customers.
//
// 8. pause(ms)  =  "WAIT A MOMENT"
//    Waits that many milliseconds. Used once: after a reset, the API's old
//    database connections are dead, so we give it a moment before retrying.
//
// 9. guard()  =  THE SAFETY CHECK AT THE DOOR
//    Refuses to start unless: the API address is on this computer; all four
//    passwords are set; the two shop passwords are long enough; and the two
//    shop passwords are different. REAL LIFE: the practice-room key that
//    cannot open the real shop. WHEN: first thing, before anything is
//    deleted.
//
// 10. check(condition, message)  =  ONE TICK-BOX
//     If the condition is false it stops the run and says exactly what went
//     wrong ("CHECK FAILED: Aminas Boutique inbox shows Brio Hardware's
//     WhatsApp message"). REAL LIFE: a flight checklist, where one unticked
//     box means the plane does not take off. WHERE: after every step.
//
// 11. runCmd(cmd, args, options)  =  "RUN THIS PROGRAM AND TELL ME IF IT FAILED"
//     Starts a program, waits, and returns what it printed. If it fails it
//     throws an error that contains only the LAST FOUR lines of output, so
//     a failure is readable and no password can leak (passwords are passed
//     through the environment, never on the command line).
//
// 12. api(path, options)  =  "TALK TO THE APP LIKE A BROWSER WOULD"
//     Sends one request to the API (GET or POST, JSON or form data, with an
//     optional login cookie) and gives back the status number, the text,
//     the parsed JSON and the login cookie if one came back.
//     REAL LIFE: a customer or shop owner pressing a button. The runner
//     uses the same front door as real people, which is why it is a fair
//     test. WHERE: every step from 2 to 9.
//
// 13. stepReset()  =  CLEAN THE TABLE
//     Hides scripts/demo-data.sql, runs scripts/reset-db.sh, and checks the
//     reset reported the locks (Row-Level Security) are in place. The
//     "finally" part puts demo-data.sql back no matter what, even after an
//     error. REAL LIFE: wiping the stall and laying out the same empty
//     tables before each trading day. WHY HIDE THE FILE: it loads a practice
//     shop called "Amina's Boutique" that would clash with "Aminas
//     Boutique".
//
// 14. stepSignup(shop)  =  THE SHOP JOINS RAHISISHA
//     Posts the signup form for one shop and expects 201 ("created"). If
//     the very first answer is a 5xx (the app's old database connections
//     died in the reset), it waits a moment and tries once more, exactly
//     like a person pressing the button again.
//
// 15. stepSeeds()  =  FILL IN THE SETTINGS
//     Loads each shop's USSD code and practice products (two SQL files, run
//     through psql as the app user) and each shop's WhatsApp number id (the
//     seed-whatsapp-demo.js script). Checks that script printed two OK
//     lines. REAL LIFE: stocking the shelves and putting the phone number
//     on the door.
//
// 16. stepUssd(run)  =  DIAL THE SHOP CODES
//     The SAME phone number dials both codes. Each answer must start with
//     "CON" (a menu), name the right shop, and list the right products
//     without a product from the other shop. REAL LIFE: one customer, two
//     different shops' phone menus.
//
// 17. stepWhatsapp(run)  =  CUSTOMERS MESSAGE THE SHOPS
//     Pretends to be Meta (WhatsApp) and posts one message per shop, each
//     addressed to that shop's own number id. Each must answer "received 1".
//     The message id includes the run number and the time, so a repeat run
//     never counts as a duplicate.
//
// 18. stepLogin(shop)  =  THE OWNER SIGNS IN
//     Logs in with the shop's own phone and password and keeps the login
//     cookie for later steps. REAL LIFE: the owner showing their badge.
//
// 19. stepInbox()  =  EACH OWNER READS THEIR OWN MESSAGES
//     Loads each shop's inbox. It must contain that shop's own WhatsApp
//     message and its own USSD activity, and must NOT contain the other
//     shop's message or the other shop's customer phone.
//
// 20. stepOrders()  =  EACH SHOP MAKES ONE SMALL ORDER
//     Creates the cheapest product, quantity 1, then checks: each shop's
//     list contains its own order and not the other's, and opening the
//     OTHER shop's order by its id answers 404 ("not found"), not the data.
//     REAL LIFE: trying a neighbour's locker with your own key.
//
// 21. stepWallet()  =  EACH SHOP HAS ITS OWN MONEY BOOK
//     Loads each shop's wallet lines. There must be lines, no line shared
//     between the two shops, and different balances. REAL LIFE: two shops
//     must never share one cash tin.
//
// 22. oneRun(run)  =  THE NINE STEPS IN ORDER
//     A list of (name, step) pairs. It runs them one at a time, times each,
//     prints "ok" for a pass, and returns at the FIRST failure with the
//     step name and the reason. Nothing after a failed step is run, because
//     the later steps depend on the earlier ones.
//
// 23. main()  =  THE WHOLE SHOW
//     Checks the guard, repeats oneRun the requested number of times,
//     prints PASSED or FAILED for each run, then a SUMMARY: runs, passed,
//     failed, fastest, average and slowest time, and a reminder that
//     M-Pesa is not covered. It sets a failing exit code if any run failed,
//     so other tools (like a robot) can tell it failed.
//
// 24. main().catch(...)  =  THE LAST NET
//     If something unexpected throws (for example a missing password), it
//     prints only the message and sets a failing exit code. It never prints
//     a whole error object, which could contain details that do not belong
//     on screen.
//
// COMMON MISTAKES
//   - Running it from PowerShell: use Git Bash (it needs bash and psql).
//   - Forgetting to start the API first: the first step after the reset
//     will fail to connect.
//   - Using the same password for both shops: the guard refuses (two shops,
//     two credentials).
//   - Pressing Ctrl+C in the middle: check scripts/demo-data.sql exists.
//
// ═══════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- settings ----------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.DEMO_API || 'http://localhost:3000';
const DB_NAME = 'rahisisha';

const RUNS = (() => {
  const i = process.argv.indexOf('--runs');
  const n = i >= 0 ? Number(process.argv[i + 1]) : 1;
  return Number.isInteger(n) && n > 0 && n <= 50 ? n : 1;
})();

const A = {
  label: 'Aminas Boutique', phone: '0700000001', owner: 'Amina Wanjiru',
  password: process.env.DEMO_PASSWORD_A, ussdCode: '*384*101#',
  pid: 'demo-pid-amina', waFrom: '254722000001', waBody: 'Hi, how much is the Maxi Dress?',
  ussdWelcome: "Amina's Boutique", ussdProduct: 'Maxi Dress', waNo: 'wamid.RUN-A-',
};
const B = {
  label: 'Brio Hardware', phone: '0700000002', owner: 'Brian Otieno',
  password: process.env.DEMO_PASSWORD_B, ussdCode: '*384*102#',
  pid: 'demo-pid-brio', waFrom: '254733000002', waBody: 'Do you have the Hammer in stock?',
  ussdWelcome: 'Brio Hardware', ussdProduct: 'Hammer', waNo: 'wamid.RUN-B-',
};

// ---------- small helpers ----------

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// guard: stop unless everything is on this computer and every password is set.
function guard() {
  const host = new URL(API).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Refusing to run: the API address is not on this computer');
  }
  const need = ['DEMO_ADMIN_PASSWORD', 'DEMO_APP_PASSWORD', 'DEMO_PASSWORD_A', 'DEMO_PASSWORD_B'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Set these environment variables first: ${missing.join(', ')}`);
  if (A.password.length < 8 || B.password.length < 8) {
    throw new Error('DEMO_PASSWORD_A and DEMO_PASSWORD_B must be at least 8 characters');
  }
  if (A.password === B.password) {
    throw new Error('DEMO_PASSWORD_A and DEMO_PASSWORD_B must be different (two shops, two credentials)');
  }
}

// check: one fact that must be true. If not, the run fails with this message.
function check(condition, message) {
  if (!condition) throw new Error(`CHECK FAILED: ${message}`);
}

// runCmd: run a program, return its output. Never prints passwords.
function runCmd(cmd, args, { env = {}, cwd = ROOT } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (r.error) throw new Error(`Could not run ${cmd}: ${r.error.message}`);
  if (r.status !== 0) {
    const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-4).join(' | ');
    throw new Error(`${cmd} ${args[0] || ''} failed: ${tail}`);
  }
  return r.stdout;
}

// api: call the API and return { status, json, cookie }.
async function api(path, { method = 'GET', body, cookie, form } = {}) {
  const headers = {};
  let payload;
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* USSD answers are plain text */ }
  const setCookie = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie().join(';')
    : (res.headers.get('set-cookie') || '');
  const m = /token=([^;]+)/.exec(setCookie);
  return { status: res.status, text, json, cookie: m ? `token=${m[1]}` : null };
}

// ---------- the steps ----------

// 1. reset: a clean database. demo-data.sql is hidden for the reset and
//    ALWAYS put back (finally).
function stepReset() {
  const real = join(ROOT, 'scripts', 'demo-data.sql');
  const hidden = `${real}.off`;
  const hid = existsSync(real);
  if (hid) renameSync(real, hidden);
  try {
    const out = runCmd('bash', ['scripts/reset-db.sh'], {
      env: {
        RESET_DB_CONFIRM: DB_NAME,
        ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD,
        APP_PASSWORD: process.env.DEMO_APP_PASSWORD,
      },
    });
    check(out.includes('policies, login_lookup present'), 'the reset did not confirm the locks (Row-Level Security)');
  } finally {
    if (hid && existsSync(hidden)) renameSync(hidden, real);
  }
}

// 2. signup: both shops sign up on the live API, with different credentials.
async function stepSignup(shop) {
  // The first request after a reset may meet a dropped database connection.
  // Try again once, which is what a user pressing the button again would do.
  let r = await api('/v1/signup', {
    method: 'POST',
    body: { phone: shop.phone, name: shop.owner, password: shop.password, tenant_name: shop.label },
  });
  if (r.status >= 500) {
    await pause(1500);
    r = await api('/v1/signup', {
      method: 'POST',
      body: { phone: shop.phone, name: shop.owner, password: shop.password, tenant_name: shop.label },
    });
  }
  check(r.status === 201, `${shop.label} signup answered ${r.status}, expected 201`);
}

// 3. seeds: USSD codes and practice products and wallet, WhatsApp numbers.
function stepSeeds() {
  const psqlEnv = { PGPASSWORD: process.env.DEMO_APP_PASSWORD };
  for (const file of ['sql/seeds/ussd_configs_seed.sql', 'sql/seeds/ussd_demo_data_seed.sql']) {
    runCmd('psql', ['-h', 'localhost', '-U', 'rahisisha_user', '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { env: psqlEnv });
  }
  const out = runCmd('node', ['scripts/seed-whatsapp-demo.js'], { cwd: join(ROOT, 'apps', 'api') });
  check((out.match(/^OK /gm) || []).length === 2, 'the WhatsApp seed did not print two OK lines');
}

// 4. ussd: the SAME phone dials both shops. The code decides who answers.
async function stepUssd(run) {
  const phone = '+254711111111';
  for (const shop of [A, B]) {
    const welcome = await api('/ussd', { method: 'POST', form: { serviceCode: shop.ussdCode, sessionId: `run${run}-${shop.pid}-1`, phoneNumber: phone, text: '' } });
    check(welcome.status === 200 && welcome.text.startsWith('CON'), `${shop.label} USSD welcome was not a menu (status ${welcome.status})`);
    check(welcome.text.includes(shop.ussdWelcome), `${shop.label} USSD welcome did not name the shop`);
    const list = await api('/ussd', { method: 'POST', form: { serviceCode: shop.ussdCode, sessionId: `run${run}-${shop.pid}-2`, phoneNumber: phone, text: '1' } });
    check(list.text.includes(shop.ussdProduct), `${shop.label} USSD product list is missing "${shop.ussdProduct}"`);
    const other = shop === A ? B : A;
    check(!list.text.includes(other.ussdProduct), `${shop.label} USSD product list shows "${other.ussdProduct}" from the other shop`);
  }
}

// 5. whatsapp: each shop gets one message on its own number id.
async function stepWhatsapp(run) {
  for (const shop of [A, B]) {
    const payload = {
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: shop.pid },
        contacts: [{ profile: { name: 'Customer' } }],
        messages: [{ id: `${shop.waNo}${run}-${Date.now()}`, from: shop.waFrom, type: 'text', text: { body: shop.waBody } }],
      } }] }],
    };
    const r = await api('/webhooks/whatsapp', { method: 'POST', body: payload });
    check(r.status === 200 && r.json?.data?.received === 1, `${shop.label} WhatsApp message was not received (status ${r.status})`);
  }
}

// 6. login: each owner logs in with their own credentials.
async function stepLogin(shop) {
  const r = await api('/v1/login', { method: 'POST', body: { phone: shop.phone, password: shop.password } });
  check(r.status === 200 && r.cookie, `${shop.label} login failed (status ${r.status})`);
  shop.cookie = r.cookie;
}

// 7. inbox: A sees only A's messages, B only B's.
async function stepInbox() {
  for (const shop of [A, B]) {
    const other = shop === A ? B : A;
    const r = await api('/v1/inbox?limit=50', { cookie: shop.cookie });
    check(r.status === 200 && Array.isArray(r.json?.data), `${shop.label} inbox did not load (status ${r.status})`);
    const rows = r.json.data;
    check(rows.some((x) => x.channel === 'whatsapp' && x.body === shop.waBody), `${shop.label} inbox is missing its own WhatsApp message`);
    check(rows.some((x) => x.channel === 'ussd'), `${shop.label} inbox is missing its own USSD activity`);
    check(!rows.some((x) => x.body === other.waBody), `${shop.label} inbox shows ${other.label}'s WhatsApp message`);
    check(!rows.some((x) => x.from === other.waFrom), `${shop.label} inbox shows ${other.label}'s customer`);
  }
}

// 8. orders: each shop makes one small order and sees only its own.
async function stepOrders() {
  const made = {};
  for (const shop of [A, B]) {
    const products = await api('/v1/products', { cookie: shop.cookie });
    check(products.status === 200 && products.json?.data?.length > 0, `${shop.label} has no products`);
    const cheapest = [...products.json.data].sort((x, y) => x.price_cents - y.price_cents)[0];
    const order = await api('/v1/orders', {
      method: 'POST', cookie: shop.cookie,
      body: { customerPhone: shop.waFrom, channel: 'web', items: [{ productId: cheapest.id, quantity: 1 }] },
    });
    check(order.status === 201, `${shop.label} order answered ${order.status}, expected 201`);
    made[shop.label] = order.json.data.id;
  }
  for (const shop of [A, B]) {
    const other = shop === A ? B : A;
    const list = await api('/v1/orders?limit=50', { cookie: shop.cookie });
    check(list.status === 200, `${shop.label} orders list did not load (status ${list.status})`);
    const ids = (list.json?.data || []).map((o) => o.id);
    check(ids.includes(made[shop.label]), `${shop.label} orders list is missing its own order`);
    check(!ids.includes(made[other.label]), `${shop.label} orders list shows ${other.label}'s order`);
    const peek = await api(`/v1/orders/${made[other.label]}`, { cookie: shop.cookie });
    check(peek.status === 404, `${shop.label} could open ${other.label}'s order by its id (status ${peek.status})`);
  }
}

// 9. wallet: each shop has its own ledger, different from the other.
async function stepWallet() {
  const seen = {};
  for (const shop of [A, B]) {
    const r = await api('/v1/wallet/entries?limit=50', { cookie: shop.cookie });
    check(r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length > 0, `${shop.label} wallet has no entries (status ${r.status})`);
    seen[shop.label] = r.json.data;
  }
  const refsA = new Set(seen[A.label].map((e) => e.reference));
  const refsB = new Set(seen[B.label].map((e) => e.reference));
  check(![...refsA].some((x) => refsB.has(x)), 'the two shops share a wallet entry');
  const balA = seen[A.label][0].balanceAfterCents;
  const balB = seen[B.label][0].balanceAfterCents;
  check(balA !== balB, "Aminas Boutique's wallet equals Brio Hardware's wallet");
}

// ---------- one full run ----------

async function oneRun(run) {
  A.cookie = null; B.cookie = null;
  const steps = [
    ['reset the database', () => stepReset()],
    ['sign up both shops', async () => { await stepSignup(A); await stepSignup(B); }],
    ['load USSD and WhatsApp settings', () => stepSeeds()],
    ['USSD for both shops', () => stepUssd(run)],
    ['WhatsApp for both shops', () => stepWhatsapp(run)],
    ['log in as both owners', async () => { await stepLogin(A); await stepLogin(B); }],
    ['inboxes are separate', () => stepInbox()],
    ['orders are separate', () => stepOrders()],
    ['wallets are separate', () => stepWallet()],
  ];
  const t0 = performance.now();
  for (const [name, fn] of steps) {
    const s0 = performance.now();
    try {
      await fn();
    } catch (err) {
      return { run, ok: false, ms: performance.now() - t0, failedAt: name, why: err.message };
    }
    console.log(`  run ${run}: ok   ${name} (${Math.round(performance.now() - s0)} ms)`);
  }
  return { run, ok: true, ms: performance.now() - t0 };
}

async function main() {
  guard();
  console.log(`Demo runner: ${RUNS} run(s) against ${API}`);
  console.log('(each run deletes and rebuilds the local practice database)\n');

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    console.log(`RUN ${i} of ${RUNS}`);
    const r = await oneRun(i);
    results.push(r);
    console.log(r.ok
      ? `  run ${i}: PASSED in ${(r.ms / 1000).toFixed(1)} s\n`
      : `  run ${i}: FAILED at "${r.failedAt}": ${r.why}\n`);
  }

  const passed = results.filter((r) => r.ok);
  const times = results.map((r) => r.ms / 1000);
  console.log('SUMMARY');
  console.log(`  Runs:     ${results.length}`);
  console.log(`  Passed:   ${passed.length}`);
  console.log(`  Failed:   ${results.length - passed.length}`);
  console.log(`  Time per run (s): fastest ${Math.min(...times).toFixed(1)}, average ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)}, slowest ${Math.max(...times).toFixed(1)}`);
  console.log('  Not covered: M-Pesa (try it by hand, twice: capstone/demo-script.md, Part 4)');
  if (passed.length !== results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
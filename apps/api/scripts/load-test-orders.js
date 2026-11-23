// FILE: apps/api/scripts/load-test-orders.js
//
// WHY THIS FILE EXISTS
//   The Week 29 weekend task asks: "100 orders in 60 seconds across two tenants.
//   Verify no data bleed." This script sends those orders to the real API, as
//   two real shop owners, and prints how fast and how reliably the API answered.
//   It is the "rush hour" test: what happens when many customers order at once?
//
// WHY IMPORTANT
//   One order at a time always works. Trouble shows up when many arrive together:
//   slow answers, errors, or (worst for us) one shop's order landing in the other
//   shop's books. The speed numbers go into PERFORMANCE.md. The "no bleed" check
//   is a separate SQL query (see the guide), because the API must not be the one
//   marking its own homework.
//
// DANGER
//   - It creates REAL orders in whatever database the API uses. Run it only
//     against the local practice database. The script REFUSES any API address
//     that is not localhost or 127.0.0.1.
//   - It never pays anything. It only creates orders. No Safaricom, no money.
//   - The two shop passwords come from environment variables, NEVER from this
//     file, so no password can be committed. The script never prints them.
//   - Do not point it at a public address (an ngrok tunnel, a server).
//
// WHAT IT SOLVES
//   - "Can the API take 100 orders in 60 seconds?" (default, paced mode)
//   - "What breaks if they all arrive at once?" (--burst mode)
//   - Gives numbers: how many worked, how many failed, and how long each took.
//
// SYSTEM DESIGN PRINCIPLE
//   Test the system from the OUTSIDE, the way a customer would (HTTP, logged in),
//   and check the result from the INSIDE, with a different tool (SQL). The two
//   views must agree.
//
// RULES
//   1. Local API only.
//   2. 50 orders per shop, 100 in total, alternating A, B, A, B...
//   3. Each shop's orders use a customer phone that starts with its own marker
//      (A: 254722..., B: 254733...). That marker is what the SQL check uses to
//      prove no order crossed over.
//   4. Passwords only via LOAD_PASSWORD_A and LOAD_PASSWORD_B.
//   5. Print only counts and timings, never secrets.
//
// PRACTICAL EXAMPLE
//   PowerShell, in apps/api, with the API running:
//     $env:LOAD_PASSWORD_A = "the practice password for Aminas Boutique"
//     $env:LOAD_PASSWORD_B = "the practice password for Brio Hardware"
//     node scripts/load-test-orders.js            (paced: 100 orders over 60 seconds)
//     node scripts/load-test-orders.js --burst    (all at once, 20 at a time)
//
// DECISIONS (and WHY)
//   - Paced by default: "100 in 60 seconds" is a RATE (one every 0.6 s). Orders
//     are started on that beat even if an earlier one is still being answered,
//     like customers walking in on a clock.
//   - --burst as a second mode: shows what happens under a rush, not just a
//     steady flow.
//   - Cheapest product, quantity 1: orders stay tiny and identical, so any
//     slowness comes from the system, not the data.
//   - Orders only, no payments: the M-Pesa sandbox is a separate system with a
//     real phone prompt. It is not part of a load test.
//   - Built-in fetch (Node 18+): no new package to install.
//
// WHERE USED / FUTURE USES
//   Any time you change the orders route or the database and want to know it
//   still holds up. Later: the same script pointed at a staging server (change
//   the guard on purpose, never by accident), or extended to the checkout route
//   once the online shop exists.
//
// TRADEOFFS
//   + No dependencies, easy to read, and it exercises login, cookies, the lock
//     (RLS) and the database together.
//   - One machine is both the tester and the server, so the numbers are
//     "on my laptop", not "on a real server". It says so in PERFORMANCE.md.
//   - It measures the order route only.
//
// HOW TO USE
//   See PRACTICAL EXAMPLE. Then run the SQL check from
//   apps/api/docs/scripts/load-test-orders.md.
//
// GUIDE DOC: apps/api/docs/scripts/load-test-orders.md
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request for the Week 29 weekend. Declared in the
//   weekend audit. Sheryl ran it and pasted the real results.

// ---------- settings you can change ----------

// Where the API listens. Must be on this computer (see guard()).
const API = process.env.LOAD_API || 'http://localhost:3000';

// The two shops (login phones from the demo). Passwords come from the
// environment, never from this file.
const SHOPS = [
  { name: 'Aminas Boutique', phone: '0700000001', password: process.env.LOAD_PASSWORD_A, customerPrefix: '254722' },
  { name: 'Brio Hardware',   phone: '0700000002', password: process.env.LOAD_PASSWORD_B, customerPrefix: '254733' },
];

const TOTAL_ORDERS = 100;            // 50 per shop
const WINDOW_MS = 60_000;            // the paced run spreads them over 60 seconds
const BURST_CONCURRENCY = 20;        // --burst: how many at the same moment
const BURST = process.argv.includes('--burst');

// ---------- helpers ----------

// guard: refuse anything that is not this computer. Real life: a practice
// room key that cannot open the real shop.
function guard() {
  let host = '';
  try {
    host = new URL(API).hostname;
  } catch {
    throw new Error('LOAD_API is not a readable address');
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Refusing to run: the API address is not on this computer');
  }
  for (const s of SHOPS) {
    if (!s.password) {
      throw new Error('Set LOAD_PASSWORD_A and LOAD_PASSWORD_B first (the practice passwords)');
    }
  }
}

// pause: wait this many milliseconds.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// percentile: the value below which p percent of the numbers fall.
// Real life: "95 percent of customers waited less than this long".
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[i];
}

// login: log in as a shop owner and keep the login cookie (called "token").
async function login(shop) {
  const res = await fetch(`${API}/v1/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: shop.phone, password: shop.password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${shop.name} (status ${res.status})`);
  // The cookie comes back in the Set-Cookie header. We only need name=value.
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie().join(';')
    : (res.headers.get('set-cookie') || '');
  const match = /token=([^;]+)/.exec(raw);
  if (!match) throw new Error(`No login cookie came back for ${shop.name}`);
  shop.cookie = `token=${match[1]}`;
}

// pickProduct: the cheapest product of this shop (so orders stay tiny).
async function pickProduct(shop) {
  const res = await fetch(`${API}/v1/products`, { headers: { cookie: shop.cookie } });
  if (!res.ok) throw new Error(`Could not list products for ${shop.name} (status ${res.status})`);
  const body = await res.json();
  const list = body.data || [];
  if (list.length === 0) throw new Error(`${shop.name} has no products`);
  list.sort((a, b) => a.price_cents - b.price_cents);
  shop.productId = list[0].id;
  shop.productName = list[0].name;
}

// placeOrder: one customer order. Returns how it went and how long it took.
async function placeOrder(shop, n) {
  // A unique customer phone per order, starting with the shop's own marker.
  // The marker is what the SQL check uses to prove no order crossed over.
  const customerPhone = `${shop.customerPrefix}${String(n).padStart(6, '0')}`;
  const started = performance.now();
  let status = 0;
  try {
    const res = await fetch(`${API}/v1/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: shop.cookie },
      body: JSON.stringify({
        customerPhone,
        channel: 'web',
        items: [{ productId: shop.productId, quantity: 1 }],
      }),
    });
    status = res.status;
    await res.text(); // read the body so the connection is released
  } catch {
    status = 0; // the request itself failed (connection problem)
  }
  return { shop: shop.name, status, ms: performance.now() - started };
}

// ---------- the run ----------

async function main() {
  guard();

  console.log(`Mode: ${BURST ? `BURST (${BURST_CONCURRENCY} at a time)` : `PACED (${TOTAL_ORDERS} orders over ${WINDOW_MS / 1000} s)`}`);

  // 1. Log in as both owners and choose a product each.
  for (const s of SHOPS) {
    await login(s);
    await pickProduct(s);
    console.log(`Ready: ${s.name} will order "${s.productName}" x1`);
  }

  // 2. Build the list of orders: A, B, A, B, ...
  const jobs = [];
  for (let i = 0; i < TOTAL_ORDERS; i++) {
    jobs.push({ shop: SHOPS[i % SHOPS.length], n: i + 1 });
  }

  const results = [];
  const t0 = performance.now();

  if (BURST) {
    // Burst: keep BURST_CONCURRENCY requests in flight until all are done.
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        results.push(await placeOrder(job.shop, job.n));
      }
    };
    await Promise.all(Array.from({ length: BURST_CONCURRENCY }, worker));
  } else {
    // Paced: start one order every (60 s / 100) = 0.6 s, without waiting for
    // the previous answer. Then wait for all of them to finish.
    const gap = WINDOW_MS / TOTAL_ORDERS;
    const inFlight = [];
    for (const job of jobs) {
      inFlight.push(placeOrder(job.shop, job.n).then((r) => results.push(r)));
      await pause(gap);
    }
    await Promise.all(inFlight);
  }

  const wallMs = performance.now() - t0;

  // 3. Print the numbers (counts and timings only, never secrets).
  const ok = results.filter((r) => r.status === 201);
  const failed = results.filter((r) => r.status !== 201);
  const times = results.map((r) => r.ms).sort((a, b) => a - b);

  const byShop = {};
  for (const r of results) {
    byShop[r.shop] ??= { created: 0, failed: 0 };
    if (r.status === 201) byShop[r.shop].created++;
    else byShop[r.shop].failed++;
  }

  const codes = {};
  for (const r of results) codes[r.status] = (codes[r.status] || 0) + 1;

  console.log('');
  console.log('RESULTS');
  console.log(`  Orders sent:        ${results.length}`);
  console.log(`  Created (201):      ${ok.length}`);
  console.log(`  Failed:             ${failed.length}`);
  console.log(`  Status codes:       ${JSON.stringify(codes)}`);
  console.log(`  Per shop:           ${JSON.stringify(byShop)}`);
  console.log(`  Total time:         ${(wallMs / 1000).toFixed(1)} s`);
  console.log(`  Orders per second:  ${(results.length / (wallMs / 1000)).toFixed(2)}`);
  console.log(`  Answer time (ms):   fastest ${Math.round(times[0])}, median ${Math.round(percentile(times, 50))}, 95% under ${Math.round(percentile(times, 95))}, slowest ${Math.round(times[times.length - 1])}`);
  console.log('');
  console.log('Next: run the SQL check in apps/api/docs/scripts/load-test-orders.md to prove no order crossed between the shops.');

  if (failed.length > 0) process.exitCode = 1;
}

// Print only the message on failure (never a whole error object), set a
// failing exit code.
main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
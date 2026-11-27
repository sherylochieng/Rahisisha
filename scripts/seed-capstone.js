// =============================================================
// FILE: scripts/seed-capstone.js
//
// Rahisisha — Capstone Demo Seed Script
// scripts/seed-capstone.js
//
// Creates one complete demo tenant with realistic data so you
// can test end-to-end flows immediately after running migrations.
//
// Run: node scripts/seed-capstone.js
//
// Everything runs inside ONE transaction — all or nothing.
// If any step fails the database stays clean.
//
// WEEK 30 DAY 3 SAFETY CHANGE (additions only, the data is the same):
//   The demo password is no longer written in this file. This repo is
//   PUBLIC, so a password in the code is a password everyone knows.
//   Put your own in .env as DEMO_PASSWORD (12 or more characters) and the
//   script reads it. If it is missing the script stops BEFORE touching the
//   database. It also refuses to run against a remote database (such as
//   Neon staging) unless you say so with ALLOW_SEED_ON_REMOTE=yes.
//   See docs/scripts/seed-capstone.md for the full explanation.
//
// -------------------------------------------------------------
// WHY THIS FILE EXISTS
//   It builds one complete pretend shop (Amina's Boutique) with an owner,
//   a staff member, five dresses, customers, two orders and a sample chat,
//   so you can test the whole app on your own computer straight after
//   running the migrations. Real life: a trader sets up a "sample stall"
//   in Gikomba before opening day to check the scales, the till and the
//   price tags all work.
//
// WHY IMPORTANT
//   Every demo, test and screenshot starts from this data. If it is quick
//   and safe to run, you can wipe your local database and rebuild a working
//   shop in seconds.
//
// DANGER
//   Before Week 30 Day 3 the demo password was written in this file and
//   printed in the terminal. The repo is public, so anyone could read it
//   and log in to any shop seeded with it. Three demo accounts on staging
//   really were seeded that way and had to be locked (27 November 2026).
//   Real life: a till PIN written on the shop door.
//
// WHAT IT SOLVES
//   - The password comes from your own .env, never from the code.
//   - The script stops before touching the database if the password is
//     missing, too short, or the old public one.
//   - The script refuses a database that is not on your computer, unless
//     you say so on purpose.
//
// SYSTEM DESIGN PRINCIPLE
//   Secrets live in the environment, not in the code. The code is shared
//   (and this repo is public); .env stays on your machine.
//   Second principle: fail early and safely. All checks run before the
//   first database call, so a refusal leaves nothing half-written.
//
// RULES
//   1. DEMO_PASSWORD must be in .env and be 12 or more characters.
//   2. It must not start with "demo1234" in any capital letters (the old
//      public password).
//   3. DATABASE_URL must point at localhost, unless ALLOW_SEED_ON_REMOTE=yes.
//   4. Never print the password.
//   5. Everything runs in ONE transaction: all or nothing.
//
// PRACTICAL EXAMPLE
//   .env has:   DEMO_PASSWORD=pick-your-own-long-phrase
//   You run:    node scripts/seed-capstone.js
//   If the line is missing you see "Seed stopped: set DEMO_PASSWORD ..."
//   and nothing is written.
//
// DECISIONS
//   - Env variable, not a prompt: a prompt would break scripts that run
//     with nobody at the keyboard.
//   - Block the old password by name: it is in the Git history for good.
//   - Block remote databases by default: demo logins on a live database
//     were the exact mistake that caused this cleanup.
//
// WHERE USED
//   Run by hand from the repo root on your own computer. Mentioned in
//   capstone/README.md and the demo notes.
//
// TRADEOFFS
//   - You add one line to .env once. A small price for no public password.
//   - The password check is simple (length and the old word). These are
//     demo accounts on a local database, so a full strength test is overkill.
//   - The remote check looks for localhost or 127.0.0.1 in the connection
//     string. A database on another computer needs ALLOW_SEED_ON_REMOTE=yes.
//     That is the safe direction to be wrong in.
//
// HOW TO USE
//   1. Add DEMO_PASSWORD=<your own phrase, 12+ characters> to .env
//   2. Run: node scripts/seed-capstone.js
//   3. Log in locally with +254700000001 and your phrase.
//
// PIECE BY PIECE (what the whole script does, with a real-life picture)
//   Guards      check the password and where the database is
//               (the gate guard checks your pass before you enter)
//   1. Tenant   creates the shop "Amina's Boutique"
//               (registering a new stall in a market)
//   2. Brand    colours, delivery areas, return policy
//               (the signboard and the notice on the door)
//   3. Users    one owner and one staff member, same scrambled password
//               (two people get keys; the lock keeps a scrambled copy)
//   4. Members  says who works at which shop and in which role
//               (the staff list pinned on the wall)
//   5. Products five dresses, four sizes each = 20 variants
//               (the rack where each size hangs separately)
//   6. Customers three buyers
//               (the shop's customer phone book)
//   7. Orders   one paid order and one waiting for payment
//               (a receipt book with one paid and one unpaid slip)
//   8. Chat     four sample WhatsApp messages
//               (a chat screenshot for the demo)
//   9. Plan     Starter plan and a usage counter
//               (the shop's membership card)
// =============================================================

// Load the .env file so process.env.DATABASE_URL and DEMO_PASSWORD exist.
// Real life: opening the sealed envelope that stays on your computer.
require('dotenv').config();
// pg lets Node talk to PostgreSQL (the database).
const { Pool } = require('pg');
// bcrypt scrambles passwords one way, so the real password is never stored.
const bcrypt = require('bcrypt');
// randomUUID makes a unique ID, like a receipt number nobody else has.
const { randomUUID } = require('crypto');

// ── SAFETY GUARD 1: the demo password comes from .env, never from the code ──
// Real life: a shop owner never prints the till PIN on the shop door. Same idea.
// Read the password from the environment (your .env file).
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
// Missing or shorter than 12 characters? Say why and stop. Nothing is written
// because we have not opened the database yet.
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 12) {
  console.error('Seed stopped: set DEMO_PASSWORD in your .env (12 or more characters).');
  console.error('Nothing was written to the database.');
  // Exit code 1 means "something went wrong" to the computer.
  process.exit(1);
}
// The old public password must never be used again (it is in the repo history).
// toLowerCase() makes "DEMO1234" and "Demo1234" count as the same word.
if (DEMO_PASSWORD.toLowerCase().startsWith('demo1234')) {
  console.error('Seed stopped: that DEMO_PASSWORD is the old public one. Choose a new one.');
  console.error('Nothing was written to the database.');
  process.exit(1);
}

// ── SAFETY GUARD 2: do not plant demo logins on a remote database by accident ──
// Real life: a fire drill is fine in the training room, not in the real bank.
// The database address we are about to use (same fallback as before).
const TARGET_URL = process.env.DATABASE_URL || 'postgresql://rahisisha_user:password@localhost:5432/rahisisha';
// "localhost" and 127.0.0.1 always mean "this very computer".
const IS_LOCAL = /@(localhost|127\.0\.0\.1)(:|\/)/.test(TARGET_URL);
// Not on this computer and you did not say "yes" on purpose? Stop.
if (!IS_LOCAL && process.env.ALLOW_SEED_ON_REMOTE !== 'yes') {
  console.error('Seed stopped: DATABASE_URL is not on this computer.');
  console.error('Demo logins on a live database are a risk. If you really mean it, set ALLOW_SEED_ON_REMOTE=yes.');
  console.error('Nothing was written to the database.');
  process.exit(1);
}

// A "pool" is a small group of ready database connections.
// Real life: a few phone lines to the bank kept open so you do not redial.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://rahisisha_user:password@localhost:5432/rahisisha'
});

// The whole seed lives in one async function so we can wait for each step.
async function seed() {
  // Borrow one connection from the pool. Everything below uses this one,
  // because a transaction must stay on a single connection.
  const client = await pool.connect();

  try {
    // BEGIN opens the transaction: nothing is final until COMMIT.
    // Real life: writing in pencil; you only ink it at the end.
    await client.query('BEGIN');
    console.log('Starting seed...');

    // ─────────────────────────────────────────
    // 1. CREATE TENANT
    // A tenant is one shop on the platform.
    // Real life: registering "Amina's Boutique" as a stall in the market.
    // ─────────────────────────────────────────
    // A fresh unique ID for this shop; every other table will point at it.
    const tenantId = randomUUID();
    // Insert the shop. The $1..$5 are slots filled safely by the values
    // in the list (this stops SQL injection).
    await client.query(`
      INSERT INTO tenants (id, name, slug, plan, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [tenantId, "Amina's Boutique", 'aminas-boutique', 'starter', 'active']);
    console.log('Tenant created: Amina\'s Boutique (aminas-boutique)');

    // ─────────────────────────────────────────
    // 2. CREATE BRAND PROFILE
    // Real life: the signboard colours and the notice on the shop door
    // (delivery areas, return rules, opening hours).
    // ─────────────────────────────────────────
    await client.query(`
      INSERT INTO brand_profiles (tenant_id, logo_url, primary_colour, secondary_colour, tone, delivery_areas, return_policy, working_hours, whatsapp_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      tenantId,
      'https://example.com/logo.png',
      '#1e3a5f',
      '#3b82f6',
      'friendly',
      'Nairobi CBD, Westlands, Kilimani, Lavington',
      'Returns within 7 days, item must be unworn with tags attached',
      'Monday to Saturday, 8am to 6pm',
      '+254700000001'
    ]);
    console.log('Brand profile created');

    // ─────────────────────────────────────────
    // 3. CREATE USERS
    // Real life: giving the owner and one helper their own keys.
    // ─────────────────────────────────────────
    // Scramble the password ONE WAY with bcrypt. The database keeps only the
    // scrambled copy; nobody (not even you) can turn it back into the password.
    // The password comes from DEMO_PASSWORD in .env (checked at the top of the
    // file). The 12 is the cost: higher is slower and harder to guess.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    // Owner
    // A new ID for the owner, then the owner's row (phone, name, scrambled password).
    const ownerId = randomUUID();
    await client.query(`
      INSERT INTO users (id, phone, name, password_hash)
      VALUES ($1, $2, $3, $4)
    `, [ownerId, '+254700000001', 'Amina Wanjiru', passwordHash]);

    // Staff
    // Same idea for the helper, Grace.
    const staffId = randomUUID();
    await client.query(`
      INSERT INTO users (id, phone, name, password_hash)
      VALUES ($1, $2, $3, $4)
    `, [staffId, '+254700000002', 'Grace Achieng', passwordHash]);

    console.log('✅ Users created: 1 owner + 1 staff');

    // ─────────────────────────────────────────
    // 4. MEMBERSHIPS
    // A user is a person; a membership says "this person works at THIS shop
    // with THIS role". Real life: the staff list pinned on the wall.
    // ─────────────────────────────────────────
    // Two rows at once: the owner and the staff member, both for this shop.
    await client.query(`
      INSERT INTO memberships (tenant_id, user_id, role)
      VALUES ($1, $2, $3), ($4, $5, $6)
    `, [tenantId, ownerId, 'owner', tenantId, staffId, 'staff']);
    console.log('Memberships created');

    // ─────────────────────────────────────────
    // 5. CREATE 5 PRODUCTS WITH VARIANTS
    // A product is the dress; a variant is one size of it, and stock is
    // counted per variant. Real life: the rack where each size hangs apart.
    // ─────────────────────────────────────────
    // Prices are in cents: 350000 cents = KES 3,500.
    const products = [
      { name: 'Ankara Wrap Dress',    description: 'Vibrant ankara print wrap dress',     price: 350000 },
      { name: 'Linen Shift Dress',    description: 'Lightweight linen shift dress',        price: 280000 },
      { name: 'Beaded Evening Gown',  description: 'Hand-beaded evening gown',             price: 850000 },
      { name: 'Casual Sundress',      description: 'Breathable cotton sundress',           price: 180000 },
      { name: 'Kitenge Midi Dress',   description: 'Classic kitenge midi dress',           price: 320000 },
    ];

    // The four sizes every dress comes in.
    const sizes = ['S', 'M', 'L', 'XL'];
    // We remember each product ID so the orders below can refer to them.
    const productIds = [];

    // Go through the five dresses one by one.
    for (const product of products) {
      // A new ID for this dress; keep it in the list.
      const productId = randomUUID();
      productIds.push(productId);

      // Save the dress as 'active' so it shows in the shop.
      await client.query(`
        INSERT INTO products (id, tenant_id, name, description, price_cents, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [productId, tenantId, product.name, product.description, product.price, 'active']);

      // Add variants for each size
      // For every size, save one variant with a random stock of 2 to 9.
      // Real life: counting how many of each size are on the rack.
      for (const size of sizes) {
        const variantId = randomUUID();
        await client.query(`
          INSERT INTO product_variants (id, tenant_id, product_id, size, colour, stock)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [variantId, tenantId, productId, size, 'Multicolour', Math.floor(Math.random() * 8) + 2]);
      }
    }
    console.log(' 5 products created with variants (4 sizes each = 20 variants)');

    // ─────────────────────────────────────────
    // 6. CREATE 3 CUSTOMERS
    // Real life: three buyers saved in the shop's phone book.
    // ─────────────────────────────────────────
    const customerData = [
      { phone: '+254711000001', name: 'Fatuma Hassan' },
      { phone: '+254722000002', name: 'Joyce Muthoni' },
      { phone: '+254733000003', name: 'Sarah Otieno'  },
    ];

    // Save each customer and remember their IDs for the orders and chat below.
    const customerIds = [];
    for (const c of customerData) {
      const customerId = randomUUID();
      customerIds.push(customerId);
      await client.query(`
        INSERT INTO customers (id, tenant_id, phone, name, channel)
        VALUES ($1, $2, $3, $4, $5)
      `, [customerId, tenantId, c.phone, c.name, 'whatsapp']);
    }
    console.log('3 customers created');

    // ─────────────────────────────────────────
    // 7. CREATE 2 ORDERS WITH ORDER ITEMS
    // Real life: a receipt book with one paid slip and one unpaid slip.
    // ─────────────────────────────────────────

    // Order 1 — paid
    // Fatuma's order, already paid: KES 3,500.
    const order1Id = randomUUID();
    await client.query(`
      INSERT INTO orders (id, tenant_id, customer_id, status, channel, total_cents)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [order1Id, tenantId, customerIds[0], 'paid', 'whatsapp', 350000]);

    // The line on the receipt: what she bought. The name and price are copied
    // in, so changing the dress price later never rewrites an old receipt.
    await client.query(`
      INSERT INTO order_items (tenant_id, order_id, product_name, variant_label, unit_price_cents, quantity)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [tenantId, order1Id, 'Ankara Wrap Dress', 'Multicolour / Size M', 350000, 1]);

    // Wallet entry for order 1
    // Money in: add the sale to the shop's wallet ledger.
    await client.query(`
      INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantId, 350000, 'sale', order1Id]);

    // Inventory movement for order 1
    // Stock out: write one row saying one size M left the rack.
    // Real life: the stock book, where every change gets its own line.
    await client.query(`
      INSERT INTO inventory_movements (tenant_id, variant_id, type, quantity, reference_id, note)
      SELECT $1, id, 'sale', -1, $2, 'Sold via WhatsApp'
      FROM product_variants
      WHERE tenant_id = $1 AND product_id = $3 AND size = 'M'
      LIMIT 1
    `, [tenantId, order1Id, productIds[0]]);

    // Order 2 — created (pending payment)
    // Joyce's order: placed but not paid yet (KES 2,800).
    const order2Id = randomUUID();
    await client.query(`
      INSERT INTO orders (id, tenant_id, customer_id, status, channel, total_cents)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [order2Id, tenantId, customerIds[1], 'created', 'whatsapp', 280000]);

    // Her receipt line: a Linen Shift Dress in size L.
    await client.query(`
      INSERT INTO order_items (tenant_id, order_id, product_name, variant_label, unit_price_cents, quantity)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [tenantId, order2Id, 'Linen Shift Dress', 'Multicolour / Size L', 280000, 1]);

    console.log('2 orders created (1 paid, 1 pending)');

    // ─────────────────────────────────────────
    // 8. CREATE A SAMPLE CONVERSATION + MESSAGES
    // Real life: a WhatsApp chat between Sarah and the shop's AI helper,
    // saved so the inbox screen has something to show in the demo.
    // ─────────────────────────────────────────
    // The conversation itself: Sarah's open chat.
    const convId = randomUUID();
    await client.query(`
      INSERT INTO conversations (id, tenant_id, customer_id, channel, status, last_message_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [convId, tenantId, customerIds[2], 'whatsapp', 'open']);

    // The four messages in order: customer asks, AI answers, and so on.
    const messageData = [
      { direction: 'inbound',  sender: 'customer', body: 'Hi, do you have the Ankara dress in size L?' },
      { direction: 'outbound', sender: 'ai',       body: 'Hello! Yes, we have the Ankara Wrap Dress in Size L — 3 in stock at KES 3,500. Would you like to order it? 🛍️' },
      { direction: 'inbound',  sender: 'customer', body: 'Yes please! How do I pay?' },
      { direction: 'outbound', sender: 'ai',       body: 'Tap the link to checkout via M-Pesa STK push — you\'ll get a PIN prompt on your phone. https://aminas-boutique.rahisisha.co.ke/checkout/xxx' },
    ];

    // Save each message into the chat.
    for (const msg of messageData) {
      await client.query(`
        INSERT INTO messages (tenant_id, conversation_id, direction, body, sender)
        VALUES ($1, $2, $3, $4, $5)
      `, [tenantId, convId, msg.direction, msg.body, msg.sender]);
    }
    console.log('Sample conversation with 4 messages created');

    // ─────────────────────────────────────────
    // 9. SUBSCRIPTION + USAGE COUNTER
    // Real life: the shop's membership card (Starter plan) and a tally of
    // how many AI replies it used this month.
    // ─────────────────────────────────────────
    await client.query(`
      INSERT INTO subscriptions (tenant_id, plan, status)
      VALUES ($1, $2, $3)
    `, [tenantId, 'starter', 'active']);

    // The first day of this month, with 4 AI messages used (the 4 in the chat).
    await client.query(`
      INSERT INTO usage_counters (tenant_id, month, ai_messages)
      VALUES ($1, date_trunc('month', NOW())::DATE, $2)
    `, [tenantId, 4]);

    console.log('Subscription and usage counter created');

    // ─────────────────────────────────────────
    // COMMIT
    // Every step worked, so make it all permanent in one go.
    // Real life: going over the pencil with ink.
    // ─────────────────────────────────────────
    await client.query('COMMIT');

    // A short summary for you. The password is never printed.
    console.log('');
    console.log('   Seed complete! Demo data summary:');
    console.log('   Tenant:        Amina\'s Boutique (subdomain: aminas-boutique)');
    // The password itself is never printed. Use the DEMO_PASSWORD from your .env.
    console.log('   Owner login:   +254700000001 / (your DEMO_PASSWORD)');
    console.log('   Staff login:   +254700000002 / (your DEMO_PASSWORD)');
    console.log('   Products:      5 (with 20 variants)');
    console.log('   Customers:     3');
    console.log('   Orders:        2 (1 paid, 1 pending)');
    console.log('   Messages:      4 (sample WhatsApp conversation)');
    console.log('   Plan:          Starter (4 AI messages used this month)');
    console.log('');
    console.log('   Visit: http://localhost:3000/aminas-boutique');

  } catch (err) {
    // Something failed: undo EVERYTHING so no half-built shop is left behind.
    // Real life: rubbing out the pencil.
    await client.query('ROLLBACK');
    console.error('Seed failed — database rolled back cleanly');
    console.error(err.message);
    process.exit(1);
  } finally {
    // Always give the connection back and close the pool, success or failure.
    client.release();
    await pool.end();
  }
}

// Start the whole thing.
seed();
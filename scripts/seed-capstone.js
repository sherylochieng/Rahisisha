// =============================================================
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
// =============================================================

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://rahisisha_user:password@localhost:5432/rahisisha'
});

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting seed...');

    // ─────────────────────────────────────────
    // 1. CREATE TENANT
    // ─────────────────────────────────────────
    const tenantId = randomUUID();
    await client.query(`
      INSERT INTO tenants (id, name, slug, plan, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [tenantId, "Amina's Boutique", 'aminas-boutique', 'starter', 'active']);
    console.log('Tenant created: Amina\'s Boutique (aminas-boutique)');

    // ─────────────────────────────────────────
    // 2. CREATE BRAND PROFILE
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
    // ─────────────────────────────────────────
    const passwordHash = await bcrypt.hash('Demo1234!', 12);

    // Owner
    const ownerId = randomUUID();
    await client.query(`
      INSERT INTO users (id, phone, name, password_hash)
      VALUES ($1, $2, $3, $4)
    `, [ownerId, '+254700000001', 'Amina Wanjiru', passwordHash]);

    // Staff
    const staffId = randomUUID();
    await client.query(`
      INSERT INTO users (id, phone, name, password_hash)
      VALUES ($1, $2, $3, $4)
    `, [staffId, '+254700000002', 'Grace Achieng', passwordHash]);

    console.log('✅ Users created: 1 owner + 1 staff');

    // ─────────────────────────────────────────
    // 4. MEMBERSHIPS
    // ─────────────────────────────────────────
    await client.query(`
      INSERT INTO memberships (tenant_id, user_id, role)
      VALUES ($1, $2, $3), ($4, $5, $6)
    `, [tenantId, ownerId, 'owner', tenantId, staffId, 'staff']);
    console.log('Memberships created');

    // ─────────────────────────────────────────
    // 5. CREATE 5 PRODUCTS WITH VARIANTS
    // ─────────────────────────────────────────
    const products = [
      { name: 'Ankara Wrap Dress',    description: 'Vibrant ankara print wrap dress',     price: 350000 },
      { name: 'Linen Shift Dress',    description: 'Lightweight linen shift dress',        price: 280000 },
      { name: 'Beaded Evening Gown',  description: 'Hand-beaded evening gown',             price: 850000 },
      { name: 'Casual Sundress',      description: 'Breathable cotton sundress',           price: 180000 },
      { name: 'Kitenge Midi Dress',   description: 'Classic kitenge midi dress',           price: 320000 },
    ];

    const sizes = ['S', 'M', 'L', 'XL'];
    const productIds = [];

    for (const product of products) {
      const productId = randomUUID();
      productIds.push(productId);

      await client.query(`
        INSERT INTO products (id, tenant_id, name, description, price_cents, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [productId, tenantId, product.name, product.description, product.price, 'active']);

      // Add variants for each size
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
    // ─────────────────────────────────────────
    const customerData = [
      { phone: '+254711000001', name: 'Fatuma Hassan' },
      { phone: '+254722000002', name: 'Joyce Muthoni' },
      { phone: '+254733000003', name: 'Sarah Otieno'  },
    ];

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
    // ─────────────────────────────────────────

    // Order 1 — paid
    const order1Id = randomUUID();
    await client.query(`
      INSERT INTO orders (id, tenant_id, customer_id, status, channel, total_cents)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [order1Id, tenantId, customerIds[0], 'paid', 'whatsapp', 350000]);

    await client.query(`
      INSERT INTO order_items (tenant_id, order_id, product_name, variant_label, unit_price_cents, quantity)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [tenantId, order1Id, 'Ankara Wrap Dress', 'Multicolour / Size M', 350000, 1]);

    // Wallet entry for order 1
    await client.query(`
      INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference_id)
      VALUES ($1, $2, $3, $4)
    `, [tenantId, 350000, 'sale', order1Id]);

    // Inventory movement for order 1
    await client.query(`
      INSERT INTO inventory_movements (tenant_id, variant_id, type, quantity, reference_id, note)
      SELECT $1, id, 'sale', -1, $2, 'Sold via WhatsApp'
      FROM product_variants
      WHERE tenant_id = $1 AND product_id = $3 AND size = 'M'
      LIMIT 1
    `, [tenantId, order1Id, productIds[0]]);

    // Order 2 — created (pending payment)
    const order2Id = randomUUID();
    await client.query(`
      INSERT INTO orders (id, tenant_id, customer_id, status, channel, total_cents)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [order2Id, tenantId, customerIds[1], 'created', 'whatsapp', 280000]);

    await client.query(`
      INSERT INTO order_items (tenant_id, order_id, product_name, variant_label, unit_price_cents, quantity)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [tenantId, order2Id, 'Linen Shift Dress', 'Multicolour / Size L', 280000, 1]);

    console.log('2 orders created (1 paid, 1 pending)');

    // ─────────────────────────────────────────
    // 8. CREATE A SAMPLE CONVERSATION + MESSAGES
    // ─────────────────────────────────────────
    const convId = randomUUID();
    await client.query(`
      INSERT INTO conversations (id, tenant_id, customer_id, channel, status, last_message_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [convId, tenantId, customerIds[2], 'whatsapp', 'open']);

    const messageData = [
      { direction: 'inbound',  sender: 'customer', body: 'Hi, do you have the Ankara dress in size L?' },
      { direction: 'outbound', sender: 'ai',       body: 'Hello! Yes, we have the Ankara Wrap Dress in Size L — 3 in stock at KES 3,500. Would you like to order it? 🛍️' },
      { direction: 'inbound',  sender: 'customer', body: 'Yes please! How do I pay?' },
      { direction: 'outbound', sender: 'ai',       body: 'Tap the link to checkout via M-Pesa STK push — you\'ll get a PIN prompt on your phone. https://aminas-boutique.rahisisha.co.ke/checkout/xxx' },
    ];

    for (const msg of messageData) {
      await client.query(`
        INSERT INTO messages (tenant_id, conversation_id, direction, body, sender)
        VALUES ($1, $2, $3, $4, $5)
      `, [tenantId, convId, msg.direction, msg.body, msg.sender]);
    }
    console.log('Sample conversation with 4 messages created');

    // ─────────────────────────────────────────
    // 9. SUBSCRIPTION + USAGE COUNTER
    // ─────────────────────────────────────────
    await client.query(`
      INSERT INTO subscriptions (tenant_id, plan, status)
      VALUES ($1, $2, $3)
    `, [tenantId, 'starter', 'active']);

    await client.query(`
      INSERT INTO usage_counters (tenant_id, month, ai_messages)
      VALUES ($1, date_trunc('month', NOW())::DATE, $2)
    `, [tenantId, 4]);

    console.log('Subscription and usage counter created');

    // ─────────────────────────────────────────
    // COMMIT
    // ─────────────────────────────────────────
    await client.query('COMMIT');

    console.log('');
    console.log('   Seed complete! Demo data summary:');
    console.log('   Tenant:        Amina\'s Boutique (subdomain: aminas-boutique)');
    console.log('   Owner login:   +254700000001 / Demo1234!');
    console.log('   Staff login:   +254700000002 / Demo1234!');
    console.log('   Products:      5 (with 20 variants)');
    console.log('   Customers:     3');
    console.log('   Orders:        2 (1 paid, 1 pending)');
    console.log('   Messages:      4 (sample WhatsApp conversation)');
    console.log('   Plan:          Starter (4 AI messages used this month)');
    console.log('');
    console.log('   Visit: http://localhost:3000/aminas-boutique');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed — database rolled back cleanly');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
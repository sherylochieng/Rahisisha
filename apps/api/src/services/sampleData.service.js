// ═══════════════════════════════════════════════════════════
// FILE: apps/api/src/services/sampleData.service.js
// ═══════════════════════════════════════════════════════════
//
// WHY THIS FILE EXISTS
//   A brand-new shop is empty: no products, no customers. This
//   file adds 3 sample products and 2 sample customers so the
//   owner sees a working shop on day one.
//
// WHY IMPORTANT
//   The first minute decides if a new owner stays. An empty
//   dashboard looks dead. A shop with sample items shows what
//   the product does and how to use it.
//
// DANGER (what breaks without it)
//   - New owners land on empty screens and leave.
//   - If seeding is written INSIDE signup.js, that file grows
//     and mixes two jobs (creating an account and filling a
//     demo shop).
//   - If it is run OUTSIDE the signup transaction, a failure can
//     leave a shop with an owner but half the sample data.
//
// WHAT IT SOLVES
//   One function, seedSampleData(client, tenantId), that fills a
//   new shop. Signup calls it. Other code can reuse it later
//   (for example a demo shop).
//
// SYSTEM DESIGN PRINCIPLE
//   "Single responsibility" and "atomic setup". This file does
//   ONE job. Because it takes the open transaction connection
//   (client) from signup, the shop, the owner AND the sample
//   data are created together or not at all.
//
// RULES (never do this)
//   1. NEVER call it outside a transaction that has already set
//      app.current_tenant. Row-level security would reject the
//      inserts.
//   2. NEVER omit tenant_id from the INSERTs. The columns are
//      NOT NULL with no default.
//   3. NEVER use pool.query here. Always use the client passed in,
//      so everything belongs to the same transaction.
//   4. NEVER put real people's phone numbers in sample data.
//      The sample phones are obviously fake.
//   5. NEVER build SQL by gluing strings. Use $1, $2 placeholders.
//
// PRACTICAL EXAMPLE
//   Amina signs up "Amina's Boutique". Her dashboard immediately
//   shows 3 products (Sample: Maize Flour 2kg, ...) and she can
//   create an order for "Sample Customer 1". When she is ready
//   she deletes the samples and adds her own.
//
// DECISIONS
//   - Sample products are named "Sample: ..." and their
//     description says to edit or delete them, so nobody mistakes
//     them for real stock.
//   - Status is 'active' so they appear as sellable.
//   - Prices are in cents (18000 = KES 180.00).
//   - Customers use fake numbers 0700000001 and 0700000002,
//     with channels 'whatsapp' and 'web' (allowed values:
//     whatsapp, web, ussd).
//   - Runs inside the signup transaction. Tradeoff: if seeding
//     ever fails, signup fails too. A test covers this.
//
// WHERE YOU WILL USE THIS
//   - routes/auth/signup.js (next step)
//   - Later: a demo-data script, or a "reset my shop" tool
//
// TRADEOFFS
//   + Atomic: no half-built shops.
//   + Easy to change: edit the two lists below.
//   - A bug here would block signup (until fixed). The signup
//     and happy-path tests catch that.
//   - Samples are English only.
//
// HOW TO USE
//   import { seedSampleData } from '../../services/sampleData.service.js';
//   await seedSampleData(client, tenant_id);   // inside the transaction
//
// ═══════════════════════════════════════════════════════════
// EXPLAINED PIECE BY PIECE (real life + where / when / how)
// ═══════════════════════════════════════════════════════════
//
// 1. SAMPLE_PRODUCTS / SAMPLE_CUSTOMERS  =  THE WELCOME BASKET LIST
//    Plain lists of what goes in the basket. To change the basket,
//    change the list, not the code.
//
// 2. client  =  THE OPEN DOOR TO THE DATABASE FOR THIS SIGNUP
//    It is the connection signup is already using, mid-transaction.
//    Using it keeps everything in one all-or-nothing unit.
//
// 3. tenantId in every INSERT  =  WRITING THE SHOP'S NAME ON EVERY ITEM
//    Each row must say which shop it belongs to. Row-level security
//    also checks it matches the shop we stamped on this connection.
//
// 4. $1, $2 placeholders  =  FILLING IN A FORM, NOT DICTATING SQL
//    Values travel separately from the SQL, so they cannot change
//    what the SQL does (this blocks SQL injection).
//
// 5. for...of with await  =  ADD ONE ITEM AT A TIME
//    Simple and in order. Only 5 rows, so speed does not matter.
//
// 6. ON CONFLICT (tenant_id, phone) DO NOTHING
//    =  "IF THIS CUSTOMER IS ALREADY ON THE LIST, SKIP"
//    Makes the customer step safe to run twice.
//
// 7. return { products, customers }  =  A RECEIPT
//    The counts let a test (or a log) confirm what was added.
// ═══════════════════════════════════════════════════════════

// What goes into every new shop. Prices are in CENTS: 18000 = KES 180.00
const SAMPLE_PRODUCTS = [
  { sku: 'SAMPLE-1', name: 'Sample: Maize Flour 2kg', priceCents: 18000 },
  { sku: 'SAMPLE-2', name: 'Sample: Cooking Oil 1L',  priceCents: 32000 },
  { sku: 'SAMPLE-3', name: 'Sample: Sugar 1kg',       priceCents: 16000 },
];

// Obviously fake phones, so they never belong to a real person.
// channel must be one of: whatsapp, web, ussd
const SAMPLE_CUSTOMERS = [
  { phone: '0700000001', name: 'Sample Customer 1', channel: 'whatsapp' },
  { phone: '0700000002', name: 'Sample Customer 2', channel: 'web' },
];

// seedSampleData: fills a brand-new shop.
//   client   - the open transaction connection from signup
//              (app.current_tenant must already be set on it)
//   tenantId - the new shop's id
// Returns how many rows were added: { products, customers }
export async function seedSampleData(client, tenantId) {
  // 1) Sample products
  for (const p of SAMPLE_PRODUCTS) {
    await client.query(
      `INSERT INTO products (tenant_id, sku, name, description, price_cents, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [
        tenantId,
        p.sku,
        p.name,
        'Sample product. Edit or delete it when you add your own.',
        p.priceCents,
      ]
    );
  }

  // 2) Sample customers
  for (const c of SAMPLE_CUSTOMERS) {
    await client.query(
      `INSERT INTO customers (tenant_id, phone, name, channel)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, phone) DO NOTHING`,
      [tenantId, c.phone, c.name, c.channel]
    );
  }

  // 3) The receipt
  return {
    products:  SAMPLE_PRODUCTS.length,
    customers: SAMPLE_CUSTOMERS.length,
  };
}
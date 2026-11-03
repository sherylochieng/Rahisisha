// =============================================================
// wallet.service.js
//
// WHY THIS FILE EXISTS
//   Every wallet money movement goes through these three helpers,
//   so the money rules live in ONE place instead of being copied
//   into many controllers.
//
// WHY IMPORTANT
//   Money bugs hurt real people. One small, careful file is far
//   easier to check and audit than the same code repeated.
//
// DANGER (if this file does not exist)
//   - Each controller writes its own wallet SQL; one forgets the
//     whole-number check and a decimal corrupts the balance.
//   - One forgets the tenant, and money lands in no shop's wallet.
//   - Someone adds an UPDATE "to fix a balance" and the history
//     can no longer be trusted.
//   - Nobody can audit "every line that touches wallet_entries".
//
// WHAT IT SOLVES
//   credit()  adds money    (a positive line)
//   debit()   removes money (a negative line)
//   balance() adds all lines up
//
// SYSTEM DESIGN PRINCIPLE
//   Append-only ledger. We only ever ADD lines, never edit or
//   delete them. Balance = SUM of every line, never stored, so it
//   can never drift out of sync.
//
// WHERE YOU WILL USE THIS IN FUTURE PROJECTS
//   Any wallet, loyalty points, store credit, prepaid minutes,
//   subscription credits, a chama (savings group) balance.
//
// TRADEOFFS
//   + History is complete and nothing is ever lost.
//   - SUM gets slower as lines grow (fix later with snapshots).
//   - debit() does not yet stop a balance going below zero
//     (stretch goal: needs a lock, or two debits can race).
//
// HOW TO USE (these are called by controllers or webhooks,
// always with req.db so the tenant is already set)
//
//   // M-Pesa payment arrives (Week 29 webhook):
//   await credit(req.db, 350000, 'sale', 'QGH7XYZ123');
//
//   // Owner refunds a customer:
//   await debit(req.db, 350000, 'refund', 'QGH7XYZ123');
//
//   // Platform takes its cut:
//   await debit(req.db, 17500, 'commission', orderId);
//
//   // Dashboard shows "Wallet: KES 3,325":
//   const cents = await balance(req.db);      // 332500
//   res.json({ data: { balanceCents: cents }, error: null });
//
// RULES: amounts are WHOLE CENTS (KES 350 = 35000). Never floats.
// reason must be one of: sale, refund, commission, payout.
// =============================================================

// credit: adds money to this tenant's wallet.
// db          = tenant-scoped connection (req.db)
// amountCents = whole number of cents, must be above zero
// reason      = sale | refund | commission | payout
// reference   = optional receipt code or id (text)
export async function credit(db, amountCents, reason, reference) {
  // Refuse decimals, text, zero and negatives
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('invalid');
  }

  // Add ONE new line. The tenant comes from the connection's
  // current tenant, so it can never be another shop's id.
  await db.query(
    `INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference)
     VALUES (current_setting('app.current_tenant', TRUE)::uuid, $1, $2, $3)`,
    [amountCents, reason, reference]
  );
}

// debit: removes money from this tenant's wallet.
// Same inputs as credit. The caller passes a POSITIVE amount;
// we store it as a NEGATIVE line.
export async function debit(db, amountCents, reason, reference) {
  // Same safety check as credit
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('invalid');
  }

  // Add ONE new line, with the amount made negative
  await db.query(
    `INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference)
     VALUES (current_setting('app.current_tenant', TRUE)::uuid, $1, $2, $3)`,
    [-amountCents, reason, reference]
  );
}

// balance: adds up every line for this tenant (RLS hides other
// shops' lines). COALESCE turns "no lines yet" into 0.
// Postgres returns a SUM of bigint as TEXT, so we convert it back
// to a number (safe for any realistic wallet size).
export async function balance(db) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0) AS balance FROM wallet_entries`
  );
  return Number(rows[0].balance);
}
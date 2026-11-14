// FILE: apps/api/scripts/seed-whatsapp-demo.js
//
// WHY THIS FILE EXISTS
//   The WhatsApp webhook only works for a shop that has a row in
//   whatsapp_configs. This script gives the two demo shops (Amina's Boutique
//   and Brio Hardware) a FAKE WhatsApp number and a FAKE token, so you can
//   try the webhook by hand on your own computer.
//
// WHY IMPORTANT
//   Without it you would have to insert encrypted tokens by hand, which is
//   easy to get wrong. This script encrypts the same way the app does.
//
// DANGER
//   - The verify tokens in here are GUESSABLE demo words. If this ran on a
//     real server, a stranger could connect to a shop's webhook. So the
//     script REFUSES to run when NODE_ENV is production, or when the
//     database is not on this computer.
//   - Never put a REAL Meta token in this file or in chat. Fake only.
//
// WHAT IT SOLVES
//   Trying Day 2 by hand: POST a pretend Meta message and see it land.
//
// SYSTEM DESIGN PRINCIPLE
//   Seeds are for development only, repeatable (safe to run twice) and
//   guarded so they can never touch real data.
//
// RULES
//   1. Local database only, never production.
//   2. Fake tokens only. The script prints ids, never tokens.
//   3. Safe to run again: it updates the same rows instead of failing.
//   4. Needs KMS_KEY in apps/api/.env (the same key the app uses).
//
// PRACTICAL EXAMPLE
//   cd apps/api
//   node scripts/seed-whatsapp-demo.js
//   -> Amina gets phone_number_id  demo-pid-amina
//   -> Brio  gets phone_number_id  demo-pid-brio
//
// DECISIONS (and WHY)
//   - JavaScript, not SQL (unlike the USSD seeds): the token has to be
//     scrambled by encryptSecret() in kms.js, which needs the secret
//     KMS_KEY and our exact stored format. Postgres cannot do that, and the
//     key must never be written into a committed SQL file.
//   - Uses the shop's slug to find it (aminas-boutique, brio-hardware),
//     the same slugs the USSD seeds use.
//   - ON CONFLICT (tenant_id) DO UPDATE: running twice just refreshes.
//
// WHERE USED / FUTURE USES
//   Local manual testing. Later: a real "connect WhatsApp" screen replaces it.
//
// TRADEOFFS
//   + Quick to try the webhook.
//   - Demo data only. Real shops need a real setup flow (not built yet).
//
// HOW TO USE
//   cd apps/api
//   node scripts/seed-whatsapp-demo.js
//
// GUIDE DOC: apps/api/docs/scripts/seed-whatsapp-demo.md
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request (it handles tokens). Declared in
//   AI_AUDIT_week_29_day2.md.

// pool: the app's own database connection. Importing it ALSO loads your
// .env file (pool.js calls dotenv), which is where DATABASE_URL and
// KMS_KEY come from. Real life: the front-desk phone line, already plugged in.
import { pool } from '../src/db/pool.js';

// encryptSecret: the same scrambler the real app uses (needs KMS_KEY).
// Using the SAME function means a demo row is built exactly like a real one.
import { encryptSecret } from '../src/utils/kms.js';

// The two demo shops and their FAKE WhatsApp details.
//   slug        : how we find the shop (same slugs as the USSD seeds)
//   phoneNumberId: the pretend "number" Meta would put in its payload
//   token       : a FAKE token, scrambled before saving
//   verifyToken : the pretend secret word for Meta's GET handshake
// "demo-" in every value makes it obvious this is practice data.
const DEMO = [
  {
    slug: 'aminas-boutique',
    phoneNumberId: 'demo-pid-amina',
    token: 'FAKE-DEMO-TOKEN-AMINA',
    verifyToken: 'demo-verify-amina',
  },
  {
    slug: 'brio-hardware',
    phoneNumberId: 'demo-pid-brio',
    token: 'FAKE-DEMO-TOKEN-BRIO',
    verifyToken: 'demo-verify-brio',
  },
];

// guard: stop unless this is clearly a local, non-production setup.
// Real life: a "training mode" key that only opens the practice room.
function guard() {
  // 1. Never in production mode.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV is production');
  }
  // 2. The database must be on THIS computer. We read the host name out of
  //    DATABASE_URL (the part after the @). A bad or missing URL also stops us.
  let host = '';
  try {
    host = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    throw new Error('Refusing to run: DATABASE_URL is missing or not readable');
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Refusing to run: the database is not on this computer');
  }
}

async function main() {
  // Check the guard BEFORE touching anything.
  guard();

  // Do the same job for each demo shop, one at a time.
  for (const shop of DEMO) {
    // Find the shop by its slug. ($1 is a safe slot. The tenants table has
    // no RLS, so a plain query works.)
    const { rows } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [shop.slug]);
    // Not in this database (e.g. a fresh database)? Say so and move on,
    // instead of crashing.
    if (!rows[0]) {
      console.log(`SKIPPED ${shop.slug}: shop not found in this database`);
      continue;
    }
    const tenantId = rows[0].id;

    // Scramble the fake token, locked to THIS shop's id (same as the real
    // app). If KMS_KEY is missing, this line throws a clear error.
    const encrypted = encryptSecret(shop.token, tenantId);

    // Insert the row. If the shop already has one (we ran this before),
    // ON CONFLICT turns the insert into an update, so running twice is safe.
    // EXCLUDED.x means "the value we just tried to insert".
    await pool.query(
      `INSERT INTO whatsapp_configs
         (tenant_id, phone_number_id, access_token_encrypted, webhook_verify_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO UPDATE SET
         phone_number_id        = EXCLUDED.phone_number_id,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         webhook_verify_token   = EXCLUDED.webhook_verify_token,
         updated_at             = NOW()`,
      [tenantId, shop.phoneNumberId, encrypted, shop.verifyToken]
    );

    // Print only the ids. The token is NEVER printed.
    console.log(`OK ${shop.slug}: phone_number_id=${shop.phoneNumberId}`);
  }
}

// Run main(). If anything throws, print ONLY the message (never the whole
// error object, in case it carries something sensitive) and set a failing
// exit code. `finally` always closes the database connection, or the script
// would hang after finishing.
main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
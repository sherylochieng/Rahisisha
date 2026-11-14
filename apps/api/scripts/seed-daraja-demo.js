// FILE: apps/api/scripts/seed-daraja-demo.js
//
// WHY THIS FILE EXISTS
//   The pay route (POST /v1/orders/:id/pay) only works for a shop that has a
//   row in daraja_configs. This script gives the demo shop (Amina's Boutique)
//   a Daraja SANDBOX config, so you can fire a test STK push from your own
//   computer.
//
// WHY IMPORTANT
//   The keys must be stored ENCRYPTED, in the exact format the app reads.
//   Doing it by hand in psql is easy to get wrong and would leave plain keys
//   in your shell history. This script encrypts them the same way the app does.
//
// DANGER
//   - It reads your REAL sandbox keys from apps/api/.env. NEVER paste them in
//     chat, in this file, or in a commit. The repo is public.
//   - It only ever writes env = 'sandbox'. It REFUSES to run when NODE_ENV is
//     production or when the database is not on this computer, so it can never
//     put test keys on a live shop.
//   - It prints ids only. Keys, secrets and passkeys are never printed.
//
// WHAT IT SOLVES
//   Trying Day 3 by hand: one command, then a sandbox STK push.
//
// SYSTEM DESIGN PRINCIPLE
//   Per-tenant credentials, encrypted at rest, decrypted only at the last
//   moment. Seeds are development-only, repeatable and guarded.
//
// RULES
//   1. Local database only, never production.
//   2. Sandbox only. Real money never moves from this script.
//   3. Keys come from apps/api/.env (git-ignored), never from the code.
//   4. Safe to run again: it updates the same row.
//   5. Needs KMS_KEY in apps/api/.env (the same key the app uses).
//
// PRACTICAL EXAMPLE
//   In apps/api/.env:
//     DARAJA_SANDBOX_CONSUMER_KEY=...   (from developer.safaricom.co.ke)
//     DARAJA_SANDBOX_CONSUMER_SECRET=...
//     DARAJA_SANDBOX_PASSKEY=...        (the sandbox passkey on the portal)
//     DARAJA_SANDBOX_SHORTCODE=174379   (optional, 174379 is the sandbox till)
//     DARAJA_CALLBACK_BASE=https://abc123.ngrok-free.app
//   then:
//     cd apps/api
//     node scripts/seed-daraja-demo.js
//     -> OK aminas-boutique: env=sandbox shortcode=174379
//
// DECISIONS (and WHY)
//   - It must set the shop lock before writing, because daraja_configs has RLS
//     (unlike whatsapp_configs). So it uses ONE dedicated connection, sets
//     app.current_tenant, writes, then RESETs it and gives the connection
//     back. This is the same "stamp, then lock, then work" idea as withTenant.
//   - callback_url is built here as <DARAJA_CALLBACK_BASE>/callbacks/mpesa/<shop id>.
//     Safaricom must be able to reach it, so it has to be a public https
//     address (a tunnel such as ngrok, or the staging server). If the address
//     changes, change DARAJA_CALLBACK_BASE and run this again.
//   - Only Amina is seeded. One shop is enough to try a payment; Brio having
//     NO config is also useful: paying a Brio order must fail cleanly.
//
// WHERE USED / FUTURE USES
//   Local manual testing. Later: a real "connect M-Pesa" screen replaces it.
//
// TRADEOFFS
//   + One command to be ready for a sandbox payment.
//   - Demo setup only. Real shops need a proper setup flow (not built yet).
//
// HOW TO USE
//   cd apps/api
//   node scripts/seed-daraja-demo.js
//
// GUIDE DOC: apps/api/docs/scripts/seed-daraja-demo.md (written with the Day 3 docs)
//
// AI AUDIT NOTE
//   Written by AI at Sheryl's request (it handles payment credentials).
//   Declared in the Day 3 audit.

// pool: the app's own database connection. Importing it ALSO loads your
// .env file (pool.js calls dotenv), which is where DATABASE_URL, KMS_KEY and
// the DARAJA_* values come from. Real life: the front-desk phone line,
// already plugged in.
import { pool } from '../src/db/pool.js';

// encryptSecret: the same scrambler the real app uses (needs KMS_KEY).
// Using the SAME function means a demo row is built exactly like a real one.
import { encryptSecret } from '../src/utils/kms.js';

// The shop we set up. Same slug the other seeds use.
const SHOP_SLUG = 'aminas-boutique';

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

// readSettings: collects the Daraja sandbox values from .env.
// Stops with a clear message (naming the SETTING, never its value) if one is
// missing, so you know exactly what to add.
function readSettings() {
  const env = process.env;
  const settings = {
    consumerKey: env.DARAJA_SANDBOX_CONSUMER_KEY,
    consumerSecret: env.DARAJA_SANDBOX_CONSUMER_SECRET,
    passkey: env.DARAJA_SANDBOX_PASSKEY,
    // 174379 is Safaricom's public sandbox till, so it is a safe default.
    shortcode: env.DARAJA_SANDBOX_SHORTCODE || '174379',
    callbackBase: env.DARAJA_CALLBACK_BASE,
  };
  const names = {
    consumerKey: 'DARAJA_SANDBOX_CONSUMER_KEY',
    consumerSecret: 'DARAJA_SANDBOX_CONSUMER_SECRET',
    passkey: 'DARAJA_SANDBOX_PASSKEY',
    callbackBase: 'DARAJA_CALLBACK_BASE',
  };
  for (const [field, name] of Object.entries(names)) {
    if (!settings[field]) {
      throw new Error(`Missing ${name} in apps/api/.env`);
    }
  }
  // Safaricom only calls back to https addresses.
  if (!settings.callbackBase.startsWith('https://')) {
    throw new Error('DARAJA_CALLBACK_BASE must start with https://');
  }
  return settings;
}

async function main() {
  // Check the guard and the settings BEFORE touching anything.
  guard();
  const s = readSettings();

  // Find the shop by its slug. ($1 is a safe slot. The tenants table has
  // no RLS, so a plain query works.)
  const { rows } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [SHOP_SLUG]);
  if (!rows[0]) {
    console.log(`SKIPPED ${SHOP_SLUG}: shop not found in this database`);
    return;
  }
  const tenantId = rows[0].id;

  // Scramble each secret, locked to THIS shop's id (same as the real app).
  // If KMS_KEY is missing, these lines throw a clear error.
  const keyEnc = encryptSecret(s.consumerKey, tenantId);
  const secretEnc = encryptSecret(s.consumerSecret, tenantId);
  const passkeyEnc = encryptSecret(s.passkey, tenantId);

  // The address Safaricom will call when the customer finishes paying.
  // Trailing slashes on the base are removed so we never get "//".
  const callbackUrl = `${s.callbackBase.replace(/\/+$/, '')}/callbacks/mpesa/${tenantId}`;

  // daraja_configs has RLS, so we need ONE connection that we lock to the
  // shop. A plain pool.query could land on a different connection each time.
  const client = await pool.connect();
  try {
    // Stamp the shop on this connection (false = lasts for the connection,
    // the same choice withTenant makes).
    await client.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);

    // Insert the row. If the shop already has one (we ran this before),
    // ON CONFLICT turns the insert into an update, so running twice is safe.
    // EXCLUDED.x means "the value we just tried to insert".
    await client.query(
      `INSERT INTO daraja_configs
         (tenant_id, env, consumer_key_encrypted, consumer_secret_encrypted,
          shortcode, passkey_encrypted, callback_url)
       VALUES ($1, 'sandbox', $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id) DO UPDATE SET
         env                       = 'sandbox',
         consumer_key_encrypted    = EXCLUDED.consumer_key_encrypted,
         consumer_secret_encrypted = EXCLUDED.consumer_secret_encrypted,
         shortcode                 = EXCLUDED.shortcode,
         passkey_encrypted         = EXCLUDED.passkey_encrypted,
         callback_url              = EXCLUDED.callback_url,
         updated_at                = NOW()`,
      [tenantId, keyEnc, secretEnc, s.shortcode, passkeyEnc, callbackUrl]
    );
  } finally {
    // Always clear the lock and give the connection back, even after an
    // error, so the next user of this connection starts clean.
    await client.query('RESET app.current_tenant').catch(() => {});
    client.release();
  }

  // Print only the safe facts. Keys, secrets and passkeys are NEVER printed.
  console.log(`OK ${SHOP_SLUG}: env=sandbox shortcode=${s.shortcode}`);
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
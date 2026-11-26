// =============================================================================
// FILE: apps/api/scripts/create-platform-admin.js   (Week 30, platform admin: step 3)
// =============================================================================
//
// WHY THIS FILE EXISTS
//   Makes the FIRST platform admin account (you, the owner of Rahisisha), or sets
//   a new password for an admin who forgot theirs. There is deliberately NO web
//   page for this: nobody on the internet can ask to become an admin. You run
//   this command on your own computer.
//
// WHY IMPORTANT
//   The admin can see and suspend every shop. How the account is created must be
//   safe: a long password, typed hidden, never put in a command, never printed.
//
// DANGER
//   1. The password is typed into a HIDDEN prompt. It is never accepted as a
//      command argument or from a pipe, because those end up in your shell
//      history. If this is not a real terminal, the script refuses.
//   2. It prints ids and the phone only. NEVER the password or the hash.
//   3. It works on whatever database apps/api/.env points to. For a database
//      that is NOT on this computer (for example Neon) it shows the server name
//      and makes you TYPE that name to confirm, so you cannot create a live
//      admin by accident.
//   4. Never paste the password in chat or save it in a file in the repo.
//
// WHAT IT SOLVES
//   One safe command to create the first admin, and one to recover a lost password.
//
// SYSTEM DESIGN PRINCIPLE
//   Separation of concerns: this script only ASKS the questions. The rules
//   (phone shape, password length, hashing, the database lock) live in
//   src/services/platformAdmin.service.js.
//
// RULES
//   1. Create:  node scripts/create-platform-admin.js
//   2. Reset:   node scripts/create-platform-admin.js --reset
//   3. Password: typed twice, hidden, 12 to 72 characters.
//   4. Exit code 0 = it worked, 1 = it did not (and says why).
//
// PRACTICAL EXAMPLE
//   cd apps/api
//   node scripts/create-platform-admin.js
//     Database server: localhost
//     Your name: Sheryl
//     Phone (M-Pesa number): 0712345678
//     Password (hidden, at least 12 characters):
//     Type the password again:
//     OK admin created: id=3f1c... phone=254712345678
//
// DECISIONS
//   - Phone and name are visible; only the password is hidden.
//   - A non-local database needs the server name typed to confirm.
//   - It never overwrites an existing admin on "create"; use --reset for that.
//
// WHERE USED
//   Run by you, by hand, once on your computer, and once on the live database
//   when the platform goes live.
//
// TRADEOFFS
//   + No public door, nothing to attack from the internet.
//   - Needs access to the database from your computer (for Neon, the connection
//     string in your own .env).
//
// HOW TO USE
//   See PRACTICAL EXAMPLE. Needs DATABASE_URL in apps/api/.env.
// =============================================================================

// PIECE BY PIECE
//   askVisible(question)  = the clerk asks and you answer out loud (name, phone).
//   askHidden(question)   = the clerk turns her back while you whisper the
//                           password: nothing is shown, not even stars.
//   database server check = before writing anything, the clerk reads out which
//                           office she is working in. For a faraway office she
//                           makes you say its name back, so she cannot write in
//                           the wrong book by mistake.
//   main()                = the whole conversation, in order.

import readline from 'node:readline';
import { pool } from '../src/db/pool.js';
import {
  createPlatformAdmin,
  resetPlatformAdminPassword,
} from '../src/services/platformAdmin.service.js';

// Ask a normal question and return the typed answer (shown on screen).
function askVisible(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Ask for a password: nothing is shown while typing. Raw mode lets us read each
// key ourselves. Enter finishes, Backspace deletes, Ctrl+C cancels.
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';

    function finish() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
    }

    function onData(chunk) {
      // A pasted password arrives as many characters at once, so loop over them.
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { finish(); return resolve(value); }
        if (ch === '\u0003') { finish(); return reject(new Error('Cancelled')); } // Ctrl+C
        if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); continue; } // Backspace
        value += ch;
      }
    }

    stdin.on('data', onData);
  });
}

async function main() {
  const reset = process.argv.includes('--reset');

  // Refuse if this is not a real keyboard-and-screen terminal. Otherwise the
  // password could be piped in from a file or a command (and end up in history).
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Run this in a normal terminal window (it needs to hide your password).');
  }

  // Which database are we about to write to? Show only the server name.
  let host;
  try {
    host = new URL(process.env.DATABASE_URL).hostname;
  } catch {
    throw new Error('DATABASE_URL is missing or not readable in apps/api/.env');
  }
  console.log(`Database server: ${host}`);

  // A database that is not on this computer needs the name typed back.
  if (host !== 'localhost' && host !== '127.0.0.1') {
    console.log('This is NOT your local database. You are about to change a LIVE database.');
    const typed = await askVisible('Type the database server name above to continue: ');
    if (typed !== host) throw new Error('Server name did not match. Nothing was changed.');
  }

  console.log(reset ? 'Setting a NEW password for an existing admin.' : 'Creating a platform admin.');

  const name = reset ? null : await askVisible('Your name: ');
  const phone = await askVisible('Phone (M-Pesa number): ');
  const password = await askHidden('Password (hidden, at least 12 characters): ');
  const again = await askHidden('Type the password again: ');
  if (password !== again) throw new Error('The two passwords are not the same. Nothing was changed.');

  // The service checks everything (phone shape, name, password length) and writes.
  const admin = reset
    ? await resetPlatformAdminPassword(pool, { phone, password })
    : await createPlatformAdmin(pool, { phone, name, password });

  console.log(`OK admin ${reset ? 'password changed' : 'created'}: id=${admin.id} phone=${admin.phone}`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    // A short, kind message. The service's errors already have clear wording.
    console.error(`FAILED: ${err.message}`);
    await pool.end().catch(() => {});
    process.exit(1);
  });

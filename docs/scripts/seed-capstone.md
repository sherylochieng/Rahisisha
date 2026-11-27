# Guide: `scripts/seed-capstone.js`

**FILE:** `scripts/seed-capstone.js`
**GUIDE FILE:** `docs/scripts/seed-capstone.md`
**Changed:** Week 30 Day 3 (safety change, the demo data itself is the same)

---

## WHY THIS FILE EXISTS
It builds one complete pretend shop (Amina's Boutique) with an owner, a staff member, five dresses, customers, two orders and a sample chat, so you can test the whole app on your own computer straight after running the migrations.

## WHY IMPORTANT
Every demo, test and screenshot starts from this data. If it is quick and safe to run, you can wipe your local database and rebuild a working shop in seconds.

## DANGER
Before Week 30 Day 3 this file had the demo password written inside it (the old public demo password), and the same password was printed in the terminal. The repo is public, so anyone could read it and log in to any staging shop that was seeded with it. Three demo accounts on staging really were seeded that way. We locked them on 27 November 2026.

## WHAT IT SOLVES
- The password is no longer in the code. It comes from your own `.env`.
- The script stops before touching the database if the password is missing, too short, or the old public one.
- The script refuses to run against a database that is not on your computer, unless you say so on purpose.

## SYSTEM DESIGN PRINCIPLE
**Secrets live in the environment, not in the code.** Code is shared (and this repo is public). The environment (`.env`) stays on your machine. A second principle is **fail early and safely**: all the checks run before the first database call, so a refusal leaves nothing half-written.

## RULES
1. `DEMO_PASSWORD` must be in `.env` and be 12 or more characters.
2. It must not start with `demo1234` in any capital letters (the old public password).
3. `DATABASE_URL` must point at localhost, unless `ALLOW_SEED_ON_REMOTE=yes` is set.
4. Never print the password. The summary at the end says "(your DEMO_PASSWORD)".
5. Everything still runs in ONE transaction: all or nothing.

## PRACTICAL EXAMPLE
Your `.env` has:
```
DEMO_PASSWORD=pick-your-own-long-phrase
```
Then:
```
node scripts/seed-capstone.js
```
If you forget the line, you see: `Seed stopped: set DEMO_PASSWORD in your .env (12 or more characters).` and nothing is written.

## DECISIONS
- **Env variable, not a prompt.** A prompt would break scripts that run without a person at the keyboard.
- **Block the old password by name.** It is in the Git history forever, so it must never be used on any database again.
- **Block remote databases by default.** The mistake that caused this cleanup was demo logins on a live database. One extra word (`ALLOW_SEED_ON_REMOTE=yes`) makes you do it on purpose.

## WHERE USED
Run by hand from the repo root on your own computer (`node scripts/seed-capstone.js`). It is also mentioned in `capstone/README.md` and the demo notes.

## TRADEOFFS
- You must add one line to `.env` once. That is a small price for no public password.
- The password check is simple (length and the old word). It is not a full strength test, because these are demo accounts on a local database.
- The remote check looks for `localhost` or `127.0.0.1` in the connection string. A database on another computer in your home network would also need `ALLOW_SEED_ON_REMOTE=yes`. That is the safe direction to be wrong in.

## HOW TO USE
1. Open your `.env` (the one used by this script, in the repo root or where `dotenv` finds it).
2. Add `DEMO_PASSWORD=` followed by your own phrase of 12 or more characters.
3. Run `node scripts/seed-capstone.js`.
4. Log in at the local site with `+254700000001` and your phrase.

---

## PIECE BY PIECE (what the whole script does)

| Piece | What it does | Real-life picture |
|---|---|---|
| Guards (new) | Check the password and where the database is | The guard at the gate checks your pass before you enter |
| 1. Tenant | Creates the shop "Amina's Boutique" | Registering a new stall in a market |
| 2. Brand profile | Colours, delivery areas, return policy | The signboard and the notice on the door |
| 3. Users | One owner and one staff member, same hashed password | Giving two people keys; the lock stores a scrambled copy, never the key itself |
| 4. Memberships | Says who works at which shop and in which role | The staff list pinned on the wall |
| 5. Products | Five dresses, four sizes each (20 variants) | The rack with each size hanging separately |
| 6. Customers | Three buyers | The customer phone book |
| 7. Orders | One paid order and one waiting for payment, with a wallet and stock entry | A receipt book with one paid and one unpaid slip |
| 8. Conversation | Four sample WhatsApp messages | A chat screenshot for the demo |
| 9. Subscription | Starter plan and a usage counter | The shop's membership card |

## LINE BY LINE (only the parts changed this week)

**Header note (added).** Comment lines at the top explain the safety change. Comments change nothing when the script runs.

**`const DEMO_PASSWORD = process.env.DEMO_PASSWORD;`**
Reads the password from the environment. `dotenv` has already loaded `.env` on the line above, so the value is there if you added it. Real life: reading the till PIN from the sealed envelope in the safe, not from the sign on the wall.

**`if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 12) { ... process.exit(1); }`**
If the password is missing or shorter than 12 characters, print two messages and stop. `process.exit(1)` ends the program with an error code. We have not opened any database connection yet, so nothing is written.

**`if (DEMO_PASSWORD.toLowerCase().startsWith('demo1234')) { ... }`**
Stops if you try to reuse the old public password, even with different capital letters. The old password is in the repo history for good, so it must never protect anything again.

**`const TARGET_URL = process.env.DATABASE_URL || 'postgresql://rahisisha_user:password@localhost:5432/rahisisha';`**
The same database address the script already used, now saved in a variable so the guard can look at it. The fallback is your local database.

**`const IS_LOCAL = /@(localhost|127\.0\.0\.1)(:|\/)/.test(TARGET_URL);`**
True only when the address after the `@` is `localhost` or `127.0.0.1`. Those names always mean "this computer".

**`if (!IS_LOCAL && process.env.ALLOW_SEED_ON_REMOTE !== 'yes') { ... process.exit(1); }`**
If the database is not on this computer and you did not say `ALLOW_SEED_ON_REMOTE=yes`, print the reason and stop. Real life: the fire-drill alarm is fine in the training room, not in the real bank.

**`const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);`**
Was `bcrypt.hash('<the old public password>', 12)`. It now scrambles your own `.env` password. The number 12 is the cost: higher is slower and harder to guess.

**The two `console.log` login lines at the end.**
They used to print the password. They now print `(your DEMO_PASSWORD)`, because terminals, screen recordings and pasted logs get shared.

## WHAT STAYED THE SAME
Everything else: the tenant, products, customers, orders, messages, the single transaction, the rollback on error.

## KNOWN ISSUE (noticed, not changed)
Section 7 inserts into `wallet_entries` using a column called `reference_id`, but `sql/SCHEMA.sql` defines that column as `reference`. If your local database follows `SCHEMA.sql`, that insert will fail and the whole seed will roll back. This was already there before this change. We fix it as a separate, small step if you hit it.

## SEE ALSO
- `capstone/PENDING_TASKS.md` item P1 (delete the public demo accounts)
- `docs/secrets.md`
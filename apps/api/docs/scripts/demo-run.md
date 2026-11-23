# demo-run.mjs: the whole demo, by itself, as many times as you like

**FILE:** `apps/api/docs/scripts/demo-run.md` (guide for `scripts/demo-run.mjs`)

---

## WHY THIS FILE EXISTS

This guide explains the script that runs the two-shop demo end to end with no typing: reset the database, sign up both shops, USSD, WhatsApp, orders, and checks that nothing leaks between the shops.

It is the weekend task "Run the full demo end to end ten times" and "zero manual interventions".

---

## WHY IMPORTANT

A demo you only get right by luck is not ready. If it passes ten times in a row from a clean database, with nobody touching it, it is repeatable. If it fails once in ten, you found a real bug on a quiet weekend instead of in front of the instructor.

---

## DANGER

- **It deletes the local practice database on every run.** It refuses any address that is not on this computer.
- It briefly renames `scripts/demo-data.sql` and always puts it back, even if a run fails. If you stop it with Ctrl+C at the wrong moment, check that `scripts/demo-data.sql` exists (see `RUNBOOK.md`, section 7).
- It does **not** test M-Pesa. M-Pesa uses Safaricom's sandbox and a real phone prompt, so you try it by hand, twice.
- Passwords come only from environment variables. None is in the file, and none is printed.

---

## WHAT IT SOLVES

- Does the demo work from a clean start, every time?
- Does shop A ever see shop B's messages, orders or wallet?
- How long does the whole demo take? (the target is under 5 minutes)

---

## SYSTEM DESIGN PRINCIPLE

A repeatable demo is a tested demo. Treat the demo like a test suite: start from the same clean state, run the same steps, check the same answers.

---

## RULES

1. Local computer only.
2. Passwords only through environment variables.
3. Every run starts from a freshly reset database.
4. Every step checks its answer. One wrong answer fails the run.
5. `scripts/demo-data.sql` is always put back.

---

## PRACTICAL EXAMPLE

Real life: before showing the demo to the instructor, you press one button and watch it succeed ten times in a row, instead of nervously clicking through it once.

In **Git Bash**, in the repo folder, with the API running (`cd apps/api`, `npm run dev`):

```bash
export DEMO_ADMIN_PASSWORD='the postgres password'
export DEMO_APP_PASSWORD='the rahisisha_user password'
export DEMO_PASSWORD_A='a practice password for Aminas Boutique'
export DEMO_PASSWORD_B='a different practice password for Brio Hardware'
node scripts/demo-run.mjs --runs 10
```

Each `export` line lasts only for that terminal window. Nothing is saved in a file. The two shop passwords need at least 8 characters and must be different from each other.

---

## DECISIONS (and WHY)

- **One script, not ten commands:** nobody can mistype a step.
- **Real HTTP calls to the real API, not shortcuts into the database:** it tests what a customer or shop owner would really touch.
- **Isolation checked in three places (inbox, orders, wallet):** one leak anywhere is a leak.
- **`demo-data.sql` hidden during the reset:** its practice shop "Amina's Boutique" would clash with "Aminas Boutique" (the web address `aminas-boutique` would be taken).
- **Shop name "Aminas Boutique" with no apostrophe:** signup turns the name into the web address the USSD and WhatsApp settings look for.
- **No M-Pesa:** a real phone prompt cannot be automated, and it must not spend real money ten times.
- **Built-in `fetch`, `.mjs` extension:** no new package, and it runs without any setup.

---

## WHERE USED / FUTURE USES

- Before every demo, and after any big change: run it once.
- Later, against a staging server. Change the local-only guard on purpose, never by accident.
- When the online shop exists, add the cart and checkout steps.
- In any multi-tenant project: a runner that signs up two tenants and asserts nothing crosses is a cheap, strong safety net.

---

## TRADEOFFS

- **+** About 1.5 seconds per run on a fast machine, repeatable, and it catches leaks.
- **-** It wipes the practice database each run.
- **-** It needs Git Bash (for `bash` and `psql`) and the API already running.
- **-** It checks the demo's story, not every feature.

---

## HOW TO USE

1. Make sure the Windows Postgres is running (Docker is not needed) and the API is running (`RUNBOOK.md`, section 4).
2. Set the four environment variables (see PRACTICAL EXAMPLE).
3. Run it once: `node scripts/demo-run.mjs`.
4. Then ten times: `node scripts/demo-run.mjs --runs 10`.
5. Paste the SUMMARY into `PERFORMANCE.md` or the weekend notes.
6. Do the M-Pesa part by hand, twice (`capstone/demo-script.md`, Part 4).

---

## WHAT EACH RUN DOES (9 steps)

1. **Reset the database** with `scripts/reset-db.sh` (hiding `demo-data.sql` for the moment).
2. **Sign up both shops** on the live API, with different phones and passwords.
3. **Load the USSD and WhatsApp settings** (`sql/seeds/ussd_*.sql`, `seed-whatsapp-demo.js`).
4. **USSD:** the same phone number dials both shop codes. Each answers with its own name and its own products, and never the other's.
5. **WhatsApp:** one message to each shop's own number.
6. **Log in** as both owners.
7. **Inboxes:** each shop sees its own WhatsApp message and USSD activity, and none of the other's.
8. **Orders:** each shop makes one small order, sees only its own, and gets a 404 when it tries to open the other shop's order by its id.
9. **Wallets:** each shop has its own ledger, with no shared entries and different balances.

---

## HOW WE KNOW THE CHECKS REALLY CATCH LEAKS

On 23 November 2026, before it was handed over, the script was run in a test setup and then **deliberately broken five ways** (each check turned upside down in a copy). Every broken copy failed with a clear message:

- `Aminas Boutique USSD product list shows "Maxi Dress" from the other shop`
- `Aminas Boutique inbox shows Brio Hardware's WhatsApp message`
- `Aminas Boutique orders list shows Brio Hardware's order`
- `Aminas Boutique could open Brio Hardware's order by its id`
- `Aminas Boutique's wallet equals Brio Hardware's wallet`

A check that cannot fail proves nothing. These can.

---

## PIECE BY PIECE (simple words, real-life examples)

### `guard()`

Stops unless the API address is on this computer, all four passwords are set, and the two shop passwords are different. Real life: the practice room key that cannot open the real shop.

### `check(condition, message)`

One fact that must be true. If not, the run stops with this message. Real life: a checklist where one unticked box means "not ready".

### `runCmd(...)`

Runs another program (`bash`, `psql`, `node`) and stops with its last error lines if it fails. It never prints passwords.

### `api(path, ...)`

Calls the API like a browser would and gives back the status, the answer, and the login cookie.

### `stepReset()`

Hides `demo-data.sql`, runs the reset script, then **always** puts the file back (`finally`).

### `stepSignup(shop)`

Signs a shop up. If the very first request meets a dropped database connection (the reset kills the API's connections), it tries once more, like a person pressing the button again. This is also a small real-life test of the connection fix in `pool.js`.

### `stepSeeds()`, `stepUssd()`, `stepWhatsapp()`, `stepLogin()`

Load the settings, dial USSD, send WhatsApp messages, and log in. Each checks the answer.

### `stepInbox()`, `stepOrders()`, `stepWallet()`

The three isolation checks: each shop sees its own rows and none of the other's.

### `oneRun(run)` and `main()`

`oneRun` does the nine steps in order, times each one, and stops at the first failure. `main` repeats it `--runs` times and prints a SUMMARY: runs, passed, failed, and the fastest, average and slowest time.

---

*Written by AI at Sheryl's request (declared in the weekend audit). 23 November 2026.*
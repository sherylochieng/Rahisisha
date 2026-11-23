# RUNBOOK

**FILE:** `RUNBOOK.md` (repo root)

---

## WHY THIS FILE EXISTS

A runbook is the "what do I do when..." page, like the card stuck inside a shop's cupboard that says what to do if the lights go out.

It is written for a tired person (me, in three months) who has forgotten how everything fits together. It says what runs where, how to start and stop it, how to back up and restore the database, how to reset for the demo, how to push safely, and what to do when something breaks.

Every command in it was really run on 23 November 2026.

---

## WHY IMPORTANT

A backup you have never restored is only a hope. A demo you cannot reset is a gamble.

Writing the steps down once means I never have to work them out in a hurry, and a teammate (or the instructor) can repeat them without asking me.

---

## DANGER

- `DROP DATABASE` and `reset-db.sh` delete everything. Only use them on the local practice database, and only after a backup exists when the data matters.
- A backup file holds real data (shops, phones, orders). Keep it OUTSIDE the repo and never commit it.
- The ngrok tunnel makes my laptop's API public. Close it when the demo is over.
- The M-Pesa sandbox prompts a REAL phone. Use my own number and small amounts.
- Never paste or commit `.env`, keys, secrets, passkeys, tokens or passwords.

---

## WHAT IT SOLVES

- Where things live, and which program uses which port.
- Start everything, stop everything, check everything is healthy.
- Back up, wipe, restore and verify the database.
- Reset to a clean demo state.
- Push to GitHub safely and tag a release.
- A "something went wrong" table built from real errors.

---

## SYSTEM DESIGN PRINCIPLE

**Prove the restore, not just the backup.**

A backup is only real once you have restored it somewhere and checked the result. Here that meant comparing the row counts before and after, and checking that the Row-Level Security locks (the isolation promise) survived the restore. Counts alone would not have caught a restore that quietly lost the locks.

---

## RULES

1. Read the "which Postgres" section before touching the database.
2. Take the "before" numbers first, and check the backup file has a real size.
3. Restore as the admin user (`postgres`) into a database owned by `rahisisha_user`.
4. After any restore or reset: check the counts, check the locks, run the isolation tests.
5. Only one Postgres may listen on port 5432.

---

## PRACTICAL EXAMPLE

On 23 November 2026 the database had 9 shops, 9 users, 36 products, 16 orders, 2 messages and 4 wallet entries.

I made a backup (92,774 bytes), dropped the database, recreated it empty, restored the backup and counted again. The numbers were identical, 20 tables still had Row-Level Security forced on, all 125 isolation tests passed, and USSD still answered for both shops. That whole run is section 6.

---

## DECISIONS (and WHY)

- **Custom-format dump (`pg_dump -Fc`):** it is compressed and `pg_restore` can restore parts of it. A plain `.sql` file is bigger and all-or-nothing.
- **Backup kept outside the repo (`~/rahisisha-backups`):** the repo is public, and a backup holds real data.
- **Restore as `postgres` into a database owned by `rahisisha_user`:** the tables keep the same owner as before, so the app still runs as an ordinary user and the locks still apply.
- **The Docker Postgres is stopped, not deleted:** two databases on one port is a hazard (see section 3), but stopping is reversible and deleting is not.
- **Hide `demo-data.sql` during a reset instead of editing it:** a rename is easy to undo and changes no file contents.

---

## WHERE USED / FUTURE USES

This runbook is for Rahisisha today, but the habit works in any project. Here is where and how to use it next time:

- **Any project with a database.** Before the first real user, do one full backup-wipe-restore-verify run and write it down. Example: a booking app for a salon. Back up, wipe, restore, then check that the number of bookings matches and that a customer still cannot see another salon's bookings.
- **Before every risky change.** Take a backup first, then run the migration, upgrade or reset. Example: before changing a table that holds M-Pesa payments, dump the database so a wrong migration can be undone.
- **Handing a project to someone else.** Put the start, stop and health-check steps in the runbook so the next person does not need you. Example: a client who owns a shop and a freelancer who maintains the site later.
- **Deployment week.** The same sections become the production runbook: swap the local commands for the server's, and add a second person who watches the restore.
- **After every real mistake.** Add one row to the "something went wrong" table (symptom, meaning, fix). Example: this week's `role "postgres" does not exist` row came straight from a real error, and the next person will recognise it in seconds.

---

## TRADEOFFS

- **+** One place to look when something breaks, and every step has already been proven to work.
- **+** A beginner can follow it, because each command says which terminal to use and what a good answer looks like.
- **-** It goes stale. If a port, a script name or a command changes, the runbook is wrong until someone updates it.
- **-** It covers a local practice database only. Production needs more (see section 12).

---

## HOW TO USE

Do not read it top to bottom. Use the contents list, jump to the job, and copy the commands in the order shown. Section 10 is for when something breaks.

---

## AI AUDIT NOTE

Written by AI at Sheryl's request, from the commands and results she ran on 23 November 2026. Declared in the weekend audit.

---

## Contents

1. [How to read this file](#1-how-to-read-this-file)
2. [The map: what runs where](#2-the-map-what-runs-where)
3. [Which Postgres is the app using? (read this before the database)](#3-which-postgres-is-the-app-using)
4. [Start everything, stop everything](#4-start-everything-stop-everything)
5. [Is everything healthy?](#5-is-everything-healthy)
6. [Backup and restore](#6-backup-and-restore)
7. [Reset to a clean demo](#7-reset-to-a-clean-demo)
8. [Set up the two-shop demo](#8-set-up-the-two-shop-demo)
9. [Push to GitHub safely and tag a release](#9-push-to-github-safely-and-tag-a-release)
10. [Something went wrong](#10-something-went-wrong)
11. [Secrets and safety rules](#11-secrets-and-safety-rules)
12. [What this does not cover](#12-what-this-does-not-cover)
13. [Chaos test: cut the database connection](#13-chaos-test-cut-the-database-connection)

---

## 1. How to read this file

**A runbook is like the "what to do if the lights go out" card stuck inside a shop's cupboard.** You do not read it every day. You open it on the day something goes wrong, and it tells you the next step in plain words.

Three kinds of terminal are used here. They are not interchangeable:

| Terminal | Used for | How you know |
|---|---|---|
| **PowerShell** (inside VS Code) | Starting the apps, `npm`, `git`, `curl.exe`, `docker` | Prompt starts with `PS C:\...>` |
| **Git Bash** | `bash scripts/reset-db.sh`, `psql`, `pg_dump`, `pg_restore` | Prompt shows `MINGW64` and `$` |
| **A browser** | The app itself and GitHub | |

If a command says "not found" or behaves strangely, the first thing to check is that you are in the right terminal (see section 10).

Never paste the prompt line (`PS C:\...>` or `$`) back into a terminal. Paste only the command.

---

## 2. The map: what runs where

| What | Where | Port | Started by |
|---|---|---|---|
| The API (Express) | `apps/api` | 3000 | `npm run dev` |
| The web app (Next.js) | `apps/web` | 3001 | `npm run dev` |
| The database (Postgres, installed on Windows) | Windows service | 5432 | Starts with Windows |
| Redis (installed, but **not used by any code yet**) | Docker container `rahisisha_redis` | 6379 | Not needed today (see the note below the table) |
| The public tunnel (ngrok) | Only for M-Pesa demos | none (points at 3000) | `ngrok http 3000` |
| Docker Postgres (`rahisisha_postgres`) | Docker, **stopped on purpose** | 5432 | Do not start it (see section 3) |

**Redis note (corrected 23 November 2026):** the `ioredis` and `connect-redis` packages are installed and `REDIS_URL` exists in `.env.example`, but no file in `apps/api/src` uses Redis. USSD works without it (the phone sends the whole menu path each time). Redis becomes useful when sessions or queues are added. Earlier notes that said "USSD sessions live in Redis" were wrong.

Where the settings live:

- `apps/api/.env`: database address, `KMS_KEY`, the Daraja sandbox keys, `DARAJA_CALLBACK_BASE`. **Private. Never commit it.**
- `infra/docker-compose.yml`: describes the Docker containers.
- `sql/SCHEMA.sql` and `sql/migrations/`: the database structure.
- `scripts/reset-db.sh` and `scripts/demo-data.sql`: the reset script and its practice shops.

---

## 3. Which Postgres is the app using?

On the development laptop there were **two** Postgres servers on port 5432 at the same time:

- the one installed on Windows (`postgres.exe`): this is the real one the app uses, and it has the `postgres` admin user;
- the one from `infra/docker-compose.yml` (`rahisisha_postgres` in Docker): empty and unused. Its `rahisisha_user` is a **superuser**, and a superuser ignores Row-Level Security. If the app ever connected to it by accident, the isolation promise would silently stop working.

**Analogy:** two shop doors with the same street number. The app has been walking through the real one, but the second door should be kept shut.

Check what is listening (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 5432 -State Listen | ForEach-Object { "$($_.LocalAddress) -> $((Get-Process -Id $_.OwningProcess).ProcessName)" }
```

- Good: only `postgres` lines (the Windows one listens on both `0.0.0.0` and `::`).
- Bad: a line with `com.docker.backend`. Stop the Docker database:

```powershell
docker stop rahisisha_postgres
```

This only pauses it. Nothing is deleted. Do not run `docker compose up` for the whole file again without stopping the Docker Postgres afterwards.

---

## 4. Start everything, stop everything

### Start (a work session or a demo)

Open one VS Code terminal per item. Keep each one open.

1. **Docker Desktop:** open it from the Start menu and wait until it says the engine is running (1 to 2 minutes). Windows may ask about the firewall: tick **Private networks** only, then Allow.
2. **Redis:** not needed today (no code uses it). Skip this step. If a future feature needs it: `docker start rahisisha_redis`.

3. **Postgres:** nothing to do, the Windows service is already running. Check it with the command in section 3.
4. **The API** (terminal 1):

```powershell
cd apps/api
npm run dev
```

   Wait for `API server running on port 3000`.

5. **The web app** (terminal 2):

```powershell
cd apps/web
npm run dev
```

   Wait for the address `http://localhost:3001`.

6. **Only for an M-Pesa demo, ngrok** (terminal 3). See section 8.

### Stop

Click in each terminal and press **Ctrl+C**: ngrok first, then the API, then the web app. Leave Docker and Postgres running.

---

## 5. Is everything healthy?

Run these when you are not sure the app is working.

| Check | Command | Good answer |
|---|---|---|
| API answers | `curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=h1" -d "phoneNumber=+254711111111" -d "text="` | A reply starting with `CON` |
| Web app answers | `curl.exe -I http://localhost:3001/login` | `HTTP/1.1 200 OK` |
| Only one Postgres | the command in section 3 | Only `postgres` lines |
| Isolation locks hold | `cd apps/api` then `npm run test:isolation` | 7 suites, 125 tests passed |
| Everything works | `cd apps/api` then `npm test` | 29 suites, 310 tests passed |

(`Jest did not exit one second after the test run has completed` at the end of `npm test` is a harmless note. What matters is the `passed` lines.)

---

## 6. Backup and restore

Run in **Git Bash**, in the repo folder. Each `psql`, `pg_dump` and `pg_restore` command asks for the `postgres` password.

### 6.1 Take the "before" numbers

```bash
psql -h localhost -U postgres -d rahisisha -c "SELECT (SELECT count(*) FROM tenants) AS shops, (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM messages) AS messages, (SELECT count(*) FROM wallet_entries) AS wallet_entries;"
```

Write the numbers down. This asks as the admin, who is not blocked by the shop locks, so it counts every shop.

### 6.2 Make the backup

Outside the repo, so it can never be committed. Replace the date.

```bash
mkdir -p ~/rahisisha-backups
pg_dump -h localhost -U postgres -Fc -f ~/rahisisha-backups/rahisisha-YYYY-MM-DD.dump rahisisha
ls -l ~/rahisisha-backups
```

`-Fc` makes a compressed backup. The file must have a real size (the 23 November one was 92,774 bytes). A file of 0 bytes means the backup failed.

### 6.3 Wipe and restore

Stop the API first (an open connection blocks the drop; `WITH (FORCE)` also disconnects it).

```bash
psql -h localhost -U postgres -d postgres -c "DROP DATABASE rahisisha WITH (FORCE);"
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE rahisisha OWNER rahisisha_user;"
pg_restore -h localhost -U postgres -d rahisisha ~/rahisisha-backups/rahisisha-YYYY-MM-DD.dump
```

`pg_restore` printing nothing means it ran without errors. It must be restored **as `postgres`** into a database **owned by `rahisisha_user`**, so the tables keep the same owner as before.

### 6.4 Verify the restore

1. Run the counts query from 6.1 again. The numbers must equal the "before" numbers.
2. Check the locks are still forced on:

```bash
psql -h localhost -U postgres -d rahisisha -c "SELECT count(*) AS tables_with_forced_rls FROM pg_class WHERE relrowsecurity AND relforcerowsecurity AND relkind = 'r';"
```

   Expect **20**. (20 locked tables plus the extra `login_lookup` rule is the "21 policies" the reset script reports.)

3. Run the isolation tests (PowerShell): `cd apps/api` then `npm run test:isolation`. Expect 7 suites and 125 tests.
4. Start the API and dial both shops with the same phone number:

```powershell
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=r1" -d "phoneNumber=+254711111111" -d "text=1"
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*102#" -d "sessionId=r2" -d "phoneNumber=+254711111111" -d "text=1"
```

   Amina's Boutique shows her dresses and Brio Hardware shows Cement and Hammer.

### 6.5 Result of the real run (23 November 2026)

| Check | Before | After |
|---|---|---|
| shops / users / products / orders / messages / wallet_entries | 9 / 9 / 36 / 16 / 2 / 4 | 9 / 9 / 36 / 16 / 2 / 4 |
| tables with Row-Level Security forced on | not measured | 20 |
| isolation tests | 7 suites, 125 tests | 7 suites, 125 tests |
| USSD for both shops | working | working |

There are 9 shops because the automated tests leave their own test shops behind.

---

## 7. Reset to a clean demo

Use this to start the demo from nothing. **It deletes everything in the practice database.** Take a backup first if the data matters.

The reset script also loads some practice shops from `scripts/demo-data.sql`, including one called "Amina's Boutique". That clashes with the demo, where Aminas Boutique signs up herself (see the slug note in section 8). So hide that file for the reset:

1. PowerShell: hide the practice data.

```powershell
Rename-Item scripts/demo-data.sql demo-data.sql.off
```

2. Git Bash: run the reset. It asks you to type the database name `rahisisha`, then the `postgres` password, then the `rahisisha_user` password.

```bash
bash scripts/reset-db.sh
```

   Expect: `OK: 21 policies, login_lookup present.` and `5/5 scripts/demo-data.sql not found yet. Skipping demo data.`

3. PowerShell: put the file back, and check Git sees nothing changed.

```powershell
Rename-Item scripts/demo-data.sql.off demo-data.sql
git status --short
```

(`Rename-Item` is a PowerShell command. In Git Bash it says "command not found". If you ran the reset before renaming back, check the output says "Skipping".)

---

## 8. Set up the two-shop demo

After a reset (section 7). Full minute-by-minute script: `capstone/demo-script.md`. Written record of the 23 November run: `demo-week29.md`.

1. Start the API and web app (section 4).
2. In a browser go to `http://localhost:3001/signup` and sign up both shops with **different** phones and passwords:
   - Shop name `Aminas Boutique`, phone `0700000001`
   - Shop name `Brio Hardware`, phone `0700000002` (use a private window so the logins do not clash)

   **Why "Aminas" with no apostrophe:** signup turns the shop name into its web address. "Aminas Boutique" becomes `aminas-boutique`, the name the setup scripts look for. "Amina's Boutique" would become `amina-s-boutique` and the scripts would not find it.

3. Load the USSD settings (Git Bash, asks for the `rahisisha_user` password each time):

```bash
psql -h localhost -U rahisisha_user -d rahisisha -f sql/seeds/ussd_configs_seed.sql
psql -h localhost -U rahisisha_user -d rahisisha -f sql/seeds/ussd_demo_data_seed.sql
```

4. Load the WhatsApp and M-Pesa settings (PowerShell, in `apps/api`). Each should print two `OK` lines, one per shop:

```powershell
node scripts/seed-whatsapp-demo.js
node scripts/seed-daraja-demo.js
```

5. **For M-Pesa only:** start the tunnel with `ngrok http 3000`, copy the `https://....ngrok-free.dev` address, put it in `apps/api/.env` as `DARAJA_CALLBACK_BASE` (no slash at the end), press `rs` then Enter in the API terminal, and run `node scripts/seed-daraja-demo.js` again. **The address changes every time ngrok starts.**
6. Log in from PowerShell as each owner and make one small order each (the cheapest product, quantity 1), then pay it with your **own** number:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/login -ContentType 'application/json' -Body (@{ phone = '0700000001'; password = 'PASSWORD' } | ConvertTo-Json) -SessionVariable sA
```

   The orders, WhatsApp and payment commands are in `capstone/demo-script.md`.

7. Afterwards: close ngrok (Ctrl+C), stop the API and web app.

Expected results from the real run: both orders `paid` with an M-Pesa receipt, Amina's wallet KES 12,660, Brio's wallet KES 8,460, each inbox showing only its own messages.

---

## 9. Push to GitHub safely and tag a release

1. **Stop** ngrok, the API and the web app (section 4). Reason: the push first runs the isolation tests, and the running servers can collide with them. ngrok should be closed anyway.
2. Check what you are about to push:

```powershell
git status -sb
```

   Expect `## main...origin/main [ahead N]` and no file lines. Files you do not want to commit: `.env`, `.dump` backups, `commit-docs.ps1`, `*.zip`.

3. Push. The pre-push hook runs the isolation tests (about 25 seconds). A failing test blocks the push, and that is the hook doing its job.

```powershell
git push
```

4. Tag the release and push the tag:

```powershell
git tag -a v0.29.0 -m "message"
git push origin v0.29.0
git ls-remote --tags origin v0.29.0
```

   The `ls-remote` line should end in `refs/tags/v0.29.0` (its hash differs from the commit hash, which is normal for an annotated tag).

5. Open `https://github.com/sherylochieng/Rahisisha/actions` and check the newest run is **green**.

Commit messages: one piece per commit, tagged with the week and day, for example `docs(day5): ... [Week 29 Day 5]`. No `Co-Authored-By` lines.

---

## 10. Something went wrong

| What you see | What it means | What to do |
|---|---|---|
| `role "postgres" does not exist` | You reached the **Docker** Postgres, not the Windows one | Section 3: stop `rahisisha_postgres`, use `-h localhost` with the Windows Postgres |
| `error: unknown switch 'e'` after `git reset --hard HEAD@{1}` | PowerShell treats `@{ }` as its own symbol | Put the reference in quotes: `git reset --hard "HEAD@{1}"` |
| `Rename-Item: command not found` | You are in Git Bash, not PowerShell | Run it in PowerShell |
| A pasted line starting with `PS C:\...>` gives errors | You pasted the prompt too | Paste only the command |
| Windows firewall box about "Docker Desktop Backend" | Windows asks if Docker may use the network | Tick **Private networks** only, click Allow access |
| `order_not_payable` when paying | The order is already `paid` (the "pay once" safety) | Make a new order, or check the order status |
| `duplicates=1` after a WhatsApp message | The same message id was sent twice | Use a new `wamid.` id for each message |
| M-Pesa prompt never comes, or the order stays `pending` | The ngrok address changed, the tunnel is closed, or Safaricom's sandbox is flaky | Check ngrok is running and `DARAJA_CALLBACK_BASE` matches, press `rs` in the API terminal, re-run `seed-daraja-demo.js`. If the sandbox itself is down, say so honestly (it failed once on 16 November) |
| `Missing DARAJA_...` or `KMS_KEY` message from a seed script | A setting is missing in `apps/api/.env` | Add it. Never paste its value anywhere |
| The signup says the slug is taken | The shop name was already used (reset first) | Reset (section 7) or use another shop name |
| `Port 3000 is already in use` | An old API is still running | Find the terminal and press Ctrl+C, or close VS Code terminals and start again |
| `warning: LF will be replaced by CRLF` | Windows line-ending note | Harmless, ignore it |
| `Jest did not exit one second after the test run` | A harmless note at the end of `npm test` | Check the `passed` lines above it |
| `git push` is blocked | A test in the pre-push hook failed | Read which test failed. Do not skip the hook. Fix it, commit, push again |
| Wrong database answers (shop lock seems off) | The app may have used the Docker superuser database | Section 3, then run `npm run test:isolation` |
| The API terminal shows `Unhandled 'error' event ... terminating connection due to administrator command` and `app crashed` | A database connection was cut and nothing handled it (the bug found by the chaos test) | `apps/api/src/db/pool.js` must contain `pool.on('error', ...)`. Run `npm test -- pool.error-handler`. See section 13 |
| `Database connection dropped (the pool will reconnect)` in the API terminal | A connection was lost, and the pool is recovering. This is the fix working | Nothing, unless it repeats many times a minute. Then check Postgres |
| `reset-db.sh` stops at "type the database name" | It is a safety check | Type `rahisisha` and press Enter |

If something is not in this table: stop, copy the exact error text, and do not run commands you do not understand.

---

## 11. Secrets and safety rules

1. `.env`, keys, secrets, passkeys, tokens and passwords never go in a commit, a chat or a screenshot.
2. Backups (`.dump`) stay outside the repo, in `~/rahisisha-backups`.
3. The repo is public, so assume everything you commit can be read by anyone.
4. `KMS_KEY` encrypts the stored WhatsApp and M-Pesa settings. If it is lost, those settings in a restored database cannot be decrypted. Keep a copy somewhere separate and safe.
5. Close ngrok as soon as a demo is over.
6. Use only your own phone number and small amounts in the M-Pesa sandbox.
7. Never connect the app to a superuser database: it ignores the shop locks.

---

## 12. What this does not cover

- **Roles** (`rahisisha_user`, `postgres`) are not inside the dump. The restore only worked because they already existed. On a new server, create them first (the reset script does this).
- **Redis** is not backed up, and does not need to be today: no code uses it yet.
- **Secrets** (the `.env` file, `KMS_KEY`) are not in the dump (see section 11).
- **Production.** All of this was run on a local practice database. A production restore needs the same steps plus a maintenance window and a second person watching.
- **Other chaos tests.** Only one was run: cutting the database connections (section 13). Stopping the whole Postgres service, a slow database, or a full disk were not tested.

---

## 13. Chaos test: cut the database connection

**What a chaos test is:** a fire drill for the app. You break one part on purpose, once, while the app is running, and watch two things: does it fail politely, and does it recover by itself?

**What we cut:** the connections between the API and the database. In real life this happens when Postgres restarts, the laptop sleeps, or the network blips. It was done with `pg_terminate_backend`, which closes the API's connections from the database side.

**Why not the notification service:** the assignment names a notification-service and a queue. Neither exists yet (`apps/workers` is an empty scaffold), and Redis is not used by any code (see the note in section 2). The database is the part the app cannot live without, so that is what we cut.

### 13.1 How to repeat it

1. Start the API (section 4) and check USSD answers (section 5).
2. In Git Bash, open an admin session and leave it open:

```bash
psql -h localhost -U postgres -d rahisisha
```

3. In PowerShell, make the API open a connection:

```powershell
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=c1" -d "phoneNumber=+254711111111" -d "text="
```

4. Straight away, at the `rahisisha=#` prompt, cut the connections. The API closes idle connections after 30 seconds, so do this quickly:

```sql
SELECT count(*) AS cut, count(*) FILTER (WHERE pg_terminate_backend(pid)) AS terminated FROM pg_stat_activity WHERE datname = 'rahisisha' AND usename = 'rahisisha_user' AND pid <> pg_backend_pid();
```

5. Wait 5 seconds, then dial again:

```powershell
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=c2" -d "phoneNumber=+254711111111" -d "text=1"
```

### 13.2 What happened (23 November 2026)

| | Before the fix | After the fix |
|---|---|---|
| API terminal | `Unhandled 'error' event` ... `[nodemon] app crashed` | `Database connection dropped (the pool will reconnect): terminating connection due to administrator command` |
| Is the API still running? | **No, it stayed down** until restarted | **Yes** |
| Dial after the cut | `curl: (7) Failed to connect to localhost port 3000` | Amina's product list |

**The bug:** `apps/api/src/db/pool.js` had no listener for pool errors. When a connection that was sitting unused in the pool was cut, Node treated the report as an unhandled error and stopped the whole API. One small blip would have taken every shop offline.

**The fix:** `pool.on('error', ...)` in `pool.js` writes the problem to the log (only the message, never the whole error object, because that holds connection details) and carries on. The pool throws the dead connection away and opens a fresh one for the next request.

**The guard:** `apps/api/tests/pool.error-handler.test.js` fails if the listener is removed (checked: it failed without the fix and passed with it).

### 13.3 What this does not prove

- Only **idle** connections were cut. A request that is in the middle of a query when the connection dies will fail with an error for that one customer (a clean `500`, not a crash). That was not tested here.
- Stopping the whole Postgres service and starting it again was not tested.
- The recovery was checked on USSD only. Orders, wallet and the other routes use the same pool, but were not each tried after a cut.
<!--
=====================================================================
FILE: README.md  (repo root)

WHY THIS FILE EXISTS
  It is the front door of the repo. A new person (teammate, instructor,
  employer) should understand what Rahisisha is and have it running in
  about 10 minutes, without asking you anything.

WHY IMPORTANT
  It is the first file anyone reads. If its steps fail, they stop trusting
  the rest of the project.

DANGER
  A README that does not work when followed. Every command below was taken
  from the real scripts and files. The one-command start (dev-up.sh) was
  tested; see "How much of this has been tested" at the bottom.

WHAT IT SOLVES
  "What is this, how do I run it, where is everything else?"

SYSTEM DESIGN PRINCIPLE
  Short front door, long rooms behind it: this file stays short and LINKS to
  the detail (runbook, API reference, secrets, ADR).

RULES
  1. Say honestly what is built and what is not.
  2. Only commands that exist in the repo.
  3. When code changes, change this file in the same commit.

TRADEOFFS
  The diagram is plain text so it shows everywhere (GitHub, VS Code, a
  phone) and diffs cleanly. It is less pretty than an image.

HOW TO USE
  Read top to bottom. Quickstart is section "Run it in 10 minutes".
=====================================================================
-->

# Rahisisha - Make Business Easy

![CI](https://github.com/sherylochieng/Rahisisha/actions/workflows/ci.yml/badge.svg)

A multi-tenant SaaS platform that gives small Kenyan businesses their own online shop.

- **Live staging:** https://rahisishabiashara.com
- **API health check:** https://api.rahisishabiashara.com/health
- **CI runs:** https://github.com/sherylochieng/Rahisisha/actions

## What it is

Think of a mama mboga who sells by WhatsApp, a hardware shop that takes orders on USSD, and a boutique that wants a shop link. Rahisisha gives each of them their own shop: products, orders, an inbox, a wallet that records every shilling, and a public shop page. Customers can pay with M-Pesa. Many shops live in one system, and the database itself stops one shop from ever seeing another's data.

**What works today:** sign up and log in, products (add and list), orders and their status flow, the M-Pesa STK push (Safaricom sandbox), wallet ledger, inbox, dashboard, public shop page, USSD menu, WhatsApp inbound (simulated), isolation between shops (125 isolation tests).

**What is not built yet (honest list):** product edit and delete in the web app (the API has them; GitHub issue #6), cart and customer checkout, a Settings page for M-Pesa and WhatsApp keys, real-money payments, a real WhatsApp connection, background workers. See [launch-blockers.md](launch-blockers.md) and [NEXT.md](NEXT.md).

## Run it in 10 minutes

You need: **Windows with Git Bash**, **Node.js** (tested on v24), and **PostgreSQL** running on `localhost:5432` with `psql` available. (Git Bash, because the scripts are bash scripts.)

**1. Get the code and install the packages.** There are three separate folders to install:

```bash
git clone https://github.com/sherylochieng/Rahisisha.git
cd Rahisisha
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

**2. Create the app's database user, once.** The app must NEVER connect as `postgres` (a superuser ignores the row-level locks that keep shops apart). Choose your own password:

```bash
psql -U postgres -c "CREATE ROLE rahisisha_user LOGIN PASSWORD 'choose-a-password';"
```

If it answers `role "rahisisha_user" already exists`, that is fine: skip this step.

**3. Build the database.** This creates it, loads the schema, checks the isolation locks and loads demo data. It asks you to type the database name (`rahisisha`) and two passwords:

```bash
bash scripts/reset-db.sh
```

**4. Make the two settings files.**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/api/.env` and set:

- `DATABASE_URL` to `postgresql://rahisisha_user:<your password>@localhost:5432/rahisisha` (the example file may show `postgres`: change it to `rahisisha_user`)
- `JWT_SECRET` to any long random text
- `KMS_KEY` to 32 random bytes in base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `PORT=3000`
- `WEB_ORIGIN=http://localhost:3001` (the list of websites the API accepts calls from; without it the browser is refused and the signup page says "We couldn't reach the server")

Open `apps/web/.env.local` and set `NEXT_PUBLIC_API_URL=http://localhost:3000/v1`. It must END in `/v1`. Without it the signup page says "Route not found".

What every variable means, and which are secret: [docs/secrets.md](docs/secrets.md). Never commit `.env` files.

**5. Start everything with one command:**

```bash
./scripts/dev-up.sh
```

It checks Node, packages, settings files, free ports and Postgres, starts the API and the web app, and prints two `READY` lines. Press Ctrl+C once to stop both.

**6. Check it works.**

```bash
curl http://localhost:3000/health
```

You should get `{"status":"ok"}`. Open http://localhost:3001, create your shop on the signup page and add a product. To try the API directly, follow the copy-and-run walk-through in [docs/api-reference.md](docs/api-reference.md).

**If something goes wrong,** see [docs/RUNBOOK.md](docs/RUNBOOK.md) (find your symptom, follow the steps).

**Run the tests:**

```bash
cd apps/api
npm test                  # all API tests
npm run test:isolation    # the shop-separation tests (also run automatically before every git push)
```

## How it fits together

```
 CUSTOMERS                                                        SHOP OWNER
 phone / browser                                                  browser
      |                                                               |
      | shop link        USSD (*384#)       WhatsApp message          |
      v                       |                  |                    v
 +-------------------+        |                  |           +-------------------+
 |  Web app          |        |                  |           |  Web app          |
 |  Next.js :3001    |        |                  |           |  (login, dashboard|
 |  public shop page |        |                  |           |  products, orders)|
 +---------+---------+        |                  |           +---------+---------+
           |                  v                  v                     |
           |        Africa's Talking        Meta (WhatsApp)             |
           |                  |                  |                      |
           |                  | POST /ussd       | POST /webhooks/      |
           |                  |                  |      whatsapp        |
           v                  v                  v                      v
      +--------------------------------------------------------------------+
      |  API  (Express 4, Node)  :3000                                     |
      |                                                                    |
      |  requireAuth  ->  withTenant  ->  controllers                      |
      |  (who are you?)   (lock this request to ONE shop)                  |
      +--------+-----------------------------------------------+-----------+
               |                                               ^
               | SQL as rahisisha_user                         | POST /callbacks/
               v                                               |      mpesa/:tenantId
      +-----------------------------+                          |
      |  PostgreSQL                 |             +------------+-----------+
      |  row-level security (RLS):  |             |  Safaricom Daraja      |
      |  every shop sees only its   |   STK push  |  (M-Pesa)              |
      |  own rows                   |  <--------- |  sandbox only          |
      +-----------------------------+  from API   +------------------------+

 Also in the repo, NOT used by the running app today:
   Redis (Docker container, no code uses it)    apps/workers (empty placeholder)
```

In words: the browser talks to the Next.js web app (port 3001), which talks to the Express API (port 3000). Every request first passes `requireAuth` (the login cookie `token` says who you are) and `withTenant`, which opens a database connection locked to that one shop. PostgreSQL then enforces the lock itself with row-level security, so even a bug in the code cannot show one shop another shop's rows. Three outside companies call the API directly: Africa's Talking for USSD, Meta for WhatsApp, and Safaricom, which calls back after a customer enters their M-Pesa PIN. Locally that callback needs an ngrok tunnel. Money is stored in whole cents.

Why the isolation works this way: [capstone/adr/ADR-0003-isolation.md](capstone/adr/ADR-0003-isolation.md) and [isolation-proof.md](isolation-proof.md).

## Where to read more

| I want to... | Read |
| --- | --- |
| Start, stop, back up, reset, push safely | [RUNBOOK.md](RUNBOOK.md) |
| Fix something that just broke | [docs/RUNBOOK.md](docs/RUNBOOK.md) |
| Call the API (curl for every endpoint, error codes) | [docs/api-reference.md](docs/api-reference.md) |
| Know every setting and which are secret | [docs/secrets.md](docs/secrets.md) |
| See how the project was planned (older, partly out of date) | [capstone/README.md](capstone/README.md) |
| Speed and limits | [PERFORMANCE.md](PERFORMANCE.md), [load-check.md](load-check.md) |
| Known bugs and what blocks a launch | [launch-blockers.md](launch-blockers.md), [NEXT.md](NEXT.md) |

## Read this first

**[Full project README: capstone/README.md](capstone/README.md)** (what it is, what works today, API reference, how to run and test)

Other starting points:
- [How the live site is set up](capstone/STAGING.md)
- [API developer index](apps/api/docs/INDEX.md)
- [AI audit for the Week 28 Weekend](apps/api/docs/AI_AUDIT_week_28_weekend.md)

Reviewing the Week 28 Weekend work? Look at the commits tagged `[Week 28 Weekend]`.

## How much of this has been tested

- **Tested on the author's laptop:** `./scripts/dev-up.sh` (refuses when a port is busy, starts both programs, stops both on Ctrl+C), the health check, the API tests and the isolation tests.
- **Followed step by step from a fresh clone (24 November 2026):** clone, install the three folders, build the database (`reset-db.sh` on a scratch database), settings files, `./scripts/dev-up.sh`, health check, signup and adding a product in the browser. This test found two mistakes in the first version of these steps (`WEB_ORIGIN` and the `/v1` ending of `NEXT_PUBLIC_API_URL`), which are now fixed above.
- **Not run on a truly clean machine:** it was a fresh clone on the author's own laptop, where the `rahisisha_user` role already existed, so step 2 (creating the role) was not executed.
- **Not tested:** real M-Pesa money (sandbox only), a real WhatsApp number, USSD on a real phone.

## Piece by piece (simple words)

**The quickstart** is the opening checklist of a kiosk: stock the shelves (database), put the key in the lock (settings), then open the shutter (dev-up).

**The diagram** is a map of a bus stage: customers arrive from the left, the API is the stage manager in the middle, and every matatu (request) is sent to exactly one shop's bay.

**Row-level security** is separate lockers for each shop, with the building's own lock on every locker, not just the shopkeeper's promise.

**The honest lists** (what works, what is not built, what was tested) are a shop's price board and "out of stock" sign: a customer trusts you more when you say what you do not have.
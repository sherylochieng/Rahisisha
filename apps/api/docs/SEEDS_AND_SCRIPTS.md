# Seeds and Scripts — One Map of Everything That Puts Data In or Rebuilds the Database

**File:** `apps/api/docs/SEEDS_AND_SCRIPTS.md`
**Added:** Week 29 Day 2 (docs tidy-up)

---

## WHY THIS FILE EXISTS

Seeds and helper scripts live in three folders. This is the one list that says what
each file does, which folder it belongs in, and how to run it.

## THE THREE FOLDERS (and the rule for each)

| Folder | What goes in it |
|--------|-----------------|
| `sql/seeds/` | SQL files only. Plain starter data, no code. Run with `\i` in psql. |
| `scripts/` (repo root) | Helper programs for the **whole repo**. |
| `apps/api/scripts/` | Helper programs that belong to the **API** and use its own code or `.env`. |

Rule of thumb for any future project:
1. Name the folder after the job: `migrations` (change table shapes), `seeds`
   (starter data), `scripts` (helper programs).
2. Keep things with the code they need. Plain SQL with the SQL. Anything that needs
   the app's code or `.env` next to the app.
3. Keep this one index up to date. Add a row whenever you add a seed or script.

## THE LIST

| File | What it does | Run with | Never |
|------|--------------|----------|-------|
| `scripts/reset-db.sh` | Deletes and rebuilds the local database from `sql/SCHEMA.sql`, checks the policy count (18), loads demo data | `bash scripts/reset-db.sh` from the repo root | on a database you cannot lose; never on production |
| `scripts/demo-data.sql` | Three demo shops with owners, products, customers and wallet money. Loaded automatically by `reset-db.sh` | (via `reset-db.sh`) | on production (public demo password) |
| `scripts/seed-capstone.js` | One complete demo shop with realistic data, in one transaction | `node scripts/seed-capstone.js` from the repo root | on production |
| `sql/seeds/ussd_configs_seed.sql` | Gives Amina and Brio their USSD service codes and welcome texts | in psql: `\i sql/seeds/ussd_configs_seed.sql` | with secrets in it |
| `sql/seeds/ussd_demo_data_seed.sql` | Demo products and wallet money for Amina and Brio, so the USSD menu has something to show | in psql: `\i sql/seeds/ussd_demo_data_seed.sql` | on production |
| `apps/api/scripts/seed-whatsapp-demo.js` | Gives Amina and Brio a FAKE WhatsApp number and a FAKE encrypted token | `cd apps/api` then `node scripts/seed-whatsapp-demo.js` | on production (it refuses) |

## ORDER FOR A FRESH LOCAL SETUP

1. `bash scripts/reset-db.sh` (empty database, schema, demo shops).
2. In psql: `\i sql/seeds/ussd_configs_seed.sql` and `\i sql/seeds/ussd_demo_data_seed.sql`.
3. Put `KMS_KEY` in `apps/api/.env`, then `node scripts/seed-whatsapp-demo.js`.

The tests do NOT need any of these. They create their own shops, so they also run on
GitHub CI.

## WHY SOME SEEDS ARE SQL AND ONE IS JAVASCRIPT

The USSD seeds insert plain data, so SQL is enough. The WhatsApp seed must encrypt a
token with `kms.js` and the secret `KMS_KEY`, which Postgres cannot do and which must
never be written into a committed SQL file.
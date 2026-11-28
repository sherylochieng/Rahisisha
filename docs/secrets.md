<!--
=============================================================================
FILE: docs/secrets.md  (Week 30 Day 2, Task 4)
=============================================================================

WHY THIS FILE EXISTS
  Every environment variable the project reads, in one place: what it does,
  where it is set, and whether it is rotated. Nobody should have to search the
  code to find out what `COOKIE_DOMAIN` means.

WHY IMPORTANT
  A missing or wrong variable fails in confusing ways (for example, logins
  that work but never stick). And a real secret committed to Git is public
  forever. This page prevents both.

DANGER
  - NEVER write a real value in this file. Examples below are fake.
  - Never commit a real `.env` file. Only the `.env.example` files are
    committed.
  - Losing `KMS_KEY` means every stored WhatsApp and M-Pesa key becomes
    unreadable. Keep a copy somewhere safe (a password manager).

WHAT IT SOLVES
  - A new developer can set up a working `.env` in 5 minutes.
  - A reviewer can see which values are secret and which are just settings.

SYSTEM DESIGN PRINCIPLE
  Configuration lives in the environment, not in the code. The same code runs
  on a laptop and on a server, and only the environment changes.

RULES
  1. Every variable the code reads is listed here. If you add a new one, add a
     row in the same commit.
  2. Real values are never written here, in chat, or in Git.
  3. "Secret" means: if it leaks, someone can hurt the shop or its customers.

WHERE USED
  Linked from the README (setup section) and from RUNBOOK.md.

TRADEOFFS
  + One page, easy to keep next to the code.
  - It is written by hand, so it can drift. The check at the bottom helps.
=============================================================================
-->

# Environment variables and secrets

**Last checked against the code:** 24 November 2026

**Where values live today:**
- **On your laptop:** in an `.env` file you create yourself (`apps/api/.env`,
  and `.env.local` or `.env` in `apps/web`). Git ignores these files (see
  `.gitignore`).
- **In Git:** only the `.env.example` files, with fake values.
- **On a server:** the project is not deployed yet. When it is, these are
  set in the host's environment settings, never in a file in the repo.

---

## 1. The API (`apps/api/.env`)

| Variable | Secret? | Required? | What it does | Example (fake) | Rotated? |
|---|---|---|---|---|---|
| `DATABASE_URL` | **Yes** (has the password) | Yes | The Postgres connection string. The app must log in as `rahisisha_user`, **not** a superuser, so the row-level security (RLS) walls between shops apply. | `postgresql://rahisisha_user:YOUR_PASSWORD@localhost:5432/rahisisha` | Change the database password when staff leave, then update here. No tool automates it. |
| `JWT_SECRET` | **Yes** | Yes | Signs the login cookie. Anyone who knows it can forge a login. | `a-long-random-string` | Changing it logs every user out (cookies last 7 days). No rotation schedule exists yet. |
| `KMS_KEY` | **Yes** | Yes, for WhatsApp and M-Pesa | 32 random bytes in base64 (44 characters). Encrypts each shop's WhatsApp token and M-Pesa keys before they are stored. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | `put-your-own-44-character-key-here` | **Not rotated.** Changing it makes stored keys unreadable, and there is no re-encrypt tool yet. See section 5. |
| `NODE_ENV` | No | No (defaults to development) | `production` turns on secure (https-only) cookies and only accepts `https` shop addresses. | `development` | No. |
| `PORT` | No | No (defaults to 3000) | The port the API listens on. | `3000` | No. |
| `WEB_ORIGIN` | No | No | The exact web address allowed to call the API from a browser (CORS). | `http://localhost:3001` | No. |
| `ROOT_DOMAIN` | No | No | Turns on shop addresses like `amina.yourdomain.com`. When empty, the app runs in laptop mode with no subdomains. | `localhost` or `rahisisha.co.ke` | No. |
| `COOKIE_DOMAIN` | No | No | Lets the login cookie work across shop subdomains (usually `.` plus the root domain). When empty, the cookie stays on one host. | `.rahisisha.co.ke` | No. |
| `DARAJA_API_BASE` | No | No | Overrides the Safaricom address. **Only for tests**, so they can talk to a fake. | `http://localhost:9999` | No. |
| `WHATSAPP_API_BASE` | No | No | Overrides Meta's address (default `https://graph.facebook.com`). For tests and fakes. | `https://graph.facebook.com` | No. |
| `WHATSAPP_API_VERSION` | No | No | The Meta API version (default `v21.0`). | `v21.0` | Update when Meta retires a version. |
| `NOTIFICATIONS_WORKER` | No | No (off unless `on`) | Turns on the background sender that empties the notifications outbox. With only the pretend `test` channel it marks messages sent without telling anyone. | `on` | No. |
| `NOTIFICATIONS_INTERVAL_SECONDS` | No | No (defaults to 15) | How often the sender checks the outbox. Limited to 5 to 600. | `15` | No. |

---

## 2. The web app (`apps/web`)

| Variable | Secret? | Required? | What it does | Example (fake) | Rotated? |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | **No.** It is sent to every visitor's browser. | Yes | The address of the API, **including `/v1`**. Never put a secret in a variable that starts with `NEXT_PUBLIC_`. | `http://localhost:3000/v1` | No. |
| `ROOT_DOMAIN` | No | No (defaults to `localhost`) | Used to build each shop's public link and to read the shop word from the address. Must match the API's `ROOT_DOMAIN`. | `localhost` | No. |

---

## 3. Scripts and tests only (not needed to run the app)

| Variable | Secret? | Used by | What it does |
|---|---|---|---|
| `DARAJA_SANDBOX_CONSUMER_KEY` | Yes | `apps/api/scripts/seed-daraja-demo.js` | Safaricom sandbox key. Comes from the Daraja developer portal. |
| `DARAJA_SANDBOX_CONSUMER_SECRET` | Yes | same | Safaricom sandbox secret. |
| `DARAJA_SANDBOX_PASSKEY` | Yes | same | Safaricom sandbox passkey. |
| `DARAJA_SANDBOX_SHORTCODE` | No | same | Sandbox shortcode (default `174379`). |
| `DARAJA_CALLBACK_BASE` | No | same | The public address Safaricom calls back (your ngrok address), with no path at the end. Changes each time ngrok restarts. |
| `NOTIFICATIONS_QUIET` | No | `apps/api/src/channels/testChannel.js` and tests | Set to `on` to silence the test channel's log line. The sender tests set it themselves. |
| `SHOP_SLUG` | No | `check-payment.js`, `diagnose-stk-query.js` | Which shop to check (default `aminas-boutique`). |
| `ADMIN_USER` / `ADMIN_PASSWORD` | **Yes** (password) | `scripts/reset-db.sh` | The Postgres administrator that may drop and create databases (default user `postgres`). |
| `APP_USER` / `APP_PASSWORD` | **Yes** (password) | `scripts/reset-db.sh` | The app's database login (default user `rahisisha_user`). |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | No | `scripts/reset-db.sh` | Where the database is (defaults `localhost`, `5432`, `rahisisha`). The script refuses any host other than localhost. |
| `RESET_DB_CONFIRM` | No | `scripts/reset-db.sh` | Type the database name here to allow a wipe without a prompt. **Never set it in your normal shell profile.** |
| `LOAD_PASSWORD_A` / `LOAD_PASSWORD_B` | **Yes** (practice passwords) | `apps/api/scripts/load-test-orders.js` | Passwords of the two demo shops for the load test. |

---

## 4. Secrets that are NOT environment variables

Each shop's own keys are stored **in the database, encrypted** with `KMS_KEY`:

- the shop's WhatsApp access token (table for WhatsApp settings), and
- the shop's M-Pesa consumer key, secret and passkey (table for Daraja
  settings).

They are decrypted only when the shop sends a message or starts a payment. If
the database is leaked without `KMS_KEY`, they stay unreadable.

---

## 5. Rotation: what is true today

- **No rotation process exists yet.** Nothing here is rotated on a schedule.
- **`JWT_SECRET`:** safe to change at any time. The only effect is that every
  user must log in again.
- **`KMS_KEY`:** **not safe to change.** Encrypted shop keys were locked with
  the old key. To rotate, a re-encrypt script is needed (decrypt with the old
  key, encrypt with the new). That script does not exist. This is listed as
  an idea, not a feature.
- **Database passwords:** change the password in Postgres, then update
  `DATABASE_URL` (and `APP_PASSWORD`) and restart.
- **If a secret leaked** (for example, pasted in a public place): treat it as
  burned. Replace it, restart, and for `JWT_SECRET` everyone is logged out.

---

## 6. Gaps found while writing this page

These are honest notes, to be fixed when the project is finished.

**Fixed on 24 November 2026** (found by following the README from a fresh
clone):

- `apps/api/.env.example` now lists `WEB_ORIGIN` and, commented out,
  `ROOT_DOMAIN` and `COOKIE_DOMAIN`, and shows the database user as
  `rahisisha_user` (a superuser **bypasses** row-level security).
- `apps/web/.env.example` now shows `NEXT_PUBLIC_API_URL` ending in `/v1`.

**Still open:**

- `apps/api/.env.example` does not list `SHOP_SLUG`, or the optional
  `WHATSAPP_*` and `DARAJA_API_BASE` variables.
- `apps/web/.env.example` does not list `ROOT_DOMAIN`.
- The root `.env.example` lists `REDIS_URL`, but no code reads it (Redis is
  not used yet).

---

## 7. Check that no real secret is committed

From the repo root, run:

```
git ls-files | Select-String "\.env"
```

Only `.env.example` files should appear. If a plain `.env` or `.env.local`
shows up, stop and remove it from Git before the next push.

<!--
=============================================================================
PIECE BY PIECE
=============================================================================
Secret?        : would a leak hurt someone? Real life: your house key (secret)
                 against your street name (not secret).
Required?      : will the app break without it? Real life: the shop cannot open
                 without the till key, but it can open without a radio.
Rotated?       : is it changed on a schedule? Real life: changing the shop's
                 locks every year.
NEXT_PUBLIC_   : Next.js sends any variable with this start to the visitor's
                 browser. So it must never hold a secret.
Section 4      : secrets kept in the database, locked with KMS_KEY. Real life:
                 valuables in a safe, where KMS_KEY is the safe's key.
Section 6      : known gaps, written honestly instead of hidden.
=============================================================================
-->
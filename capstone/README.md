# Rahisisha - Make Business Easy

![CI](https://github.com/sherylochieng/Rahisisha/actions/workflows/ci.yml/badge.svg)

> A multi-tenant SaaS platform that gives a small business its own online shop plus an AI team for marketing, customer conversations and sales.

**Live staging:** https://rahisishabiashara.com
**API:** https://api.rahisishabiashara.com (health check: `/health`)
**CI runs:** https://github.com/sherylochieng/Rahisisha/actions
**How the live site is set up:** [`capstone/STAGING.md`](STAGING.md)

**Reviewing the Week 28 Weekend work?** Look at the commits tagged `[Week 28 Weekend]` and read [`apps/api/docs/AI_AUDIT_week_28_weekend.md`](../apps/api/docs/AI_AUDIT_week_28_weekend.md).

**Reviewing the Week 29 Day 1 work (USSD per tenant)?** Look at the commits tagged `[Week 29 Day 1]`, read [`apps/api/docs/AI_AUDIT_week_29_day1.md`](../apps/api/docs/AI_AUDIT_week_29_day1.md) and [`ussd-quirks.md`](../ussd-quirks.md), and see "Try USSD locally" below.

## What is Rahisisha?

**Rahisisha** is a multi-tenant SaaS platform built for small product businesses in Kenya ... boutiques, dress shops, and informal sellers who currently run their entire business through WhatsApp manually. A customer messages "iko stock?", the owner replies by hand, sends an M-Pesa number, waits for confirmation, and updates stock in a notebook. Rahisisha replaces that entire loop with one signup: the owner uploads a product photo, the AI enhances it in the business's own brand colours and adds real text layers ,,price, name, logo ...then automatically announces it on WhatsApp. The AI answers customer questions from the real catalog, the M-Pesa STK push fires automatically when a customer taps Buy, stock updates itself, and the owner sees everything on one dashboard , without touching a single customer chat. Instagram and Facebook auto-posting are planned for the growth phase after the MVP launch.

The architecture is built around strict multi-tenancy enforced at two independent layers .... application code and PostgreSQL Row-Level Security , so a bug in one layer cannot leak one business's data to another. Every critical path has a corresponding test that runs in CI on every push: tenant isolation, last-item concurrency, and payment idempotency. The stack is Next.js 16, Express, PostgreSQL 16, Redis, BullMQ, Anthropic Claude API, M-Pesa Daraja, and WhatsApp Cloud API , all running on Docker Compose locally and deploying to a single VPS in Week 30.

Every shop gets its own address on the platform, like `mama-mboga.rahisishabiashara.com`. Many businesses share one database, but each business can only ever see its own data.

**Who it's for:** Solo owners, introverts and small startups who cannot afford separate marketing, social-media, sales and support staff but need all of them to grow.

**The first test business:** The founder's own dress shop.

---

## The full flow

```
Owner uploads product photo
        ↓
AI enhances photo in brand colours + adds real text layers (price, name, logo)
        ↓
Owner reviews and approves
        ↓
Storefront updates + WhatsApp announcement goes out automatically
        ↓
Customer sees the post, messages the WhatsApp bot
        ↓
AI answers from real catalog data (price, size, stock, delivery)
        ↓
Customer taps Buy → inventory reserved → M-Pesa STK push sent
        ↓
Customer enters PIN → Safaricom confirms server-side
        ↓
Stock decrements → order created → WhatsApp confirmation sent
        ↓
Owner opens dashboard → sees the sale, revenue, stock update
```

---

## Features

| Feature | Status | Built so far (12 Nov 2026) |
| --- | --- | --- |
| Branded storefront per business | P0 — Week 28 | Partly: every shop has its own address and a "shop not found" page. The public product page is not built yet |
| AI-enhanced product photos (real photo, real text layers) | P0 — Week 29 | Planned |
| Owner approval gate — nothing goes public without sign-off | P0 — Week 29 | Planned |
| WhatsApp announcement on product publish | P0 — Week 29 | Planned |
| AI chat assistant grounded in tenant catalog data only | P0 — Week 29 | Planned |
| In-chat M-Pesa payment link | P0 — Week 29 | Planned |
| Inventory reservation — prevents double-selling | P0 — Week 29 | Table is in the schema; the logic is planned |
| M-Pesa STK push + server-side callback confirmation | P0 — Week 29 | Planned |
| Owner dashboard — sales, revenue, stock, orders | P0 — Week 30 | Dashboard home is done (orders today, wallet balance, latest products). The list pages are planned |
| Multi-tenant isolation — Business A cannot see Business B's data | P0 — all weeks | Done and tested on all 16 tenant tables |
| Order tracking, ratings, AI advice, billing | P1 — Week 30 if time | Order status flow is done. Ratings, AI advice and billing are planned |
| USSD, Telegram, Instagram/TikTok auto-posting | P2 — after demo | USSD was brought into Week 29. Day 1 is done: `POST /ussd`, a per-shop menu and a cross-tenant test |

---

## What works today

- Sign up a business. It creates the shop, the owner, and 3 sample products and 2 sample customers.
- Log in. The shop is found from the address, and the login cookie works across shop addresses.
- Per-shop subdomains, with a friendly page for unknown shops.
- Products API: create, list with cursor pagination, read, update, soft delete.
- Orders API: create in a transaction, list, read, status changes through a state machine.
- Wallet ledger: append-only, balance is a sum and is never stored.
- Dashboard home.
- Friendly 503 when the database is down; loading and error states in the web app.
- **USSD per shop (Week 29 Day 1):** one shared `POST /ussd` endpoint. The shop is found from the dialled service code, never from the phone number. Menu: welcome, 1 View products, 2 Check balance, 3 Exit. Every reply is 182 characters or less.
- Unknown URLs answer with a JSON 404, like every other error (not an HTML page).
- Signup form errors appear under the wrong field; signup is all-or-nothing (a failed seeding leaves no shop or owner behind).
- Tenant isolation proven by a test suite, continuous integration against real PostgreSQL, and a staging deploy.

## Known gaps (honest list)

- There is **no customers endpoint** yet (`/v1/customers`), and the products, orders and customers list pages in the dashboard are not built (the menu shows them as "soon"). The 2 sample customers created at signup therefore have no page to appear on.
- There is **no public storefront page** for customers yet.
- M-Pesa, WhatsApp, AI photo enhancement and background jobs are planned for Week 29 and later.
- Login and signup errors still use the older `{ "error": "text" }` shape.
- USSD was tested with `curl` and automated tests, **not yet with the Africa's Talking simulator**. The menu is one level deep: no back key, no paging, no `ussd_events` log, no idle timeout (the stretch goals).

The full list, with reasons, is in [`capstone/PENDING_TASKS.md`](PENDING_TASKS.md).

## Try it live

1. Open https://rahisishabiashara.com and **sign up** a new shop. It comes with sample products.
2. You are sent to your own address, `https://<your-shop-word>.rahisishabiashara.com`, and the dashboard.
3. The free API server sleeps after 15 minutes without visits, so **the first request can take about a minute**.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend / Dashboard | Next.js 16 (App Router, JavaScript) |
| Backend API | Express + Node.js (JavaScript) |
| Database | PostgreSQL with Row-Level Security |
| Sessions & queues | Redis + BullMQ |
| AI chat & advice | Anthropic Claude SDK |
| Photo enhancement | Image API (TBD — testing 2–3 providers) |
| Payments | M-Pesa Daraja STK Push |
| Messaging | WhatsApp Cloud API (Meta) |
| Local dev | Docker Compose |
| CI/CD | GitHub Actions |
| Shared types | mctaba-shared-types (git submodule) |
| Tests | Jest (ESM) + supertest, against real PostgreSQL |
| Staging hosting | Render (API), Vercel (web), Neon (database) |

---

## How to run locally

```bash
# 1. Clone the repo (with submodules)
git clone --recurse-submodules https://github.com/sherylochieng/rahisisha.git
cd rahisisha

# 2. Copy environment variables
cp .env.example .env
# Fill in your values — see .env.example for what each variable does
# (the API also has apps/api/.env.example, the web app apps/web/.env.example)

# 3. Start Postgres + Redis
docker-compose up -d
# (or use a PostgreSQL you already run on your machine)

# 4. Load the schema
psql -U rahisisha_user -d rahisisha -f sql/SCHEMA.sql
# NOTE: this works on a database that rahisisha_user OWNS, which is how the
# reset script below creates it. On an older database owned by someone
# else, use the reset script, or load the schema as the admin user.

# 5. Seed demo data
node scripts/seed-capstone.js

# 6. Start the API (Week 28+)
cd apps/api && npm install && npm run dev
# Runs on http://localhost:3000

# 7. Start the dashboard (new terminal, Week 28+)
cd apps/web && npm install && npm run dev
# Runs on http://localhost:3001
```

Demo tenant created by the seed script:
- **Login:** +254700000001 / Demo1234!
- **Business:** Amina's Boutique (5 products, 3 customers, 2 orders)

### Rebuild the local database from scratch

```bash
DB_NAME=rahisisha ADMIN_USER=postgres ADMIN_PASSWORD=<your-postgres-password> \
APP_PASSWORD=<password-for-rahisisha_user> bash scripts/reset-db.sh
```

One-time setup: the app user must already exist, for example `psql -U postgres -c "CREATE ROLE rahisisha_user LOGIN PASSWORD '<password>';"`.

`scripts/reset-db.sh` drops the database, recreates it (owned by `rahisisha_user`), loads `sql/SCHEMA.sql`, checks that all the Row-Level Security policies are present, and loads `scripts/demo-data.sql` if it is there. It **refuses to run against anything but a local database** and asks you to type the database name to confirm. Use Git Bash on Windows. Demo data is in `scripts/demo-data.sql` and is safe to run twice.

The app must connect as an ordinary database user (`rahisisha_user`), never a superuser, otherwise the Row-Level Security locks do nothing.

### Try USSD locally

Load the two USSD demo shops (run inside `psql`, connected as `rahisisha_user`):

```
\i sql/seeds/ussd_configs_seed.sql
\i sql/seeds/ussd_demo_data_seed.sql
```

Start the API (`cd apps/api && npm run dev`), then pretend to be Africa's Talking. On Windows use `curl.exe`:

```bash
# Amina's Boutique (*384*101#), first screen
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=s1" -d "phoneNumber=+254700000001" -d "text="
# Brio Hardware (*384*102#), press 1 (products)
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*102#" -d "sessionId=s2" -d "phoneNumber=+254700000001" -d "text=1"
# A code nobody owns -> END Service unavailable
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*999#" -d "sessionId=s3" -d "phoneNumber=+254700000001" -d "text="
```

Replies are plain text starting with `CON ` (the session stays open) or `END ` (it closes). Note the same phone number is used for both shops: the shop comes from the service code only.

### Run the tests

```bash
cd apps/api
npm test                 # everything (19 suites, 168 tests)
npm run test:isolation   # only the tenant isolation suites (89 tests)
```

The isolation suite attacks every tenant table as a second shop and expects to read, change and delete nothing. A Husky `pre-push` hook runs it before every push, and CI runs the full suite against a real PostgreSQL on every push: https://github.com/sherylochieng/Rahisisha/actions

---

## API reference

Base URL: `http://localhost:3000/v1` locally, `https://api.rahisishabiashara.com/v1` on staging.

Success replies look like `{ "data": ..., "error": null }`. Validation failures look like:

```json
{ "error": { "code": "validation", "message": "Request validation failed", "details": { "priceCents": "Expected number, received string" } } }
```

| Method | URL | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/health` | none | Returns `{"status":"ok"}` |
| POST | `/v1/signup` | none | Create a shop and its owner account |
| POST | `/v1/login` | none | Log in; sets an httpOnly cookie |
| GET | `/v1/me` | cookie | The logged-in user's profile |
| GET | `/v1/tenants/by-slug/:slug` | none | Find an active shop by its address word (404 if unknown) |
| GET | `/v1/dashboard` | cookie | Orders today, wallet balance, latest products |
| GET | `/v1/products` | cookie | List products (cursor pagination: `?cursor=`) |
| POST | `/v1/products` | cookie | Create a product |
| GET | `/v1/products/:id` | cookie | Read one product |
| PATCH | `/v1/products/:id` | cookie | Update a product |
| DELETE | `/v1/products/:id` | cookie | Soft delete a product |
| POST | `/v1/orders` | cookie | Create an order (transaction) |
| GET | `/v1/orders` | cookie | List orders (cursor pagination) |
| GET | `/v1/orders/:id` | cookie | Read one order |
| PATCH | `/v1/orders/:id` | cookie | Change order status (illegal moves return 409) |
| POST | `/ussd` | service code | USSD for every shop. **Not under `/v1`**: it is the callback URL for Africa's Talking. Takes form data (`serviceCode`, `sessionId`, `phoneNumber`, `text`) and replies in plain text (`CON ...` or `END ...`, 182 characters at most) |

Status codes: 400 validation or malformed id, 401 not logged in, 404 not found (including another shop's record, and any URL that matches no route, which answers `{ "data": null, "error": { "code": "not_found", "message": "Route not found" } }`), 409 conflict, 500 unexpected, 503 database unreachable.

Details for each route are in [`apps/api/docs/endpoints/`](../apps/api/docs/endpoints/) and the file-by-file guides in [`apps/api/docs/INDEX.md`](../apps/api/docs/INDEX.md). The full planned API (35 endpoints) is in [`capstone/api.md`](api.md).

---

## Repo Structure

```
rahisisha/
  apps/
    web/              Next.js dashboard and public storefronts
    api/              Express REST API and webhooks
                        src/, tests/, docs/ (guides, AI audits, endpoints)
    workers/          BullMQ background jobs
  packages/
    db/               Database migrations and connection pool
    types/            Shared Zod schemas
    shared-types/     mctaba-shared-types submodule
  infra/
    nginx/            Reverse proxy config
    docker-compose.yml
  capstone/           Architecture and planning docs, STAGING.md, PENDING_TASKS.md
  sql/
    migrations/       23 numbered migration files (001-023)
    SCHEMA.sql        Full combined schema
    seeds/            Seed files (USSD service codes, and demo products and wallet for the two USSD shops)
  scripts/            reset-db.sh, demo-data.sql, seed-capstone.js and utilities
  .github/workflows/  ci.yml, the CI pipeline
  docs/               API reference and build plan
```

Folders such as `workers/`, `packages/` and `infra/` are scaffolds for later weeks.

---

## Project documents

| Document | Purpose |
| --- | --- |
| [`capstone/SPEC.md`](SPEC.md) | One-page product spec — tenant, core actions, monetisation, anti-scope |
| [`capstone/ROADMAP.md`](ROADMAP.md) | Four-week day-by-day build roadmap |
| [`capstone/api.md`](api.md) | All 35 API endpoints with method, URL, and error codes |
| [`capstone/api-versioning.md`](api-versioning.md) | API versioning decisions and rules |
| [`capstone/WILL_NOT_BUILD.md`](WILL_NOT_BUILD.md) | 12 explicit MVP exclusions |
| [`capstone/stories.md`](stories.md) | 18 user stories grouped by role |
| [`capstone/tables.md`](tables.md) | All 20 database tables with one-line purposes |
| [`capstone/indexes.md`](indexes.md) | Every index and the query it supports |
| [`capstone/isolation-models.md`](isolation-models.md) | Three multi-tenancy models compared |
| [`capstone/adr/ADR-0003-isolation.md`](adr/ADR-0003-isolation.md) | Multi-tenancy isolation decision record |
| [`docs/API.md`](../docs/API.md) | Full API spec with request/response shapes |
| [`docs/PLAN.md`](../docs/PLAN.md) | Day by day build plan for Weeks 28-30 |
| [`AI_AUDIT.md`](../AI_AUDIT.md) | Weekly AI usage audit log |
| [`capstone/STAGING.md`](STAGING.md) | How the live staging site is set up, settings, troubleshooting |
| [`capstone/PENDING_TASKS.md`](PENDING_TASKS.md) | What is left to do, in priority order |
| [`apps/api/docs/INDEX.md`](../apps/api/docs/INDEX.md) | Developer index of the API: structure, patterns, tests |
| [`apps/api/docs/tests/isolation-proof.md`](../apps/api/docs/tests/isolation-proof.md) | Evidence that every tenant table is locked |
| [`apps/api/docs/AI_AUDIT_week_28_weekend.md`](../apps/api/docs/AI_AUDIT_week_28_weekend.md) | AI audit for the Week 28 Weekend work |
| [`apps/api/docs/AI_AUDIT_week_29_day1.md`](../apps/api/docs/AI_AUDIT_week_29_day1.md) | AI audit for Week 29 Day 1 (USSD). States openly that tenant resolution was AI-written |
| [`ussd-quirks.md`](../ussd-quirks.md) | Short notes on USSD rules: the 182 character limit, the back key, CON vs END |
| [Trello Board](https://trello.com/b/CB8yGexS/rahisisha-capstone-sprint) | Sprint task board — Weeks 28–30 |

---

## Multi-tenancy & security

Every business's data is completely invisible to every other business — not just by application code, but enforced at the database level with PostgreSQL Row-Level Security. A bug in the application layer cannot cause a data leak because the database itself refuses to return another tenant's rows.

The three tests that must always pass:
- **Tenant isolation** — Business A cannot fetch, update or delete Business B's records
- **Inventory concurrency** — two simultaneous buyers cannot both claim the last item
- **Payment idempotency** — a repeated M-Pesa callback cannot create a duplicate order

These run in CI on every push. A failing test blocks the deploy.

Also in place since Week 28:
- **Login cookie:** httpOnly, `Secure` in production, `SameSite=Strict`, shared across shop addresses through a cookie domain.
- **CORS:** the main site and every shop address are allowed by a rule; look-alike domains such as `evilrahisishabiashara.com` are refused.
- **The app connects as an ordinary database user**, never a superuser.

Also in place since Week 29 Day 1 (USSD):
- **The shop comes from the service code**, never from the phone number (one phone can shop at many shops, and numbers can be faked). After that, USSD uses the same `withTenant` lock as every web route.
- **`ussd_configs` has no RLS, on purpose**: the shop must be found before it is known. It holds only public data (service code, shop id, welcome line) and is listed as a documented exception in `apps/api/docs/tests/isolation-proof.md`.
- **`tests/isolation/ussd.cross-tenant.test.js`** proves dialling shop A never shows shop B's welcome, products or balance, even by product id.

---

## Week 27 Status

Architecture and design week complete. No production code yet.

- ✅ Full database schema — 20 tables, RLS on all tenant-owned tables
- ✅ API designed — 35 endpoints documented before any code written
- ✅ Repo scaffolded — monorepo with package.json in each service folder
- ✅ Demo data — seed script creates Amina's Boutique end to end
- ✅ Decisions documented — ADRs for every major architectural choice
- ✅ Git submodule — mctaba-shared-types linked as packages/shared-types
- ✅ Week 28 — multi-tenant core + auth (see below)

## Week 28 Status

- ✅ Multi-tenant core: Row-Level Security on 16 tables, tenant context on every request
- ✅ Auth: signup, login, `/me`, login cookie across shop addresses
- ✅ Products and orders APIs, cursor pagination, order state machine
- ✅ Wallet ledger (append-only)
- ✅ Dashboard home
- ✅ Isolation suite (81 tests) and 141 tests in total
- ✅ Weekend polish: friendly 503, loading and error states, signup sample data, `reset-db.sh`, `demo-data.sql`
- ✅ CI green on real PostgreSQL
- ✅ Staging live at https://rahisishabiashara.com

## Week 29 Status

- ✅ Day 1: USSD per tenant
  - `ussd_configs` table (migration 023) and two seeded service codes (`*384*101#` Amina's Boutique, `*384*102#` Brio Hardware)
  - `POST /ussd`: `resolveUssdTenant` guard, then `withTenant`, then the menu (1 products, 2 balance, 3 exit)
  - Cross-tenant test (8 checks) and `ussd-quirks.md`
  - AI audit (`AI_AUDIT_week_29_day1.md`), including the honest note that the tenant lookup was AI-written
- ✅ Reviewer fixes done the same day: JSON 404 for unknown URLs, signup errors under each field, and a test that signup is all-or-nothing
- ✅ 19 suites, 168 tests passing; CI green

---

**Tagline:** Make business easy.
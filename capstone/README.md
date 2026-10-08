# Rahisisha - Make Business Easy

> A multi-tenant SaaS platform that gives a small business its own online shop plus an AI team for marketing, customer conversations and sales.

## What is Rahisisha?

**Rahisisha** is a multi-tenant SaaS platform built for small product businesses in Kenya ... boutiques, dress shops, and informal sellers who currently run their entire business through WhatsApp manually. A customer messages "iko stock?", the owner replies by hand, sends an M-Pesa number, waits for confirmation, and updates stock in a notebook. Rahisisha replaces that entire loop with one signup: the owner uploads a product photo, the AI enhances it in the business's own brand colours and adds real text layers ,,price, name, logo ...then automatically announces it on WhatsApp. The AI answers customer questions from the real catalog, the M-Pesa STK push fires automatically when a customer taps Buy, stock updates itself, and the owner sees everything on one dashboard , without touching a single customer chat. Instagram and Facebook auto-posting are planned for the growth phase after the MVP launch.

The architecture is built around strict multi-tenancy enforced at two independent layers .... application code and PostgreSQL Row-Level Security , so a bug in one layer cannot leak one business's data to another. Every critical path has a corresponding test that runs in CI on every push: tenant isolation, last-item concurrency, and payment idempotency. The stack is Next.js 16, Express, PostgreSQL 16, Redis, BullMQ, Anthropic Claude API, M-Pesa Daraja, and WhatsApp Cloud API , all running on Docker Compose locally and deploying to a single VPS in Week 30.

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

| Feature | Status |
| --- | --- |
| Branded storefront per business | P0 — Week 28 |
| AI-enhanced product photos (real photo, real text layers) | P0 — Week 29 |
| Owner approval gate — nothing goes public without sign-off | P0 — Week 29 |
| WhatsApp announcement on product publish | P0 — Week 29 |
| AI chat assistant grounded in tenant catalog data only | P0 — Week 29 |
| In-chat M-Pesa payment link | P0 — Week 29 |
| Inventory reservation — prevents double-selling | P0 — Week 29 |
| M-Pesa STK push + server-side callback confirmation | P0 — Week 29 |
| Owner dashboard — sales, revenue, stock, orders | P0 — Week 30 |
| Multi-tenant isolation — Business A cannot see Business B's data | P0 — all weeks |
| Order tracking, ratings, AI advice, billing | P1 — Week 30 if time |
| USSD, Telegram, Instagram/TikTok auto-posting | P2 — after demo |

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

---

## How to run locally

```bash
# 1. Clone the repo (with submodules)
git clone --recurse-submodules https://github.com/sherylochieng/rahisisha.git
cd rahisisha

# 2. Copy environment variables
cp .env.example .env
# Fill in your values — see .env.example for what each variable does

# 3. Start Postgres + Redis
docker-compose up -d

# 4. Load the schema
psql -U rahisisha_user -d rahisisha -f sql/SCHEMA.sql

# 5. Seed demo data
node scripts/seed-capstone.js

# 6. Start the API (Week 28+)
cd apps/api && npm install && npm run dev
# Runs on http://localhost:4000

# 7. Start the dashboard (new terminal, Week 28+)
cd apps/web && npm install && npm run dev
# Runs on http://localhost:3000
```

Demo tenant created by the seed script:
- **Login:** +254700000001 / Demo1234!
- **Business:** Amina's Boutique (5 products, 3 customers, 2 orders)

---

## Repo Structure

```
rahisisha/
  apps/
    web/              Next.js dashboard and public storefronts
    api/              Express REST API and webhooks
    workers/          BullMQ background jobs
  packages/
    db/               Database migrations and connection pool
    types/            Shared Zod schemas
    shared-types/     mctaba-shared-types submodule
  infra/
    nginx/            Reverse proxy config
    docker-compose.yml
  capstone/           Architecture and planning docs
  sql/
    migrations/       20 numbered migration files (001-020)
    SCHEMA.sql        Full combined schema
  scripts/            Seed script and utilities
  docs/               API reference and build plan
```

---

## Project documents

| Document | Purpose |
| --- | --- |
| [`capstone/SPEC.md`](capstone/SPEC.md) | One-page product spec — tenant, core actions, monetisation, anti-scope |
| [`capstone/ROADMAP.md`](capstone/ROADMAP.md) | Four-week day-by-day build roadmap |
| [`capstone/api.md`](capstone/api.md) | All 35 API endpoints with method, URL, and error codes |
| [`capstone/api-versioning.md`](capstone/api-versioning.md) | API versioning decisions and rules |
| [`capstone/WILL_NOT_BUILD.md`](capstone/WILL_NOT_BUILD.md) | 12 explicit MVP exclusions |
| [`capstone/stories.md`](capstone/stories.md) | 18 user stories grouped by role |
| [`capstone/tables.md`](capstone/tables.md) | All 20 database tables with one-line purposes |
| [`capstone/indexes.md`](capstone/indexes.md) | Every index and the query it supports |
| [`capstone/isolation-models.md`](capstone/isolation-models.md) | Three multi-tenancy models compared |
| [`capstone/adr/ADR-0003-isolation.md`](capstone/adr/ADR-0003-isolation.md) | Multi-tenancy isolation decision record |
| [`docs/API.md`](docs/API.md) | Full API spec with request/response shapes |
| [`docs/PLAN.md`](docs/PLAN.md) | Day by day build plan for Weeks 28-30 |
| [`AI_AUDIT.md`](AI_AUDIT.md) | Weekly AI usage audit log |

---

## Multi-tenancy & security

Every business's data is completely invisible to every other business — not just by application code, but enforced at the database level with PostgreSQL Row-Level Security. A bug in the application layer cannot cause a data leak because the database itself refuses to return another tenant's rows.

The three tests that must always pass:
- **Tenant isolation** — Business A cannot fetch, update or delete Business B's records
- **Inventory concurrency** — two simultaneous buyers cannot both claim the last item
- **Payment idempotency** — a repeated M-Pesa callback cannot create a duplicate order

These run in CI on every push. A failing test blocks the deploy.

---

## Week 27 Status

Architecture and design week complete. No production code yet.

- ✅ Full database schema — 20 tables, RLS on all tenant-owned tables
- ✅ API designed — 35 endpoints documented before any code written
- ✅ Repo scaffolded — monorepo with package.json in each service folder
- ✅ Demo data — seed script creates Amina's Boutique end to end
- ✅ Decisions documented — ADRs for every major architectural choice
- ✅ Git submodule — mctaba-shared-types linked as packages/shared-types
- ⏳ Week 28 — multi-tenant core + auth starts Monday

---

**Tagline:** Make business easy.
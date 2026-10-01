# Rahisisha — Make Business Easy

> A multi-tenant SaaS platform that gives a small business its own online shop plus an AI team for marketing, customer conversations and sales.

## What is Rahisisha?

Small business owners in Kenya do the work of three people they cannot afford to hire a marketer, a social media manager, and a customer service person. The result is inconsistent content, slow replies, double-selling, and no clear view of the business.

Rahisisha fixes that in one signup.

The owner uploads a product. Rahisisha enhances the real photo in the business's brand colours, publishes a branded storefront, announces new items on WhatsApp, answers customer questions from the real catalog, accepts M-Pesa payments, keeps stock accurate across every channel, and reports results on one dashboard without the owner touching a single customer chat.

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

---

## How to run locally

```bash
# 1. Clone the repo
git clone https://github.com/sherylochieng/rahisisha.git
cd rahisisha

# 2. Copy environment variables
cp .env.example .env
# Fill in your values — see docs/secrets.md for what each variable does

# 3. Start Postgres + Redis
docker-compose up -d

# 4. Load the schema
psql -U rahisisha_user -d rahisisha -f sql/SCHEMA.sql

# 5. Seed demo data (two tenants for isolation testing)
node scripts/seed-demo.js

# 6. Start the backend
cd server && npm install && npm run dev

# 7. Start the frontend (new terminal)
cd app && npm install && npm run dev

# 8. Open the dashboard
# http://localhost:3000
```

---

## Project documents

| Document | Purpose |
| --- | --- |
| [`capstone/SPEC.md`](capstone/SPEC.md) | One-page product spec — tenant, core actions, monetisation, anti-scope |
| [`capstone/ROADMAP.md`](capstone/ROADMAP.md) | Four-week day-by-day build roadmap |
| [`capstone/WILL_NOT_BUILD.md`](capstone/WILL_NOT_BUILD.md) | 12 explicit MVP exclusions |
| [`capstone/stories.md`](capstone/stories.md) | 18 user stories grouped by role |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, multi-tenancy, data model |
| [`docs/API.md`](docs/API.md) | Full API spec with request/response shapes |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture Decision Records (ADR-001 to ADR-019) |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Deployment, incident response, recovery |
| [`AI_AUDIT.md`](AI_AUDIT.md) | Weekly AI usage audit log |

---

## Multi-tenancy & security

Every business's data is completely invisible to every other business — not just by application code, but enforced at the database level with PostgreSQL Row-Level Security. A bug in the application layer cannot cause a data leak because the database itself refuses to return another tenant's rows.

The three tests that must always pass:
- **Tenant isolation** — Business A cannot fetch, update or delete Business B's records
- **Inventory concurrency** — two simultaneous buyers cannot both claim the last item
- **Payment idempotency** — a repeated M-Pesa callback cannot create a duplicate order

These run in CI on every push. A failing test blocks the deploy.


**Tagline:** Make business easy.
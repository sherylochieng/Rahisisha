# Rahisisha — Four-Week Capstone Roadmap

The full Phase 0(P0) flow MUST work end-to-end before the next
P2 features (USSD, Telegram, social auto-posting) are only attempted 

##Here is the roadmap fo rahisisha

## Week 27 — Architecture, schema, API design, repo setup

- **Day 1:** Pick vertical, write SPEC, user stories, roadmap, anti-scope, rough 20–30 task backlog
- **Day 2:** Choose multi-tenancy pattern, write ADR-0003, RLS migrations preview
- **Day 3:** Full `SCHEMA.sql` — every table, `tenant_id` on all, RLS enabled on all, smoke test with two tenants
- **Day 4:** Full API spec — every endpoint, method, body, response shape, error codes, pagination, versioning notes
- **Day 5:** Repo scaffold — all service folders with `package.json` + `Dockerfile`, `docker-compose.yml`, GitHub milestones + issues, `docs/PLAN.md`
- **Weekend:** Re-read all design docs, write README pitch, draft 3-minute cohort presentation

**Deliverables:** `ARCHITECTURE.md`, `SCHEMA.sql`, `API.md`, `DESIGN.md`, repo scaffold, 20–30 task backlog

**Gate:** Repo exists, schema loads clean on a fresh Postgres, API doc is complete, clear day-by-day plan for Weeks 28–30.

---

## Week 28 — Multi-tenant core + auth

- **Day 1:** Tenant signup — one transaction: user + tenant + brand settings + membership + wallet
- **Day 2:** Auth middleware + RLS context middleware (`SET LOCAL app.current_tenant`); first protected endpoint returns only the current tenant's data with no explicit filter
- **Day 3:** Products + variants CRUD (Zod validation, status state machine); Orders CRUD with stock deduction inside transaction
- **Day 4:** Wallet ledger (append-only rows, balance by sum); full isolation test suite — every tenant-owned table × 3 cross-tenant attacks
- **Day 5:** Next.js dashboard shell — sidebar, overview page with real SQL numbers, pre-push hook blocks on isolation test failure
- **Weekend:** Polish — loading/empty states, demo data seed, CI green, deploy to staging

**Deliverables:** Signup flow, auth + RLS middleware, products/orders/wallet, isolation test suite, dashboard shell

**Gate:** Two tenants are fully isolated end-to-end. Isolation test passes in CI. The demo script runs without manual fixes.

---

## Week 29 — Integrations: photo enhancement, AI chat, WhatsApp, M-Pesa

- **Day 1:** Photo enhancement — owner uploads real photo, AI enhances it in brand colours, real text layers added (price, name, logo), owner approval gate, original always retained
- **Day 2:** AI chat assistant — grounded on tenant catalog data only via named read-only tool functions; guardrails run after every reply; prompt-injection defense
- **Day 3:** WhatsApp per tenant — webhook routes by `phone_number_id`, encrypted token per tenant, dedup on `message_id`, in-chat M-Pesa payment link
- **Day 4:** M-Pesa checkout — STK push, server-side callback only, idempotent processing, wallet credited in one transaction, stock decrements on confirmed payment
- **Day 5:** Unified dashboard inbox + payments page; two-tenant end-to-end demo recorded; tag `v0.29.0`
- **Weekend:** Stability sprint — 10× full demo runs, isolation tests, load test, backup/restore test

**Deliverables:** Photo enhancement + approval, AI chat + guardrails, WhatsApp adapter, M-Pesa checkout, unified inbox, end-to-end demo

**Gate:** A customer can ask about a product, pay via M-Pesa, receive a WhatsApp confirmation, and the owner sees the order and wallet update in the dashboard — for two separate tenants with zero data bleed.

---

## Week 30 — Testing, documentation, deploy, demo day

- **Day 1:** Full test suite green; manual QA plan (25+ cases executed); bug triage with severity labels; load spot-check
- **Day 2:** `README.md` (10-minute onboarding), `RUNBOOK.md` (5 real incidents with concrete steps), API reference with curl examples, secrets doc
- **Day 3:** Production deploy — real domain, TLS (wildcard via Let's Encrypt), uptime monitoring, Sentry error tracking, daily Postgres backups + restore test
- **Day 4:** Demo rehearsed 3× timed; story outline; fallback recording; slide deck (10–12 slides); freeze code at `v1.0.0-rc1`
- **Day 5:** Demo day — 5-minute live demo, Q&A, `v1.0.0` tag + push, release notes, marathon retrospective (800–1,200 words, zero AI)
- **Weekend:** Rest. Post-mortem. Update CV and LinkedIn. Thank the cohort.

**Deliverables:** Green test suite, QA plan, README + RUNBOOK + API reference, production deploy, demo, `v1.0.0` tag, retrospective

**Gate:** The 5-minute demo succeeds from a clean environment, three times in a row, with no manual fixes, on live production infrastructure. Business A cannot access Business B's data. The last-item concurrency test passes.

---

## Explicitly out of MVP (do not start until after the P0 gate passes)

- USSD owner menu (P2 stretch)
- Telegram channel (P2 stretch)
- Live Instagram / Facebook / TikTok auto-posting (roadmap)
- SMS receipts and delivery updates (P2 stretch)
- Staff accounts UI
- Multi-language interface
- Multi-currency
- Marketplace across businesses
- Native mobile apps
- Custom tenant domains
- Ad management
- Automated refunds
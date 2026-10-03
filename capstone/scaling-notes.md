# Scaling Notes - Multi-Tenancy

When does the shared schema + RLS decision get revisited, and what are the signals?

---

## At what tenant count do we reconsider?

The shared schema model works comfortably up to **hundreds of tenants** on a single
Postgres server. We do not need to reconsider it for the capstone demo (1–5 tenants)
or the early product launch (up to ~100 tenants).

The signal to reconsider is not a specific number , it is a specific symptom:

> Query times for a specific tenant's tables consistently exceed 200ms under normal
> load, even after adding the right indexes.

When that happens, it means one tenant's data volume or query patterns are starting
to strain the shared system. That is the moment to evaluate per-tenant isolation
options for that specific tenant , not for everyone at once.

---

## What is the noisy neighbour problem?

Imagine 50 businesses sharing one database. One of them - a very busy boutique -
starts running thousands of queries per minute during a flash sale.

That one tenant is now consuming a large share of the database's CPU and memory.
The other 49 tenants start seeing slow responses - even though they did nothing
wrong. That is the **noisy neighbour problem**: one tenant's behaviour hurts
everyone else.

**How we manage it in Rahisisha:**
- Per-tenant rate limits at the API middleware level (limits how many requests
  one tenant can make per minute)
- Query timeouts (any single query that runs longer than 5 seconds is killed)
- Usage caps per subscription plan (Starter = 1,000 AI messages/month — this
  also limits database load)
- Monitoring and alerting when one tenant's query volume spikes

---

## What signals push us toward schema-per-tenant?

| Signal | What it means |
| --- | --- |
| One tenant generates 10× the query load of all others combined | Noisy neighbour is real and affecting other tenants |
| Query times for all tenants degrade despite good indexes | The shared tables are too large for one server |
| A specific tenant's contract requires query isolation | Legal or SLA requirement, not just performance |
| We need to run maintenance on one tenant without affecting others | Operational need for isolation |

---

## What signals push us toward database-per-tenant?

| Signal | What it means |
| --- | --- |
| A regulated business signs up (SACCO, hospital, insurance) | Kenya law or their contract requires physical data separation |
| A tenant is acquired or needs to be migrated to their own infrastructure | Business requirement |
| A data breach in one tenant must be guaranteed not to affect others | Security requirement beyond what RLS provides |
| Kenya Data Protection Act enforcement requires data residency per tenant | Legal requirement |

---

## The scaling path we planned (PRD Section 13)

| Stage | Approximate size | Architecture |
| --- | --- | --- |
| MVP | Up to ~100 tenants | One server + Docker Compose + PostgreSQL |
| Growth | Hundreds of tenants | Managed Postgres + read replica + CDN |
| Scale | Thousands of tenants | Extract services + partition queues + consider tenant sharding |

The code already has module boundaries, provider interfaces and background queues
so later extraction happens around existing seams — not a full rewrite.

---

## The one rule

> Scale when you feel the pain — not before. Premature optimization is the
> biggest waste of time in early-stage product development. Build for today's
> scale, design for tomorrow's, and migrate when the numbers demand it.
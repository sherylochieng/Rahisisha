# Multi-Tenancy Isolation Models - Comparison

This document compares the three main patterns for isolating tenant data in a
multi-tenant SaaS. Written before choosing a pattern, based on the Mctaba Labs
Week 27 notes and three external articles.

---

## The three models

### Model 1 — Shared database, shared schema (row-level isolation)

Every tenant's data lives in the same tables. Each row has a `tenant_id` column
that identifies which business it belongs to. Every query must filter by `tenant_id`.
PostgreSQL Row-Level Security (RLS) can be added as a second enforcement layer.

| Dimension | Detail |
| --- | --- |
| **Isolation** | Logical only — enforced by application code + RLS policies |
| **Setup cost** | Very low — standard tables, no special provisioning per tenant |
| **Migration cost** | Very low — one migration changes all tenants at once |
| **Ops complexity** | Very low — one database to back up, monitor, and restore |
| **Scaling** | Works well up to hundreds of tenants on one server; partition or shard later |
| **Data leak risk** | Medium — a missing `WHERE tenant_id = $1` exposes all tenants' data; RLS mitigates this |
| **Cross-tenant queries** | Easy — useful for platform-level analytics |
| **Tenant-level restore** | Hard — restoring one tenant from a backup is complex |
| **Compliance** | May not satisfy customers who require physical data separation |

**Best for:** Early-stage SaaS with 1–500 tenants where speed of development matters
more than physical isolation.

---

### Model 2 — Shared database, separate schema per tenant

One PostgreSQL database, but each tenant gets their own schema
(e.g. `tenant_amina.products`, `tenant_brian.products`). The application switches
the `search_path` to the right schema per request.

| Dimension | Detail |
| --- | --- |
| **Isolation** | Strong logical isolation — schemas are separate namespaces |
| **Setup cost** | Medium — must provision a schema + run migrations for every new tenant |
| **Migration cost** | High — a schema change must be applied to every tenant's schema separately |
| **Ops complexity** | Medium — one database but N schemas to track and migrate |
| **Scaling** | Gets slow at thousands of tenants; schema count becomes a management burden |
| **Data leak risk** | Low — a missing filter returns only that tenant's schema data |
| **Cross-tenant queries** | Hard — requires UNION across schemas |
| **Tenant-level restore** | Medium — can restore one schema without touching others |
| **Compliance** | Better than shared schema; still not full physical separation |

**Best for:** Mid-stage SaaS where tenants need stronger isolation but physical
separation is not a contractual requirement.

---

### Model 3 — Separate database per tenant

Each tenant gets their own PostgreSQL database instance (or cluster). The application
connects to the right database based on the tenant's identity.

| Dimension | Detail |
| --- | --- |
| **Isolation** | Complete physical isolation — one tenant's outage or breach cannot affect another |
| **Setup cost** | Very high — full database provisioning per new tenant signup |
| **Migration cost** | Very high — schema changes must run against every tenant's database separately |
| **Ops complexity** | Very high — N databases to back up, monitor, patch, and restore |
| **Scaling** | Requires significant infrastructure automation (Kubernetes, Terraform) to manage |
| **Data leak risk** | Negligible — a bug cannot reach another tenant's database |
| **Cross-tenant queries** | Very hard — requires cross-database connections or data pipelines |
| **Tenant-level restore** | Easy — each tenant's database is an independent backup target |
| **Compliance** | Meets the strictest data residency and privacy requirements |

**Best for:** Enterprise SaaS where customers contractually require physical data
separation (banks, hospitals, governments).

---

## Side-by-side summary

| | Shared schema | Schema per tenant | DB per tenant |
| --- | --- | --- | --- |
| Setup per new tenant | Instant | Minutes | Hours |
| Migration effort | One migration | N migrations | N migrations |
| Ops overhead | Minimal | Moderate | Very high |
| Data isolation | Logical | Logical (stronger) | Physical |
| Leak risk without RLS | High | Low | None |
| Good for 1–100 tenants | ✅ | ✅ | ❌ |
| Good for 1,000+ tenants | ✅ with sharding | ⚠️ complexity grows | ✅ with automation |
| Solo 4-week build | ✅ | ⚠️ | ❌ |

---

## Decision

**Chosen: Model 1 — shared schema + tenant_id + PostgreSQL RLS**

See `capstone/adr/ADR-0003-isolation.md` for the full decision record with
consequences and the conditions under which this decision would be revisited.

---

## Scaling notes

At what point do we reconsider?

- **Schema-per-tenant** becomes worth considering when a single tenant generates
  enough load to starve other tenants (noisy neighbour problem) and we need query
  isolation, not just data isolation.
- **DB-per-tenant** becomes necessary when a customer's contract or local law
  (e.g. Kenya Data Protection Act, GDPR) requires physical data separation.
- **Noisy neighbour** means one tenant running expensive queries or high traffic
  slows the database for all other tenants — a risk in shared schema that is managed
  with per-tenant rate limits and query timeouts.
- A signal to reconsider: if Postgres query times for a specific tenant's tables
  consistently exceed 200ms under normal load, it's time to evaluate isolation options
  for that tenant.
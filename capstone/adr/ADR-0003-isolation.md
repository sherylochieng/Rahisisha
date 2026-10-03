# ADR-0003 - Multi-Tenancy Isolation Pattern

**Date:** October 2026  
**Status:** Accepted  
**Decider:** Sheryl Ochieng  

---

## Context

Rahisisha is a multi-tenant SaaS ... many businesses (tenants) share one platform.
Amina's boutique, Brian's photography studio, and the founder's,sheryls', dress shop all run
on the same system. The core safety requirement is that Business A can never see,
change, or delete Business B's data under any code path ... not because we hope the
code is correct, but because the system makes it structurally impossible.

Three patterns exist for achieving this. A decision was required before writing a
single line of application code, because the pattern chosen affects every table,
every query, every middleware, and every test in the system.

---

## Decision

**Chosen pattern: Shared database, shared schema, row-level isolation**

Every business table carries a `tenant_id UUID NOT NULL` column that references
the `tenants` table. Two independent enforcement layers protect the boundary:

1. **Application layer** 
   Every query goes through a `withTenant(tenantId, sql,
   params)` helper that requires `tenantId` as a mandatory argument. A query
   without it is a compile-time mistake, not a silent runtime bug.

2. **Database layer** 
   PostgreSQL Row-Level Security (RLS) is enabled on every
   tenant-owned table. A transaction-local variable (`SET LOCAL app.current_tenant
   = $1`) is set at the start of every request by the `tenantContext` middleware.
   The RLS policy filters every query by this variable automatically — even if the
   application code has a bug, the database refuses to return another tenant's rows.

---

## Consequences

### Positive

1. **Fastest to build** 
   One migration changes all tenants at once. No per-tenant
   provisioning on signup. A new tenant is a new row in the `tenants` table, not a
   new schema or a new database.

2. **Simplest to operate** 
   One database to back up, monitor, restore, and patch.
   One connection pool. One set of logs. Everything a solo developer can actually
   manage in a four-week capstone sprint.

3. **Two independent enforcement layers**  
   An application bug (missing`tenant_id` filter) cannot leak data on its own because the database RLS policy blocks it independently.
   Both layers would have to fail simultaneously for a breach to occur.

4. **Scales well to the expected range** 
   1 to 100 tenants on a single Postgres
   instance is well within documented performance limits. Partitioning or sharding
   can be added later around existing module boundaries without a full rewrite.

5. **Enables platform-level analytics** 
   Cross-tenant aggregate queries (total platform revenue, usage patterns) are straightforward SQL  useful for the
   platform admin dashboard.

### Negative

1. **Data leak risk if both layers fail** 
   If the `withTenant` helper is bypassed
   AND the RLS policy is misconfigured simultaneously, cross-tenant data could be
   exposed. Mitigation: the isolation test suite (`tenantIsolation.test.js`) runs on
   every push and blocks deploys on failure.

2. **Noisy neighbour risk** — one tenant running expensive queries can slow the
   database for all tenants. Mitigation: per-tenant rate limits and query timeouts
   at the middleware layer. Not a real risk at demo scale (1–5 tenants).

3. **Tenant-level restore is complex** — restoring one tenant's data from a backup
   without affecting others requires careful SQL, not a simple database restore.
   Acceptable for the MVP; document the procedure in the RUNBOOK.

4. **Does not satisfy physical isolation requirements** — a tenant whose contract
   or regulation (e.g. banking, healthcare) requires their data to be on a separate
   physical server cannot be served by this model. Not a concern for the current
   vertical (small boutiques and photographers).

5. **Migration discipline required** — every new table must have `tenant_id` and
   RLS enabled from day one. A table added without it is a permanent gap in the
   isolation boundary. Mitigation: a migration linting step in CI checks for the
   presence of `tenant_id` and the RLS enable statement on every new table.

---

## Alternatives considered

### Schema-per-tenant (rejected)

Each tenant gets their own Postgres schema (`amina.products`, `brian.products`).
The application switches `search_path` per request.

**Why rejected:** Every schema change (new column, new index, renamed table) must
run once per tenant schema. At 100 tenants, one migration becomes 100 migrations.
The isolation benefit over shared schema + RLS is marginal and does not justify
the migration overhead for a solo four-week build.

### Database-per-tenant (rejected)

Each tenant gets their own Postgres database instance.

**Why rejected:** Full database provisioning on every new signup requires
infrastructure automation (Kubernetes, Terraform, managed Postgres services) that
is out of scope for a solo capstone project. Operations overhead — N databases to
back up, monitor, and patch — is unmanageable solo. Maximum safety is not worth
the build cost at this stage.

---

## Conditions for revisiting this decision

This decision should be revisited if:

- A tenant's contract requires physical data separation (e.g. a regulated business
  such as a SACCO, hospital, or bank signs up)
- The noisy neighbour problem becomes real and measurable (query times for a
  specific tenant consistently exceed 200ms under normal load)
- Kenya Data Protection Act enforcement requires per-tenant data residency
- Platform growth reaches a scale where shared-schema indexing becomes a
  bottleneck (typically 10,000+ active tenants on one server)

---

## Related decisions

- ADR-004 — Memberships table instead of users.tenant_id directly
- ADR-005 — Redis-backed sessions (tenant resolved from session, never URL body)
- ADR-009 — Webhook idempotency via webhook_events table (same isolation applies)
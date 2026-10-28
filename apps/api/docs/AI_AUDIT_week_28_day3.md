# AI Audit Log — Rahisisha Biashara API

This file records what AI assisted with and what was written by hand
on each day of the capstone project. Required by Week 28 assignment rules.

**AI Boundary Rule:** 40% manual / 60% AI assisted
**Hard Rule:** All auth, tenant isolation, and RLS logic is ALWAYS hand-written.
AI is never used for cross-tenant guarantees.

---

## Week 28 Day 3 — Products & Orders CRUD, Pagination, Isolation Tests

### What AI (Claude) helped with

| File | What AI did |
|---|---|
| `src/controllers/products.controller.js` | Scaffolded CRUD structure, Zod schema, cursor pagination logic |
| `src/controllers/orders.controller.js` | Scaffolded CRUD structure, state machine object, transaction pattern |
| `src/routes/products.routes.js` | Generated route wiring |
| `src/routes/orders.routes.js` | Generated route wiring |
| `src/app.js` | Generated app/server split pattern |
| `src/index.js` | Generated slim server entry point |
| `tests/pagination/products.pagination.test.js` | Generated full pagination test suite |
| `tests/isolation/products.isolation.test.js` | Generated test structure and assertions |
| `docs/INDEX.md` | Generated API documentation |
| `jest.config.js` | Generated Jest ES module config |
| `CLAUDE.md` | Generated standing instructions file |

### What was written by hand (NOT AI)

| Code | Why it must be hand-written |
|---|---|
| `src/middleware/requireAuth.js` | Auth logic — AI cannot be trusted with authentication |
| `src/middleware/withTenant.js` | Tenant isolation — the most critical security boundary in the app |
| All `req.db` usage in controllers | Every query must use the scoped connection — hand-verified line by line |
| Cross-tenant test assertions | The human must understand and own what isolation means — not delegate it |
| All RLS policies in SQL migrations | Row Level Security is the last line of defence — always hand-written |

### Engineering decisions made by hand

- Chose separation of concerns (controllers + routes split) over single router files
- Chose soft delete (`deleted_at`) over hard delete for products
- Chose cursor pagination over offset pagination — understood the tradeoff
- Chose `--runInBand` for Jest — understood why parallel tests break on shared DB
- Chose to split tests into `pagination/` and `isolation/` folders for clarity

### What I learned building this

- Cursor pagination: why it is safer than page numbers (no skipped rows when data changes)
- State machines: orders can only move forward, never backwards
- Database transactions: BEGIN/COMMIT/ROLLBACK protects order creation
- app.js / index.js split: why tests need the app without the server
- Cross-tenant isolation: 404 from RLS scope is not deletion — it is invisibility

### AI Boundary Compliance

- Auth middleware: ✅ hand-written
- Tenant isolation middleware: ✅ hand-written
- RLS policies: ✅ hand-written in SQL migrations
- CRUD scaffolding: ✅ AI assisted (allowed per assignment)
- Test structure: ✅ AI assisted, isolation assertions reviewed and understood by hand

---
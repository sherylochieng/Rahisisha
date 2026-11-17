# 026_ussd_events.sql: The USSD Logbook

**File:** `sql/migrations/026_ussd_events.sql`
**Doc:** `apps/api/docs/src/db/026_ussd_events.md`
**Added:** Week 29 Day 4
**Also in:** `sql/SCHEMA.sql` (table 26), `scripts/reset-db.sh` and `.github/workflows/ci.yml` (policy count 20 to 21)

---

## WHY THIS FILE EXISTS

The unified inbox must show USSD requests next to WhatsApp messages. WhatsApp chats already live in `messages`, but nothing recorded a USSD request. This creates `ussd_events`: one row per USSD request.

## WHY IMPORTANT

Without a table there is nothing to list, so the inbox could never show a USSD row. It is also a NEW table that holds customer phone numbers, so it must be locked per shop (RLS) from its first day.

## DANGER

- A tenant table without RLS leaks one shop's customers to another. This table has `ENABLE` + `FORCE` row level security and a `tenant_isolation` policy with `WITH CHECK`.
- Every time a policy is added, the expected count in `scripts/reset-db.sh` and in the CI file must go up (20 to 21), or the reset script refuses to finish.
- The phone number is stored but must never be printed or logged.
- Run the migration as the owner role (`rahisisha_user`, the file ends with `OWNER TO rahisisha_user`) or the app cannot use the table.

## WHAT IT SOLVES

A shop-scoped, newest-first log of USSD requests (phone, what was typed, when), with an index matching how the inbox reads it.

## SYSTEM DESIGN PRINCIPLE

Isolation in the database, not in the code. The app never writes `WHERE tenant_id = ...` for this table; Postgres adds it.

## RULES

1. `ENABLE` and `FORCE` row level security.
2. Policy uses `NULLIF(current_setting('app.current_tenant', TRUE), '')::UUID` with both `USING` and `WITH CHECK`.
3. Table owned by `rahisisha_user`.
4. `SCHEMA.sql` is updated in the same change so a fresh database matches.
5. Counts in `reset-db.sh` and CI are bumped.

## PRACTICAL EXAMPLE

A customer dials `*384*101#` and presses 2. A row is saved: `tenant_id` = Amina's shop, `phone` = the caller, `body` = `2`. Brian's shop can never see it.

## DECISIONS (and WHY)

- `body` is `NOT NULL` and `''` means the caller only dialled the code (the first screen).
- `session_id` is nullable: it is only for debugging.
- Index `(tenant_id, created_at DESC, id DESC)` matches the inbox's newest-first ordering with the id tie-break.
- Unlike `ussd_configs`, this table CAN have RLS, because it is only written after the shop is known (the guard has already found it from the service code).

## WHERE USED / FUTURE USES

Written by `ussd.controller.js`; read by `inbox.controller.js`. Future: a retention job that deletes events older than N days.

## TRADEOFFS

+ Simple, one row per request.
- It grows with every USSD tap (a long menu logs several rows per call). A retention policy is future work.
- No unique key: a retried request from Africa's Talking would log twice.

## HOW TO USE

```powershell
psql -U rahisisha_user -d rahisisha -f sql/migrations/026_ussd_events.sql
```
A fresh database gets it from `sql/SCHEMA.sql`.

## PIECE BY PIECE (simple words, real-life examples)

### `BEGIN; ... COMMIT;`

Everything happens together or not at all. Real life: either the whole new filing cabinet is delivered, or none of it.

### `CREATE TABLE ussd_events (...)`

The columns. `tenant_id` says which shop; `phone` who called; `body` what they typed; `created_at` when. `ON DELETE CASCADE` means deleting a shop deletes its log.

### `CREATE INDEX ussd_events_tenant_idx`

The index card. It lets Postgres find one shop's newest rows without reading the whole table.

### `ENABLE` / `FORCE ROW LEVEL SECURITY`

Turns the lock on, and makes it apply even to the table's owner. Real life: a door lock that even the caretaker's key must respect.

### `CREATE POLICY tenant_isolation`

The lock rule: a row is visible and writable only when its `tenant_id` equals the shop the request belongs to. `WITH CHECK` stops one shop planting a row inside another's log.

### `OWNER TO rahisisha_user`

Makes the app's database user the owner, like every other table.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*

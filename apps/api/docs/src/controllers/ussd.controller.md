# ussd.controller.js: Day 4 Addition (USSD Logging)

**File:** `apps/api/src/controllers/ussd.controller.js`
**Doc:** `apps/api/docs/src/controllers/ussd.controller.md`
**Added:** Week 29 Day 4
**Note:** the controller was written on Week 29 Day 1. This guide covers only the Day 4 change (the logging block). The Day 1 menu logic is unchanged.

---

## WHY THIS FILE EXISTS

On Day 4 the USSD controller also records each request in `ussd_events`, so it appears in the unified inbox.

## WHY IMPORTANT

Without the logging block the inbox would never contain a USSD row.

## DANGER

- Logging must NEVER break the menu. It is wrapped in `try/catch` and failures are ignored on purpose; the caller always gets their menu.
- It runs only after the shop is known (after the config check), so an unknown service code logs nothing.
- The phone number is stored but never logged to the console.
- The insert uses `req.db` (the shop-locked connection). RLS `WITH CHECK` guarantees the row can only belong to this shop.
- It is `await`ed, which adds one small insert to every USSD request (Africa's Talking waits for the reply, so keep it light).

## WHAT IT SOLVES

Every USSD request becomes an inbox row: `phoneNumber`, what was typed (`text`), the session id.

## SYSTEM DESIGN PRINCIPLE

Best-effort side effects: a secondary job (logging) must never break the primary job (answering the caller).

## RULES

1. Skip the insert when `phoneNumber` is missing (the column is NOT NULL).
2. Swallow the error; do not log it (it could contain the phone).
3. Parameterised SQL only.

## PRACTICAL EXAMPLE

Caller 0733... dials and presses 2. The caller sees `END Balance: KSh ...`; the inbox gains `{channel:'ussd', from:'0733...', body:'2'}`.

## TRADEOFFS

+ Tiny and safe.
- A silent failure means a missing inbox row with no alarm. A counter or alert is future work.
- Each menu tap logs a row, so one call can create several rows.

## PIECE BY PIECE (simple words, real-life examples)

### `const phone = req.body && req.body.phoneNumber;`

Africa's Talking sends `phoneNumber`. If a test or a bad caller omits it, we skip logging.

### `INSERT INTO ussd_events (tenant_id, phone, session_id, body) VALUES (...)`

One row for this request. `text` is what the caller typed so far (`''` = just dialled). Real life: the receptionist writes one line in the visitors' book.

### `catch (_err) { }`

Intentionally empty. Real life: if the visitors' book pen dies, the receptionist still lets the visitor in.

---

*Written by AI at Sheryl's request (declared in `AI_AUDIT_week_29_day4.md`). Last updated 17 November 2026.*

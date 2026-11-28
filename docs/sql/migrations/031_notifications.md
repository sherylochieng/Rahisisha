# sql/migrations/031_notifications.sql

**FILE:** `sql/migrations/031_notifications.sql` (Week 30 Day 3, Batch 3b-1, step 1)

## WHY THIS FILE EXISTS

When head office suspends, reinstates or verifies a shop, the owner should be told. Sending a WhatsApp or SMS is slow and can fail. So the admin action never sends. It writes **one line in a table** (the outbox), and a worker sends it later. This file creates that table, `notifications`.

Real life: the post office tray on the counter. The clerk drops the letter in the tray before you leave the counter. The postman collects it later.

## WHY IMPORTANT

The line is written in the **same transaction** as the shop change and its receipt. So all three happen together or none do. A shop is never suspended without its owner's message being queued, and no message is queued for a change that was cancelled.

## DANGER (what breaks without it)

1. It is a **new table** only. Nothing existing changes. Safe to run twice.
2. It has `tenant_id` and **forced** row level security. Shops may only **read** their own rows. Only head office (`app.platform_admin = 'on'`) may write. A shop owner can never queue, edit or delete a message.
3. `recipient_phone` and `payload` are personal data. Never print them in logs. Use `maskPhone()`.
4. Run as the owner of the tables, after a `pg_dump` backup on Neon. The last line gives the table to `rahisisha_user`, like migrations 026 and 028.
5. **The policy count changes.** There are now 25 policies (23 + `tenant_read` + `admin_all`). `scripts/reset-db.sh` was updated from 23 to 25. Without that, CI fails with "Expected 23 policies, found 25".

## WHAT IT SOLVES

"Tell the owner what happened, reliably, without slowing or breaking the admin action." Later it also feeds a head-office list of queued, sent and failed messages.

## SYSTEM DESIGN PRINCIPLE

**Transactional outbox.** The message is data first (a row). Delivery comes later. It also separates **what** to say (`template` + `payload`) from **how** to send it (`channel`), so WhatsApp and SMS can be added without touching the admin code.

## RULES

1. `channel` is `test`, `whatsapp` or `sms`. Today everything uses `test` (sends nothing real).
2. `status` is `queued`, `sent` or `failed`. New rows are `queued`.
3. `attempts`, `last_error`, `send_after`, `sent_at` are the worker's retry notebook.
4. `recipient_phone` may be empty (a shop with no owner row). The row is still written so head office can see "nobody to tell".
5. `audit_log_id` links to the receipt of the action that caused the message (`ON DELETE SET NULL`).

## PRACTICAL EXAMPLE

Head office suspends "Mama Njeri Groceries" because of fake M-Pesa messages. In one transaction the shop becomes suspended, a receipt is written, and this table gets a line: template `shop.suspended`, the owner's number, payload `{"shopName":"Mama Njeri Groceries","reason":"..."}`, status `queued`.

## DECISIONS

- `channel` and `status` are `TEXT` with `CHECK` rules, not Postgres enums. Adding a new word later is one simple `ALTER`.
- Shops get read-only access (`tenant_read`) so a future "messages we sent you" screen is possible. No shop-side writes at all.
- `ON DELETE CASCADE` on `tenant_id`: a removed shop takes its message history with it (same as `ussd_events`).

## WHERE USED

`notifications.service.js` (queues rows), `adminShops.service.js` (calls it), `isolation.test.js` (proves shops cannot touch each other's rows).

## TRADEOFFS

+ Reliable, retryable, auditable. - Nothing is delivered until the worker exists (next batch).

## HOW TO USE

```
psql -U postgres -d rahisisha -f sql/migrations/031_notifications.sql
```

Local first. On Neon only after a backup, with the owner connection. Safe to run twice.

---

## LINE BY LINE

**`BEGIN; ... COMMIT;`**
All or nothing. If any line fails, nothing is created.

**`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`**
A unique tracking number for each message, made by the database.

**`tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`**
Which shop the message is about. The database checks the shop exists. If the shop is deleted for good, its messages go with it.

**`channel TEXT NOT NULL DEFAULT 'test' CHECK (...)`**
How it will travel. The `CHECK` refuses any word outside the list. `test` is the dress rehearsal: it sends nothing real.

**`template TEXT NOT NULL CHECK (char_length(template) BETWEEN 1 AND 80)`**
The message's name (for example `shop.suspended`). The words live in code, not here.

**`recipient_phone TEXT CHECK (... <= 20)`**
Who receives it. Allowed to be empty. A length limit stops garbage.

**`payload JSONB NOT NULL DEFAULT '{}'`**
The blanks to fill in (shop name, reason). Small JSON, always an object.

**`status`, `attempts`, `last_error`, `send_after`, `sent_at`**
The worker's notebook: where the message is, how many tries, why it last failed (max 500 characters), not before when, and when it was sent.

**`audit_log_id UUID REFERENCES audit_logs(id) ON DELETE SET NULL`**
Points at the receipt of the admin action. If a receipt is ever removed, the message stays and the link is blanked.

**`CREATE INDEX notifications_due_idx ... WHERE status = 'queued'`**
A **partial** index: the worker's question "what is due?" reads a tiny list of queued rows only, even after millions were sent.

**`CREATE INDEX notifications_tenant_idx`**
For head office: newest messages first, per shop.

**`ENABLE` and `FORCE ROW LEVEL SECURITY`**
Turns the lock on, and makes it apply even to the table's owner role (the app's own user).

**`tenant_read` policy (SELECT only)**
A shop sees a row only if its `tenant_id` matches the shop making the request. There is no write policy for shops, so Postgres refuses every shop-side write.

**`admin_all` policy**
True only while `app.platform_admin = 'on'`, which `withAdminLock` switches on inside a transaction. `USING` filters reads and changes; `WITH CHECK` filters new rows.

**`ALTER TABLE notifications OWNER TO rahisisha_user`**
Gives the table to the app's user so it can manage it, consistent with the other tables.

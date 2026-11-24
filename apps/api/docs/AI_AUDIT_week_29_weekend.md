<!-- FILE: apps/api/docs/AI_AUDIT_week_29_weekend.md -->
<!-- WHY: Week 29 Weekend (Bug Fixing and Stability) needs an honest record of what the AI did and what Sheryl did. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 29 Weekend (Bug Fixing and Stability)

**Author:** Sheryl
**Date:** 24 November 2026
**AI rules for this assignment:** none were given. The weekend text had no marking table and no list of "AI allowed" or "AI not allowed" tasks. Because nothing was said, this audit declares **everything the AI wrote**, so a reviewer can decide for themselves.

This audit says what actually happened, including the AI's own mistakes.

---

## 1. The most important lines in this audit

1. **The AI wrote the test scripts and all the documents.** That is `scripts/demo-run.mjs`, `apps/api/scripts/load-test-orders.js`, their guides, `RUNBOOK.md`, `PERFORMANCE.md` and `NEXT.md`. Sheryl ran the scripts on her own computer and pasted the real results. The numbers in the documents are her results, not the AI's.
2. **The AI changed production code once.** `apps/api/src/db/pool.js` got a 3-line error handler (section 3). It is small, but it is production code, so it is called out here.
3. **The web fixes were written by the AI and tested by Sheryl** in her browser and terminal (section 4).
4. **Nothing was changed in money, ledger, tenant or RLS code.** The weekend did not touch them.

---

## 2. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | Run the demo ten times | `scripts/demo-run.mjs`, `apps/api/docs/scripts/demo-run.md` | **AI wrote** the runner and its guide. Sheryl ran it and pasted the results. |
| 2 | Isolation tests | existing tests | Sheryl ran `npm run test:isolation`. No test was changed. |
| 3 | Load test: 100 orders in 60 seconds, two shops | `apps/api/scripts/load-test-orders.js`, `apps/api/docs/scripts/load-test-orders.md`, `PERFORMANCE.md` | **AI wrote** the script, the guide and the report text. Sheryl ran it and pasted the results. |
| 4 | Chaos test (cut database connections) | `apps/api/src/db/pool.js`, `apps/api/tests/pool.error-handler.test.js`, `apps/api/docs/src/db/pool.md` | The crash was found by Sheryl's run. **AI wrote** the fix and the test (section 3). |
| 5 | Backup and restore test | `RUNBOOK.md` | AI wrote the steps. Sheryl ran them: dump, wipe, restore, check the counts. |
| 6 | Review every admin page | five files in `apps/web/src` (section 4) | AI read the pages and wrote the fixes. Sheryl tested each one. |
| 7 | `npm test` in every service | none | Sheryl ran it: API 30 suites, 312 tests, all passing. The web app and workers have no tests. |
| 8 | Notes for later | `NEXT.md` | AI wrote it. Ideas only, no code. |
| 9 | Runbook | `RUNBOOK.md` | AI wrote it at Sheryl's request, for someone who has never used a runbook. |

---

## 3. The one change to production code

The chaos test cut the database connections while the API was running. The API crashed.

**Why it crashed.** The database library keeps a few idle connections open. When one is cut, it raises an error event. Nothing was listening for that event, and Node treats an error event with no listener as fatal, so the whole API stopped.

**The fix.**

| Change | What it does | Who |
|---|---|---|
| `pool.on('error', ...)` in `pool.js` | Logs "Database connection dropped (the pool will reconnect)" and carries on | AI wrote, Sheryl saved and committed |
| `tests/pool.error-handler.test.js` | Checks that a listener exists and that an error event no longer throws | AI wrote |
| `docs/src/db/pool.md` (+27 lines, add only) | Explains the handler | AI wrote |

The crash was seen first. The AI wrote the fix only after Sheryl pasted the crash log from her computer.

---

## 4. The web changes

The page review found that every page already had an empty state, a loading screen and an error screen. Four small things were fixed.

| File | Problem | Fix | Who |
|---|---|---|---|
| `apps/web/src/app/shop/[slug]/loading.js` (new) | The public shop page showed a blank screen while loading | A grey placeholder in the same shape as the page | AI wrote, Sheryl tested |
| `apps/web/src/app/(authed)/payments/page.js` | A damaged `?cursor=` in the address showed "We're having trouble" | Obvious junk is ignored and the newest page is shown | AI wrote, Sheryl tested |
| `apps/web/src/app/(authed)/inbox/page.js` | Same | Same | AI wrote, Sheryl tested |
| `apps/web/src/components/ShopLinkCard.js` | A hydration error in the terminal: the server drew 3 buttons and the browser drew 4 | The Share button now appears after the page loads | AI wrote, Sheryl tested |
| `apps/web/src/app/(authed)/dashboard/page.js` | Two leftover commented-out `TEMP TEST` lines | Deleted by Sheryl | SELF |

The hydration error was **not** found by the AI reading the code. It was found by Sheryl's terminal output after she reloaded the dashboard. The AI then explained the cause and wrote the fix.

---

## 5. What Sheryl did herself

- **Decisions (SELF):** chose the plan to cut database connections for the chaos test, because the notification service does not exist. Chose to record the demo with logins.
- **All runs (SELF):** ran the demo runner, the isolation tests, the load test, the chaos test, the backup and restore, and `npm test`, on her own Windows computer, and pasted the real output.
- **All browser checks (SELF):** opened each page, tested the bad-cursor addresses, and checked the terminal after each fix.
- **Git (SELF):** one commit per file, each tagged `[Week 29 Weekend]`, with no AI attribution lines.

---

## 6. What went wrong and what was fixed

- **The AI said USSD used Redis. It does not.** Corrected in the chat and in `RUNBOOK.md`.
- **The AI miscounted several times** (lines in files, commits ahead, test counts). Each was admitted and re-checked against the real output.
- **The first chaos attempt looked like "nothing happens".** It was repeated with the exact cut command, and the crash was then confirmed before the fix.
- **The AI first saved the demo runner in the wrong folder.** It was moved to `scripts/`.
- **The AI gave a PowerShell command with `&&`**, which her version of PowerShell does not accept. Nothing was committed by mistake, and the commands were re-given one line at a time.
- **The AI first described the dashboard "not loading" as a possible bug.** It was only the first compile (9.3 seconds). The real bug in that terminal was the hydration error.

---

## 7. What is not verified

- **No video exists.** The demo was run by script and by hand, but no `.mp4` was recorded.
- **WhatsApp was simulated** and does not reply yet. **USSD was tested with `curl`**, not on a real phone.
- **M-Pesa was tested in the Daraja sandbox only.** Refunds, reversals and reconciliation are not built (see `NEXT.md`).
- **The cause of the slower burst test is not proven.** `PERFORMANCE.md` says so.
- **The chaos test only cut idle connections.** A connection cut in the middle of a query, a database restart and a slow database are untested.
- **The AI tested its scripts first in its own sandbox** (a different Postgres version and system from Sheryl's Windows computer). Only Sheryl's runs on her own computer count as proof.
- **The page review was done by reading the code and by Sheryl clicking the pages.** There are no automated tests for the web app.
- **The AI cannot confirm that the re-read boxes in older audits were ticked honestly.** Those are Sheryl's.
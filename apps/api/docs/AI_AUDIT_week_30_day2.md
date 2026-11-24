<!-- FILE: apps/api/docs/AI_AUDIT_week_30_day2.md -->
<!-- WHY: Week 30 Day 2 (Documentation and Runbook) requires an AI audit. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 30 Day 2 (Documentation and Runbook)

**Author:** Sheryl
**Date:** 24 November 2026
**Week 30 rule:** 20% manual / 80% AI. AI is allowed to **draft prose**. An AI audit is required.

This audit says what actually happened, including the AI's own mistakes.

---

## 1. The most important lines in this audit

1. **The AI drafted all the documents and the start script.** Sheryl ran every command, pasted every result, and made every commit herself, one file per commit, each tagged `[Week 30 Day 2]`, with no AI attribution lines.
2. **The AI got the README quickstart wrong the first time.** It told the reader to set `NEXT_PUBLIC_API_URL` without `/v1` and left out `WEB_ORIGIN`. Following the README from a fresh copy found both mistakes (section 5). They are fixed.
3. **Only one of the eight runbook incidents was reproduced on purpose.** Each incident in `docs/RUNBOOK.md` has an Evidence line saying what is real and what is worked out from the code (section 6).
4. **The curl examples in `docs/api-reference.md` were not all run.** They were written from reading the controllers (section 6).

---

## 2. Summary

| Task | File | Commit | Who did what |
|---|---|---|---|
| 4 | `docs/secrets.md` | d66db0481, 50ce464cb | AI wrote it from reading the code. Sheryl confirmed her real database user is `rahisisha_user`, not the `postgres` shown in the old example. The second commit updates the gaps section after the example files were fixed. |
| 3 | `docs/api-reference.md` | b291f450d | AI read every route and controller and wrote the examples. Replaces the outdated Week 27 plan (`capstone/api.md`, kept for history). |
| 2 | `docs/RUNBOOK.md` | 161c09a4c | AI wrote 8 incidents. Sheryl pasted her existing root `RUNBOOK.md` headings so the new file adds to it instead of repeating it. |
| (script) | `scripts/dev-up.sh` | bbe4fb36c | AI wrote it. **Sheryl tested it** on her machine (section 4). |
| 1, 5 | `README.md` | 3fde44137, 2af92deab | AI wrote the quickstart, the text diagram and the honest status lists. Every old README line was kept (Sheryl ran a line-by-line check: nothing missing). |
| (fix) | `apps/api/.env.example` | f180d1c4a | Found by the fresh-clone test. Adds `WEB_ORIGIN`, changes the example user to `rahisisha_user`. |
| (fix) | `apps/web/.env.example` | 670dfb413 | Found by the fresh-clone test. Shows the API address ending in `/v1`. |

---

## 3. What the AI did

- Read the real routes, controllers, scripts and web code before writing, so the documents describe what the code does today, not the Week 27 plan.
- Wrote the API reference: a curl example per endpoint, auth rule, success shape and error codes, plus a table of where the old plan was wrong (port 4000 vs 3000, cookie `session` vs `token`, old error code names).
- Wrote the runbook: 8 incidents with symptom, check, fix, prevention and an evidence line.
- Wrote `dev-up.sh`, the README, the diagram, and the fixes to the example files.
- Said honestly in the README what is not built yet (product edit and delete in the web app, issue #6; cart and checkout; Settings page; real money; real WhatsApp).

## 4. What Sheryl did herself

- **Ran everything (SELF):** every command, including the checks that a linked file exists (all 12 did), the `dev-up.sh` tests, and the commits.
- **Tested `dev-up.sh` (SELF):** it refused to start while an old API held port 3000 (correct), started both programs when the ports were free, and both ports were free after Ctrl+C.
- **Followed the README from a fresh clone (SELF):** a copy of the repo in a new folder, a scratch database `rahisisha_scratch`, the three installs, `scripts/reset-db.sh`, the settings files, `./scripts/dev-up.sh`, the health check, signup in the browser and adding a product. She then removed the test folder and dropped the scratch database. Her real project and real database were not used.
- **Gave the facts the AI could not see (SELF):** the headings of her root `RUNBOOK.md`, her current README, and the contents of both example files.
- **Decisions:** the AI proposed these and Sheryl agreed and carried them out, so they are the AI's ideas that she accepted, not her own: keep the old root `RUNBOOK.md` and add a separate incident file; create `dev-up.sh` and test it before the README promises it; do the fresh-clone test; fix the example files. Sheryl's own decision during the day was to do the assignments first and finish the project afterwards, so the documents describe the project as it is today and say what is unbuilt.

---

## 5. What went wrong and what was fixed

- **README step 4 was wrong (AI mistake).** It said `NEXT_PUBLIC_API_URL=http://localhost:3000`. The web code says the value already ends in `/v1`, and the AI's own `docs/secrets.md` said so, so the README contradicted the AI's other document. The signup page then said "Route not found". Fixed in 2af92deab and 670dfb413.
- **README left out `WEB_ORIGIN` (AI mistake).** The API refuses a browser unless `WEB_ORIGIN` lists the web app. The signup page said "We couldn't reach the server" while `/health` worked. The AI found it by asking the API the browser's question (an OPTIONS request) and seeing no `Access-Control-Allow-Origin` header. Fixed in 2af92deab and f180d1c4a.
- **The example files were out of date.** `apps/api/.env.example` showed the user `postgres` (a superuser would silently switch the isolation locks off) and had a typo ("PASSWORRD"). `docs/secrets.md` section 6 was updated to match (50ce464cb).
- **Wrong shell commands (AI mistakes).** The AI gave `tasklist /FI ...` for Git Bash, which turned `/FI` into a file path, and two `/FI` filters together would match nothing. It also put the PowerShell command `Get-Process` in a Git Bash block. Both were corrected and no harm was done.
- **The AI first tried to read the root `RUNBOOK.md` from an old copy of the repo where it did not exist,** so it asked Sheryl for the headings instead of guessing.
- **Test folder "busy".** After the test, deleting the test folder failed once with "Device or resource busy" although both ports were free. The cause was not identified. Sheryl later saw the folder was gone.

---

## 6. What is not verified

- **The curl examples in `docs/api-reference.md` were not all run.** They were written from reading the controllers. Only health, signup, login, the dashboard and adding a product were exercised, through the browser during the README test. Status codes and error shapes elsewhere come from the code.
- **Seven of the eight runbook incidents were not reproduced on purpose.** Incident 1 (database down) was reproduced in the Week 29 chaos test. Incident 5 (paid but pending), incident 4 (the "api" shop word and shared private-window cookies) and incident 7 (pre-push guard) happened while building. Incidents 2, 3, 6 and 8 are worked out from the code. Each incident says which kind it is.
- **The README was followed from a fresh clone on the author's own laptop, not a clean machine.** The clone came from the local folder (not GitHub), and the database user `rahisisha_user` already existed, so README step 2 (creating the user) was not run.
- **`dev-up.sh` was tested on Windows Git Bash only.** It checks Postgres with `pg_isready` and prints a warning if that tool is missing. Stopping with Ctrl+C worked once. The leftover-process risk is documented but not solved.
- **The "125 isolation tests" figure in the README comes from the existing `RUNBOOK.md`.** It was not re-run today.
- **Link check:** the 12 internal links were checked for existence. External links (the live staging site and the CI badge) were not checked.
- **`npm install` reported vulnerabilities** (API 7, including 1 critical; web 3) and deprecated packages such as `multer 1.x`. They were not touched. They go on the after-assignments list.
- **The stretch goals were not attempted:** OpenAPI from the zod schemas, a documentation site, `CONTRIBUTING.md`.
- **Still out of date:** `capstone/api.md` (kept for history, flagged in the new reference) and parts of `capstone/README.md`.
- **Not tested at all:** real M-Pesa money (sandbox only), a real WhatsApp number, USSD on a real phone.
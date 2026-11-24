<!-- FILE: apps/api/docs/AI_AUDIT_week_30_day1.md -->
<!-- WHY: Week 30 Day 1 (Testing and QA Sweep) requires an AI audit. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 30 Day 1 (Testing and QA Sweep)

**Author:** Sheryl
**Date:** 24 November 2026
**Week 30 rule:** 20% manual / 80% AI. AI is allowed for **test case generation and bug description drafting**. AI is **NOT allowed** for **severity calls and launch blockers**. An AI audit is required.

This audit says what actually happened, including the AI's own mistakes.

---

## 1. The most important lines in this audit

1. **Every severity was decided by Sheryl, not by the AI.** For each of the five issues the AI only listed facts (what happens, who is affected, whether anything is lost) and asked Sheryl to choose. The five choices and her reasons are in section 3.
2. **The launch blockers list is Sheryl's decision.** She said the list is #6, #7 and #8, and that #4 and #5 ship as known issues. The AI only wrote the text of `launch-blockers.md` from her decisions. The AI cannot prove which words were Sheryl's, so this is her statement.
3. **The AI wrote the 43 test cases and the five issue descriptions** (both allowed). Sheryl ran every case and pasted every result. The "Actual" and "Result" columns in `qa/manual-plan.md` were filled in by the AI from the results Sheryl pasted during the session. Sheryl ran the tests, and the AI typed the record.
4. **The AI made one factual mistake in an issue and fixed it** (section 5, first item).

---

## 2. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | Green the suite | none | Sheryl ran `npm test` (API: 30 suites, 312 tests) and `npm run test:isolation` (7 suites, 125 tests), all passing. No fix was needed, so there are no test-fix commits. Web and workers have no tests (section 6). |
| 2 | Manual QA plan | `qa/manual-plan.md` | **AI wrote** the 43 cases (allowed). **Sheryl ran** every case. AI recorded the results she pasted. |
| 3 | Bug triage | GitHub issues #4 to #8 | **AI drafted** the issue text (allowed). **Sheryl set every severity** and opened every issue. |
| 4 | Load spot-check | `load-check.md` | AI wrote the document. Sheryl ran `autocannon` on six endpoints and pasted the output. |
| 5 | Launch blockers | `launch-blockers.md` | AI wrote the text. **Sheryl made the decisions.** |

---

## 3. The severity decisions (Sheryl's, in her words)

| Issue | Case | Severity | Sheryl's reason |
|---|---|---|---|
| #4 | S6: symbol-only shop name gives an empty address | medium | The owner can't get a working link and is left confused. Rare. Fix for a better experience. |
| #5 | P5: a 10+ digit price says "numbers only" | medium | A seller might price something very valuable, so the message should say "too large". |
| #6 | P6: no edit or delete of products in the web app | high | An owner must be able to manage their own products. Before launch, after the assignments. |
| #7 | P6b: samples say "Edit or delete it" | high | Fixed together with #6. |
| #8 | W5: no WhatsApp reply from the inbox | high | Meta must be connected and replies added in the app before launch. |

**What the AI added.** Facts only: for example, that the owner cannot rename a shop (Settings is "soon"), that the price limit is about KES 21.4 million, and that a blocker must be fixed before Day 3. The AI also suggested a fix for each issue. The suggested fix for #4 (refuse a name with no letters or numbers) was Sheryl's own idea first.

---

## 4. What Sheryl did herself

- **Decisions (SELF):** all five severities, the final launch-blockers list, agreeing to open five issues (not nine), and the choice to use the Qa Duka One test shop for product cases so her demo shop stayed clean.
- **All runs (SELF):** the suites, six load runs, and all 43 QA cases, including the M-Pesa payment on her own phone, USSD and WhatsApp calls, and the cross-shop attempts.
- **GitHub (SELF):** created the labels `blocker`, `high`, `medium` and `low`, and opened issues #4 to #8.
- **Git (SELF):** one commit per file, each tagged `[Week 30 Day 1]`, with no AI attribution lines.

---

## 5. What went wrong and what was fixed

- **The AI wrote a false claim in issue #6**, saying the API had no update or delete route for products. It had not checked. The API **does** have `PATCH` and `DELETE` routes, and tests for both. The AI found this when it checked before drafting the next issue, and Sheryl edited the issue. The real gap is the web app only.
- **L4 and L5 were first run incorrectly.** An old private window was still logged in, so the pages showed shop data. The AI said it was an invalid test and not a bug. After closing all private windows, the cases were repeated and passed.
- **The first order command used an old product id** (from before a database reset). The API refused it correctly, and the AI then looked up a real id.
- **Some pastes were cut short** (for example the USSD inbox rows and the WhatsApp message text). The AI asked for the full rows before marking those cases PASS.

---

## 6. What is not verified

- **Web app and workers have no automatic tests.** `apps/workers` is only a `package.json` with no code. Task 1's "run `npm test` for web and workers" was therefore not possible, and this is written down as a known limit.
- **The load check is a sanity check.** One laptop, small data, dev mode, one run each. The 97.5% value is used as a stand-in for p95 because `autocannon` does not print p95.
- **M-Pesa was tested in the Daraja sandbox only.** USSD was tested with `curl`, and WhatsApp was simulated.
- **X2 (shop A paying shop B's order):** the API answered "Order not found". Whether a phone prompt arrived was not confirmed.
- **The finding that automatic tests leave data in the real Aminas shop** is inferred from matching times (and the pre-push test runs). It was not proven by reading the tests.
- **One question stayed open:** a product saved as "Sugar" was meant to be "QA Sugar". It was not confirmed whether it was a typing slip.
- **The Playwright and chaos stretch goals were not attempted.**
- **The AI cannot confirm the severity wording is Sheryl's own.** It is her statement.
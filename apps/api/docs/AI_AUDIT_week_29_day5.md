<!-- FILE: apps/api/docs/AI_AUDIT_week_29_day5.md -->
<!-- WHY: Week 29 Day 5 submission requires an AI audit. Linked from the root AI_AUDIT.md index. -->

# AI Audit: Week 29 Day 5 (Demo and Git Reflog Recovery)

**Author:** Sheryl
**Date:** 23 November 2026
**Week 29 rule:** 25% manual / 75% AI. AI is allowed for the demo script. AI is **NOT allowed** for the demo reflection (the reflog notes). An AI audit is required.

This audit says what actually happened, including where the AI helped more than a reviewer might expect.

---

## 1. The most important lines in this audit

1. **`reflog-notes.md` is Sheryl's work, not the AI's.**
   - Sheryl first asked the AI to write the notes. The AI refused, because the assignment does not allow AI for the reflection, and it did not write any sentence of them.
   - Before Sheryl wrote, the AI explained the four required facts in plain words (what the reflog stores, how long it keeps entries, what it cannot save, and the command for a dangling commit). The notes cover those same four facts, so **a reviewer may see the similarity**.
   - Sheryl then pasted a first text that was a long write-up of the practice. The AI said it was not the 5 to 7 sentence notes the task asks for and that it was missing required points. It did not rewrite it.
   - Sheryl's second text was 6 sentences. The AI only checked the facts (all correct) and changed nothing.
   - The AI cannot prove who typed the final words. This is Sheryl's statement that they are her own words.
2. **`reflog-demo.txt` was assembled by the AI from Sheryl's real terminal output.** PowerShell's recorder (`Start-Transcript`) saved the commands but not Git's replies. Sheryl pasted each reply to the AI as she went, and the AI copied them into one file, with a note at the top saying so. The recorder's own header (computer and user details) was left out on purpose. The AI made one mistake while assembling it (a branch label on one log line that Sheryl's real output did not have) and corrected it before the file was used.
3. **The demo script and the written demo record were written by the AI** (allowed for the script). The real results in them come from Sheryl's own run.

---

## 2. Summary

| Task | Area | Files | Who did what |
|---|---|---|---|
| 1 | Two-shop demo (written record) | `demo-week29.md` | AI wrote it from the results Sheryl pasted. Sheryl ran every command. |
| 2 | Demo script | `capstone/demo-script.md` | **AI wrote it** (allowed). Sheryl decided the approach and ran the rehearsal. |
| 3 | Reflog practice | `reflog-demo.txt` | Sheryl ran every Git command. AI explained the steps and assembled the file from her output (see section 1). |
| 4 | Reflog notes | `reflog-notes.md` | **Sheryl, in her own words.** AI explained the concepts first and fact-checked afterwards (see section 1). |
| 1 | Brio Hardware M-Pesa settings | `apps/api/scripts/seed-daraja-demo.js`, `apps/api/docs/scripts/seed-daraja-demo.md` | AI wrote the change (see section 3). Sheryl saved, checked with `git diff --stat`, and committed. |
| 5 | Audit, README, tag | this file, `AI_AUDIT.md`, `capstone/README.md`, tag `v0.29.0` | AI drafted the text. Sheryl applies and pushes. |

---

## 3. The one code change

`seed-daraja-demo.js` used to set up M-Pesa sandbox settings for Amina's Boutique only. The two-shop demo needs a sandbox payment for each shop.

| Change | What it does | Who |
|---|---|---|
| `SHOP_SLUGS = ['aminas-boutique', 'brio-hardware']` | Names both shops | AI |
| `seedShop(slug, s)` | The old per-shop work, moved into a function | AI |
| `main()` loops over `SHOP_SLUGS` | Checks the guard and the settings once, then seeds each shop | AI |

It writes sandbox keys only, refuses production and non-local databases, and encrypts each shop's keys with that shop's own id, as before. It does not touch money, the ledger or callback verification.

---

## 4. What Sheryl did herself

- **Decisions (SELF):** chose "both shops live in the sandbox" for M-Pesa, chose to record with logins instead of resetting for a fresh signup, and chose to write the reflection herself after the AI declined to.
- **Reflog practice (SELF):** created the throwaway branch, ran `git reset --hard HEAD~3`, read the reflog, rescued with `git reset --hard "HEAD@{1}"`, returned to `main` and deleted the branch.
- **Demo rehearsal (SELF):** started Docker, rebuilt the database, started the API, web app and tunnel, signed up both shops, loaded the USSD, WhatsApp and M-Pesa settings, sent the USSD and WhatsApp requests, created one order per shop, and paid each through the Safaricom sandbox with her own number.
- **Tests (SELF):** ran `npm run test:isolation` (7 suites, 125 tests) and `npm test` (29 suites, 310 tests) herself.
- **Git (SELF):** one commit per piece, each tagged `[Week 29 Day 5]`, with no AI attribution lines.

---

## 5. What went wrong and what was fixed

- The AI's first `reflog-demo.txt` had one wrong branch label on a log line. Corrected before use.
- The reset script loaded practice shops, one of them also named "Amina's Boutique", which would have clashed with the signup. The AI spotted it before signup and the database was rebuilt without the practice data.
- Signup turns "Amina's Boutique" into `amina-s-boutique`, which the setup scripts do not find. The demo uses "Aminas Boutique" instead.
- The first demo script said Amina's USSD welcome was "Welcome to Aminas Boutique". The real text is "Karibu Amina's Boutique". Fixed in the script.
- A second pay request on Brio's already-paid order was refused with `order_not_payable`. That is the safety working, and it is shown in `demo-week29.md`.

---

## 6. What is not verified

- The two shops were signed up during the rehearsal, not in one continuous recording. No `.mp4` was recorded.
- WhatsApp messages were simulated, and WhatsApp does not reply yet. USSD was tested with `curl`, not the Africa's Talking simulator.
- Brio's Safaricom reply text was not captured separately. The order is `paid` and the wallet has a receipt.
- The AI cannot confirm the reflog notes are in Sheryl's own words (see section 1).
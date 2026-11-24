<!--
=============================================================================
FILE: launch-blockers.md  (repo root)  (Week 30 Day 1, Task 5)
=============================================================================

WHY THIS FILE EXISTS
  After QA and bug triage there are many issues. This file is the short list
  of the ones that must be closed before launch. Everything not on this list
  ships.

WHY IMPORTANT
  Without it, every small bug looks like a reason to delay and nothing ships.
  With it, "ready to launch" has a clear, checkable meaning.

DANGER
  - Keep it SHORT. Every line you add is a line that can delay the launch.
  - Do not add an item because it is annoying. Add it only if you are
    unwilling to launch without it.
  - This file records Sheryl's decisions. AI wrote the text only (Week 30
    rules: severity calls and launch blockers are NOT for AI).

WHAT IT SOLVES
  Everyone, including a client or a reviewer, can see exactly what "done"
  means for launch.

SYSTEM DESIGN PRINCIPLE
  Decide the finish line before you run. Triage first, then draw the line.

RULES
  1. An issue is on the list only if it must be closed to launch.
  2. Each item has its GitHub issue number and one reason.
  3. Tick an item only when its issue is closed AND the case in
     `qa/manual-plan.md` has been re-run and passes.
  4. Anything not here ships as a known issue.

WHERE USED
  Read it before launch day. Tick items as they close.

TRADEOFFS
  + Clear, short, honest.
  - It must be kept up to date. If a new blocker appears, add it with a reason.
=============================================================================
-->

# Launch blockers

**Decided by:** Sheryl, 24 November 2026

**Source:** the 43-case manual QA (`qa/manual-plan.md`) and the GitHub issues
opened from it.

## Must be closed before launch

| Done | Issue | Severity | What | Why it blocks launch (Sheryl's reason) |
|---|---|---|---|---|
| [ ] | #6 | high | Owners cannot edit or delete a product | An owner must be able to manage their own products. |
| [ ] | #7 | high | Sample products say "Edit or delete it" with no edit or delete | Fixed together with #6, so the page does not promise something that does not exist. |
| [ ] | #8 | high | Owners cannot reply to a WhatsApp message from the inbox | Meta must be connected and replies added inside the app before launch. |

**How to close each one:**
- **#6 and #7:** build edit and delete in the web app (the API already has
  both), then re-run QA case P6 and P6b. For shops that already exist, the
  sample text is stored in the database, so those rows need updating too.
- **#8:** connect Meta's real WhatsApp Business account, add a reply route and
  a reply box, then re-run QA case W5 with a real number.

## Ships as a known issue

These are real problems, and they do **not** block launch.

| Issue | Severity | What | What an owner can do meanwhile |
|---|---|---|---|
| #4 | medium | A business name made only of symbols (such as `@@@`) creates a shop with an empty address and no shop link. | Use a business name with letters or numbers. Tell new owners in the signup help text if it happens often. |
| #5 | medium | A price with 10 or more digits says "numbers only" instead of "too large". Nothing is saved wrongly. | Use a normal price. The limit is about KES 21.4 million. |

## Other known limits (written down, not part of the blocker decision)

These are described honestly elsewhere, so nobody is misled:

- No automatic tests for the web app and the workers (`apps/workers` is only a
  placeholder). See `NEXT.md`, section 4.
- M-Pesa is tested in the Daraja sandbox only. Refunds, reversals and
  reconciliation are not built. See `NEXT.md`, section 1.
- WhatsApp is simulated, and USSD is tested with `curl` only. See
  `qa/manual-plan.md`.
- The automatic tests leave test data in the real Aminas Boutique shop. See
  the findings table in `qa/manual-plan.md`.

<!--
=============================================================================
PIECE BY PIECE
=============================================================================
Must be closed       : the finish line. Real life: the sheet by the shop door
                       that says "we open when these are done".
Done checkbox        : a tick for you. Tick it only when the issue is closed
                       AND the QA case passes again.
Ships as known issue : an honest "we know, and it is fine for now". Real life:
                       the flickering light is on the list, but it does not
                       stop the opening.
Other known limits   : things that are not issues but that a reader should
                       know, so nobody is surprised later.
=============================================================================
-->
<!--
=============================================================================
FILE: NEXT.md  (repo root)  (Week 29 Weekend)
=============================================================================

WHY THIS FILE EXISTS
  The weekend rule is "no new features, only bug fixing and stability". But
  while testing, ideas keep appearing. This file is the parking lot: every
  idea goes HERE instead of into the code, so the capstone stays stable and
  nothing good is forgotten.

WHY IMPORTANT
  A new feature added on the last weekend is the most common way a working
  demo breaks. Writing the idea down costs one minute and risks nothing.
  It also gives an honest list of what is NOT built, so nobody is misled.

DANGER
  Nothing in this file exists yet. Do not treat any line as built, and do not
  start an item before reading its "Why it matters" paragraph.

WHAT IT SOLVES
  Ideas stay out of the code, and they also stay out of your head.

SYSTEM DESIGN PRINCIPLE
  Freeze, then plan. Make what exists stable, write the next steps down, and
  do them only after everything is submitted.

RULES
  1. Ideas only. No code lives here.
  2. Every idea says what it is, why it matters, and what proves it is done.
  3. When an item is built, move it to the README or the audit and delete it
     from here.

WHERE USED
  Read it when planning the work after submission.

WHERE YOU WILL USE THIS PRINCIPLE IN FUTURE PROJECTS
  Any project with a deadline or a demo: keep a NEXT file from day one.
  Whenever a teammate or a client says "can we also add...?" during a code
  freeze, the answer is "yes, it is in NEXT.md", and the release stays safe.

TRADEOFFS
  + Zero risk to the demo.
  - Items can go stale. Re-read an item before starting it.
=============================================================================
-->

# NEXT: ideas for after the capstone is submitted

Nothing on this page is built. Everything here is a plan.

The ideas are grouped by what they protect: money first, then customers, then
the stability of the system, then the quality of the project.

> **Update 27 Nov 2026:** the live to-do list is now **`docs/PENDING_TASKS.md`**
> (one merged list, with codes P1 and up, the hybrid build batches and the
> decisions). Several ideas below are already done or changed: customer cart,
> checkout and pay, product edit and delete, and reconciliation of payments now
> exist, and the product is becoming a hybrid marketplace plus shops. Read that
> file for the true status. This page stays as the original parking lot of ideas.

---

## 1. Money safety

Do these BEFORE real shillings flow. Today M-Pesa is only tested in the Daraja
sandbox, and these four gaps start to matter the moment a real customer pays.

### 1.1 STK confirmation retry

**What it is.** When a customer pays, M-Pesa sends our server a confirmation
(the callback). If that confirmation is lost, the order stays "created" forever
even though the money was paid.

**Why it matters.** The customer has paid, the owner sees nothing, and both are
upset. Real life: you pay the mama mboga by M-Pesa, her phone is off, and she
never gets the SMS, so she thinks you did not pay.

**Done when.** A payment with no callback after a few minutes is checked
directly against Daraja's query API, and the order updates by itself.

### 1.2 Reconciliation

**What it is.** A daily check that compares Daraja's list of payments with our
wallet entries and flags every difference.

**Why it matters.** The only way to know the wallet is right is to compare it
with the other side. Real life: a shopkeeper counts the till against the
M-Pesa statement every evening, so a missing 500 shillings is found the same
day and not at the end of the month.

**Done when.** A report says "all matched", or lists the payments that do not.

### 1.3 Reversals and refunds

**What it is.** The owner can refund a paid order, and the wallet records it.

**Why it matters.** The ledger already allows the reason "refund", but no
button and no API creates one. Real life: a customer returns a dress, and the
owner has no way to give the money back inside the system.

**Done when.** A refund adds a new negative wallet entry, never edits an old
one, and the balance stays correct.

### 1.4 Pay on delivery is NOT planned

This is a decision, not an idea. Payment is M-Pesa only. Do not add cash on
delivery.

---

## 2. Customers: the online shop

### 2.1 The build order

**What it is.** The online shop is built in small steps, and each step needs
the one before it:

1. Cart: a customer collects products.
2. Checkout API: turns a cart into an order.
3. Pay API: starts the M-Pesa prompt for that order.
4. Checkout pages: the screens for steps 1 to 3.
5. Settings page: shop name, phone and shop link (it shows "soon" today).
6. Product edit and delete: today an owner can only add products.

**Why it matters.** You cannot pay for a cart that does not exist, and you
cannot edit a product that was never saved. Building out of order wastes time.

**Done when.** A customer can open the shop link on a phone, pick products,
pay with M-Pesa, and the owner sees the paid order.

### 2.2 WhatsApp replies

**What it is.** Today we only RECEIVE WhatsApp messages. The owner cannot answer
from the inbox.

**Why it matters.** A customer who messages and gets no answer buys somewhere
else.

**Done when.** The owner types a reply in the inbox and the customer receives
it on WhatsApp.

### 2.3 Real-phone checks

**What it is.** Two tests on real devices. First, open the shop link on a real
phone on mobile data, not only on a laptop. Second, test USSD with a real phone
or the operator's simulator, because today it is tested with curl only.

**Why it matters.** Real phones and real networks behave differently from a
laptop on home Wi-Fi.

**Done when.** Both checks are written down with the date and the result.

---

## 3. Stability and performance

### 3.1 Pool size experiment

**What it is.** Run the load test with the database pool at 10, 20 and 40
connections, at several levels of concurrency.

**Why it matters.** The pool is 20 today, and nobody has measured whether that
is right. The burst test showed higher latency, and its cause is not proven.
Real life: a bank with 20 tellers might be too many or too few. You find out by
counting the queue at different staffing levels.

**Done when.** PERFORMANCE.md has a table of pool size against speed and
errors, and the chosen number has a reason.

### 3.2 More failure types in the chaos test

**What it is.** Today the chaos test only cuts IDLE database connections. That
already found a real crash, which is now fixed.

**Still untested.** A connection cut in the middle of a query, a database that
restarts, a slow database, and Daraja not answering.

**Why it matters.** Real failures are messy. The first one we tried found a
bug, so the others probably will too.

**Done when.** Each case has a test and a line in RUNBOOK.md.

### 3.3 A cursor that looks valid but is fake

**What it is.** The inbox and payments pages now ignore obvious junk in the
address bar, such as `@@bad!!`. A bookmark that LOOKS valid but is made up still
gets a 400 from the API and shows the error page.

**Why it matters.** Real life: a link cut short by WhatsApp can still look
valid, and the accountant who opens it sees "We're having trouble", which is
the wrong message.

**Done when.** The page catches that 400 and falls back to the newest page, as
the public shop page already does.

### 3.4 Redis, queues and a notification service

**What it is.** Docker runs Redis, but no code uses it today. The assignment
also mentioned a notification-service, which does not exist.

**Why it matters.** An unused service is clutter and a distraction. The chaos
test cut database connections instead of a notification service for exactly
this reason.

**Done when.** A decision is written down: either use Redis (for queues or rate
limits) and build the notification service, or remove Redis from the setup.

---

## 4. Quality

### 4.1 Tests for the web app and the workers

**What it is.** `npm test` in the API runs 30 suites (312 tests). The web app
and the workers have no tests at all.

**Why it matters.** The weekend page review was done by reading code and
clicking pages. A test would catch a broken empty state without a person.

**Done when.** There is at least one test per page for the empty state and for
the error state.

### 4.2 Upgrade Next.js from 16.4.2 to 16.4.6

**What it is.** A version upgrade of the web framework.

**Why it matters.** It brings fixes, but an upgrade can also break things.
Real life: you change the tyres on a matatu in the garage, not on the highway
with passengers inside.

**Done when.** The upgrade is its OWN commit, so if anything breaks it is easy
to undo, and the whole app still works.

### 4.3 Stale line in `isolation-proof.md`

**What it is.** One line, around line 478, no longer matches reality.

**Done when.** The line is corrected, after submission.

### 4.4 Demo video

**What it is.** No recording exists. The written demo record and the scripted
demo runs exist, but there is no .mp4.

**Why it matters.** A video lets someone see the demo without installing
anything.

**Done when.** A video is recorded, and the audit is updated to say so.

### 4.5 Your own housekeeping

**What it is.** Two things that are yours to do. Tick the audit "re-read"
boxes yourself, and decide whether to make the repository private and add the
instructor.

**Why it matters.** The boxes record that YOU read the audit. Nobody can tick
them for you.

**Done when.** The boxes are ticked, and the repository setting is chosen.

---

## How to use this file

1. After everything is submitted, pick ONE item.
2. Read its "Why it matters" paragraph.
3. Do it on its own branch, with its own commit.
4. When it is done, delete it from here and mention it in the README.

<!--
=============================================================================
PIECE BY PIECE
=============================================================================
Section 1 (money)      : first, because real money makes every bug expensive.
                         Real life: you check the till before you open the
                         shop, not after.
Section 2 (customers)  : the online shop steps, in the order they depend on
                         each other. You cannot pay for a cart that does not
                         exist yet.
Section 3 (stability)  : measurements and extra failure tests. They protect
                         what already works.
Section 4 (quality)    : tests, upgrades and housekeeping.
"What it is"           : the idea in plain words, so it still makes sense in
                         three months.
"Why it matters"       : the reason, with a real-life example. Without a
                         reason, an idea is just a wish.
"Done when"            : how to PROVE the item is finished. Without it, "done"
                         is just a feeling.
=============================================================================
-->
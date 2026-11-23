<!--
FILE: capstone/demo-script.md

WHY THIS FILE EXISTS
  The Week 29 demo is five minutes long and shows two shops using Rahisisha at
  the same time. This is the minute-by-minute script I follow while I record,
  plus the setup I do BEFORE the camera starts and the honest limits I say out loud.

WHY IMPORTANT
  The main promise of the product is that one shop never sees another shop's
  data. A demo that wanders, or hides what is not finished, proves nothing.
  A script keeps it to five minutes and keeps it honest.

DANGER
  - The M-Pesa part uses Safaricom's SANDBOX, but on 16 November 2026 it took
    KES 1,200 from a real M-Pesa balance (Safaricom reversed it later). Use only
    my own number and only the smallest order.
  - Never show .env, a consumer key, a secret, a passkey or a token on screen.
  - Close the ngrok tunnel when the recording is done.

WHAT IT SOLVES
  Turns the Week 29 work (USSD, WhatsApp, M-Pesa, all per shop) into one story
  with two shops, so the isolation promise can be SEEN, not only claimed.

SYSTEM DESIGN PRINCIPLE
  Prove isolation by contrast: do the same four things for shop A and shop B,
  then show that A's data never appears for B and B's never for A.

RULES
  1. Same four steps for both shops: sign up, USSD, WhatsApp, M-Pesa.
  2. Different credentials for each shop (different phone, password, shop name).
  3. Say what is real and what is simulated. Do not pretend.
  4. Total length: 5 minutes. Practise once with a timer.

HOW TO USE
  Do "BEFORE YOU PRESS RECORD" first. Then read the five parts in order.
  Lines marked **YOU FILL** are for me to check or complete after rehearsing.

AI AUDIT NOTE
  This script was written by AI at my request (the assignment allows AI for the
  demo script). It is declared in AI_AUDIT.md and AI_AUDIT_week_29_day5.md.
  The reflog notes are NOT part of this: those are my own words.
-->

# Week 29 Demo Script: Two Shops, One Platform

**Presenter:** Sheryl Ochieng
**Date:** 23 November 2026
**Length:** 5 minutes (five parts, minute by minute)
**Story:** Aminas Boutique (shop A) and Brio Hardware (shop B) both join Rahisisha. Each one gets USSD, WhatsApp and M-Pesa on its own. At the end, A never sees B's messages and A's wallet is not B's wallet.

| | Shop A | Shop B |
|---|---|---|
| Shop name | Aminas Boutique | Brio Hardware |
| Owner phone (login) | 0700000001 | 0700000002 |
| Password | my practice password A (on paper) | my practice password B (on paper, different) |
| USSD code | `*384*101#` | `*384*102#` |
| WhatsApp number id | `demo-pid-amina` | `demo-pid-brio` |
| M-Pesa | sandbox | sandbox |

Why "Aminas" with no apostrophe: signup turns the shop name into its web address. "Aminas Boutique" becomes `aminas-boutique`, which is the name the USSD, WhatsApp and M-Pesa setup scripts look for. "Amina's Boutique" would become `amina-s-boutique` and the scripts would not find it.

**Recording plan (decided 23 November 2026):** I signed both shops up during the rehearsal, a few minutes before recording, so the video starts with LOGIN, not a fresh signup. I say this out loud in Part 1. Because the rehearsal already ran USSD, WhatsApp and one M-Pesa payment per shop, the inboxes and wallets already hold that activity, and the recording adds a second round on top of it.

---

## BEFORE YOU PRESS RECORD (about 10 minutes, off camera)

1. Stop anything else using ports 3000 and 3001. Start Docker, Postgres and Redis.
2. Database: already reset and loaded during the rehearsal (23 November). Do NOT reset again, or both shops are lost. (To start over completely: hide `scripts/demo-data.sql` by renaming it, run `bash scripts/reset-db.sh` in Git Bash, rename it back, then sign up both shops again.)
3. Start the API (`cd apps/api && npm run dev`) and the web app (`cd apps/web && npm run dev`).
4. Start the ngrok tunnel to port 3000. Put its https address in `apps/api/.env` as `DARAJA_CALLBACK_BASE` (no trailing path), then restart the API.
5. Open **two separate browser windows**: one normal (shop A) and one private/incognito (shop B). They do not share login cookies.
6. Already done in the rehearsal: both shops signed up (Aminas Boutique, Brio Hardware), the USSD, WhatsApp and M-Pesa settings loaded for both. If the ngrok address changed, update `DARAJA_CALLBACK_BASE` in `apps/api/.env`, press `rs` in the API terminal, and run `node scripts/seed-daraja-demo.js` again (two `OK` lines).
7. Log in from PowerShell as each owner (practice passwords, never on camera):
   `Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/login -ContentType 'application/json' -Body (@{ phone = '0700000001'; password = 'A-PASSWORD' } | ConvertTo-Json) -SessionVariable sA`
   and the same with phone `0700000002` and `-SessionVariable sB`.
8. Make ONE NEW small order per shop (the earlier ones are already paid), the cheapest item, quantity 1 (Sample: Sugar 1kg, KES 160). Amina's Sugar id is `857f81fb-d8ff-4c8a-9173-ba2b70a33349`, Brio's is `b18ca473-e091-4d9c-96dd-00804d84ccc6` (look them up again if the database was reset):
   `$oa = @{ customerPhone = '254722000001'; channel = 'web'; items = @(@{ productId = '857f81fb-d8ff-4c8a-9173-ba2b70a33349'; quantity = 1 }) } | ConvertTo-Json -Depth 5`
   `Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/orders -ContentType 'application/json' -Body $oa -WebSession $sA | ConvertTo-Json -Depth 5`
   Do the same with `$ob`, Brio's Sugar id, `customerPhone = '254733000002'` and `-WebSession $sB`. Write down both new order ids.
9. Write down the wallet balance of each shop BEFORE recording (from the dashboard). After the rehearsal they were KES 12,660 (Amina) and KES 8,460 (Brio). Each new payment adds KES 160.
10. Rehearse the whole thing once with a timer. If the M-Pesa prompt does not confirm in the sandbox, see "If M-Pesa misbehaves" at the end.

---

## PART 1: Two shops, two owners (0:00 to 1:00)

**Say:** "Rahisisha is one platform for many small shops. Two shops joined it just before this recording: Aminas Boutique and Brio Hardware, with different phones and different passwords. Signup creates a shop, an owner and the link between them in one step. I signed them up a few minutes ago, so now I log in as each."

**Show:**
1. Window 1: log in as **Aminas Boutique**, phone 0700000001. The dashboard says Aminas Boutique and shows its own wallet balance and its own shop link (`aminas-boutique`).
2. Window 2 (private): log in as **Brio Hardware**, phone 0700000002. The dashboard says Brio Hardware, with a different balance and the link `brio-hardware`.
3. Point at the two shop links and balances: same app, two separate worlds.

**Why it is safe:** signup stamps the new shop's id on the database connection before it writes anything, and the database lock (Row-Level Security) then only lets that shop see its own rows.

**Honest note:** the signups were done in my rehearsal, just before recording, not on camera. Because of that, both shops already hold the rehearsal activity (USSD dial-ins, one WhatsApp message and one KES 160 payment each).

---

## PART 2: USSD, per shop (1:00 to 2:00)

**Say:** "A customer with no smartphone dials a short code. The code decides which shop answers. It is never the phone number, because one phone can shop at many shops."

**Show** (PowerShell, `curl.exe`; the phone number is deliberately the SAME for both):

```powershell
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=a1" -d "phoneNumber=+254711111111" -d "text="
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*102#" -d "sessionId=b1" -d "phoneNumber=+254711111111" -d "text="
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=a2" -d "phoneNumber=+254711111111" -d "text=1"
curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*102#" -d "sessionId=b2" -d "phoneNumber=+254711111111" -d "text=1"
```

- The first two show "Karibu Amina's Boutique" and "Welcome to Brio Hardware" (the welcome text is each shop's own setting).
- The last two show A's products (Maxi Dress, Kitenge Top) and B's products (Cement 50kg, Hammer), after each shop's own sample items. No mixing.
- Every USSD dial-in is also saved in that shop's own inbox (you see it in Part 3).

**Honest note:** I tested USSD with `curl` and automated tests, not yet with the Africa's Talking simulator.

---

## PART 3: WhatsApp and the inbox (2:00 to 3:00)

**Say:** "Customers message each shop's own WhatsApp number. The shop is found from the number id inside Meta's message, never from anything the customer types. I am pretending to be Meta here."

**Show:**
1. In PowerShell send one message to A (`phone_number_id` = `demo-pid-amina`) and one to B (`demo-pid-brio`), from different customers. Use NEW message ids each time (`wamid.DEMO-A-2`, `wamid.DEMO-B-2`), because the rehearsal used `-1`. Build the JSON with a hashtable and `ConvertTo-Json -Depth 10` (pasting multi-line JSON loses the brackets):
   `$a = @{ entry = @(@{ changes = @(@{ value = @{ metadata = @{ phone_number_id = 'demo-pid-amina' }; contacts = @(@{ profile = @{ name = 'Wanjiru' } }); messages = @(@{ id = 'wamid.DEMO-A-2'; from = '254722000001'; type = 'text'; text = @{ body = 'Hi, is the Kitenge Top in stock?' } }) } }) }) } | ConvertTo-Json -Depth 10`
   `Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/whatsapp -ContentType 'application/json' -Body $a`
   For Brio use `demo-pid-brio`, `wamid.DEMO-B-2`, `from = '254733000002'`, body `Is the Cement 50kg still KES 750?`, and `$b`. The answer should say `received=1`.
2. Window 1 (A): open **Inbox**. Only A's WhatsApp messages and A's USSD dial-ins are there (the "WA" and "USSD" tags). Nothing from B.
3. Window 2 (B): open **Inbox**. Only B's messages are there. Nothing from A.
4. Send A's message again with the same message id: the answer says `duplicates=1`, so nothing is saved twice.

**Why it is safe:** the shop's access token is stored encrypted, and each message is saved inside that shop's own lock. A's inbox query cannot return B's rows.

**Honest note:** WhatsApp only SAVES messages for now. It does not reply yet, and the messages are simulated, not from a real WhatsApp number.

---

## PART 4: M-Pesa, per shop (3:00 to 4:30)

**Say:** "Now each shop gets paid. The customer pays an order by M-Pesa. The amount comes only from the order, never from the request, and the wallet grows only after Safaricom confirms."

**Show:**
1. Start a sandbox payment for A's NEW order (from setup step 8) with your own number in place of 07XXXXXXXX: `Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/orders/<A order id>/pay -ContentType 'application/json' -Body (@{ phone = '07XXXXXXXX' } | ConvertTo-Json) -WebSession $sA`. The answer is `pending` and the phone shows the M-Pesa prompt. Enter the PIN. Blur your number if it is on screen.
2. Safaricom calls back to A's own address (`/callbacks/mpesa/<A's shop id>`). A's order becomes `paid`.
3. Window 1: open **Payments** (the wallet). A's wallet shows a new KES 160 sale, and the balance is KES 160 higher than before.
4. Do the same for B's order with B's login and B's address.
5. Window 2: B's wallet shows B's own KES 160 sale. A's wallet is unchanged by it.
6. Optional proof: try to pay the same order twice. The system answers `order_not_payable`, so nothing is charged or credited twice.

**Why it is safe:** each shop has its own M-Pesa settings, encrypted with its own shop id. The callback credits only the shop in its own address, only if our own pending payment matches, and only once. Posting the same result twice changes nothing.

**Honest note:** M-Pesa is built and tested, but not finished. The sandbox confirmation step failed once on 16 November. Refunds, reversals and reconciliation are not built.

---

## PART 5: The proof (4:30 to 5:00)

**Say:** "So what did we just see? Same four steps, two shops, and nothing leaked."

**Show:**
- A's inbox has no message from B. B's inbox has no message from A.
- A's wallet total is not B's wallet total.
- The tests (run before recording): `cd apps/api` then `npm run test:isolation` shows the isolation suites passing. **YOU FILL**: paste the real numbers from today's run (the full project ran 29 suites, 310 tests on 19 November 2026).
- Last line: "Every push runs these isolation tests first. If one fails, the push is blocked."

**Known limits (say one sentence):** WhatsApp does not reply yet, M-Pesa refunds and reconciliation are not built, and the public online shop (cart and checkout) is next.

---

## IF M-PESA MISBEHAVES (fallback, say it honestly)

If the sandbox prompt does not arrive or the result never comes back, do not fake it. Say: "The Safaricom sandbox is unreliable, and this is the same step that failed once before." Then run `node scripts/check-payment.js` (read-only, shows what the system recorded) and `npm test` to show the payment tests with a fake Safaricom. Record that instead of a fake success.

---

## AFTER RECORDING

- Close the ngrok tunnel and stop the servers.
- Check the video does not show `.env`, keys, tokens or your real phone number.
- Save the video as `demo-week29.mp4` and put the link or file in the submission.

---

## EVIDENCE (fill after the run)

- Date and time of the recording: **YOU FILL**
- Isolation tests: **YOU FILL**
- Full project tests: **YOU FILL**
- Rehearsal result, 23 November 2026: both orders `paid` with a recorded receipt. Amina's wallet KES 12,660 (practice balance KES 12,500 plus KES 160), Brio's wallet KES 8,460 (practice balance KES 8,300 plus KES 160). Different receipts, different wallets.
- Recording payment results (order `paid`, wallet amounts for A and B): **YOU FILL**
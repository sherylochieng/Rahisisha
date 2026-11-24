<!--
=============================================================================
FILE: qa/manual-plan.md  (Week 30 Day 1, Task 2)
=============================================================================

WHY THIS FILE EXISTS
  Automatic tests only check what someone thought to test. A written manual
  plan makes a person walk through the app like a real owner and customer,
  and writes down what really happened.

WHY IMPORTANT
  The bugs a customer finds are usually the ones in the gaps between tests:
  a name with odd symbols, a link cut by WhatsApp, a button that was never
  built. Every failure here becomes a GitHub issue (Task 3).

DANGER
  - The "Expected" column was written from the code BEFORE the test was run.
    If the app disagrees, do not edit "Expected" to match. Write the real
    result in "Actual" and mark FAIL. That is how a bug is caught.
  - Never put real passwords or real phone numbers in this file.
  - Severity (blocker / high / medium / low) is NOT decided here. That is
    Sheryl's judgment in Task 3 and Task 5.

WHAT IT SOLVES
  A repeatable checklist anyone can run before a release.

SYSTEM DESIGN PRINCIPLE
  Write the expected result first, then look. Otherwise you only see what you
  hoped to see.

RULES
  1. Run the cases in the order written. Later cases use shops made earlier.
  2. For each case fill in Actual and Result (PASS, FAIL or NOT BUILT).
  3. A case that fails gets a GitHub issue. Put the issue number in Actual.
  4. AI wrote the cases (allowed this week). Sheryl runs them and judges them.

WHERE USED
  Linked from the Week 30 Day 1 submission. Re-run after every big change.

TRADEOFFS
  + Finds real-world problems that tests miss.
  - Slow, and a person can make mistakes. Keep the list short and useful.
=============================================================================
-->

# Manual QA plan (Week 30 Day 1)

**Run date:** 24 November 2026 **Tester:** Sheryl **Build:** git commit b709d8bee

## Setup (do once)

1. Postgres is running. Start the API: `cd apps/api; npm run dev` (port 3000).
2. Start the web app: `cd apps/web; npm run dev` (port 3001).
3. Two shops exist from the demo: **Aminas Boutique** (shop A, phone
   `0700000001`) and **Brio Hardware** (shop B, phone `0700000002`). If the
   database was reset, sign them up again (see `RUNBOOK.md`).
4. Log in from PowerShell as each owner and keep the sessions (replace the
   passwords with your practice ones):

   ```
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/login -ContentType 'application/json' -Body (@{ phone = '0700000001'; password = 'A-PASSWORD' } | ConvertTo-Json) -SessionVariable sA
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/login -ContentType 'application/json' -Body (@{ phone = '0700000002'; password = 'B-PASSWORD' } | ConvertTo-Json) -SessionVariable sB
   ```

5. For the M-Pesa cases, ngrok must be running and `DARAJA_CALLBACK_BASE` set
   (see `capstone/demo-script.md`, setup steps 4 and 6).
6. Open one normal browser window for shop A and one private window for shop B.

---

## 1. Signup

Use the signup page at `http://localhost:3001/signup`. Use new phone numbers
such as `0711000001`, `0711000002` for cases that create accounts.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| S1 | Sign up with name "Test Owner", phone `0711000001`, a password of 8+ characters, business "Qa Duka One". | Lands on `/dashboard`. Shows "Qa Duka One", a shop link containing `qa-duka-one`, and sample products. | Dashboard for Qa Duka One. Shop link `qa-duka-one.localhost:3001`. Wallet KES 0.00. Three sample products. | PASS |
| S2 | Sign up with a DIFFERENT phone `0711000002` and the SAME business "Qa Duka One". | Works. The second shop gets the address `qa-duka-one-1` (a number is added). No error. | Worked. Second shop link is `qa-duka-one-1.localhost:3001`. | PASS |
| S3 | Sign up with phone `0711000001` again (already used in S1) and a new business name. | Error under the phone box: "This phone number already has an account. Try logging in." No new shop is made. | Under the phone box: "This phone number already has an account. Try logging in." No shop made. | PASS |
| S4 | Sign up with a 7-character password. | Error under the password box: "Password must be 8 to 72 characters." Not submitted. | "Password must be 8 to 72 characters." under the password box. | PASS |
| S5 | Sign up with a 1-character business name, e.g. "A". | Error under the business box: "Business name must be 2 to 100 characters." | "Business name must be 2 to 100 characters." under the business box. | PASS |
| S6 | Sign up with the business name `@@@` (symbols only). Use a new phone `0711000003`. | Should be refused with a clear message, OR given a usable shop address. It must NOT create a shop with an empty address. (Suspected bug: the address may come out empty.) | Signup ACCEPTED `@@@`. Dashboard opened, but the "Your shop link" card is missing. `/v1/me` shows `"slug":""` (empty shop address). The shop can never have a public page. Issue: ______ | FAIL |
| S7 | Sign up with the business name "Mama's Duka" and a new phone. | Works. Shop address is `mama-s-duka` (the apostrophe becomes a dash). | Worked. Shop link is `mama-s-duka.localhost:3001`. Sample products present. | PASS |
| S8 | Open `http://localhost:3001/shop/no-such-shop-xyz`. | The "Page not found" (404) page. No crash. | "Page not found" 404 page with a link to the home page and the login page. | PASS |

## 2. Login

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| L1 | Log in at `/login` with shop A's phone and the right password. | Goes to `/dashboard`, shows Aminas Boutique. | Dashboard of Aminas Boutique (12 orders today, wallet KES 12,500.00). | PASS |
| L2 | Log in with the right phone and a WRONG password. | A clear error. Stays on the login page. No details about which part was wrong. | "Invalid credentials". Stayed on the login page. | PASS |
| L3 | Log in with a phone that has no account (`0799999999`). | An error. Same kind of message as L2. No crash. | "Invalid credentials" (identical to L2). No crash. | PASS |
| L4 | In a private window with no login, open `http://localhost:3001/dashboard`. | Sent to `/login`. No dashboard numbers are shown. | After closing all private windows and opening a new one, `/dashboard` sent me to the login page. (First attempt was invalid: an old private window was still logged in.) | PASS |
| L5 | In that same private window, open `/inbox`, `/orders`, `/payments`, `/products`. | Each one sends you to `/login`. | `/inbox`, `/orders`, `/payments`, `/products` all sent me to the login page. | PASS |

## 3. Products

Logged in as shop A in the browser.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| P1 | Products, "Add product". Name "QA Soap", price `150`, status Active. Save. | Returns to the list. "QA Soap" shows KES 150.00, active. | Done on shop Qa Duka One (not Aminas, to keep the demo shop clean). "QA Soap" KES 150.00 active is in the list. Note: it sits in the MIDDLE of the list, not newest first (list is ordered by id). Issue: ______ | PASS |
| P2 | Add a product with price `abc`. | Error under price: "Enter a price like 350 or 350.50 (numbers only)." Nothing saved. | "Enter a price like 350 or 350.50 (numbers only)." under price. Form stayed open. | PASS |
| P3 | Add a product with an empty name. | Error under name: "Enter the product name." | "Enter the product name." under name, no price error (from a clean form). | PASS |
| P4 | Add two products with the same SKU `QA-1`. | Second one: "You already have a product with this SKU. Use a different one." | Second save: "You already have a product with this SKU. Use a different one." under SKU. | PASS |
| P5 | Add a product with a very large price, `99999999999`. | Error: "That price is too large. Please enter a smaller amount." | `99999999999` (11 digits) gave "Enter a price like 350 or 350.50 (numbers only)", NOT "too large". Nothing saved. Cause: the price reader accepts at most 9 digits, so a 10+ digit price is treated as "not a number". The "too large" message works for `30000000` (8 digits). Issue: ______ | FAIL |
| P6 | Look for a way to EDIT or DELETE "QA Soap". | **NOT BUILT** (only add and list exist). Record it as a known gap. | The Products list has no Edit or Delete buttons. Known gap. Issue: ______ | NOT BUILT |
| P6b | Read the description under a sample product on the public shop page. | (Not in the original plan; found while running P6.) The text should not promise something that does not exist. | Each sample says "Sample product. Edit or delete it when you add your own." but edit and delete are NOT built. Misleading. Issue: ______ | FAIL |
| P7 | Open the public shop page `/shop/aminas-boutique`. | "QA Soap" appears (it is active). A draft product does NOT appear. | `/shop/qa-duka-one` lists Sugar, QA Soap and the 3 samples. "QA Draft" (draft) is NOT there. | PASS |

## 4. Orders and M-Pesa (Daraja sandbox)

Use the PowerShell sessions from the setup. The M-Pesa prompt goes to a real
phone, so use your own number and never show it on camera.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| O1 | Create an order for shop A: `$oa = @{ customerPhone = '254722000001'; channel = 'web'; items = @(@{ productId = '<a real product id of shop A>'; quantity = 1 }) } \| ConvertTo-Json -Depth 5` then `Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/orders -ContentType 'application/json' -Body $oa -WebSession $sA`. | Answers with the new order, status `created`. It shows on the Orders page. Note the order id. | Order `77aa5f5d-d6e7-4206-9681-10b8dd774e1b`, status `created`, total_cents 16000. Shown on the Orders page as KES 160.00 created. (First try used an old product id from before a database reset; the API refused it correctly.) | PASS |
| O2 | Create an order with `quantity = 0`. | Refused with a 400 error. No order is made. | 400 "Request validation failed", detail "Number must be greater than 0". No order made. | PASS |
| O3 | Create an order with a product id that does not exist (`00000000-0000-0000-0000-000000000000`). | Refused with a clear error. No crash. | Unknown product id: `{"error":{"message":"One or more products not found"}}`. No crash. (Seen with an old product id rather than the all-zero id.) | PASS |
| O4 | Pay the O1 order: `Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/orders/<order id>/pay -ContentType 'application/json' -Body (@{ phone = '07XXXXXXXX' } \| ConvertTo-Json) -WebSession $sA`. Enter the PIN on the phone. | Answer is `pending`, then the phone shows the M-Pesa prompt. After the PIN the order becomes `paid`. | Answer `pending` ("Check your phone and enter your M-Pesa PIN"). Prompt came, PIN entered, order became `paid`. | PASS |
| O5 | After O4, open the Payments page and the Dashboard. | A new "Sale" line with the M-Pesa receipt. The wallet balance grew by exactly the order total. | Payments shows Sale `UKO6I3I1V2`, +KES 160.00, 24 Nov 14:49. Wallet KES 12,500.00 to KES 12,660.00. | PASS |
| O6 | Pay the SAME order again (repeat the O4 command). | Refused with `order_not_payable`. No second charge, no second wallet entry. | Second pay: `order_not_payable` "Order is 'paid', only a 'created' order can be paid". No second wallet entry. | PASS |
| O7 | Make a new order and pay it, but press CANCEL on the phone prompt. | The order stays `created`. No wallet entry. (The sandbox is slow, so wait a minute.) | New order `9c15c91f-8513-49aa-bf84-6a8a19bb7e9a`, pay answered `pending`, prompt cancelled on the phone. Order stays `created`, no new Sale line. | PASS |

## 5. USSD (tested with `curl.exe`, not a real phone)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| U1 | `curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=qa1" -d "phoneNumber=+254711111111" -d "text="` | A menu that begins with `CON` and names Amina's Boutique (A's own welcome). | `CON Karibu Amina's Boutique` with menu 1 View products, 2 Check balance, 3 Exit. | PASS |
| U2 | Same, with `-d "text=1"` and `sessionId=qa2`. | The answer for menu option 1 of shop A, starting with `CON` or `END`. Nothing from shop B. | `END Products` listing Maxi Dress, Kitenge Top, Sample: Maize Flour, Sample: Cooking Oil. Only A's products, no drafts. Note: only 4 of 5 active products are listed (Sample: Sugar missing) and names are cut short. Issue: ______ | PASS |
| U3 | Same as U1 but with an unknown code `*384*999#`. | A polite refusal. No crash, no data from any shop. | `END Service unavailable`. No crash, no data. | PASS |
| U4 | After U1, open shop A's Inbox. | A row tagged USSD from `+254711111111`, "Dialled the USSD code". | Inbox shows USSD rows from 254711111111: "Dialled the USSD code" (15:03) and "Chose: 1" (15:07). | PASS |

## 6. WhatsApp (simulated, because we do not have a real Meta number)

Build the message like the demo script does (see `capstone/demo-script.md`,
Part 3). Use a NEW message id each time.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| W1 | Send a message to shop A (`phone_number_id = demo-pid-amina`, id `wamid.QA-A-1`). | The answer says `received=1`. | `received=1; duplicates=0`. | PASS |
| W2 | Open shop A's Inbox. | A row tagged WA with the message text and a Nairobi time. | Inbox row: WA, 254722000009, 24 Nov 15:14, "QA test: do you have a red dress?". | PASS |
| W3 | Send the SAME message id `wamid.QA-A-1` again. | The answer says `duplicates=1`. The inbox still shows it only once. | `received=0; duplicates=1`. Inbox shows the message once. | PASS |
| W4 | Send a message with an unknown `phone_number_id` (`nobody`). | No crash. Nothing saved to any shop. | `@{ignored=True}`. No crash. Nothing shown in either inbox. | PASS |
| W5 | Look for a way to REPLY to the customer from the inbox. | **NOT BUILT** (we only receive). Record it as a known gap. | The Inbox page has no reply box or button. Known gap. Issue: ______ | NOT BUILT |

## 7. Cross-tenant attempts (one shop trying to reach another)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| X1 | Open shop B's Inbox (private window), after A got messages in W1 and U1. | None of A's messages or USSD rows appear. | Brio's inbox (via the API) has only its own WhatsApp message and 2 USSD rows, all dated 23 Nov from the demo run. None of today's Aminas rows. | PASS |
| X2 | With shop A's session, try to pay shop B's order id: `.../v1/orders/<B order id>/pay` with `-WebSession $sA`. | Refused as "not found" (404). Shop B's order is untouched. | `not_found` "Order not found" (same answer as a missing order). (Whether a phone prompt arrived was not confirmed.) | PASS |
| X3 | Compare the Products pages of A and B. | Each shows only its own products. | A's list: Aminas products and its own drafts. B's list: Cement 50kg, Hammer and the samples. No mixing. | PASS |
| X4 | Open `/shop/aminas-boutique` and `/shop/brio-hardware`. | Each public page shows only that shop's products. | A's public list: Maxi Dress, Kitenge Top and 3 samples. B's: Hammer, Cement 50kg and 3 samples. No drafts, no crossover. | PASS |
| X5 | With NO cookie, call `curl.exe -i http://localhost:3000/v1/dashboard`. | `401`. No data. | `HTTP/1.1 401 Unauthorized`, body `{"error":"Not logged in"}`. | PASS |
| X6 | Take shop A's token and change one letter, then call the dashboard with it: `curl.exe -i -H "Cookie: token=<edited token>" http://localhost:3000/v1/dashboard`. | `401`. The edited token is refused. | `HTTP/1.1 401 Unauthorized`, body `{"error":"Session expired — please log in again"}`. | PASS |
| X7 | Send USSD for the SAME phone number to both shops (`*384*101#` and `*384*102#`). | Each shop answers with its OWN welcome. No mixing. | Shop B code `*384*102#`: `CON Welcome to Brio Hardware`. Shop A (U1) answered `Karibu Amina's Boutique`. Different shops, no mixing. Note: A's welcome is Swahili and B's is English. Check this is intended. | PASS |

---

## Summary (fill in after running)

| Group | Cases | Pass | Fail | Not built |
|---|---|---|---|---|
| Signup | 8 | 7 | 1 (S6) | 0 |
| Login | 5 | 5 | 0 | 0 |
| Products | 7 | 5 | 1 (P5) | 1 (P6) |
| Orders and M-Pesa | 7 | 7 | 0 | 0 |
| USSD | 4 | 4 | 0 | 0 |
| WhatsApp | 5 | 4 | 0 | 1 (W5) |
| Cross-tenant | 7 | 7 | 0 | 0 |
| **Total** | **43** | **39** | **2** | **2** |

Plus one extra case found while running: **P6b** (FAIL), not counted in the 43.

## Findings to turn into GitHub issues (Task 3)

Severity is NOT set here. Sheryl decides each one in Task 3.

| # | From | Finding |
|---|---|---|
| 1 | S6 (FAIL) | Business name `@@@` creates a shop with an EMPTY address (`slug` is `""`), so it has no shop link and no public page. |
| 2 | P5 (FAIL) | A price with 10 or more digits says "numbers only" instead of "too large". Nothing is saved. |
| 3 | P6b (FAIL) | Sample products say "Edit or delete it when you add your own", but edit and delete do not exist. |
| 4 | P6 (NOT BUILT) | No way to edit or delete a product. |
| 5 | W5 (NOT BUILT) | No way to reply to a WhatsApp message from the inbox. |
| 6 | observation | Automatic tests (and the pre-push isolation run) leave data in the real Aminas Boutique shop: "Test Product For Orders" drafts and KES 500 test orders. |
| 7 | observation (P1) | The Products list is ordered by id, not newest first. A new product can appear in the middle. |
| 8 | observation (U2) | USSD lists 4 of 5 active products and cuts names short. Check whether that is intended. |
| 9 | observation (X7) | Shop A's USSD welcome is Swahili, shop B's is English. Check whether that is intended. |

**GitHub issues opened (number and one-line title):**

- ______

<!--
=============================================================================
PIECE BY PIECE
=============================================================================
Setup               : the stage must be ready before the play. Real life: you
                      open the shop, switch on the till and stock the shelves
                      before the first customer.
ID (S1, L2, P4 ...) : a short name so a bug report can say "S6 failed".
Steps               : exactly what to do, so a different person gets the same
                      result.
Expected            : what SHOULD happen, written before looking.
Actual              : what REALLY happened, in your own words.
Result              : PASS (matches), FAIL (does not match, open an issue) or
                      NOT BUILT (the feature does not exist yet).
NOT BUILT           : not a mistake. It is an honest record that the feature
                      is missing, so it is triaged and not forgotten.
Cross-tenant group  : the most important group for a shared app. Real life:
                      checking that one shop's till key cannot open the
                      neighbour's till.
=============================================================================
-->
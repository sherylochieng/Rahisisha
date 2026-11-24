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

**Run date:** ______ **Tester:** Sheryl **Build:** git commit ______

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
| S1 | Sign up with name "Test Owner", phone `0711000001`, a password of 8+ characters, business "Qa Duka One". | Lands on `/dashboard`. Shows "Qa Duka One", a shop link containing `qa-duka-one`, and sample products. | | |
| S2 | Sign up with a DIFFERENT phone `0711000002` and the SAME business "Qa Duka One". | Works. The second shop gets the address `qa-duka-one-1` (a number is added). No error. | | |
| S3 | Sign up with phone `0711000001` again (already used in S1) and a new business name. | Error under the phone box: "This phone number already has an account. Try logging in." No new shop is made. | | |
| S4 | Sign up with a 7-character password. | Error under the password box: "Password must be 8 to 72 characters." Not submitted. | | |
| S5 | Sign up with a 1-character business name, e.g. "A". | Error under the business box: "Business name must be 2 to 100 characters." | | |
| S6 | Sign up with the business name `@@@` (symbols only). Use a new phone `0711000003`. | Should be refused with a clear message, OR given a usable shop address. It must NOT create a shop with an empty address. (Suspected bug: the address may come out empty.) | | |
| S7 | Sign up with the business name "Mama's Duka" and a new phone. | Works. Shop address is `mama-s-duka` (the apostrophe becomes a dash). | | |
| S8 | Open `http://localhost:3001/shop/no-such-shop-xyz`. | The "Page not found" (404) page. No crash. | | |

## 2. Login

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| L1 | Log in at `/login` with shop A's phone and the right password. | Goes to `/dashboard`, shows Aminas Boutique. | | |
| L2 | Log in with the right phone and a WRONG password. | A clear error. Stays on the login page. No details about which part was wrong. | | |
| L3 | Log in with a phone that has no account (`0799999999`). | An error. Same kind of message as L2. No crash. | | |
| L4 | In a private window with no login, open `http://localhost:3001/dashboard`. | Sent to `/login`. No dashboard numbers are shown. | | |
| L5 | In that same private window, open `/inbox`, `/orders`, `/payments`, `/products`. | Each one sends you to `/login`. | | |

## 3. Products

Logged in as shop A in the browser.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| P1 | Products, "Add product". Name "QA Soap", price `150`, status Active. Save. | Returns to the list. "QA Soap" shows KES 150.00, active. | | |
| P2 | Add a product with price `abc`. | Error under price: "Enter a price like 350 or 350.50 (numbers only)." Nothing saved. | | |
| P3 | Add a product with an empty name. | Error under name: "Enter the product name." | | |
| P4 | Add two products with the same SKU `QA-1`. | Second one: "You already have a product with this SKU. Use a different one." | | |
| P5 | Add a product with a very large price, `99999999999`. | Error: "That price is too large. Please enter a smaller amount." | | |
| P6 | Look for a way to EDIT or DELETE "QA Soap". | **NOT BUILT** (only add and list exist). Record it as a known gap. | | |
| P7 | Open the public shop page `/shop/aminas-boutique`. | "QA Soap" appears (it is active). A draft product does NOT appear. | | |

## 4. Orders and M-Pesa (Daraja sandbox)

Use the PowerShell sessions from the setup. The M-Pesa prompt goes to a real
phone, so use your own number and never show it on camera.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| O1 | Create an order for shop A: `$oa = @{ customerPhone = '254722000001'; channel = 'web'; items = @(@{ productId = '<a real product id of shop A>'; quantity = 1 }) } \| ConvertTo-Json -Depth 5` then `Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/orders -ContentType 'application/json' -Body $oa -WebSession $sA`. | Answers with the new order, status `created`. It shows on the Orders page. Note the order id. | | |
| O2 | Create an order with `quantity = 0`. | Refused with a 400 error. No order is made. | | |
| O3 | Create an order with a product id that does not exist (`00000000-0000-0000-0000-000000000000`). | Refused with a clear error. No crash. | | |
| O4 | Pay the O1 order: `Invoke-RestMethod -Method Post -Uri http://localhost:3000/v1/orders/<order id>/pay -ContentType 'application/json' -Body (@{ phone = '07XXXXXXXX' } \| ConvertTo-Json) -WebSession $sA`. Enter the PIN on the phone. | Answer is `pending`, then the phone shows the M-Pesa prompt. After the PIN the order becomes `paid`. | | |
| O5 | After O4, open the Payments page and the Dashboard. | A new "Sale" line with the M-Pesa receipt. The wallet balance grew by exactly the order total. | | |
| O6 | Pay the SAME order again (repeat the O4 command). | Refused with `order_not_payable`. No second charge, no second wallet entry. | | |
| O7 | Make a new order and pay it, but press CANCEL on the phone prompt. | The order stays `created`. No wallet entry. (The sandbox is slow, so wait a minute.) | | |

## 5. USSD (tested with `curl.exe`, not a real phone)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| U1 | `curl.exe -X POST http://localhost:3000/ussd -d "serviceCode=*384*101#" -d "sessionId=qa1" -d "phoneNumber=+254711111111" -d "text="` | A menu that begins with `CON` and names Amina's Boutique (A's own welcome). | | |
| U2 | Same, with `-d "text=1"` and `sessionId=qa2`. | The answer for menu option 1 of shop A, starting with `CON` or `END`. Nothing from shop B. | | |
| U3 | Same as U1 but with an unknown code `*384*999#`. | A polite refusal. No crash, no data from any shop. | | |
| U4 | After U1, open shop A's Inbox. | A row tagged USSD from `+254711111111`, "Dialled the USSD code". | | |

## 6. WhatsApp (simulated, because we do not have a real Meta number)

Build the message like the demo script does (see `capstone/demo-script.md`,
Part 3). Use a NEW message id each time.

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| W1 | Send a message to shop A (`phone_number_id = demo-pid-amina`, id `wamid.QA-A-1`). | The answer says `received=1`. | | |
| W2 | Open shop A's Inbox. | A row tagged WA with the message text and a Nairobi time. | | |
| W3 | Send the SAME message id `wamid.QA-A-1` again. | The answer says `duplicates=1`. The inbox still shows it only once. | | |
| W4 | Send a message with an unknown `phone_number_id` (`nobody`). | No crash. Nothing saved to any shop. | | |
| W5 | Look for a way to REPLY to the customer from the inbox. | **NOT BUILT** (we only receive). Record it as a known gap. | | |

## 7. Cross-tenant attempts (one shop trying to reach another)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| X1 | Open shop B's Inbox (private window), after A got messages in W1 and U1. | None of A's messages or USSD rows appear. | | |
| X2 | With shop A's session, try to pay shop B's order id: `.../v1/orders/<B order id>/pay` with `-WebSession $sA`. | Refused as "not found" (404). Shop B's order is untouched. | | |
| X3 | Compare the Products pages of A and B. | Each shows only its own products. | | |
| X4 | Open `/shop/aminas-boutique` and `/shop/brio-hardware`. | Each public page shows only that shop's products. | | |
| X5 | With NO cookie, call `curl.exe -i http://localhost:3000/v1/dashboard`. | `401`. No data. | | |
| X6 | Take shop A's token and change one letter, then call the dashboard with it: `curl.exe -i -H "Cookie: token=<edited token>" http://localhost:3000/v1/dashboard`. | `401`. The edited token is refused. | | |
| X7 | Send USSD for the SAME phone number to both shops (`*384*101#` and `*384*102#`). | Each shop answers with its OWN welcome. No mixing. | | |

---

## Summary (fill in after running)

| Group | Cases | Pass | Fail | Not built |
|---|---|---|---|---|
| Signup | 8 | | | |
| Login | 5 | | | |
| Products | 7 | | | |
| Orders and M-Pesa | 7 | | | |
| USSD | 4 | | | |
| WhatsApp | 5 | | | |
| Cross-tenant | 7 | | | |
| **Total** | **43** | | | |

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
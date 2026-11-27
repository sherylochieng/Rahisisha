# tests/suspendedShop.doors.test.js

**FILE:** `apps/api/tests/suspendedShop.doors.test.js` (Week 30 Day 3, Batch 1, step 5)

## WHY THIS FILE EXISTS

Proves that suspending a shop closes **every door** that should close, and that reinstating it opens them again: the public page, the USSD phone line, the WhatsApp line, and the owner's own door (look, do not touch).

## WHY IMPORTANT

A padlock that holds on one door but not the others is worth nothing. This test walks to every door and tries the handle. It uses the **real admin service** to suspend and reinstate, so the whole chain is tested: admin action, database, every door.

## DANGER (what breaks without it)

It makes its own throw-away admin, owner, shop and phone lines with random names, and removes them afterwards. The WhatsApp token in it is fake and stored encrypted, like the real thing. Never put real phone numbers or tokens here.

## WHAT IT SOLVES

Confidence that "suspended" really means gone on the web page, on USSD, on WhatsApp and for owner changes, with one clear reason shown to the owner.

## SYSTEM DESIGN PRINCIPLE

Test the promise at the edges: the customer's phone, the customer's WhatsApp, the owner's browser. The inside can be perfect and the promise still broken if one door was forgotten.

## RULES

1. Each run makes its own shop with random names.
2. Clean up everything made, shop rows first (they need the shop lock).
3. Never print passwords or tokens.

## PRACTICAL EXAMPLE

```
cd apps/api
npm test -- suspendedShop
```

## DECISIONS

- The **M-Pesa door is not closed on purpose**: money already paid must still be recorded. `resolveMpesaTenant` refuses only `deleted` shops.
- The USSD answer for a suspended shop must be **exactly** the answer for an unknown code, so a caller cannot tell the difference.

## WHERE USED

Part of the normal test run and the pre-push hook.

## TRADEOFFS

+ Real database, real app, real admin service. Nothing is faked.
- Orders and inbox writes share one guard, which is tested on products, uploads and orders.

## HOW TO USE

```
cd apps/api ; npm test -- suspendedShop
```

---

## LINE BY LINE

**`dial(code)`**
A phone dialling the shop's USSD code. Africa's Talking posts **form** data, so `.type('form')` is used.

**`whatsapp(phoneNumberId, messageId)`**
Meta delivering one customer message, in the real shape (`entry`, `changes`, `value`, `metadata.phone_number_id`).

**`inShop(work)`**
Opens the shop's own drawer with its own key (stamps the shop on the connection inside a transaction), runs the query, closes it. Used to count messages and products, which are locked per shop.

**`beforeAll`**
Hires a test admin, opens a shop with an owner, gives the shop a USSD code and a WhatsApp number (encrypted fake token), and signs a real owner token the same way signup and login do.

**`afterAll`**
Removes shop rows first, then the phone lines, the receipts, the shop, the owner and the admin.

**Test 1: while active, everything works**
The control. The page loads, USSD shows the welcome, a WhatsApp message is saved, the owner creates a product, and `/v1/me` says `active`. Without this, "the door is shut" could just mean "the door was broken".

**Test 2: after suspend, the public doors close**
The page is `404`. USSD answers exactly `END Service unavailable`, the same as an unknown code, and never shows the reason. WhatsApp answers `200 ignored` and **nothing is saved**.

**Test 3: look, do not touch**
Reads still work, and `/v1/me` shows `suspended`, the time and the reason. Five write attempts (create, edit and delete a product, sign an upload, create an order) all get `403 shop_suspended` with the admin's reason. No product was created.

**Test 4: reinstate reopens everything**
On the very next requests, with no sign-out: the page, USSD, WhatsApp and the owner's writes all work, and `/v1/me` is `active` again with no reason.

**Test 5: a deleted shop**
A deleted shop's owner gets `403 shop_unavailable` and **no** reason.

**Proof the tests guard the code**
I undid each fix on purpose: the USSD lookup, the WhatsApp lookup, the products guard and the uploads guard. Each time the matching test failed, then I restored the code.

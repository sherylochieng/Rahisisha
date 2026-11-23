# Week 29 Demo: Two Shops, One Platform

**Presenter:** Sheryl Ochieng
**Date:** 23 November 2026
**Story:** Aminas Boutique (shop A) and Brio Hardware (shop B) both use Rahisisha Biashara. Each gets USSD, WhatsApp and M-Pesa on its own. A never sees B's messages, and A's wallet is not B's wallet.

The step-by-step script is in [`capstone/demo-script.md`](capstone/demo-script.md). This file is the written record of the run, with the real results.

---

## WHY THIS FILE EXISTS

A demo proves the app works with a story anyone can follow. This file records what I ran on 23 November 2026 and what the system really answered, so a reviewer can check each claim.

---

## The two shops (different credentials)

| | Shop A | Shop B |
|---|---|---|
| Shop name | Aminas Boutique | Brio Hardware |
| Owner | Amina Wanjiru | Brian Otieno |
| Login phone | 0700000001 | 0700000002 |
| Password | its own practice password | a different practice password |
| Shop link | `aminas-boutique` | `brio-hardware` |
| USSD code | `*384*101#` | `*384*102#` |
| WhatsApp number id | `demo-pid-amina` | `demo-pid-brio` |

Both shops signed up on the live signup page. Each signup landed on its own dashboard, with `Today's orders 0` and `Wallet balance KES 0.00`.

---

## Step 1: USSD, per shop

The SAME phone number dialled both shops. The service code decided which shop answered.

```
*384*101#  ->  CON Karibu Amina's Boutique   (1. View products 2. Check balance 3. Exit)
*384*102#  ->  CON Welcome to Brio Hardware  (1. View products 2. Check balance 3. Exit)
```

Pressing 1 (View products):

- Amina's Boutique: Maxi Dress KSh 2,500, Kitenge Top KSh 1,200, plus sample items.
- Brio Hardware: Cement 50kg KSh 750, Hammer KSh 450, plus sample items.

No product from one shop appeared in the other.

---

## Step 2: WhatsApp, per shop

I played Meta and sent one customer message to each shop's own number id. Both answered `received=1, duplicates=0`.

- To Amina: "Hi, how much is the Maxi Dress?" (customer 254722000001)
- To Brio: "Do you have the Hammer in stock?" (customer 254733000002)

**Inbox result** (each owner logged in to their own dashboard):

- **Aminas Boutique inbox:** the WhatsApp message about the Maxi Dress, plus its own two USSD events ("Dialled the USSD code", "Chose: 1"). Nothing from Brio.
- **Brio Hardware inbox:** the WhatsApp message about the Hammer, plus its own two USSD events. Nothing from Amina.

---

## Step 3: M-Pesa, per shop (Safaricom sandbox, live)

Each shop has its own M-Pesa settings, encrypted with its own shop id. I made one KES 160 order per shop (Sample: Sugar 1kg) and paid each through the sandbox from the shop owner's login.

| | Aminas Boutique | Brio Hardware |
|---|---|---|
| Order total | KES 160 (16000 cents) | KES 160 (16000 cents) |
| Order status after payment | `paid` | `paid` |
| Safaricom answer | "The service request is processed successfully." | not captured separately (the order is `paid` and the wallet has a receipt) |
| M-Pesa receipt (sandbox) | UKN6I3CDA6 | UKN6I3CE9Z |
| Wallet before | KES 12,500 (practice balance) | KES 8,300 (practice balance) |
| Wallet after | **KES 12,660** | **KES 8,460** |

Paying Brio's order a second time was refused with `order_not_payable` ("Order is 'paid', only a 'created' order can be paid"), so a payment cannot be charged or credited twice.

---

## The proof

- Amina's inbox has no message from Brio's customer, and Brio's has none from Amina's.
- Amina's wallet (KES 12,660) is not Brio's wallet (KES 8,460). Each ledger holds only its own sale and its own receipt.
- The checks above read the real database through each owner's own login, so the database lock (Row-Level Security) is what kept the two apart.
- Automated proof, run on 23 November 2026 after the demo:

```
npm run test:isolation
Test Suites: 7 passed, 7 total
Tests:       125 passed, 125 total

npm test (whole project)
Test Suites: 29 passed, 29 total
Tests:       310 passed, 310 total
```

---

## Honest notes

1. The two shops were signed up on the live page during the rehearsal, shortly before the rest of the run, not in a continuous recording.
2. WhatsApp messages are simulated (I played Meta with a script). The app saves messages but does not reply yet.
3. USSD was tested with `curl`, not yet with the Africa's Talking simulator.
4. M-Pesa ran against Safaricom's sandbox. The sandbox has failed intermittently at the confirmation step before (16 November), and refunds, reversals and reconciliation are not built.
5. Sandbox prompts reach a real phone, so I used my own number and only KES 160 per payment.

---

## How to repeat this

Follow `capstone/demo-script.md` ("Before you press record", then Parts 1 to 5). Setup scripts used: `sql/seeds/ussd_configs_seed.sql`, `sql/seeds/ussd_demo_data_seed.sql`, `apps/api/scripts/seed-whatsapp-demo.js`, and `apps/api/scripts/seed-daraja-demo.js` (now seeds both shops).
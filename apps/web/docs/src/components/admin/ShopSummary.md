# ShopSummary.js (guide)

**File:** `apps/web/src/components/admin/ShopSummary.js`

## What it is
The cover of one shop's file: name, status, verified mark, plan, owner, owner phone, joined date, and (if suspended) when and why.

## Why it exists
Before suspending or verifying, the admin must see the facts. It reuses `ShopStatusChip` and `VerifiedMark`.

## Data minimisation
The owner's **phone number is shown here, not in the list**. The admin has a reason to look (to contact the owner).

## Kenyan example
The file cover at the registry: who owns the business, their contact, when it started, and a red sticker if it was closed, with the reason.

## Danger
The suspended reason is typed by an admin: plain text only.

## LINE BY LINE
1. `Fact`: a small helper for one term and value pair, so the markup is written once.
2. Heading row: shop name, status chip, verified mark.
3. `shop.status === 'suspended' &&`: the orange box with the time and the reason.
4. `<dl>`: a definition list (screen readers read it well).
5. Owner and phone: a dash when missing.
6. `shop.verifiedAt &&`: "Verified on" only for verified shops.

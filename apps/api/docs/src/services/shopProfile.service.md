# shopProfile.service.js

**FILE:** `apps/api/src/services/shopProfile.service.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

A shop has a small "business card": the town, one line about the shop, a
WhatsApp number, delivery areas, and the owner's yes or no to the marketplace. This file reads and saves that card in the table brand_profiles.

## WHY IMPORTANT

The owner's Shop profile page and the public shop page both use it, and the
marketplace (Batch 6) will read the same facts. One place that knows how the
card is stored means a change is made once.

## DANGER

1. Always pass req.db (the shop-locked connection from withTenant). Then the
   database itself refuses to show or change another shop's card. Never pass the
   plain pool.
2. A shop that has never saved its card has NO row yet. readProfile then returns
   an "empty card" (all empty, marketplace OFF) instead of an error, and
   saveProfile creates the row on the first save.
3. The WhatsApp number is private. readPublicCard never returns it. It is kept for
   later, when the platform sends messages and shows contact through its own
   channel.

## WHAT IT SOLVES

- readProfile: the owner's whole card, for the form.
- saveProfile: create or update the card (only the fields you send change).
- readPublicCard: only the two facts a stranger may see: town and description.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: the controller checks the form and answers HTTP; this
file only talks to the database. "Upsert": one row per shop, created on first
save, changed after that (brand_profiles.tenant_id is UNIQUE).

## RULES

1. tenantId comes from the login (req.tenantId), never from the request body.
2. Empty text is stored as NULL, never as "".
3. list_in_marketplace is only ever true when the owner sent true.

## PRACTICAL EXAMPLE

```
Mama Njeri opens Shop profile for the first time: readProfile gives an empty card.
She types "Kitengela" and saves: saveProfile creates her row. Later she changes only
her delivery areas: the other fields stay exactly as they were.
```

## DECISIONS

- Merge in code, then write the whole row: simple to read, and one owner edits
  one shop, so two saves at the same instant are not a real risk.
- Responses use snake_case (town, short_description...), like the rest of the API.
- No opening hours: an online shop takes orders 24/7. (The older column working_hours
  is left alone and unused.)

## WHERE USED

shopProfile.controller.js, storefront.controller.js (readPublicCard)

## TRADEOFFS

+ Very readable. - One extra read before a save.

## HOW TO USE

```
const card = await readProfile(req.db);
const saved = await saveProfile(req.db, req.tenantId, { town: 'Kitengela' });
```

## PIECE BY PIECE

```
FIELDS             = THE LIST OF BOXES ON THE CARD, with the column each one lives in.
emptyCard()        = A BLANK CARD for a shop that has not filled one in yet.
readProfile(db)    = TAKE THE CARD OUT OF THE DRAWER (or hand over a blank one).
saveProfile(...)   = WRITE ONLY THE BOXES THAT CHANGED, then file the card back.
                     ON CONFLICT (tenant_id) = "if this shop already has a card, update it".
readPublicCard(db) = THE SHOP WINDOW VERSION: town and description only.
```

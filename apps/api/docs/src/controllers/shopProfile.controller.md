# shopProfile.controller.js

**FILE:** `apps/api/src/controllers/shopProfile.controller.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

Answers the two questions the owner's Shop profile page asks:
  GET /v1/shop/profile  "what does my card say now?"
  PUT /v1/shop/profile  "save these changes to my card".

## WHY IMPORTANT

It is the gatekeeper for what an owner may write: lengths are limited, the WhatsApp
number must be a real Kenyan mobile number, and unknown fields are refused.

## DANGER

1. Mounted behind requireAuth and withTenant, so req.db is locked to the owner's
   shop. Never read a shop id from the request body.
2. The WhatsApp number is stored in the app's one phone shape (2547XXXXXXXX) so
   it matches customers and M-Pesa numbers.
3. .strict() on the form: a field the form does not know about is an error, not
   silently ignored. (A typo like "listInMarketplce" must not quietly do nothing.)

## WHAT IT SOLVES

Safe reading and saving of the shop's business card, with clear field-by-field errors.

## SYSTEM DESIGN PRINCIPLE

Thin controller: check the form (Zod), call the service, answer. The database work
lives in shopProfile.service.js.

## RULES

1. town max 60, short description max 160, delivery areas max 300.
2. Empty text means "clear this box" and is saved as NULL.
3. Only send the boxes you want to change.

## PRACTICAL EXAMPLE

```
  PUT /v1/shop/profile  { "town": "Kitengela", "whatsappNumber": "0712 345 678",
//                           "listInMarketplace": true }
  -> { data: { town: "Kitengela", whatsapp_number: "254712345678",
               list_in_marketplace: true, ... }, error: null }
```

## DECISIONS

- Requests are camelCase (like products), responses snake_case (like the rest).
- A wrong WhatsApp number is reported under details.whatsappNumber.

## WHERE USED

shopProfile.routes.js

## TRADEOFFS

+ Simple. - PUT behaves like a "partial save" (only sent fields change); that is
  friendlier for forms than a strict full replace.

## HOW TO USE

```
Mounted in app.js:  app.use('/v1/shop/profile', requireAuth, withTenant,
                             blockWritesWhenSuspended, shopProfileRouter);
```

## PIECE BY PIECE

```
text(max)         = A BOX THAT TAKES WORDS UP TO A LIMIT; blank becomes "empty".
whatsappNumber    = THE PHONE BOX: any normal way of writing a Kenyan mobile number
                    is turned into one standard shape, or refused.
Form (strict)     = THE WHOLE FORM; unknown boxes are refused.
getProfile        = "SHOW ME MY CARD".
updateProfile     = "SAVE MY CHANGES": check, translate names, save, show the saved card.
```

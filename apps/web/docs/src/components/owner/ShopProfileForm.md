# ShopProfileForm.js

**FILE:** `apps/web/src/components/owner/ShopProfileForm.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

The owner's "Shop profile" form: town, a one-line description, the WhatsApp
number, delivery areas, and the switch "Show my shop in the marketplace".
It saves them with one button.

## WHY IMPORTANT

This is how a shop introduces itself to strangers. Town and the one-line
description appear on the public shop page. The marketplace switch is the owner's
yes or no to being listed (it is OFF until they turn it on).

## DANGER

1. It is a CLIENT file ('use client'): it holds the typing, the picking and the
   Save click.
2. The WhatsApp number is PRIVATE. The text under the box says so. It is not shown
   on the public page.
3. Turning the marketplace switch on only records the choice. Nothing public
   happens until the marketplace is built (a later batch).
4. It sends ALL the boxes on every save, so what the owner sees is what is saved.
   An empty box clears that field.
5. No opening hours on purpose: an online shop takes orders 24/7.

## WHAT IT SOLVES

One form, with a clear message beside any box the server did not accept, and a
pop-up "Changes saved" that is seen wherever the owner is on the page.

## SYSTEM DESIGN PRINCIPLE

Same pattern as ProductForm: useFormState for the red banner and the busy button,
shared FormError, inputClass, FieldError and SubmitButton (DRY), field errors
mapped from error.details. The "saved" pop-up is the shared Toast component.

## RULES

1. The page (server file) loads the saved card and passes it in as `profile`.
2. Limits match the server: town 60, description 160, areas 300.
3. Never show the number anywhere except in its own box.

## PRACTICAL EXAMPLE

```
Mama Njeri types "Kitengela, Nairobi" and a line about her shop, adds her number and
presses Save. A green "Changes saved" note pops up. Her shop link now shows the town
and the line.
```

## DECISIONS

- The town box guides the owner with an example ("Utawala, Nairobi").
- The marketplace switch is a real button with role="switch" and aria-checked.
- The description has a live counter (x / 160).
- After saving we stay on the page (no redirect) and call router.refresh().

## WHERE USED

app/(authed)/shop-profile/page.js

## TRADEOFFS

+ Simple and familiar. - Saving sends everything, not only the changed boxes.
- Opening hours were left out for now (shops are online all day).

## HOW TO USE

```
import ShopProfileForm from '../../../components/owner/ShopProfileForm';
<ShopProfileForm profile={profile} />
```

## PIECE BY PIECE

```
1. profile            = THE CARD AS IT IS NOW, handed in by the page.
2. town, ...          = THE BOXES ON THE CARD. Each starts with the saved words.
3. listed             = THE SWITCH ON THE WALL: on = "list me", off = "do not list me".
4. fieldErrors        = THE CLERK'S RED PEN: a short message beside the wrong box.
5. handleSubmit       = "SAVE": check the easy things here, send, then show the result.
6. err.details        = THE SERVER POINTING AT A BOX: whatsappNumber -> the number box.
7. note / <Toast>     = THE "CHANGES SAVED" STICKY NOTE that floats in the corner and fades away.
```

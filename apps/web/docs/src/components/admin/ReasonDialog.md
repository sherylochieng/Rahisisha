# ReasonDialog.js (guide)

**File:** `apps/web/src/components/admin/ReasonDialog.js`

## What it is
The confirmation box every shop action goes through: a question, an explanation, a box for the written reason, and Cancel / Confirm.

## Why it exists
Suspending a shop stops a real person's business. It must never happen by one accidental click. The box makes the admin stop, read and write why.

## Architecture
- Uses the browser's own `<dialog>` with `showModal()`: focus is trapped, Esc works and the background dims, with no library.
- Validates the reason early (5 to 500 characters, the same rule as the API), but the API is still the real check.
- `onConfirm(reason)` is a promise from the parent. If it fails, the message shows here and the box stays open.

## Kenyan example
The bank teller says "You are closing this account. Please write the reason and sign here." The signature box is this reason field.

## Danger
- For suspend, the reason is shown to the owner. The orange notice says so.
- While busy, both buttons lock and Esc does nothing, so the action cannot be sent twice.

## Reuse
Any confirmation that needs a typed reason. Pass a different `config`.

## LINE BY LINE
1. `'use client'`: runs in the browser.
2. `ref`, `reason`, `busy`, `error`: the dialog element, what was typed, a request running, a message to show.
3. The effect: calls `dialog.showModal()` once when the box appears.
4. `submit`: stops the normal form submit, trims the reason, checks the minimum, sets busy, awaits `onConfirm`.
5. `catch`: shows the message and unlocks the buttons.
6. `<dialog onCancel>`: Esc is ignored while busy, otherwise it calls the parent's `onCancel`.
7. The heading and explanation come from `config`.
8. `config.warnsOwner &&`: the orange "This reason will be shown to the shop owner" notice.
9. `AdminField multiline`: the reason box (taller, same look). `maxLength` stops typing at 500.
10. The counter `reason.length / 500`.
11. `FormError`: the error message.
12. Cancel (`quiet`) and Confirm (`danger` for suspend, otherwise `primary`). `loading` locks them.

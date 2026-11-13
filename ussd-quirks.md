<!-- FILE: ussd-quirks.md (repo root) -->
<!-- WHY: Week 29 Day 1, Task 5. Short notes on USSD rules that shaped the menu code. -->
<!-- RELATED CODE: apps/api/src/controllers/ussd.controller.js (cap() and the CON/END replies) -->

# USSD quirks

1. A USSD screen is limited to about 182 characters because USSD uses the phone network's old signalling channel, which was built for very short messages.
2. If my reply is longer than that, the network cuts it off or rejects it, so the caller sees half a menu or an error instead of the menu.
3. That is why my controller keeps only 4 products, shortens names to 20 characters, and runs every reply through a `cap()` function that stops it going past 182.
4. Africa's Talking sends everything the caller has typed so far in one `text` field, joined by `*` (for example `1*2`), so `*` is a separator and not a back button.
5. To support "back", I would choose my own key such as `0`, remove the last item from `text`, and show the previous screen again.
6. A reply that starts with `CON` means continue: the session stays open and waits for the caller to press another key.
7. A reply that starts with `END` means the session closes after the message, which is why products, balance and goodbye all use `END`.
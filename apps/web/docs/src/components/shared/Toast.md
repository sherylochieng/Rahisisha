# Toast.js

**FILE:** `apps/web/src/components/shared/Toast.js` (Week 30 Day 3, Batch 4b)

> This guide is generated from the explanation at the top of the file itself, so the two always say the same thing.

## WHY THIS FILE EXISTS

A small pop-up note that tells the person something just happened, such as
"Changes saved", and then goes away by itself. It floats at the corner of the
screen, so it is seen even when the page is scrolled.

## WHY IMPORTANT

A note placed at the top of a long form is easy to miss: the person presses Save
at the bottom and sees nothing change. A floating note answers "did that work?" at
once, wherever they are on the page.

## DANGER

1. A CLIENT file ('use client'): it uses a timer to hide itself.
2. It must not block the screen or the buttons (it is small and sits in a corner).
3. role="status" (polite) for good news and role="alert" for errors, so screen
   readers announce it without taking over.

## WHAT IT SOLVES

One reusable "it worked" or "it failed" pop-up for any screen.

## SYSTEM DESIGN PRINCIPLE

DRY and "feedback for every action": the same pop-up for every screen that saves
something, so people learn one signal.

## RULES

1. Show it by giving `message` text; hide it by giving an empty message.
2. The parent owns the message; the toast calls onClose() when its time is up, so
   the parent clears the message.
3. Keep the text short: "Changes saved".

## PRACTICAL EXAMPLE

```
const [note, setNote] = useState('');
<Toast message={note} onClose={() => setNote('')} />
After a good save:  setNote('Changes saved');
```

## DECISIONS

- Disappears after 4 seconds (5 for errors) unless the person closes it first.
- Fixed to the bottom corner, above the phone's basket bars and menus (high z-index).

## WHERE USED

components/owner/ShopProfileForm.js

## TRADEOFFS

+ Tiny and clear. - One message at a time (a new one replaces the old).

## HOW TO USE

```
import Toast from '../shared/Toast';
```

## PIECE BY PIECE

```
message      = THE WORDS ON THE NOTE; empty means no note.
tone         = 'success' (green) or 'error' (red).
useEffect    = THE KITCHEN TIMER: starts when a message appears, takes the note down after a few seconds.
clearTimeout = TURNING THE TIMER OFF if the message changes or the screen goes away.
the X button = THE PERSON TAKING THE NOTE DOWN THEMSELVES.
```

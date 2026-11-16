# WhatsApp Security Notes (Week 29 Day 2)

1. We encrypt each shop's WhatsApp access token before it is saved, because the token is like a key to that shop's WhatsApp number: anyone holding it can send messages as that business, so if someone gets a copy of the database (a backup or a leaked dump) the scrambled text is useless without our key, which lives in an environment variable and never in the database or in git.
2. Each shop has its own token, not one shared token for the whole app, so that if one token leaks or one shop disconnects, only that one shop is affected and every other shop keeps working.
3. A shared token would also make every shop's messages look like they came from the same place, and a single leak would let a stranger send messages as every business on the platform.
4. The verify challenge is a handshake: when a shop connects the webhook, Meta sends a GET request with a secret verify token and a random number, and we must send that number back only if the verify token is one of ours.
5. Meta does this to be sure that the address really belongs to us and that nobody is pointing Meta's messages at a server they do not control, and we also refuse anything with the wrong token with a 403.
6. If a shop revokes our access in Meta, the token stops working, so Meta answers our send with a 401 or 403, our sender stops with a clear "token rejected" error that never contains the token, and nothing is sent for that shop until its owner connects a new token.
7. Revoking one shop never touches any other shop's token or messages, because every token is encrypted separately and locked to its own shop id, and nothing here yet tells the owner to reconnect, which is a gap we know about.



Why are tokens stored encrypted? If someone steals a copy of the database, a plain-text token lets them send messages as the shop. They could send bad or malicious messages and ruin the shop’s reputation. Encrypted, the stolen copy only holds scrambled text they can’t use.

Why does each shop have its own token? If all shops shared one token, a single leak would put every shop at risk. With one token per shop, a leak only affects that one shop, so the damage stays small, and we can cancel and replace just that token.

What does the verify challenge do? Meta checks that you really own the webhook address before it sends anything there. It sends a secret challenge, and our server has to answer correctly with the shared verify token. If the answer is wrong, Meta won’t connect it, so a stranger can’t claim our address.

What happens when a shop revokes its token? Meta rejects our send with a 401 or 403 error. Our app stops sending for that shop with a clear “token rejected” error, and it never shows the token itself. Nothing is sent for that shop until the owner generates a new token in Meta and updates it in the app. Other shops are not affected.
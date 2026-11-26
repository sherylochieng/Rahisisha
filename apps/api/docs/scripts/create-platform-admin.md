# create-platform-admin.js: making the first platform admin from your own computer

**FILE:** `apps/api/docs/scripts/create-platform-admin.md`  
**Written:** Week 30 (26 Nov 2026)  

---

## WHY THIS DOC EXISTS

Explains the command `node scripts/create-platform-admin.js` in `apps/api/scripts/`: what it asks, what it refuses, and how to use it safely, including on the live database later.

## WHY IMPORTANT

The admin account is the master key to every shop. This script is the only way to create one, so how it handles your password decides how safe the whole platform is.

## DANGER (what breaks without it)

1. The password is typed into a **hidden** prompt. It is never taken as a command argument or from a pipe, because those would be saved in your shell history. If the window is not a real terminal, the script refuses.
2. It prints the id and phone only. Never the password or the hash.
3. On a database that is **not on your computer** (for example Neon) it shows the server name and makes you type it back. This stops you creating a live admin by accident.
4. Never paste the password in chat, in a file in the repo, or in a commit.

## WHAT IT SOLVES

One safe command to create the first admin, and one to set a new password if you forget it. There is no public page for either, so nobody on the internet can ask to become an admin.

## SYSTEM DESIGN PRINCIPLE

Separation of concerns: the script only asks the questions. The rules (phone shape, password length, hashing, the database lock) live in `src/services/platformAdmin.service.js`, which has its own tests.

## RULES

1. Create: `node scripts/create-platform-admin.js` (from `apps/api`).
2. Reset a lost password: `node scripts/create-platform-admin.js --reset`.
3. The password is typed twice, hidden, 12 to 72 characters.
4. "Create" never overwrites an existing admin (use `--reset`).
5. Exit code 0 means it worked, 1 means it did not, with a plain reason.

## PRACTICAL EXAMPLE

```
cd apps/api
node scripts/create-platform-admin.js
Database server: localhost
Creating a platform admin.
Your name: Sheryl
Phone (M-Pesa number): 0712345678
Password (hidden, at least 12 characters):
Type the password again:
OK admin created: id=3f1c... phone=254712345678
```
Nothing is shown while you type the password. That is normal.

## DECISIONS

- Name and phone are visible, only the password is hidden.
- A non-local database needs the server name typed back to confirm.
- Reset is a flag on the same script, so there is one tool to remember.

## WHERE USED

Run by you, by hand: once on your computer to try the admin, and once on the live database when the platform goes live (with your own Neon connection string in your own `.env`, never pasted anywhere).

## TRADEOFFS

+ No door on the internet, nothing to attack.
- Needs your computer to reach the database. For Neon that means the connection string must be in your own `.env`.
- A forgotten password needs you to run the script again with `--reset`.

## HOW TO USE

See the practical example. Before the first run, migration 028 must be applied to that database.

---

## PIECE BY PIECE (real life, in simple terms)

**askVisible(question)**  
The clerk asks a normal question and you answer out loud: your name and phone.

**askHidden(question)**  
The clerk turns her back while you whisper the password. Nothing is shown, not even stars. Backspace works, Enter finishes, Ctrl+C cancels. A pasted password works too.

**Not a real terminal? Refuse**  
If someone tries to feed the password from a file or another command, the clerk says 'no, come in person', because that would leave the password in history.

**Database server line**  
Before writing anything the clerk reads out which office she is working in. For a faraway office she makes you say its name back, so she cannot write in the wrong book.

**Type the password twice**  
Like confirming an M-Pesa PIN: if the two do not match, nothing is written.

**The service call**  
The clerk hands the filled form to the manager (the service). The manager checks the papers and writes in the staff book.

**Exit code 0 or 1**  
The clerk's last words: 'done' or 'not done, and here is why'.

---

## What happens, in order

1. The script refuses if it is not in a real terminal.
2. It reads `DATABASE_URL` and prints only the server name. If it is not `localhost`, you must type the name to continue.
3. It asks for your name (not for `--reset`), your phone, and the password twice (hidden).
4. If the two passwords differ, it stops and changes nothing.
5. It calls `createPlatformAdmin` (or `resetPlatformAdminPassword` with `--reset`). The service checks and writes through the database lock.
6. It prints `OK ...` with the id and phone, then closes the database connection.

## Messages you may see

| Message | Meaning |
|---|---|
| Run this in a normal terminal window | Run it in PowerShell or Windows Terminal, not through a pipe or an editor output panel |
| DATABASE_URL is missing or not readable | Check `apps/api/.env` |
| Server name did not match | You typed a different server name; nothing was changed |
| The two passwords are not the same | Nothing was changed |
| Password must be at least 12 characters | Choose a longer password |
| An admin with this phone number already exists | Use `--reset` to set a new password |
| No admin with this phone number | `--reset` was used for a phone that is not an admin |

## Related documents

- The service: `apps/api/docs/src/services/platformAdmin.service.md`
- The database part: `sql/migrations/028_platform_admins.sql`
- Overview of the admin: `docs/guides/platform-admin.md`

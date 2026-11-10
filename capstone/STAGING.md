# STAGING.md: the live practice copy of Rahisisha Biashara

> **FILE:** `docs/STAGING.md`
> **Written:** 10 Nov 2026 (Week 28 Weekend, Task 8)

---

## WHY THIS FILE EXISTS

Rahisisha Biashara now runs on the internet, not only on a laptop. This guide
records **where each piece lives, what settings it needs, and how to fix or
rebuild it**, so nobody (including future you) has to guess.

## WHY IMPORTANT

The live site is spread over **five companies** (Neon, Render, Vercel,
Host Pinnacle, GitHub). Each holds a piece of the setup. If this knowledge
lives only in your head, one forgotten setting can take the site down.

## DANGER (what breaks without it)

- A setting is changed or deleted and nobody knows which one the site needs.
- The database password is rotated in Neon but not in Render, and the API
  cannot connect.
- Someone points the app at the **boss database user**, which skips the
  locks, and every shop can see every shop's data.

## WHAT IT SOLVES

One page answering: *Where is it? What does it need? How do I fix it?*

## SYSTEM DESIGN PRINCIPLE

**"Staging is a rehearsal of production."** Same code, same kind of
database, same kind of address. If something works here, it will work live.
Also: **configuration lives in the environment, not in the code**, so the
same code runs on a laptop and online with different settings.

## RULES (never do this)

1. **NEVER write a real password, secret or full database address in this
   file or anywhere in git.** Secrets live only in Render, Vercel and your
   password manager.
2. **NEVER connect the app as `neondb_owner`.** It can skip row-level
   security (`rolbypassrls = true`). The app uses `rahisisha_user` only.
3. **NEVER put the Neon address in your laptop's `.env`.** Laptop and
   staging are different databases.
4. **NEVER change `NEXT_PUBLIC_*` settings without redeploying the website.**
   They are baked in at build time.
5. **NEVER treat the demo accounts as safe.** Their password is public.

## PRACTICAL EXAMPLE

A reviewer opens `https://rahisishabiashara.com`, signs up a shop, and lands
on a dashboard with three sample products. Behind that one click: Vercel
served the page, Render ran the API, Neon saved the shop, and a login cookie
travelled between `rahisishabiashara.com` and `api.rahisishabiashara.com`.

---

## 1. THE LIVE ADDRESSES

| What | Address |
|---|---|
| Main site (landing, signup, login) | https://rahisishabiashara.com |
| A shop's own address | `https://<shop-word>.rahisishabiashara.com` |
| API | https://api.rahisishabiashara.com |
| API (Render's own address, still on) | https://rahisisha-api-staging.onrender.com |
| Website (Vercel's own address) | https://rahisisha-web.vercel.app |

Quick health check: open
`https://api.rahisishabiashara.com/v1/tenants/by-slug/does-not-exist`.
Expected answer: `{"data": null,"error": {"message": "Shop not found"}}`.

## 2. THE BIG PICTURE

```
 Visitor's browser
       |
       |  https://rahisishabiashara.com   (and *.rahisishabiashara.com)
       v
 +-------------+      the website's gate guard (proxy.js) asks:
 |   VERCEL    |      "which shop is this address?"
 |  Next.js    |-------------------------------------------+
 +-------------+                                           |
       |  browser calls (with login cookie)                |
       v                                                   v
 +-------------------------------------------------------------+
 |  RENDER  api.rahisishabiashara.com  (Express API, Node 22)  |
 +-------------------------------------------------------------+
                          |
                          |  DATABASE_URL (rahisisha_user)
                          v
 +-------------------------------------------------------------+
 |  NEON  Postgres, Frankfurt, database "rahisisha"            |
 |  row-level security: 17 policies, FORCE on                  |
 +-------------------------------------------------------------+

 DNS: domain bought at Host Pinnacle, nameservers point to Vercel.
      Vercel DNS holds: apex, wildcard (*), and api -> Render.
```

## 3. WHERE EACH PIECE LIVES

| Piece | Company | Name | Region | Plan |
|---|---|---|---|---|
| Database | Neon | project `rahisisha-staging` (branch `production`) | Frankfurt | Free |
| API | Render | service `rahisisha-api-staging` | Frankfurt | Free |
| Website | Vercel | project `rahisisha-web` | Vercel default | Hobby (free) |
| Domain | Host Pinnacle | `rahisishabiashara.com` | n/a | KES 2,030 / year |
| DNS | Vercel DNS | nameservers `ns1.vercel-dns.com`, `ns2.vercel-dns.com` | n/a | Free |
| Code and robot | GitHub | `sherylochieng/Rahisisha`, Actions CI | n/a | Free |

## 4. SETTINGS EACH PIECE NEEDS (names only, never values)

### Render: service `rahisisha-api-staging`

Build command `npm ci`, start command `npm start`, root directory `apps/api`.

| Name | Value / where it comes from |
|---|---|
| `NODE_VERSION` | `22` (same as CI) |
| `NODE_ENV` | `production` (secure cookies, https only) |
| `JWT_SECRET` | generated by Render. **Different from your laptop's.** |
| `DATABASE_URL` | Neon address for **`rahisisha_user`**, database `rahisisha`, `?sslmode=require`. Direct (not pooled) host. |
| `WEB_ORIGIN` | `https://rahisishabiashara.com` |
| `ROOT_DOMAIN` | `rahisishabiashara.com` (turns on the shop rules: CORS + shop lookup) |
| `COOKIE_DOMAIN` | `.rahisishabiashara.com` (leading dot: the cookie works on every address under it) |
| `PORT` | set by Render itself. Do not add. |

### Vercel: project `rahisisha-web`

Root directory `apps/web`, preset Next.js. Both variables are type **Config**
(not Secret), because `NEXT_PUBLIC_*` values go to the browser anyway.

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.rahisishabiashara.com/v1` (**with `/v1`**) |
| `ROOT_DOMAIN` | `rahisishabiashara.com` |

### Vercel DNS records for `rahisishabiashara.com`

| Type | Name | Points to |
|---|---|---|
| (apex) | `@` | Vercel (automatic) |
| wildcard | `*` | Vercel (automatic, via the `*.rahisishabiashara.com` domain on the project) |
| CNAME | `api` | the target Render shows under Custom Domains |

### Neon

| Item | Value |
|---|---|
| Database | `rahisisha`, owned by `rahisisha_user` |
| App user | `rahisisha_user`: LOGIN only. Not superuser. **Cannot skip row-level security.** |
| Boss user | `neondb_owner`: `rolbypassrls = true`. **Admin tasks only.** |
| Connection | direct (pooling **off**) |

---

## 5. HOW TO DO COMMON JOBS

### Redeploy the API
Push to `main`. Render redeploys by itself. Or Render, then the service,
then **Manual Deploy**.

### Redeploy the website
Push to `main`. Vercel redeploys by itself. After changing a `NEXT_PUBLIC_*`
setting: Vercel, then **Deployments**, then the **⋯**, then **Redeploy**.

### Change a setting on Render
Render, then the service, then **Environment**, then edit, then **Save**.
Render restarts the API (about one minute).

### Change the staging database password
1. Neon, then **Roles**, then `rahisisha_user`, then **Reset password**.
   (Neon's psql `\password` does NOT work. Neon only accepts plain passwords.)
2. Copy the new password straight into your password manager.
3. Rebuild the `DATABASE_URL` and paste it into Render's `DATABASE_URL`.
4. Passwords with symbols like `@` break the address. Neon's generated ones
   are safe.

### Rebuild the staging database from scratch
`scripts/reset-db.sh` refuses any host except localhost, **on purpose**, so
it cannot be pointed at a live database. To rebuild staging, do it by hand
with the boss address in a PowerShell variable (never in a file):

```powershell
# 1. As the boss user: drop and recreate the database, owned by the app user
psql -d "$env:NEON_ADMIN_URL" -c "DROP DATABASE IF EXISTS rahisisha;"
psql -d "$env:NEON_ADMIN_URL" -c "CREATE DATABASE rahisisha OWNER rahisisha_user;"
# (if CREATE says "must be able to SET ROLE":
#  psql -d "$env:NEON_ADMIN_URL" -c "GRANT rahisisha_user TO neondb_owner;")

# 2. As the app user: load the tables and locks, then the demo shops
psql -d "$env:NEON_APP_URL" -v ON_ERROR_STOP=1 -q -f sql/SCHEMA.sql | Out-Null
psql -d "$env:NEON_APP_URL" -v ON_ERROR_STOP=1 -q -f scripts/demo-data.sql | Out-Null

# 3. Check: we want 17
psql -d "$env:NEON_APP_URL" -tAc "SELECT count(*) FROM pg_policies WHERE schemaname='public';"
```

### Prove the locks work on staging
```powershell
cd apps\api
$env:DATABASE_URL = $env:NEON_APP_URL
npm test -- isolation --testTimeout=60000     # needs the demo shops loaded
Remove-Item Env:DATABASE_URL                   # always clean up afterwards
```
`--testTimeout=60000` is needed because Neon is far away and one test's
setup makes many round trips.

---

## 6. FREE-PLAN LIMITS TO REMEMBER

| Piece | Limit | What you will notice |
|---|---|---|
| Render (free) | sleeps after 15 min of no visits | the first visit after a quiet spell can take about a minute |
| Render (free) | monthly instance-hour pool shared by your services | too many always-awake services run it out |
| Neon (free) | database sleeps when idle, small storage | a tiny delay on the first query |
| Vercel (Hobby) | personal / non-commercial use | upgrade before real, paying customers |
| Domain | KES 2,030 per year | **renews 9 Nov 2027. Set a reminder in October.** |

(Check each company's own pricing page. Free plans change.)

## 7. IF SOMETHING BREAKS

| You see | Likely cause | Fix |
|---|---|---|
| Site slow once, then fine | API was asleep | normal on the free plan |
| "We're having trouble right now" | API cannot reach the database | check Neon is up; check `DATABASE_URL` on Render |
| Login says "Tenant not found" | `ROOT_DOMAIN` missing on Render | add it (see section 4) |
| Login works, then you are logged out on the next page | `COOKIE_DOMAIN` missing or lacks the leading dot | set `.rahisishabiashara.com` |
| Browser console: CORS error | `WEB_ORIGIN` / `ROOT_DOMAIN` wrong on Render | fix and save |
| Every API call 404 from the website | `NEXT_PUBLIC_API_URL` lacks `/v1` | fix on Vercel, then **redeploy** |
| "password authentication failed" in Render logs | the password changed in Neon only | update `DATABASE_URL` on Render |
| Shop address shows Vercel "not found" | wildcard domain missing | add `*.rahisishabiashara.com` to the Vercel project |
| A shop can see another shop's data | the app is using the boss user | **stop. Use `rahisisha_user` only, then run the isolation tests** |

## 8. KNOWN GAPS (honest list)

1. **Demo accounts are public.** `scripts/demo-data.sql` shops use a known
   password. Fine for a rehearsal, never for real data.
2. **Reserved shop words.** `api` and `www` are not shops, but signup does not
   refuse them yet. A shop called `api` could not log in at its own address.
3. **Test leftovers.** Test runs against staging left a few extra shops.
4. **SSL warning.** The `pg` library prints a note about `sslmode=require`
   changing meaning in a future version. Not an error. Later: use
   `sslmode=verify-full` explicitly.
5. **First visit after sleep** can be slow or time out on the shop lookup.
6. **Products, Orders, Wallet pages** show "soon" in the sidebar.

---

## DECISIONS WE MADE (and why)

1. **Three free hosts instead of one VPS.** No server to secure or update.
2. **Neon over Render's database.** Render's free database is deleted after
   30 days. Neon's does not expire.
3. **A real domain, not the free addresses.** Browsers refuse to share the
   login cookie between `onrender.com` and `vercel.app`, and shops need their
   own subdomain.
4. **Vercel runs the DNS** (nameservers moved). Vercel needs that to serve a
   wildcard (`*`) for shop addresses.
5. **Shop found from the visitor's address** (the Origin header), not the
   API's own address. See `apps/api/src/utils/getShopSlug.js`.
6. **CORS by rule, not by list.** See `apps/api/src/utils/allowedOrigin.js`.
7. **Pooling off on Neon** to match the laptop. Revisit if connections run out.

## WHERE YOU WILL USE THIS

- Showing your instructor the live site (Task 8 proof)
- Fixing an outage (section 7)
- Moving to paid plans later (section 3 lists exactly what to move)

## TRADEOFFS

+ Free, no server to look after, real HTTPS, real domain
- Five dashboards to keep in your head (this file is the map)
- Free-plan sleep and limits
- Settings spread across three companies

## HOW TO USE

1. Something is wrong? Go to **section 7**.
2. Need a value? **Section 4** lists the names (never the secrets).
3. Rebuilding or rotating? **Section 5**.

---

## EXPLAINED PIECE BY PIECE (real life + where / when / how)

**1. Addresses (section 1) = THE STREET SIGNS.**
Where: every browser tab. When: whenever someone visits. Real life: shop
signs on one street, all under `rahisishabiashara.com`.

**2. The big picture (section 2) = THE MAP OF THE BUILDING.**
The website is the shop window, the API is the shopkeeper, the database is
the stockroom. The window never walks into the stockroom. It only asks the
shopkeeper.

**3. Settings tables (section 4) = THE LIGHT SWITCHES.**
Where: Render and Vercel dashboards. When: after a redeploy, if something
behaves oddly. Each row is one switch and what it should be set to. Missing
one is like leaving a room's light off.

**4. `NEXT_PUBLIC_API_URL` ending in `/v1` = THE FULL STREET ADDRESS.**
Saying only "api.rahisishabiashara.com" is like giving a street without a
house number. The website adds `/login` to it, so it must already end in `/v1`.

**5. `COOKIE_DOMAIN` with a leading dot = A NAME TAG THAT WORKS IN EVERY ROOM.**
Without the dot or the setting, the tag only works in the room that issued
it. With it, it works on the main site and on every shop address.

**6. `neondb_owner` vs `rahisisha_user` = THE BUILDING MANAGER vs A SHOPKEEPER.**
The manager has a master key that opens every door, so the manager builds
the rooms and then **never serves customers**. The shopkeeper has a key to
one room at a time. The app must always be the shopkeeper.

**7. Rebuild commands (section 5) = RESETTING THE STOCKROOM.**
Where: your PowerShell. When: rarely (a bad schema change, a messy demo).
The local script refuses to touch anything but localhost, like a lock that
only opens on your own door.

**8. Free-plan limits (section 6) = THE SMALL PRINT.**
The shopkeeper naps when no one visits. The first customer after a nap waits
a minute. Not broken, just a cheap room.

**9. If something breaks (section 7) = THE FIRST-AID TABLE.**
Look up the symptom, read the cause, apply the fix. Written now, while you
remember, for the day you are tired and it is 2 a.m.

**10. Known gaps (section 8) = THE HONEST NOTE ON THE DOOR.**
Saying what is not finished protects your reputation more than hiding it.
# shops/[id]/page.js (guide)

**File:** `apps/web/src/app/admin/(panel)/shops/[id]/page.js`

## What it is
The address `/admin/shops/<shop id>`.

## What it does
1. Reads the id from the address (`await params`, because Next.js 16 gives it as a promise).
2. If it is not shaped like a UUID, shows the normal "not found" page straight away.
3. Otherwise shows `ShopDetail`.

## Danger
Do not fetch here: the admin cookie is not readable on the server.

## Reuse
Same idea as your product edit page: check the id's shape early, then hand over to a component.

## LINE BY LINE
1. `metadata`: tab title "Shop".
2. `UUID_PATTERN`: the shape of a real id.
3. `const { id } = await params;`: read the id.
4. `if (!UUID_PATTERN.test(id)) notFound();`: reject made-up ids.
5. `return <ShopDetail id={id} />;`

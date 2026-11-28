# shops/page.js (guide)

**File:** `apps/web/src/app/admin/(panel)/shops/page.js`

## What it is
The address `/admin/shops`. Sets the tab title and shows `ShopsBrowser`.

## Why so small
Same pattern as the sign-in page: thin page, working component beside it. It sits in `(panel)`, so the guard and navy menu wrap it automatically.

## Danger
Do not fetch here. The admin cookie cannot be read on the server, so the browser component does the fetching.

## LINE BY LINE
1. `import ShopsBrowser`: the working part, in the same folder.
2. `metadata = { title: 'Shops' }`: tab title.
3. `return <ShopsBrowser />`: draw it.

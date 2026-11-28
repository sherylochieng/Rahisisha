// =============================================================================
// FILE: apps/web/src/app/(authed)/products/[id]/edit/page.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The screen at /products/<id>/edit where an owner corrects a product: a
//   wrong price, a typo in the name, or switching it to draft (issues #6, #7)
//
// WHY IMPORTANT:
// - Without it, the only way to fix a mistake is to ask a developer to touch
//   the database
//
// DANGER:
// - The id comes from the address bar, so ANYONE can type any id. We never
//   trust it: it must look like a real id, and the API only returns a product
//   that belongs to the logged-in shop (the database locks do that). A product
//   from another shop simply comes back as "not found"
//
// WHAT IT SOLVES:
// - Loads one product and gives it to the shared ProductForm in edit mode
// - A wrong, deleted or foreign id shows the friendly not-found page
//
// SYSTEM DESIGN PRINCIPLE: Never trust what is in the address bar
// - The server checks the id, and the API decides what is allowed
//
// RULES:
// - This is a SERVER page: it reads the login cookie and fetches the product
//   before anything reaches the browser (lib/serverApi.js)
// - Next.js 16 gives `params` as a promise, so we `await` it
// - key={product.id} makes the form start fresh for each product, so an old
//   product's values never linger in the boxes
//
// PRACTICAL EXAMPLE:
// - Amina taps Edit on "Red dress". The address becomes
//   /products/3f2c.../edit, the page fetches that dress, and the form opens
//   with "Red dress" and "1500" already typed in
//
// WHERE USED:
// - Opened from the Edit link on each row of (authed)/products/page.js
//
// TRADEOFFS:
// + Reuses the same form as Add, so a fix in one place fixes both
// - The page does not show product images yet (not built)
//
// HOW TO USE:
//   Visit /products/<a real product id>/edit while logged in.
// =============================================================================

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { serverGetOptional } from '../../../../../lib/serverApi';
import ProductForm from '../../../../../components/owner/ProductForm';

export const metadata = {
  title: 'Edit product',
};

// A real id looks like 3f2c1a9e-5b7d-4c1e-9a2b-0d4e6f8a1b2c. Anything else is
// refused before we even ask the API
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params }) {
  // STEP 1: read the id from the address (Next.js 16: params is a promise)
  const { id } = await params;

  // STEP 2: a badly shaped id is "not found", no need to bother the API
  if (!UUID_PATTERN.test(id)) notFound();

  // STEP 3: ask the API for this one product. null means 404 or 400
  const product = await serverGetOptional(`/products/${id}`);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      {/* A way back, in case the owner changes their mind */}
      <Link href="/products" className="text-sm font-medium text-brand-orange hover:underline">
        &larr; Back to products
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Edit product</h1>
        <p className="mt-1 text-sm text-gray-500">
          Change what you need and press Save changes.
        </p>
      </div>

      {/* key: a fresh form for each product, so no old values linger */}
      <ProductForm key={product.id} product={product} />
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// serverGetOptional : asks the API for one product. A "not found" answer comes
//                     back as null, not as a crash. Real life: asking the
//                     shopkeeper for a dress that is not in stock. "We don't
//                     have it" is a normal answer, not a fire
// notFound()        : shows your friendly not-found page
// UUID_PATTERN      : the shape of a real id. Real life: a receipt number has a
//                     fixed shape, so a made-up scribble is refused at the door
// await params      : the id arrives as a promise in Next.js 16. We wait for it
// key={product.id}  : a new form for each product, like a fresh order slip
// product={product} : puts the form into edit mode (boxes pre-filled)
// =============================================================================
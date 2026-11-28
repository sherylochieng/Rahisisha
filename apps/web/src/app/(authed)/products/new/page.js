// =============================================================================
// FILE: apps/web/src/app/(authed)/products/new/page.js
// =============================================================================
//
// WHY THIS FILE EXISTS:
// - The address /products/new needs a page. It shows a title and the Add
//   product form
//
// WHY IMPORTANT:
// - It is the front door for adding a product. The form does the work; this
//   file only puts it on a page with a title and a way back
//
// DANGER (if this file does not exist):
// - /products/new shows "page not found" and the Add product button has
//   nowhere to go
//
// WHAT IT SOLVES:
// - One tidy page: back link, title, short hint, the form
//
// SYSTEM DESIGN PRINCIPLE: Pages arrange, components work
// - This page holds no logic. All checking and sending is in ProductForm
//
// RULES:
// - It sits inside the (authed) folder, so the layout's login check runs first.
//   A logged-out visitor is sent to /login and never sees the form
// - Server Component: no 'use client' here (the form itself is a client
//   component and brings its own)
// - The page never tells the API which shop the product belongs to. The API
//   takes the shop from the login cookie
//
// PRACTICAL EXAMPLE:
// - Amina clicks "Add product" on the Products page, lands here, fills the
//   form and returns to her list
//
// WHERE USED:
// - The "Add product" button on /products
//
// TRADEOFFS:
// + Tiny and easy to read
// - No loading skeleton needed: it fetches nothing
//
// HOW TO USE:
// - Open /products/new while logged in
// =============================================================================

import Link from 'next/link';
import ProductForm from '../../../../components/owner/ProductForm';

// Browser tab title for this page
export const metadata = {
  title: 'Add product',
};

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      {/* A way back, in case the owner changes their mind */}
      <Link href="/products" className="text-sm font-medium text-brand-orange hover:underline">
        &larr; Back to products
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Add product</h1>
        <p className="mt-1 text-sm text-gray-500">
          Give your product a name and a price. You can change the details later.
        </p>
      </div>

      <ProductForm />
    </div>
  );
}

// =============================================================================
// PIECE BY PIECE
// =============================================================================
// import Link             : a link that changes page without a full reload
// import ProductForm      : the form itself. Four "../" climb from
//                           app/(authed)/products/new up to src/, then into
//                           components. Real life: four floors down to the
//                           stockroom
// metadata.title          : the text on the browser tab
// "Back to products" link : like a door marked "Exit" on a form counter
// <ProductForm />         : draws the form. It handles typing, checking and
//                           sending by itself
// =============================================================================